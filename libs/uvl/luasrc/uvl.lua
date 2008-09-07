--[[

UCI Validation Layer - Main Library
(c) 2008 Jo-Philipp Wich <xm@leipzig.freifunk.net>
(c) 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--


--- UVL - UCI Validation Layer
-- @class	module
-- @cstyle	instance

module( "luci.uvl", package.seeall )

require("luci.fs")
require("luci.util")
require("luci.model.uci")
require("luci.uvl.errors")
require("luci.uvl.datatypes")
require("luci.uvl.validation")
require("luci.uvl.dependencies")


TYPE_SCHEME   = 0x00
TYPE_CONFIG   = 0x01
TYPE_SECTION  = 0x02
TYPE_OPTION   = 0x03
TYPE_ENUM     = 0x04

--- Boolean; default true;
-- treat sections found in config but not in scheme as error
STRICT_UNKNOWN_SECTIONS    = true

--- Boolean; default true;
-- treat options found in config but not in scheme as error
STRICT_UNKNOWN_OPTIONS     = true

--- Boolean; default true;
-- treat failed external validators as error
STRICT_EXTERNAL_VALIDATORS = true

--- Boolean; default true;
-- treat list values stored as options like errors
STRICT_LIST_TYPE           = true


local default_schemedir = "/lib/uci/schema"
local default_savedir = "/tmp/.uvl"
local ERR = luci.uvl.errors


--- Object constructor
-- @class			function
-- @name			UVL
-- @param schemedir	Path to the scheme directory (optional)
-- @return			Instance object
UVL = luci.util.class()

function UVL.__init__( self, schemedir )
	self.schemedir	= schemedir or default_schemedir
	self.packages	= { }
	self.beenthere  = { }
	self.depseen    = { }
	self.uci		= luci.model.uci
	self.err		= luci.uvl.errors
	self.dep		= luci.uvl.dependencies
	self.datatypes  = luci.uvl.datatypes
end


--- Parse given scheme and return the scheme tree.
-- @param scheme	Name of the scheme to parse
-- @return			Table containing the parsed scheme or nil on error
-- @return			String containing the reason for errors (if any)
function UVL.get_scheme( self, scheme )
	if not self.packages[scheme] then
		local ok, err = self:read_scheme( scheme )
		if not ok then
			return nil, err
		end
	end
	return self.packages[scheme], nil
end

--- Validate given configuration, section or option.
-- @param config	Name of the configuration to validate
-- @param section	Name of the section to validate (optional)
-- @param option	Name of the option to validate (optional)
-- @return			Boolean indicating whether the given config validates
-- @return			String containing the reason for errors (if any)
function UVL.validate( self, config, section, option )
	if config and section and option then
		return self:validate_option( config, section, option )
	elseif config and section then
		return self:validate_section( config, section )
	elseif config then
		return self:validate_config( config )
	end
end

--- Validate given configuration.
-- @param config	Name of the configuration to validate
-- @return			Boolean indicating whether the given config validates
-- @return			String containing the reason for errors (if any)
function UVL.validate_config( self, config, uci )

	if not self.packages[config] then
		local ok, err = self:read_scheme(config)
		if not ok then
			return false, err
		end
	end

	local co = luci.uvl.config( self, uci or config, uci and config )
	local sc = { }

	self.beenthere = { }
	self.depseen   = { }

	if not co:config() then
		return false, co:errors()
	end

	local function _uci_foreach( type, func )
		for k, v in pairs(co:config()) do
			if v['.type'] == type then
				sc[type] = sc[type] + 1
				local ok, err = func( k, v )
				if not ok then co:error(err) end
			end
		end
	end

	for k, v in pairs( self.packages[config].sections ) do
		sc[k] = 0
		_uci_foreach( k,
			function(s)
				return self:_validate_section( co:section(s) )
			end
		)
	end

	if STRICT_UNKNOWN_SECTIONS then
		for k, v in pairs(co:config()) do
			local so = co:section(k)
			if not self.beenthere[so:cid()] then
				co:error(ERR.SECT_UNKNOWN(so))
			end
		end
	end

	for _, k in ipairs(luci.util.keys(sc)) do
		local so = co:section(k)
		if so:scheme('required') and sc[k] == 0 then
			co:error(ERR.SECT_REQUIRED(so))
		elseif so:scheme('unique') and sc[k] > 1 then
			co:error(ERR.SECT_UNIQUE(so))
		end
	end

	return co:ok(), co:errors()
end

--- Validate given config section.
-- @param config	Name of the configuration to validate
-- @param section	Name of the section to validate
-- @return			Boolean indicating whether the given config validates
-- @return			String containing the reason for errors (if any)
function UVL.validate_section( self, config, section, uci )

	if not self.packages[config] then
		local ok, err = self:read_scheme( config )
		if not ok then
			return false, err
		end
	end

	local co = luci.uvl.config( self, uci or config, uci and config )
	local so = co:section( section )

	self.beenthere = { }
	self.depseen   = { }

	if not co:config() then
		return false, co:errors()
	end

	if so:config() then
		return self:_validate_section( so )
	else
		return false, ERR.SECT_NOTFOUND(so)
	end
end

--- Validate given config option.
-- @param config	Name of the configuration to validate
-- @param section	Name of the section to validate
-- @param option	Name of the option to validate
-- @return			Boolean indicating whether the given config validates
-- @return			String containing the reason for errors (if any)
function UVL.validate_option( self, config, section, option, uci )

	if not self.packages[config] then
		local ok, err = self:read_scheme( config )
		if not ok then
			return false, err
		end
	end

	local co = luci.uvl.config( self, uci or config, uci and config )
	local so = co:section( section )
	local oo = so:option( option )

	if not co:config() then
		return false, co:errors()
	end

	if so:config() and oo:config() then
		return self:_validate_option( oo )
	else
		return false, ERR.OPT_NOTFOUND(oo)
	end
end


function UVL._validate_section( self, section )

	self.beenthere[section:cid()] = true

	if section:config() then
		if section:scheme('named') == true and
		   section:config('.anonymous') == true
		then
			return false, ERR.SECT_NAMED(section)
		end

		for _, v in ipairs(section:variables()) do
			local ok, err = self:_validate_option( v )
			if not ok and (
				v:scheme('required') or v:scheme('type') == "enum" or (
					not err:is(ERR.ERR_DEP_NOTEQUAL) and
					not err:is(ERR.ERR_DEP_NOVALUE)
				)
			) then
				section:error(err)
			end
		end

		local ok, err = luci.uvl.dependencies.check( self, section )
		if not ok then
			section:error(err)
		end
	else
		return false, ERR.SECT_NOTFOUND(section)
	end

	if STRICT_UNKNOWN_OPTIONS and not section:scheme('dynamic') then
		for k, v in pairs(section:config()) do
			local oo = section:option(k)
			if k:sub(1,1) ~= "." and not self.beenthere[oo:cid()] then
				section:error(ERR.OPT_UNKNOWN(oo))
			end
		end
	end

	return section:ok(), section:errors()
end

function UVL._validate_option( self, option, nodeps )

	self.beenthere[option:cid()] = true

	if not option:scheme() and not option:parent():scheme('dynamic') then
		if STRICT_UNKNOWN_OPTIONS then
			return false, option:error(ERR.OPT_UNKNOWN(option))
		else
			return true
		end

	elseif option:scheme() then
		if option:scheme('required') and not option:value() then
			return false, option:error(ERR.OPT_REQUIRED(option))

		elseif option:value() then
			local val = option:value()

			if option:scheme('type') == "reference" or
			   option:scheme('type') == "enum"
			then
				local scheme_values = option:scheme('values') or { }
				local config_values = ( type(val) == "table" and val or { val } )
				for _, v in ipairs(config_values) do
					if not scheme_values[v] then
						return false, option:error( ERR.OPT_BADVALUE(
							option, { v, luci.util.serialize_data(
								luci.util.keys(scheme_values)
							) }
						) )
					end
				end
			elseif option:scheme('type') == "list" then
				if type(val) ~= "table" and STRICT_LIST_TYPE then
					return false, option:error(ERR.OPT_NOTLIST(option))
				end
			end

			if option:scheme('datatype') then
				local dt = option:scheme('datatype')

				if self.datatypes[dt] then
					val = ( type(val) == "table" and val or { val } )
					for i, v in ipairs(val) do
						if not self.datatypes[dt]( v ) then
							return false, option:error(
								ERR.OPT_INVVALUE(option, { v, dt })
							)
						end
					end
				else
					return false, option:error(ERR.OPT_DATATYPE(option, dt))
				end
			end
		end

		if not nodeps then
			local ok, err = luci.uvl.dependencies.check( self, option )
			if not ok then
				option:error(err)
			end
		end

		local ok, err = luci.uvl.validation.check( self, option )
		if not ok and STRICT_EXTERNAL_VALIDATORS then
			return false, option:error(err)
		end
	end

	return option:ok(), option:errors()
end

--- Find all parts of given scheme and construct validation tree.
-- This is normally done on demand, so you don't have to call this function
-- by yourself.
-- @param scheme	Name of the scheme to parse
-- @param alias		Create an alias for the loaded scheme
function UVL.read_scheme( self, scheme, alias )

	local so = luci.uvl.scheme( self, scheme )
	local bc = "%s/bytecode/%s.lua" %{ self.schemedir, scheme }

	if not luci.fs.access(bc) then
		local schemes = { }
		local files = luci.fs.glob(self.schemedir .. '/*/' .. scheme)

		if files then
			for i, file in ipairs( files ) do
				if not luci.fs.access(file) then
					return false, so:error(ERR.SME_READ(so,file))
				end

				local uci = luci.model.uci.cursor( luci.fs.dirname(file), default_savedir )

				local sd, err = uci:get_all( luci.fs.basename(file) )

				if not sd then
					return false, ERR.UCILOAD(so, err)
				end

				table.insert( schemes, sd )
			end

			local ok, err = self:_read_scheme_parts( so, schemes )
			if ok and alias then self.packages[alias] = self.packages[scheme] end
			return ok, err
		else
			return false, so:error(ERR.SME_FIND(so, self.schemedir))
		end
	else
		local sc = loadfile(bc)
		if sc then
			self.packages[scheme] = sc()
			return true
		else
			return false, so:error(ERR.SME_READ(so,bc))
		end
	end
end

-- Process all given parts and construct validation tree
function UVL._read_scheme_parts( self, scheme, schemes )

	-- helper function to check for required fields
	local function _req( t, n, c, r )
		for i, v in ipairs(r) do
			if not c[v] then
				local p, o = scheme:sid(), nil

				if t == TYPE_SECTION then
					o = section( scheme, nil, p, n )
				elseif t == TYPE_OPTION then
					o = option( scheme, nil, p, '(nil)', n )
				elseif t == TYPE_ENUM then
					o = enum( scheme, nil, p, '(nil)', '(nil)', n )
				end

				return false, ERR.SME_REQFLD(o,v)
			end
		end
		return true
	end

	-- helper function to validate references
	local function _ref( c, t )
		local k, n
		if c == TYPE_SECTION then
			k = "package"
			n = 1
		elseif c == TYPE_OPTION then
			k = "section"
			n = 2
		elseif c == TYPE_ENUM then
			k = "variable"
			n = 3
		end

		local r = luci.util.split( t[k], "." )
		r[1] = ( #r[1] > 0 and r[1] or scheme:sid() )

		if #r ~= n then
			return false, ERR.SME_BADREF(scheme, k)
		end

		return r
	end

	-- helper function to read bools
	local function _bool( v )
		return ( v == "true" or v == "yes" or v == "on" or v == "1" )
	end


	local ok, err

	-- Step 0: get package meta information
	for i, conf in ipairs( schemes ) do
		for k, v in pairs( conf ) do
			if v['.type'] == 'package' then
				self.packages[scheme:sid()] =
					self.packages[scheme:sid()] or {
						["name"]      = scheme:sid();
						["sections"]  = { };
						["variables"] = { };
					}

				for k, v2 in pairs(v) do
					if k == "title" or k == "description" then
						self.packages[scheme:sid()][k] = v2
					end
				end
			end
		end
	end

	-- Step 1: get all sections
	for i, conf in ipairs( schemes ) do
		for k, v in pairs( conf ) do
			if v['.type'] == 'section' then

				ok, err = _req( TYPE_SECTION, k, v, { "name", "package" } )
				if err then return false, scheme:error(err) end

				local r, err = _ref( TYPE_SECTION, v )
				if err then return false, scheme:error(err) end

				self.packages[r[1]] =
					self.packages[r[1]] or {
						["name"]      = r[1];
						["sections"]  = { };
						["variables"] = { };
					}

				local p = self.packages[r[1]]
					  p.sections[v.name]  = p.sections[v.name]  or { }
					  p.variables[v.name] = p.variables[v.name] or { }

				local s  = p.sections[v.name]
				local so = scheme:section(v.name)

				for k, v2 in pairs(v) do
					if k ~= "name" and k ~= "package" and k:sub(1,1) ~= "." then
						if k == "depends" then
							s.depends = self:_read_dependency( v2, s.depends )
							if not s.depends then
								return false, scheme:error(
									ERR.SME_BADDEP(so, luci.util.serialize_data(s.depends))
								)
							end
						elseif k == "dynamic" or k == "unique" or
						       k == "required" or k == "named"
						then
							s[k] = _bool(v2)
						else
							s[k] = v2
						end
					end
				end

				s.dynamic  = s.dynamic  or false
				s.unique   = s.unique   or false
				s.required = s.required or false
				s.named    = s.named    or false
			end
		end
	end

	-- Step 2: get all variables
	for i, conf in ipairs( schemes ) do
		for k, v in pairs( conf ) do
			if v['.type'] == "variable" then

				ok, err = _req( TYPE_OPTION, k, v, { "name", "section" } )
				if err then return false, scheme:error(err) end

				local r, err = _ref( TYPE_OPTION, v )
				if err then return false, scheme:error(err) end

				local p = self.packages[r[1]]
				if not p then
					return false, scheme:error(
						ERR.SME_VBADPACK({scheme:sid(), '', v.name}, r[1])
					)
				end

				local s = p.variables[r[2]]
				if not s then
					return false, scheme:error(
						ERR.SME_VBADSECT({scheme:sid(), '', v.name}, r[2])
					)
				end

				s[v.name] = s[v.name] or { }

				local t  = s[v.name]
				local so = scheme:section(r[2])
				local to = so:option(v.name)

				for k, v2 in pairs(v) do
					if k ~= "name" and k ~= "section" and k:sub(1,1) ~= "." then
						if k == "depends" then
							t.depends = self:_read_dependency( v2, t.depends )
							if not t.depends then
								return false, scheme:error(so:error(
									ERR.SME_BADDEP(to, luci.util.serialize_data(v2))
								))
							end
						elseif k == "validator" then
							t.validators = self:_read_validator( v2, t.validators )
							if not t.validators then
								return false, scheme:error(so:error(
									ERR.SME_BADVAL(to, luci.util.serialize_data(v2))
								))
							end
						elseif k == "valueof" then
							local values, err = self:_read_reference( v2 )
							if err then
								return false, scheme:error(so:error(
									ERR.REFERENCE(to, luci.util.serialize_data(v2)):child(err)
								))
							end
							t.type   = "reference"
							t.values = values
						elseif k == "required" then
							t[k] = _bool(v2)
						else
							t[k] = t[k] or v2
						end
					end
				end

				t.type     = t.type     or "variable"
				t.datatype = t.datatype or "string"
				t.required = t.required or false
			end
		end
	end

	-- Step 3: get all enums
	for i, conf in ipairs( schemes ) do
		for k, v in pairs( conf ) do
			if v['.type'] == "enum" then

				ok, err = _req( TYPE_ENUM, k, v, { "value", "variable" } )
				if err then return false, scheme:error(err) end

				local r, err = _ref( TYPE_ENUM, v )
				if err then return false, scheme:error(err) end

				local p = self.packages[r[1]]
				if not p then
					return false, scheme:error(
						ERR.SME_EBADPACK({scheme:sid(), '', '', v.value}, r[1])
					)
				end

				local s = p.variables[r[2]]
				if not s then
					return false, scheme:error(
						ERR.SME_EBADSECT({scheme:sid(), '', '', v.value}, r[2])
					)
				end

				local t = s[r[3]]
				if not t then
					return false, scheme:error(
						ERR.SME_EBADOPT({scheme:sid(), '', '', v.value}, r[3])
					)
				end


				local so = scheme:section(r[2])
				local oo = so:option(r[3])
				local eo = oo:enum(v.value)

				if t.type ~= "enum" and t.type ~= "reference" then
					return false, scheme:error(ERR.SME_EBADTYPE(eo))
				end

				if not t.values then
					t.values = { [v.value] = v.title or v.value }
				else
					t.values[v.value] = v.title or v.value
				end

				if not t.enum_depends then
					t.enum_depends = { }
				end

				if v.default then
					if t.default then
						return false, scheme:error(ERR.SME_EBADDEF(eo))
					end
					t.default = v.value
				end

				if v.depends then
					t.enum_depends[v.value] = self:_read_dependency(
						v.depends, t.enum_depends[v.value]
					)

					if not t.enum_depends[v.value] then
						return false, scheme:error(so:error(oo:error(
							ERR.SME_BADDEP(eo, luci.util.serialize_data(v.depends))
						)))
					end
				end
			end
		end
	end

	return self
end

-- Read a dependency specification
function UVL._read_dependency( self, values, deps )
	local expr = "%$?[a-zA-Z0-9_]+"
	if values then
		values = ( type(values) == "table" and values or { values } )
		for _, value in ipairs(values) do
			local parts     = luci.util.split( value, "%s*,%s*", nil, true )
			local condition = { }
			for i, val in ipairs(parts) do
				local k, v = unpack(luci.util.split(val, "%s*=%s*", nil, true))

				if k and (
					k:match("^"..expr.."%."..expr.."%."..expr.."$") or
					k:match("^"..expr.."%."..expr.."$") or
					k:match("^"..expr.."$")
				) then
					condition[k] = v or true
				else
					return nil
				end
			end

			if not deps then
				deps = { condition }
			else
				table.insert( deps, condition )
			end
		end
	end

	return deps
end

-- Read a validator specification
function UVL._read_validator( self, values, validators )
	if values then
		values = ( type(values) == "table" and values or { values } )
		for _, value in ipairs(values) do
			local validator

			if value:match("^exec:") then
				validator = value:gsub("^exec:","")
			elseif value:match("^lua:") then
				validator = self:_resolve_function( (value:gsub("^lua:","") ) )
			elseif value:match("^regexp:") then
				local pattern = value:gsub("^regexp:","")
				validator = function( type, dtype, pack, sect, optn, ... )
					local values = { ... }
					for _, v in ipairs(values) do
						local ok, match =
							luci.util.copcall( string.match, v, pattern )

						if not ok then
							return false, match
						elseif not match then
							return false,
								'Value "%s" does not match pattern "%s"' % {
									v, pattern
								}
						end
					end
					return true
				end
			end

			if validator then
				if not validators then
					validators = { validator }
				else
					table.insert( validators, validator )
				end
			else
				return nil
			end
		end

		return validators
	end
end

-- Read a reference specification (XXX: We should validate external configs too...)
function UVL._read_reference( self, values )
	local val = { }
	values = ( type(values) == "table" and values or { values } )

	for _, value in ipairs(values) do
		local ref = luci.util.split(value, ".")

		if #ref == 2 or #ref == 3 then
			local co = luci.uvl.config( self, ref[1] )
			if not co:config() then return false, co:errors() end

			for k, v in pairs(co:config()) do
				if v['.type'] == ref[2] then
					if #ref == 2 then
						if v['.anonymous'] == true then
							return false, ERR.SME_INVREF('', value)
						end
						val[k] = k	-- XXX: title/description would be nice
					elseif v[ref[3]] then
						val[v[ref[3]]] = v[ref[3]]  -- XXX: dito
					end
				end
			end
		else
			return false, ERR.SME_BADREF('', value)
		end
	end

	return val, nil
end

-- Resolve given path
function UVL._resolve_function( self, value )
	local path = luci.util.split(value, ".")

	for i=1, #path-1 do
		local stat, mod = luci.util.copcall(
			require, table.concat(path, ".", 1, i)
		)

		if stat and mod then
			for j=i+1, #path-1 do
				if not type(mod) == "table" then
					break
				end
				mod = mod[path[j]]
				if not mod then
					break
				end
			end
			mod = type(mod) == "table" and mod[path[#path]] or nil
			if type(mod) == "function" then
				return mod
			end
		end
	end
end


--- Object representation of an uvl item - base class.
uvlitem = luci.util.class()

function uvlitem.cid(self)
	if #self.cref == 1 then
		return self.cref[1]
	else
		local r = { unpack(self.cref) }
		local c = self.c
		if c and c[r[2]] and c[r[2]]['.anonymous'] and c[r[2]]['.index'] then
			r[2] = '@' .. c[r[2]]['.type'] ..
			       '[' .. tostring(c[r[2]]['.index']) .. ']'
		end
		return table.concat( r, '.' )
	end
end

function uvlitem.sid(self)
	return table.concat( self.sref, '.' )
end

function uvlitem.scheme(self, opt)
	local s

	if #self.sref == 4 or #self.sref == 3 then
		s = self.s and self.s.packages
		s = s      and s[self.sref[1]]
		s = s      and s.variables
		s = s      and s[self.sref[2]]
		s = s      and s[self.sref[3]]
	elseif #self.sref == 2 then
		s = self.s and self.s.packages
		s = s      and s[self.sref[1]]
		s = s      and s.sections
		s = s      and s[self.sref[2]]
	else
		s = self.s and self.s.packages
		s = s      and s[self.sref[1]]
	end

	if s and opt then
		return s[opt]
	elseif s then
		return s
	end
end

function uvlitem.config(self, opt)
	local c

	if #self.cref == 4 or #self.cref == 3 then
		c = self.c and self.c[self.cref[2]] or nil
		c = c      and c[self.cref[3]]      or nil
	elseif #self.cref == 2 then
		c = self.c and self.c[self.cref[2]] or nil
	else
		c = self.c
	end

	if c and opt then
		return c[opt]
	elseif c then
		return c
	end
end

function uvlitem.title(self)
	return self:scheme() and self:scheme('title') or
		self.cref[3] or self.cref[2] or self.cref[1]
end

function uvlitem.type(self)
	if self.t == luci.uvl.TYPE_CONFIG then
		return 'config'
	elseif self.t == luci.uvl.TYPE_SECTION then
		return 'section'
	elseif self.t == luci.uvl.TYPE_OPTION then
		return 'option'
	elseif self.t == luci.uvl.TYPE_ENUM then
		return 'enum'
	end
end

function uvlitem.error(self, ...)
	if not self.e then
		local errconst = { ERR.CONFIG, ERR.SECTION, ERR.OPTION, ERR.OPTION }
		self.e = errconst[#self.cref]( self )
	end

	return self.e:child( ... )
end

function uvlitem.errors(self)
	return self.e
end

function uvlitem.ok(self)
	return not self:errors()
end

function uvlitem.parent(self)
	if self.p then
		return self.p
	elseif #self.cref == 3 or #self.cref == 4 then
		return luci.uvl.section( self.s, self.c, self.cref[1], self.cref[2] )
	elseif #self.cref == 2 then
		return luci.uvl.config( self.s, self.c, self.cref[1] )
	else
		return nil
	end
end

function uvlitem._loadconf(self, co, c)
	if not co then
		local uci, err = luci.model.uci.cursor(), nil
		co, err = uci:get_all(c)

		if err then
			self:error(ERR.UCILOAD(self, err))
		end
	end
	return co
end


--- Object representation of a scheme.
-- @class	scheme
-- @cstyle	instance
-- @name	luci.uvl.scheme

--- Scheme instance constructor.
-- @class			function
-- @name			scheme
-- @param scheme	Scheme instance
-- @param co		Configuration data
-- @param c			Configuration name
-- @return			Config instance
scheme = luci.util.class(uvlitem)

function scheme.__init__(self, scheme, co, c)
	if not c then
		c, co = co, nil
	end

	self.cref = { c }
	self.sref = { c }
	self.c    = self:_loadconf(co, c)
	self.s    = scheme
	self.t    = luci.uvl.TYPE_SCHEME
end

--- Add an error to scheme.
-- @return	Scheme error context
function scheme.error(self, ...)
	if not self.e then self.e = ERR.SCHEME( self ) end
	return self.e:child( ... )
end

--- Get an associated config object.
-- @return	Config instance
function scheme.config(self)
	local co = luci.uvl.config( self.s, self.cref[1] )
	      co.p = self

	return co
end

--- Get all section objects associated with this scheme.
-- @return	Table containing all associated luci.uvl.section instances
function scheme.sections(self)
	local v = { }
	if self.s.packages[self.sref[1]].sections then
		for o, _ in pairs( self.s.packages[self.sref[1]].sections ) do
			table.insert( v, luci.uvl.option(
				self.s, self.c, self.cref[1], self.cref[2], o
			) )
		end
	end
	return v
end

--- Get an associated section object.
-- @param s	Section to select
-- @return	Section instance
function scheme.section(self, s)
	local so = luci.uvl.section( self.s, self.c, self.cref[1], s )
	      so.p = self

	return so
end


--- Object representation of a config.
-- @class	config
-- @cstyle	instance
-- @name	luci.uvl.config

--- Config instance constructor.
-- @class			function
-- @name			config
-- @param scheme	Scheme instance
-- @param co		Configuration data
-- @param c			Configuration name
-- @return			Config instance
config = luci.util.class(uvlitem)

function config.__init__(self, scheme, co, c)
	if not c then
		c, co = co, nil
	end

	self.cref = { c }
	self.sref = { c }
	self.c    = self:_loadconf(co, c)
	self.s    = scheme
	self.t    = luci.uvl.TYPE_CONFIG
end

--- Get all section objects associated with this config.
-- @return	Table containing all associated luci.uvl.section instances
function config.sections(self)
	local v = { }
	if self.s.packages[self.sref[1]].sections then
		for o, _ in pairs( self.s.packages[self.sref[1]].sections ) do
			table.insert( v, luci.uvl.option(
				self.s, self.c, self.cref[1], self.cref[2], o
			) )
		end
	end
	return v
end

--- Get an associated section object.
-- @param s	Section to select
-- @return	Section instance
function config.section(self, s)
	local so = luci.uvl.section( self.s, self.c, self.cref[1], s )
	      so.p = self

	return so
end


--- Object representation of a scheme/config section.
-- @class	module
-- @cstyle	instance
-- @name	luci.uvl.section

--- Section instance constructor.
-- @class			function
-- @name			section
-- @param scheme	Scheme instance
-- @param co		Configuration data
-- @param c			Configuration name
-- @param s			Section name
-- @return			Section instance
section = luci.util.class(uvlitem)

function section.__init__(self, scheme, co, c, s)
	self.cref = { c, s }
	self.sref = { c, co and co[s] and co[s]['.type'] or s }
	self.c    = self:_loadconf(co, c)
	self.s    = scheme
	self.t    = luci.uvl.TYPE_SECTION
end

--- Get all option objects associated with this section.
-- @return	Table containing all associated luci.uvl.option instances
function section.variables(self)
	local v = { }
	if self.s.packages[self.sref[1]].variables[self.sref[2]] then
		for o, _ in pairs(
			self.s.packages[self.sref[1]].variables[self.sref[2]]
		) do
			table.insert( v, luci.uvl.option(
				self.s, self.c, self.cref[1], self.cref[2], o
			) )
		end
	end
	return v
end

--- Get an associated option object.
-- @param o	Option to select
-- @return	Option instance
function section.option(self, o)
	local oo = luci.uvl.option( self.s, self.c, self.cref[1], self.cref[2], o )
	      oo.p = self

	return oo
end


--- Object representation of a scheme/config option.
-- @class	module
-- @cstyle	instance
-- @name	luci.uvl.option

--- Section instance constructor.
-- @class			function
-- @name			option
-- @param scheme	Scheme instance
-- @param co		Configuration data
-- @param c			Configuration name
-- @param s			Section name
-- @param o			Option name
-- @return			Option instance
option = luci.util.class(uvlitem)

function option.__init__(self, scheme, co, c, s, o)
	self.cref = { c, s, o }
	self.sref = { c, co and co[s] and co[s]['.type'] or s, o }
	self.c    = self:_loadconf(co, c)
	self.s    = scheme
	self.t    = luci.uvl.TYPE_OPTION
end

--- Get the value of this option.
-- @return	The associated configuration value
function option.value(self)
	local v = self:config() or self:scheme('default')
	if v and self:scheme('multival') then
		v = luci.util.split( v, "%s+", nil, true )
	end
	return v
end

--- Get the associated section information in scheme.
-- @return	Table containing the scheme properties
function option.section(self)
	return self.s.packages[self.sref[1]].sections[self.sref[2]]
end

--- Construct an enum object instance from given or default value.
-- @param v	Value to select
-- @return	Enum instance for selected value
function option.enum(self, val)
	return enum(
		self.s, self.c,
		self.cref[1], self.cref[2], self.cref[3],
		val or self:value()
	)
end


--- Object representation of a enum value.
-- @class	module
-- @cstyle	instance
-- @name	luci.uvl.enum

--- Section instance constructor.
-- @class			function
-- @name			enum
-- @param scheme	Scheme instance
-- @param co		Configuration data
-- @param c			Configuration name
-- @param s			Section name
-- @param o			Enum name
-- @param v			Enum value
-- @return			Enum value instance
enum = luci.util.class(option)

function enum.__init__(self, scheme, co, c, s, o, v)
	self.cref = { c, s, o, v }
	self.sref = { c, co and co[s] and co[s]['.type'] or s, o, v }
	self.c    = self:_loadconf(co, c)
	self.s    = scheme
	self.t    = luci.uvl.TYPE_ENUM
end
