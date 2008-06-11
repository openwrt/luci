#!/usr/bin/lua

require("luci.sys")
require("luci.model.uci")

luci.model.uci.set_savedir(luci.model.uci.savedir_state)

local srv
local net
local ip = os.getenv("REMOTE_ADDR")
luci.model.uci.foreach("network", "interface",
	function (section)
		if section.ipaddr then
			local p = luci.sys.net.mask4prefix(section.netmask)
			if luci.sys.net.belongs(ip, section.ipaddr, p) then
				net = section[".name"]
				srv = section.ipaddr
				return
			end
		end
	end)

local stat = false
luci.model.uci.foreach("luci_splash", "iface",
	function (section)
		if section.network == net then
			stat = true
		end
	end)

if not srv then
	print("Content-Type: text/plain\n")
	print("Unable to detect network settings!")
elseif not stat then
	print("Status: 302 Found")
	print("Location: http://" .. srv)
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
	
	print("Status: 302 Found")
	print("Location: http://" .. srv .. "/cgi-bin/luci-splash/" .. action)
end
