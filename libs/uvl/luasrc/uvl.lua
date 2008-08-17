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

module( "luci.uvl", package.seeall )

require("luci.fs")
require("luci.util")
require("luci.model.uci")
require("luci.uvl.datatypes")
--require("luci.uvl.validation")
require("luci.uvl.dependencies")

TYPE_SECTION  = 0x01
TYPE_VARIABLE = 0x02
TYPE_ENUM     = 0x03

STRICT_UNKNOWN_SECTIONS = true
STRICT_UNKNOWN_OPTIONS  = true


local default_schemedir = "/etc/scheme"

local function _assert( condition, fmt, ... )
	if not condition then
		return assert( nil, string.format( fmt, ... ) )
	else
		return condition
	end
end

UVL = luci.util.class()

function UVL.__init__( self, schemedir )
	self.schemedir	= schemedir or default_schemedir
	self.packages	= { }
	self.beenthere  = { }
	self.uci		= luci.model.uci
	self.datatypes  = luci.uvl.datatypes
end

function UVL._keys( self, tbl )
	local keys = { }
	if tbl then
		for k, _ in luci.util.kspairs(tbl) do
			table.insert( keys, k )
		end
	end
	return keys
end


--- Validate given configuration.
-- @param config	Name of the configuration to validate
-- @param scheme	Scheme to validate against (optional)
-- @return			Boolean indicating weather the given config validates
-- @return			String containing the reason for errors (if any)
function UVL.validate( self, config )

	self.uci.load_config( config )
	self.beenthere = { }

	local co = self.uci.get_all( config )

	local function _uci_foreach( type, func )
		local ok, err
		for k, v in pairs(co) do
			if co[k]['.type'] == type then
				ok, err = func( k, v )
				if not ok then break end
			end
		end
		return ok, err
	end

	for k, v in pairs( self.packages[config].sections ) do
		local ok, err = _uci_foreach( k,
			function(s)
				local sect = luci.uvl.section( self, co, k, config, s )
				return self:_validate_section( sect )
			end
		)
		if not ok then return false, err end
	end

	if STRICT_UNKNOWN_SECTIONS then
		for k, v in pairs(co) do
			if not self.beenthere[config..'.'..k] then
				return false, "Section '" .. config .. '.' .. co[k]['.type'] ..
					"' not found in scheme"
			end
		end
	end

	return true, nil
end

function UVL.validate_section( self, config, section )
	self.uci.load_config( config )
	self.beenthere = { }

	local co = self.uci.get_all( config )
	if co[section] then
		return self:_validate_section( luci.uvl.section(
			self, co, co[section]['.type'], config, section
		) )
	else
		return false, "Section '" .. config .. '.' .. section ..
			"' not found in config. Nothing to do."
	end
end

function UVL.validate_option( self, config, section, option )
	self.uci.load_config( config )
	self.beenthere = { }

	local co = self.uci.get_all( config )
	if co[section] and co[section][option] then
		return self:_validate_option( luci.uvl.option(
			self, co, co[section]['.type'], config, section, option
		) )
	else
		return false, "Option '" ..
			config .. '.' .. section .. '.' .. option ..
			"' not found in config. Nothing to do."
	end
end

--- Validate given section of given configuration.
-- @param config	Name of the configuration to validate
-- @param section	Key of the section to validate
-- @param scheme	Scheme to validate against
-- @return			Boolean indicating weather the given config validates
-- @return			String containing the reason for errors (if any)
function UVL._validate_section( self, section )

	if section:values() then

		for _, v in ipairs(section:variables()) do
			local ok, err = self:_validate_option( v )

			if not ok then
				return ok, err
			end
		end

		local ok, err = luci.uvl.dependencies.check( self, section )

		if not ok then
			return false, "All possible dependencies failed"
		end
	else
		print( "Error, scheme section '" .. section:sid() .. "' not found in data" )
	end

	if STRICT_UNKNOWN_OPTIONS and not section:section().dynamic then
		for k, v in pairs(section:values()) do
			if k:sub(1,1) ~= "." and not self.beenthere[
				section:cid() .. '.' .. k
			] then
				return false, "Option '" .. section:sid() .. '.' .. k ..
					"' not found in scheme"
			end
		end
	end

	return true, nil
end

--- Validate given option within section of given configuration.
-- @param config	Name of the configuration to validate
-- @param section	Key of the section to validate
-- @param option	Name of the option to validate
-- @param scheme	Scheme to validate against
-- @return			Boolean indicating weather the given config validates
-- @return			String containing the reason for errors (if any)
function UVL._validate_option( self, option, nodeps )

	if not option:option() and
	   not ( option:section() and option:section().dynamic )
	then
		return false, "Requested option '" .. option:sid() ..
			"' not found in scheme"
	end

	if option:option() then
		if option:option().required and not option:value() then
			return false, "Mandatory variable '" .. option:cid() ..
				"' doesn't have a value"
		end

		if option:option().type == "enum" and option:value() then
			if not option:option().values or
			   not option:option().values[option:value()]
			then
				return false, "Value '" .. ( option:value() or '<nil>' ) ..
					"' of given option '" .. option:cid() ..
					"' is not defined in enum { " ..
					table.concat(self:_keys(option:option().values),", ") ..
					" }"
			end
		end

		if option:option().datatype and option:value() then
			if self.datatypes[option:option().datatype] then
				if not self.datatypes[option:option().datatype](
					option:value()
				) then
					return false, "Value '" .. ( option:value() or '<nil>' ) ..
						"' of given option '" .. option:cid() ..
						"' doesn't validate as datatype '" ..
						option:option().datatype .. "'"
				end
			else
				return false, "Unknown datatype '" ..
					option:option().datatype .. "' encountered"
			end
		end

		if not nodeps then
			return luci.uvl.dependencies.check( self, option )
		end
	end

	return true, nil
end

--- Find all parts of given scheme and construct validation tree
-- @param scheme	Name of the scheme to parse
-- @return			Parsed scheme
function UVL.read_scheme( self, scheme )
	local schemes = { }

	for i, file in ipairs( luci.fs.glob(self.schemedir .. '/*/' .. scheme) ) do
		_assert( luci.fs.access(file), "Can't access file '%s'", file )

		self.uci.set_confdir( luci.fs.dirname(file) )
		self.uci.load( luci.fs.basename(file) )

		table.insert( schemes, self.uci.get_all( luci.fs.basename(file) ) )
	end

	return self:_read_scheme_parts( scheme, schemes )
end

-- Process all given parts and construct validation tree
function UVL._read_scheme_parts( self, scheme, schemes )

	-- helper function to construct identifiers for given elements
	local function _id( c, t )
		if c == TYPE_SECTION then
			return string.format(
				"section '%s.%s'",
					scheme, t.name or '?' )
		elseif c == TYPE_VARIABLE then
			return string.format(
				"variable '%s.%s.%s'",
					scheme, t.section or '?.?', t.name or '?' )
		elseif c == TYPE_ENUM then
			return string.format(
				"enum '%s.%s.%s'",
					scheme, t.variable or '?.?.?', t.value or '?' )
		end
	end

	-- helper function to check for required fields
	local function _req( c, t, r )
		for i, v in ipairs(r) do
			_assert( t[v], "Missing required field '%s' in %s", v, _id(c, t) )
		end
	end

	-- helper function to validate references
	local function _ref( c, t )
		local k
		if c == TYPE_SECTION then
			k = "package"
		elseif c == TYPE_VARIABLE then
			k = "section"
		elseif c == TYPE_ENUM then
			k = "variable"
		end

		local r = luci.util.split( t[k], "." )
		r[1] = ( #r[1] > 0 and r[1] or scheme )

		_assert( #r == c, "Malformed %s reference in %s", k, _id(c, t) )

		return r
	end

	-- Step 1: get all sections
	for i, conf in ipairs( schemes ) do
		for k, v in pairs( conf ) do
			if v['.type'] == 'section' then

				_req( TYPE_SECTION, v, { "name", "package" } )

				local r = _ref( TYPE_SECTION, v )

				self.packages[r[1]] =
					self.packages[r[1]] or {
						["sections"]  = { };
						["variables"] = { };
					}

				local p = self.packages[r[1]]
					  p.sections[v.name]  = p.sections[v.name]  or { }
					  p.variables[v.name] = p.variables[v.name] or { }

				local s = p.sections[v.name]

				for k, v2 in pairs(v) do
					if k ~= "name" and k ~= "package" and k:sub(1,1) ~= "." then
						if k:match("^depends") then
							s["depends"] = _assert(
								self:_read_dependency( v2, s["depends"] ),
								"Section '%s' in scheme '%s' has malformed " ..
								"dependency specification in '%s'",
								v.name or '<nil>', scheme or '<nil>', k
							)
						else
							s[k] = v2
						end
					end
				end
			end
		end
	end

	-- Step 2: get all variables
	for i, conf in ipairs( schemes ) do
		for k, v in pairs( conf ) do
			if v['.type'] == "variable" then

				_req( TYPE_VARIABLE, v, { "name", "section" } )

				local r = _ref( TYPE_VARIABLE, v )

				local p = _assert( self.packages[r[1]],
					"Variable '%s' in scheme '%s' references unknown package '%s'",
					v.name, scheme, r[1] )

				local s = _assert( p.variables[r[2]],
					"Variable '%s' in scheme '%s' references unknown section '%s'",
					v.name, scheme, r[2] )

				s[v.name] = s[v.name] or { }

				local t = s[v.name]

				for k, v in pairs(v) do
					if k ~= "name" and k ~= "section" and k:sub(1,1) ~= "." then
						if k:match("^depends") then
							t["depends"] = _assert(
								self:_read_dependency( v, t["depends"] ),
								"Variable '%s' in scheme '%s' has malformed " ..
								"dependency specification in '%s'",
								v.name, scheme, k
							)
						elseif k:match("^validator") then
							t["validators"] = _assert(
								self:_read_validator( v, t["validators"] ),
								"Variable '%s' in scheme '%s' has malformed " ..
								"validator specification in '%s'",
								v.name, scheme, k
							)
						else
							t[k] = v
						end
					end
				end
			end
		end
	end

	-- Step 3: get all enums
	for i, conf in ipairs( schemes ) do
		for k, v in pairs( conf ) do
			if v['.type'] == "enum" then

				_req( TYPE_ENUM, v, { "value", "variable" } )

				local r = _ref( TYPE_ENUM, v )

				local p = _assert( self.packages[r[1]],
					"Enum '%s' in scheme '%s' references unknown package '%s'",
					v.value, scheme, r[1] )

				local s = _assert( p.variables[r[2]],
					"Enum '%s' in scheme '%s' references unknown section '%s'",
					v.value, scheme, r[2] )

				local t = _assert( s[r[3]],
					"Enum '%s' in scheme '%s', section '%s' references " ..
					"unknown variable '%s'",
					v.value, scheme, r[2], r[3] )

				_assert( t.type == "enum",
					"Enum '%s' in scheme '%s', section '%s' references " ..
					"variable '%s' with non enum type '%s'",
					v.value, scheme, r[2], r[3], t.type )

				if not t.values then
					t.values = { [v.value] = v.title or v.value }
				else
					t.values[v.value] = v.title or v.value
				end

				if v.default then
					_assert( not t.default,
						"Enum '%s' in scheme '%s', section '%s' redeclares " ..
						"the default value of variable '%s'",
						v.value, scheme, r[2], v.variable )

					t.default = v.value
				end
			end
		end
	end

	return self
end

-- Read a dependency specification
function UVL._read_dependency( self, value, deps )
	local parts     = luci.util.split( value, "%s*,%s*", nil, true )
	local condition = { }

	for i, val in ipairs(parts) do
		local k, v = unpack(luci.util.split( val, "%s*=%s*", nil, true ))

		if k and (
			k:match("^%$?[a-zA-Z0-9_]+%.%$?[a-zA-Z0-9_]+%.%$?[a-zA-Z0-9_]+$") or
			k:match("^%$?[a-zA-Z0-9_]+%.%$?[a-zA-Z0-9_]+$") or
			k:match("^%$?[a-zA-Z0-9_]+$")
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

	return deps
end

-- Read a validator specification
function UVL._read_validator( self, value, validators )
	local validator

	if value and value:match("/") and self.datatypes.file(value) then
		validator = value
	else
		validator = self:_resolve_function( value )
	end

	if validator then
		if not validators then
			validators = { validator }
		else
			table.insert( validators, validator )
		end

		return validators
	end
end

-- Resolve given path
function UVL._resolve_function( self, value )
	local path = luci.util.split(value, ".")

	for i=1, #path-1 do
		local stat, mod = pcall(require, table.concat(path, ".", 1, i))
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


section = luci.util.class()

function section.__init__(self, scheme, co, st, c, s)
	self.csection = co[s]
	self.ssection = scheme.packages[c].sections[st]
	self.cref     = { c, s }
	self.sref     = { c, st }
	self.scheme   = scheme
	self.config   = co
	self.type     = luci.uvl.TYPE_SECTION
end

function section.cid(self)
	return ( self.cref[1] or '?' ) .. '.' .. ( self.cref[2] or '?' )
end

function section.sid(self)
	return ( self.sref[1] or '?' ) .. '.' .. ( self.sref[2] or '?' )
end

function section.values(self)
	return self.csection
end

function section.section(self)
	return self.ssection
end

function section.variables(self)
	local v = { }
	if self.scheme.packages[self.sref[1]].variables[self.sref[2]] then
		for o, _ in pairs(
			self.scheme.packages[self.sref[1]].variables[self.sref[2]]
		) do
			table.insert( v, luci.uvl.option(
				self.scheme, self.config, self.sref[2],
				self.cref[1], self.cref[2], o
			) )
		end
	end
	return v
end


option = luci.util.class()

function option.__init__(self, scheme, co, st, c, s, o)
	self.coption = co[s] and co[s][o] or nil
	self.soption = scheme.packages[c].variables[st][o]
	self.cref    = { c, s, o }
	self.sref    = { c, st, o }
	self.scheme  = scheme
	self.config  = co
	self.type    = luci.uvl.TYPE_OPTION
end

function option.cid(self)
	return ( self.cref[1] or '?' ) .. '.' ..
		   ( self.cref[2] or '?' ) .. '.' ..
		   ( self.cref[3] or '?' )
end

function option.sid(self)
	return ( self.sref[1] or '?' ) .. '.' ..
		   ( self.sref[2] or '?' ) .. '.' ..
		   ( self.sref[3] or '?' )
end

function option.value(self)
	return self.coption
end

function option.option(self)
	return self.soption
end

function option.section(self)
	return self.scheme.packages[self.sref[1]].sections[self.sref[2]]
end
