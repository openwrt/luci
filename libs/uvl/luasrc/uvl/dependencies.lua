--[[

UCI Validation Layer - Dependency helper
(c) 2008 Jo-Philipp Wich <xm@leipzig.freifunk.net>
(c) 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--

module( "luci.uvl.dependencies", package.seeall )

function _parse_reference( r, c, s, o )
	local ref  = { }
	local vars = {
		config  = ( c or '$config'  ),
		section = ( s or '$section' ),
		option  = ( o or '$option'  )
	}

	for i, v in ipairs(luci.util.split(r,".")) do
		table.insert(ref, (v:gsub( "%$(.+)", function(n) return vars[n] end )))
	end

	if c or s then
		if #ref == 1 and c and s then
			ref = { c, s, ref[1] }
		elseif #ref == 2 and c then
			ref = { c, unpack(ref) }
		elseif #ref ~= 3 then
			ref = nil
		end
	else
		if #ref == 1 then
			ref = { '$config', '$section', ref[1] }
		elseif #ref == 2 then
			ref = { '$config', unpack(ref) }
		elseif #ref ~= 3 then
			ref = nil
		end
	end

	return ref
end

function check( self, object, nodeps )

	if not self.beenthere[object:cid()] then
		self.beenthere[object:cid()] = true
	else
		return false, "Recursive dependency for '" .. object:sid() .. "' found"
	end

	local item = object.type == luci.uvl.TYPE_SECTION
		and object:section() or object:option()

	if item.depends then
		local ok = false
		local valid, err = false,
			string.format( 'In dependency check for %s "%s":',
				( object.type == luci.uvl.TYPE_SECTION and "section" or "option" ),
				object:cid() )

		for _, dep in ipairs(item.depends) do
			local subcondition = true
			for k, v in pairs(dep) do
				-- XXX: better error
				local ref = _parse_reference( k, unpack(object.cref) )

				if not ref then
					return false, "Ambiguous dependency reference '" .. k ..
						"' for object '" .. object:sid() .. "' given"
				end

				local option = luci.uvl.option(
					self, object.config,
					object.config[ref[2]]
						and object.config[ref[2]]['.type']
						or  object.sref[2],
					ref[1], ref[2], ref[3]
				)

				valid, err2 = self:_validate_option( option, true )
				if valid then
					if not (
						( type(v) == "boolean" and object.config[ref[2]][ref[3]] ) or
						( ref[3] and object.config[ref[2]][ref[3]] ) == v
					) then
						subcondition = false
						err = err .. "\n" ..
							self.log.dump_dependency( dep, ref, v )
						break
					end
				else
					subcondition = false
					err = err .. "\n" ..
						self.log.dump_dependency( dep, ref, nil, err2 )
					break
				end
			end

			if subcondition then
				return true
			end
		end

		return false, err
	end

	return true
end
