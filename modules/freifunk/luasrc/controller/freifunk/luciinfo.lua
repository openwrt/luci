--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--
module("luci.controller.freifunk.luciinfo", package.seeall)

function index()
	node("freifunk", "luciinfo").target = call("action_index")
end

function action_index()
	local uci = luci.model.uci
	luci.http.prepare_content("text/plain")
	
	-- General
	luci.http.write("luciinfo.api=1\n")
	luci.http.write("luciinfo.version=" .. tostring(require("luci").__version__) .. "\n")
	
	-- Sysinfo
	local s, m, r = luci.sys.sysinfo()
	local dr = luci.sys.net.defaultroute()
	dr = dr and luci.ip.Hex(dr.Gateway, 32, luci.ip.FAMILY_INET4):string()
	local l1, l5, l15 = luci.sys.loadavg()
	
	luci.http.write("sysinfo.system=" .. sanitize(s) .. "\n")
	luci.http.write("sysinfo.cpu=" .. sanitize(m) .. "\n")
	luci.http.write("sysinfo.ram=" .. sanitize(r) .. "\n")
	luci.http.write("sysinfo.hostname=" .. sanitize(luci.sys.hostname()) .. "\n")
	luci.http.write("sysinfo.load1=" .. tostring(l1) .. "\n")
	luci.http.write("sysinfo.load5=" .. tostring(l5) .. "\n")
	luci.http.write("sysinfo.load15=" .. tostring(l15) .. "\n")
	luci.http.write("sysinfo.defaultgw=" .. dr or "" .. "\n")

	
	-- Freifunk
	local ff = uci.get_all("freifunk") or {}
	for k, v in pairs(ff) do
			for i, j in pairs(v) do
				if i:sub(1, 1) ~= "." then
					luci.http.write("freifunk." .. k .. "." .. i .. "=" .. j .. "\n")
				end
			end
	end
end

function sanitize(val)
	return val:gsub("\n", "\t")
end