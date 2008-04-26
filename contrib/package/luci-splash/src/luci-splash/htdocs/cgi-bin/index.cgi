#!/usr/bin/haserl --shell=luac
dofile("/usr/lib/luci-splash/splash.lua")

local srv
local ip = ffluci.http.remote_addr()
for k, v in pairs(uci:show("network").network) do
	if v[".type"] == "interface" then
		local p = ffluci.sys.net.mask4prefix(v.netmask)
		if ffluci.sys.net.belongs(ip, v.ipaddr, p) then
			srv = v.ipaddr
		end
	end
end

if not srv then
	ffluci.http.textheader()
	return print("Unable to detect network settings!")
end

local action = "splash"

local mac = ip4mac(ip)
if not mac then
	action = "unknown"
end

if iswhitelisted(mac) or haslease(mac) then
	action = "allowed"
end

ffluci.http.redirect("http://" .. srv .. "/cgi-bin/luci-splash/" .. action)