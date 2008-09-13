--[[

UCI Validation Layer - Error handling
(c) 2008 Jo-Philipp Wich <xm@leipzig.freifunk.net>
(c) 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--

local uci = require "luci.model.uci"
local uvl = require "luci.uvl"
local util = require "luci.util"
local string = require "string"

local ipairs, error, type = ipairs, error, type 
local tonumber, unpack = tonumber, unpack


local luci = luci

module "luci.uvl.errors"

ERRCODES = {
	{ 'UCILOAD', 		'Unable to load config "%p": %1' },

	{ 'SCHEME',			'Error in scheme "%p":\n%c' },
	{ 'CONFIG',  		'Error in config "%p":\n%c' },
	{ 'SECTION',		'Error in section "%i" (%I):\n%c' },
	{ 'OPTION',			'Error in option "%i" (%I):\n%c' },
	{ 'REFERENCE',		'Option "%i" has invalid reference specification %1:\n%c' },
	{ 'DEPENDENCY',		'In dependency check for %t "%i":\n%c' },

	{ 'SME_FIND',		'Can not find scheme "%p" in "%1"' },
	{ 'SME_READ',		'Can not access file "%1"' },
	{ 'SME_REQFLD',		'Missing required scheme field "%1" in "%i"' },
	{ 'SME_INVREF',		'Illegal reference "%1" to an anonymous section' },
	{ 'SME_BADREF',		'Malformed reference in "%1"' },
	{ 'SME_BADDEP',		'Malformed dependency specification "%1" in "%i"' },
	{ 'SME_BADVAL',		'Malformed validator specification "%1" in "%i"' },
	{ 'SME_ERRVAL',		'External validator "%1" failed: %2' },
	{ 'SME_VBADPACK',	'Variable "%o" in scheme "%p" references unknown package "%1"' },
	{ 'SME_VBADSECT',	'Variable "%o" in scheme "%p" references unknown section "%1"' },
	{ 'SME_EBADPACK',	'Enum "%v" in scheme "%p" references unknown package "%1"' },
	{ 'SME_EBADSECT',	'Enum "%v" in scheme "%p" references unknown section "%1"' },
	{ 'SME_EBADOPT',	'Enum "%v" in scheme "%p" references unknown option "%1"'  },
	{ 'SME_EBADTYPE',	'Enum "%v" in scheme "%p" references non-enum option "%I"' },
	{ 'SME_EBADDEF',	'Enum "%v" in scheme "%p" redeclares the default value of "%I"' },

	{ 'SECT_UNKNOWN',	'Section "%i" (%I) not found in scheme' },
	{ 'SECT_REQUIRED',	'Required section "%p.%S" not found in config' },
	{ 'SECT_UNIQUE',	'Unique section "%p.%S" occurs multiple times in config' },
	{ 'SECT_NAMED', 	'The section of type "%p.%S" is stored anonymously in config but must be named' },
	{ 'SECT_NOTFOUND',	'Section "%p.%s" not found in config' },

	{ 'OPT_UNKNOWN',	'Option "%i" (%I) not found in scheme' },
	{ 'OPT_REQUIRED',	'Required option "%i" has no value' },
	{ 'OPT_BADVALUE', 	'Value "%1" of option "%i" is not defined in enum %2' },
	{ 'OPT_INVVALUE',	'Value "%1" of option "%i" does not validate as datatype "%2"' },
	{ 'OPT_NOTLIST',	'Option "%i" is defined as list but stored as plain value' },
	{ 'OPT_DATATYPE',	'Option "%i" has unknown datatype "%1"' },
	{ 'OPT_NOTFOUND',	'Option "%p.%s.%o" not found in config' },

	{ 'DEP_NOTEQUAL',	'Dependency (%1) failed:\nOption "%i" is not eqal "%2"' },
	{ 'DEP_NOVALUE',	'Dependency (%1) failed:\nOption "%i" has no value' },
	{ 'DEP_NOTVALID',	'Dependency (%1) failed:\n%c' },
	{ 'DEP_RECURSIVE',	'Recursive dependency for option "%i" detected' },
	{ 'DEP_BADENUM',	'In dependency check for enum value "%i":\n%c' }
}

-- build error constants and instance constructors
for i, v in ipairs(ERRCODES) do
	_M[v[1]] = function(...)
		return error(i, ...)
	end

	_M['ERR_'..v[1]] = i
end


function i18n(key, def)
	if luci.i18n then
		return luci.i18n.translate(key,def)
	else
		return def
	end
end


error = util.class()

function error.__init__(self, code, pso, args)

	self.code = code
	self.args = ( type(args) == "table" and args or { args } )

	if util.instanceof( pso, uvl.uvlitem ) then
		self.stype = pso.sref[2]
		self.package, self.section, self.option, self.value = unpack(pso.cref)
		self.object = pso
		self.value  = self.value or ( pso.value and pso:value() )
	else
		pso = ( type(pso) == "table" and pso or { pso } )

		if pso[2] then
			local uci = uci.cursor()
			self.stype = uci:get(pso[1], pso[2]) or pso[2]
		end

		self.package, self.section, self.option, self.value = unpack(pso)
	end
end

function error.child(self, err)
	if not self.childs then
		self.childs = { err }
	else
		self.childs[#self.childs+1] = err
	end
	return self
end

function error.string(self,pad)
	pad = pad or "  "

	local str = i18n(
		'uvl_err_%s' % string.lower(ERRCODES[self.code][1]),
		ERRCODES[self.code][2]
	)
		:gsub("\n", "\n"..pad)
		:gsub("%%i", self:cid())
		:gsub("%%I", self:sid())
		:gsub("%%p", self.package or '(nil)')
		:gsub("%%s", self.section or '(nil)')
		:gsub("%%S", self.stype   or '(nil)')
		:gsub("%%o", self.option  or '(nil)')
		:gsub("%%v", self.value   or '(nil)')
		:gsub("%%t", self.object and self.object:type()  or '(nil)' )
		:gsub("%%T", self.object and self.object:title() or '(nil)' )
		:gsub("%%([1-9])", function(n) return self.args[tonumber(n)] or '(nil)' end)
		:gsub("%%c",
			function()
				local s = ""
				for _, err in ipairs(self.childs or {}) do
					s = s .. err:string(pad.."  ") .. "\n" .. pad
				end
				return s
			end
		)

	return (str:gsub("%s+$",""))
end

function error.cid(self)
	return self.object and self.object:cid() or self.package ..
		( self.section and '.' .. self.section or '' ) ..
		( self.option  and '.' .. self.option  or '' ) ..
		( self.value   and '.' .. self.value   or '' )
end

function error.sid(self)
	return self.object and self.object:sid() or self.package ..
		( self.stype   and '.' .. self.stype   or '' ) ..
		( self.option  and '.' .. self.option  or '' ) ..
		( self.value   and '.' .. self.value   or '' )
end

function error.is(self, code)
	if self.code == code then
		return true
	elseif self.childs then
		for _, c in ipairs(self.childs) do
			if c:is(code) then
				return true
			end
		end
	end
	return false
end
