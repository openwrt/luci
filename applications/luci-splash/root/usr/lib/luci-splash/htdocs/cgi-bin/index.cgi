#!/usr/bin/haserl --shell=luac
package.path  = "/usr/lib/lua/?.lua;/usr/lib/lua/?/init.lua;" .. package.path
package.cpath = "/usr/lib/lua/?.so;" .. package.cpath

require("luci.http")
require("luci.sys")
require("luci.model.uci")

local srv
local net
local ip = luci.http.env.REMOTE_ADDR
for k, v in pairs(luci.model.uci.sections("network")) do
	if v[".type"] == "interface" and v.ipaddr then
		local p = luci.sys.net.mask4prefix(v.netmask)
		if luci.sys.net.belongs(ip, v.ipaddr, p) then
			net = k
			srv = v.ipaddr
			break
		end
	end
end

local stat = false
for k, v in pairs(luci.model.uci.sections("luci_splash")) do
	if v[".type"] == "iface" and v.network == net then
		stat = true
	end 
end

if not srv then
	luci.http.prepare_content("text/plain")
	print("Unable to detect network settings!")
elseif not stat then
	luci.http.redirect("http://" .. srv)
else
	local action = "splash"
	
	local mac = luci.sys.net.ip4mac(ip)
	if not mac then
		action = "unknown"
	end
	
	local status = luci.sys.execl("luci-splash status "..mac)[1]
	
	if status == "whitelisted" or status == "lease" then
		action = "allowed"
	end
	
	luci.http.redirect("http://" .. srv .. "/cgi-bin/luci-splash/" .. action)
end