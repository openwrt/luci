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
require("luci.uvl.loghelper")
require("luci.uvl.datatypes")
require("luci.uvl.validation")
require("luci.uvl.dependencies")


TYPE_SECTION  = 0x01
TYPE_VARIABLE = 0x02
TYPE_ENUM     = 0x03

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

local function _assert( condition, fmt, ... )
	if not condition then
		return assert( nil, string.format( fmt, ... ) )
	else
		return condition
	end
end


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
	self.uci		= luci.model.uci
	self.dep		= luci.uvl.dependencies
	self.log        = luci.uvl.loghelper
	self.datatypes  = luci.uvl.datatypes
end


--- Parse given scheme and return the scheme tree.
-- @param scheme	Name of the scheme to parse
-- @return			Table containing the parsed scheme or nil on error
-- @return			String containing the reason for errors (if any)
function UVL.get_scheme( self, scheme )
	if not self.packages[scheme] then
		local ok, err = pcall( self.read_scheme, self, scheme )
		if not ok then
			return nil, self.log.scheme_error( scheme, err )
		end
	end
	return self.packages[scheme], nil
end

--- Return a table containing the dependencies of specified section or option.
-- @param config	Name of the configuration or parsed scheme object
-- @param section	Type of the section
-- @param option	Name of the option (optional)
-- @return			Table containing the dependencies or nil on error
-- @return			String containing the reason for errors (if any)
function UVL.get_dependencies( self, config, section, option )
	config = ( type(config) == "string" and self:get_scheme(config) or config )

	local deps = { }
	local dt

	if not config.sections[section] then return deps end

	if option and config.variables[section][option] then
		dt = config.variables[section][option].depends
	else
		dt = config.sections[section].depends
	end

	if dt then
		for _, d in ipairs(dt) do
			local sdeps = { }
			for k, v in pairs(d) do
				local r = self.dep._parse_reference( k )
				if r then
					sdeps[r] = v
				else
					return nil,
						'Ambiguous dependency reference "%s" for object "%s" given'
							%{ k, self.log.id( config.name, section, option ) }
				end
			end
			table.insert( deps, sdeps )
		end
	end
	return deps
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
function UVL.validate_config( self, config )

	if not self.packages[config] then
		local ok, err = pcall( self.read_scheme, self, config )
		if not ok then
			return false, self.log.scheme_error( config, err )
		end
	end

	self.uci.load_config( config )
	self.beenthere = { }

	local co = self.uci.get_all( config )
	local sc = { }

	if not co then
		return false, 'Unable to load configuration "%s"' % config
	end

	local function _uci_foreach( type, func )
		local ok, err
		for k, v in pairs(co) do
			if co[k]['.type'] == type then
				sc[type] = sc[type] + 1
				ok, err = func( k, v )
				if not ok then
					err = self.log.config_error( config, err )
					break
				end
			end
		end
		return ok, err
	end

	for k, v in pairs( self.packages[config].sections ) do
		sc[k] = 0
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
				return false, self.log.config_error( config,
					'Section "%s" not found in scheme'
						% self.log.id( config, co[k]['.type'] ) )
			end
		end
	end

	for _, k in ipairs(luci.util.keys(sc)) do
		local s = self.packages[config].sections[k]

		if s.required and sc[k] == 0 then
			return false, self.log.config_error( config,
				'Required section "%s" not found in config' % k )
		elseif s.unique and sc[k] > 1 then
			return false, self.log.config_error( config,
				'Unique section "%s" occurs multiple times in config' % k )
		end
	end

	return true, nil
end

--- Validate given config section.
-- @param config	Name of the configuration to validate
-- @param section	Name of the section to validate
-- @return			Boolean indicating whether the given config validates
-- @return			String containing the reason for errors (if any)
function UVL.validate_section( self, config, section )

	if not self.packages[config] then
		local ok, err = pcall( self.read_scheme, self, config )
		if not ok then
			return false, self.log.scheme_error( config, err )
		end
	end

	self.uci.load_config( config )
	self.beenthere = { }

	local co = self.uci.get_all( config )

	if not co then
		return false, 'Unable to load configuration "%s"' % config
	end

	if co[section] then
		return self:_validate_section( luci.uvl.section(
			self, co, co[section]['.type'], config, section
		) )
	else
		return false, 'Section "%s" not found in config. Nothing to do.'
			% self.log.id( config, section )
	end
end

--- Validate given config option.
-- @param config	Name of the configuration to validate
-- @param section	Name of the section to validate
-- @param option	Name of the option to validate
-- @return			Boolean indicating whether the given config validates
-- @return			String containing the reason for errors (if any)
function UVL.validate_option( self, config, section, option )

	if not self.packages[config] then
		local ok, err = pcall( self.read_scheme, self, config )
		if not ok then
			return false, self.log.scheme_error( config, err )
		end
	end

	self.uci.load_config( config )
	self.beenthere = { }

	local co = self.uci.get_all( config )

	if not co then
		return false, 'Unable to load configuration "%s"' % config
	end

	if co[section] and co[section][option] then
		return self:_validate_option( luci.uvl.option(
			self, co, co[section]['.type'], config, section, option
		) )
	else
		return false, 'Option "%s" not found in config. Nothing to do.'
			% self.log.id( config, section, option )
	end
end


function UVL._validate_section( self, section )

	if section:values() then
		if section:section().named == true and
		   section:values()['.anonymous'] == true
		then
			return false, self.log.section_error( section,
				'The section of type "%s" is stored anonymously in config but must be named'
					% section:sid() )
		end

		for _, v in ipairs(section:variables()) do
			local ok, err = self:_validate_option( v )

			if not ok then
				return ok, self.log.section_error( section, err )
			end
		end

		local ok, err = luci.uvl.dependencies.check( self, section )

		if not ok then
			return false, err
		end
	else
		return false, 'Option "%s" not found in config' % section:sid()
	end

	if STRICT_UNKNOWN_OPTIONS and not section:section().dynamic then
		for k, v in pairs(section:values()) do
			if k:sub(1,1) ~= "." and not self.beenthere[
				section:cid() .. '.' .. k
			] then
				return false, 'Option "%s" not found in scheme'
					% self.log.id( section:sid(), k )
			end
		end
	end

	return true, nil
end

function UVL._validate_option( self, option, nodeps )

	local item = option:option()
	local val  = option:value()

	if not item and not ( option:section() and option:section().dynamic ) then
		return false, 'Option "%s" not found in scheme' % option:cid()

	elseif item then
		if item.required and not val then
			return false, 'Mandatory variable "%s" does not have a value'
				% option:cid()
		end

		if ( item.type == "reference" or item.type == "enum" ) and val then
			if not item.values or not item.values[val] then
				return false,
					'Value "%s" of given option "%s" is not defined in %s { %s }'
						%{ val or '<nil>', option:cid(), item.type,
						   table.concat( luci.util.keys(item.values or {}), ", " ) }
			end
		elseif item.type == "list" and val then
			if type(val) ~= "table" and STRICT_LIST_TYPE then
				return false,
					'Option "%s" is defined as list but stored as plain value'
						% option:cid()
			end
		end

		if item.datatype and val then
			if self.datatypes[item.datatype] then
				val = ( type(val) == "table" and val or { val } )
				for i, v in ipairs(val) do
					if not self.datatypes[item.datatype]( v ) then
						return false,
							'Value%s "%s" of given option "%s" does not validate as datatype "%s"'
								%{ ( #val>1 and ' #' .. i or '' ), v,
								   option:cid(), item.datatype }
					end
				end
			else
				return false, 'Unknown datatype "%s" encountered'
					% item.datatype
			end
		end

		if not nodeps then
			return luci.uvl.dependencies.check( self, option )
		end

		local ok, err = luci.uvl.validation.check( self, option )
		if not ok and STRICT_EXTERNAL_VALIDATORS then
			return false, self.log.validator_error( option, err )
		end
	end

	return true, nil
end

--- Find all parts of given scheme and construct validation tree.
-- This is normally done on demand, so you don't have to call this function
-- by yourself.
-- @param scheme	Name of the scheme to parse
function UVL.read_scheme( self, scheme )
	local schemes = { }
	local files = luci.fs.glob(self.schemedir .. '/*/' .. scheme)

	if files then
		for i, file in ipairs( files ) do
			_assert( luci.fs.access(file), "Can't access file '%s'", file )

			self.uci.set_confdir( luci.fs.dirname(file) )
			self.uci.load( luci.fs.basename(file) )

			table.insert( schemes, self.uci.get_all( luci.fs.basename(file) ) )
		end

		return self:_read_scheme_parts( scheme, schemes )
	else
		error( 'Can not find scheme "%s" in "%s"' %{ scheme, self.schemedir } )
	end
end

-- Process all given parts and construct validation tree
function UVL._read_scheme_parts( self, scheme, schemes )

	-- helper function to construct identifiers for given elements
	local function _id( c, t )
		if c == TYPE_SECTION then
			return string.format(
				'section "%s.%s"',
					scheme, t.name or '?' )
		elseif c == TYPE_VARIABLE then
			return string.format(
				'variable "%s.%s.%s"',
					scheme, t.section or '?.?', t.name or '?' )
		elseif c == TYPE_ENUM then
			return string.format(
				'enum "%s.%s.%s"',
					scheme, t.variable or '?.?.?', t.value or '?' )
		end
	end

	-- helper function to check for required fields
	local function _req( c, t, r )
		for i, v in ipairs(r) do
			_assert( t[v], 'Missing required field "%s" in %s', v, _id(c, t) )
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

		_assert( #r == c, 'Malformed %s reference in %s', k, _id(c, t) )

		return r
	end

	-- helper function to read bools
	local function _bool( v )
		return ( v == "true" or v == "yes" or v == "on" or v == "1" )
	end

	-- Step 1: get all sections
	for i, conf in ipairs( schemes ) do
		for k, v in pairs( conf ) do
			if v['.type'] == 'section' then

				_req( TYPE_SECTION, v, { "name", "package" } )

				local r = _ref( TYPE_SECTION, v )

				self.packages[r[1]] =
					self.packages[r[1]] or {
						["name"]      = r[1];
						["sections"]  = { };
						["variables"] = { };
					}

				local p = self.packages[r[1]]
					  p.sections[v.name]  = p.sections[v.name]  or { }
					  p.variables[v.name] = p.variables[v.name] or { }

				local s = p.sections[v.name]

				for k, v2 in pairs(v) do
					if k ~= "name" and k ~= "package" and k:sub(1,1) ~= "." then
						if k == "depends" then
							s["depends"] = _assert(
								self:_read_dependency( v2, s["depends"] ),
								'Section "%s" in scheme "%s" has malformed ' ..
								'dependency specification in "%s"',
								v.name or '<nil>', scheme or '<nil>', k
							)
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

				_req( TYPE_VARIABLE, v, { "name", "section" } )

				local r = _ref( TYPE_VARIABLE, v )

				local p = _assert( self.packages[r[1]],
					'Variable "%s" in scheme "%s" references unknown package "%s"',
					v.name, scheme, r[1] )

				local s = _assert( p.variables[r[2]],
					'Variable "%s" in scheme "%s" references unknown section "%s"',
					v.name, scheme, r[2] )

				s[v.name] = s[v.name] or { }

				local t = s[v.name]

				for k, v2 in pairs(v) do
					if k ~= "name" and k ~= "section" and k:sub(1,1) ~= "." then
						if k == "depends" then
							t["depends"] = _assert(
								self:_read_dependency( v2, t["depends"] ),
								'Invalid reference "%s" in "%s.%s.%s"',
								v2, v.name, scheme, k
							)
						elseif k == "validator" then
							t["validators"] = _assert(
								self:_read_validator( v2, t["validators"] ),
								'Variable "%s" in scheme "%s" has malformed ' ..
								'validator specification in "%s"',
								v.name, scheme, k
							)
						elseif k == "valueof" then
							local values, err = self:_read_reference( v2 )

							_assert( values,
								'Variable "%s" in scheme "%s" has invalid ' ..
								'reference specification:\n%s',
									v.name, scheme, err )

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

				_req( TYPE_ENUM, v, { "value", "variable" } )

				local r = _ref( TYPE_ENUM, v )
				local p = _assert( self.packages[r[1]],
					'Enum "%s" in scheme "%s" references unknown package "%s"',
					v.value, scheme, r[1] )

				local s = _assert( p.variables[r[2]],
					'Enum "%s" in scheme "%s" references unknown section "%s"',
					v.value, scheme, r[2] )

				local t = _assert( s[r[3]],
					'Enum "%s" in scheme "%s", section "%s" references ' ..
					'unknown variable "%s"',
					v.value, scheme, r[2], r[3] )

				_assert( t.type == "enum",
					'Enum "%s" in scheme "%s", section "%s" references ' ..
					'variable "%s" with non enum type "%s"',
					v.value, scheme, r[2], r[3], t.type )

				if not t.values then
					t.values = { [v.value] = v.title or v.value }
				else
					t.values[v.value] = v.title or v.value
				end

				if not t.enum_depends then
					t.enum_depends = { }
				end

				if v.default then
					_assert( not t.default,
						'Enum "%s" in scheme "%s", section "%s" redeclares ' ..
						'the default value of variable "%s"',
						v.value, scheme, r[2], v.variable )

					t.default = v.value
				end

				if v.depends then
					t.enum_depends[v.value] = _assert(
						self:_read_dependency(
							v.depends, t.enum_depends[v.value]
						),
						'Invalid reference "%s" in "%s.%s.%s.%s"',
						v.depends, scheme, r[2], r[3], v.value
					)
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
			self.uci.load_config(ref[1])
			local co = self.uci.get_all(ref[1])

			if not co then
				return nil, 'Can not load config "%s" for reference "%s"'
					%{ ref[1], value }
			end

			for k, v in pairs(co) do
				if v['.type'] == ref[2] then
					if #ref == 2 then
						if v['.anonymous'] == true then
							return nil, 'Illegal reference "%s" to an anonymous section'
								% value
						end
						val[k] = k	-- XXX: title/description would be nice
					elseif v[ref[3]] then
						val[v[ref[3]]] = v[ref[3]]  -- XXX: dito
					end
				end
			end
		else
			return nil, 'Malformed reference "%s"' % value
		end
	end

	return val, nil
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


--- Object representation of a scheme/config section.
-- @class	module
-- @cstyle	instance
-- @name	luci.uvl.section

--- Section instance constructor.
-- @class			function
-- @name			section
-- @param scheme	Scheme instance
-- @param co		Configuration data
-- @param st		Section type
-- @param c			Configuration name
-- @param s			Section name
-- @return			Section instance
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

--- Get the config path of this section.
-- @return	String containing the identifier
function section.cid(self)
	return ( self.cref[1] or '?' ) .. '.' .. ( self.cref[2] or '?' )
end

--- Get the scheme path of this section.
-- @return	String containing the identifier
function section.sid(self)
	return ( self.sref[1] or '?' ) .. '.' .. ( self.sref[2] or '?' )
end

--- Get all configuration values within this section.
-- @return	Table containing the values
function section.values(self)
	return self.csection
end

--- Get the associated section information in scheme.
-- @return	Table containing the scheme properties
function section.section(self)
	return self.ssection
end

--- Get all option objects associated with this section.
-- @return	Table containing all associated luci.uvl.option instances
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


--- Object representation of a scheme/config option.
-- @class	module
-- @cstyle	instance
-- @name	luci.uvl.option

--- Section instance constructor.
-- @class			function
-- @name			option
-- @param scheme	Scheme instance
-- @param co		Configuration data
-- @param st		Section type
-- @param c			Configuration name
-- @param s			Section name
-- @param o			Option name
-- @return			Option instance
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

--- Get the config path of this option.
-- @return	String containing the identifier
function option.cid(self)
	return ( self.cref[1] or '?' ) .. '.' ..
		   ( self.cref[2] or '?' ) .. '.' ..
		   ( self.cref[3] or '?' )
end

--- Get the scheme path of this option.
-- @return	String containing the identifier
function option.sid(self)
	return ( self.sref[1] or '?' ) .. '.' ..
		   ( self.sref[2] or '?' ) .. '.' ..
		   ( self.sref[3] or '?' )
end

--- Get the value of this option.
-- @return	The associated configuration value
function option.value(self)
	return self.coption
end

--- Get the associated option information in scheme.
-- @return	Table containing the scheme properties
function option.option(self)
	return self.soption
end

--- Get the associated section information in scheme.
-- @return	Table containing the scheme properties
function option.section(self)
	return self.scheme.packages[self.sref[1]].sections[self.sref[2]]
end
