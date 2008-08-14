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

TYPE_SECTION  = 0x01
TYPE_VARIABLE = 0x02
TYPE_ENUM     = 0x03


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
	self.uci		= luci.model.uci
	self.datatypes  = luci.uvl.datatypes
end

--- Validate given configuration.
-- @param config	Name of the configuration to validate
-- @param scheme	Scheme to validate against (optional)
-- @return			Boolean indicating weather the given config validates
-- @return			String containing the reason for errors (if any)
function UVL.validate( self, config, scheme )

	if not scheme then
		return false, "No scheme found"
	end

	for k, v in pairs( config ) do
		local ok, err = self:validate_section( config, k, scheme )

		if not ok then
			return ok, err
		end
	end

	return true, nil
end

--- Validate given section of given configuration.
-- @param config	Name of the configuration to validate
-- @param section	Key of the section to validate
-- @param scheme	Scheme to validate against
-- @return			Boolean indicating weather the given config validates
-- @return			String containing the reason for errors (if any)
function UVL.validate_section( self, config, section, scheme )

	if not scheme then
		return false, "No scheme found"
	end

	for k, v in pairs( config[section] ) do
		local ok, err = self:validate_option( config, section, k, scheme )

		if not ok then
			return ok, err
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
function UVL.validate_option( self, config, section, option, scheme )

	if type(config) == "string" then
		config = { ["variables"] = { [section] = { [option] = config } } }
	end

	if not scheme then
		return false, "No scheme found"
	end

	local sv = scheme.variables[section]
	if not sv then return false, "Requested section not found in scheme" end

	sv = sv[option]
	if not sv then return false, "Requested option not found in scheme" end

	if not ( config[section] and config[section][option] ) and sv.required then
		return false, "Mandatory variable doesn't have a value"
	end

	if sv.type then
		if self.datatypes[sv.type] then
			if not self.datatypes[sv.type]( config[section][option] ) then
				return false, "Value of given option doesn't validate"
			end
		else
			return false, "Unknown datatype '" .. sv.type .. "' encountered"
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
								self:_read_depency( v2, s["depends"] ),
								"Section '%s' in scheme '%s' has malformed " ..
								"depency specification in '%s'",
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

				_req( TYPE_VARIABLE, v, { "name", "type", "section" } )

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
								self:_read_depency( v, t["depends"] ),
								"Variable '%s' in scheme '%s' has malformed " ..
								"depency specification in '%s'",
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

-- Read a depency specification
function UVL._read_depency( self, value, deps )
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
					break;
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
