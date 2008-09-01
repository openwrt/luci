#!/usr/bin/lua

--[[

OLSRd configuration generator
(c) 2008 Freifunk Leipzig / Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--

require("luci.util")
require("luci.model.uci")

local conf = luci.model.uci.get_all("olsr")

local function _value(val)
	if val:match("^[0-9%. \t]+$") or val == "yes" or val == "no" then
		return val
	else
		return string.format( '"%s"', val )
	end
end

local function _section(sect,sval,parstr)
	local rv  = ""
	local pad = ""

	if sval then
		rv  = string.format( '%s "%s"\n{\n', conf[sect][".type"], conf[sect][sval] )
		pad = "\t"
	end

	for k, v in luci.util.spairs(conf[sect]) do
		if k:sub(1,1) ~= '.' and k ~= sval then
			if parstr then
				rv = rv .. string.format(
					'%s%s "%s"\t"%s"\n',
					pad, parstr,
					k:gsub( "_", "-" ),	-- XXX: find a better solution for this
					v
				)
			else
				rv = rv .. string.format(
					'%s%s\t%s\n',
					pad, k, _value(v)
				)
			end
		end
	end

	if sval then
		rv = rv .. "}\n"
	end	

	return rv
end

local function _hna(sval)
	local rv = string.format( "%s\n{\n", sval )

	for k, v in luci.util.spairs(conf) do
		if conf[k][".type"] == sval and conf[k].NetAddr and conf[k].Prefix then
			rv = rv .. string.format(
				"\t%s\t%s\n",
				conf[k].NetAddr,
				conf[k].Prefix
			)
		end
	end

	return rv .. "}\n"
end

local function _ipc(sval)
	local rv = string.format( "%s\n{\n", sval )

	for k, v in luci.util.spairs(conf[sval]) do
		if k:sub(1,1) ~= "." then
			local vals = luci.util.split(v, "%s+", nil, true)

			if k == "Net" then
				for i = 1,#vals,2 do
					rv = rv .. string.format(
						"\tNet\t%s\t%s\n",
						vals[i], vals[i+1]
					)
				end
			elseif k == "Host" then
				for i, v in ipairs(vals) do
					rv = rv .. string.format(
						"\t%s\t%s\n",
						k, vals[i]
					)
				end
			else
				rv = rv .. string.format(
					"\t%s\t%s\n",
					k, v
				)
			end
		end
	end

	return rv .. "}\n"
end


-- general config section
print( _section("general") )

-- plugin config sections
for k, v in luci.util.spairs(conf) do
	if conf[k][".type"] == "LoadPlugin" then
		print( _section( k, "Library", "PlParam" ) )
	end
end

-- interface config sections
for k, v in luci.util.spairs(conf) do
	if conf[k][".type"] == "Interface" then
		print( _section( k, "Interface" ) )
	end
end

-- write Hna4, Hna6 sections
print( _hna("Hna4") )
print( _hna("Hna6") )

-- write IpcConnect section
print( _ipc("IpcConnect") )
