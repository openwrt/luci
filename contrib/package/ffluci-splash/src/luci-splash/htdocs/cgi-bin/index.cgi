#!/usr/bin/haserl --shell=luac
package.path  = "/usr/lib/lua/?.lua;/usr/lib/lua/?/init.lua;" .. package.path
package.cpath = "/usr/lib/lua/?.so;" .. package.cpath

require("ffluci.http")
require("ffluci.sys")
require("ffluci.model.uci")

local srv
local ip = ffluci.http.remote_addr()
for k, v in pairs(ffluci.model.uci.show("network").network) do
	if v[".type"] == "interface" and v.ipaddr then
		local p = ffluci.sys.net.mask4prefix(v.netmask)
		if ffluci.sys.net.belongs(ip, v.ipaddr, p) then
			srv = v.ipaddr
			break
		end
	end
end

if not srv then
	ffluci.http.textheader()
	return print("Unable to detect network settings!")
end

local action = "splash"

local mac = ffluci.sys.net.ip4mac(ip)
if not mac then
	action = "unknown"
end

local status = ffluci.sys.exec("luci-splash status "..mac)

if status == "whitelisted" or status == "lease" then
	action = "allowed"
end

ffluci.http.redirect("http://" .. srv .. "/cgi-bin/luci-splash/" .. action)