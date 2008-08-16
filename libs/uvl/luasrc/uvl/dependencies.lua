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

module( "luci.uvl.dependencies", package.seeall )

local function _assert( condition, fmt, ... )
	if not condition then
		return assert( nil, string.format( fmt, ... ) )
	else
		return condition
	end
end


function _parse_reference( r, c, s, o )
	local ref  = { }
	local vars = {
		config  = c,
		section = s,
		option  = o
	}

	for i, v in ipairs(luci.util.split(r,".")) do
		table.insert( ref, (v:gsub( "%$(.+)", function(n) return vars[n] end )) )
	end

	if #ref == 1 and c and s then
		ref = { c, s, ref[1] }
	elseif #ref == 2 and c then
		ref = { c, unpack(ref) }
	elseif #ref ~= 3 then
		print("INVALID REFERENCE: "..#ref, c, s, o)
		ref = nil
	end

	return ref
end

function check_dependency( self, uci, conf, sect, optn, nodeps, section2 )

--	print( "Depency check:    ", conf .. '.' .. sect .. ( optn and '.' .. optn or '' ) )

	local key = conf .. '.' .. sect .. ( optn and '.' .. optn or '' )
	if not self.beenthere[key] then
		self.beenthere[key] = true
	else
		print("CIRCULAR DEPENDENCY!")
		return false, "Recursive depency detected"
	end

	-- check for config
	if not self.packages[conf] then self:read_scheme(conf) end
	local item = self.packages[conf]

	-- check for section
	if sect then
		item = _assert( self:_scheme_section( uci, conf, sect ) or self:_scheme_section( uci, conf, section2 ),
			"Unknown section '%s' in scheme '%s' requested",
			sect or '<nil>', conf or '<nil>' )

		-- check for option
		if optn then
			item = _assert( self:_scheme_option( uci, conf, sect, optn ) or
							self:_scheme_option( uci, conf, section2, optn ),
				"Unknown variable '%s' in scheme '%s', section '%s' requested",
				optn or '<nil>', conf or '<nil>', sect or '<nil>' )
		end
	end

	if item.depends then
		local ok = false
		local valid, err

		for _, dep in ipairs(item.depends) do
			--print("DEP:",luci.util.serialize_data(dep))

			local subcondition = true

			for k, v in pairs(dep) do
				-- XXX: better error
				local ref = _assert( _parse_reference(k,conf,sect,optn),
					"Ambiguous dependency reference '" .. k .. "' given" )

				-- XXX: true -> nodeps
				valid, err = self:validate_option(ref[1], ref[2], ref[3], uci, true, section2)
				if valid then
					--print("CHK:",uci[ref[2]][ref[3]],v,unpack(ref))
					if not (
						( type(v) == "boolean" and uci[ref[2]][ref[3]] ) or
						( ref[3] and uci[ref[2]][ref[3]] ) == v
					) then
						subcondition = false
						err = type(v) ~= "boolean"
							and "Option '" .. table.concat( ref, "." ) .. "' doesn't match requested type '" .. v .. '"'
							or  "Option '" .. table.concat( ref, "." ) .. "' has no value"

						break
					end
				else
					subcondition = false
					break
				end
			end

			if subcondition then
--				print( " -> Success (condition matched)\n" )
				return true
			end
		end

--		print( " -> Failed\n" )
		return false, err
	end

--	print( " -> Success (no depends)\n" )
	return true
end
