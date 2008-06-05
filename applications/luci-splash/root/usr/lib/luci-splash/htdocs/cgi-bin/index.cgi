#!/usr/bin/haserl --shell=luac

require("luci.http")
require("luci.sys")
require("luci.model.uci")

luci.model.uci.set_savedir(luci.model.uci.savedir_state)

local srv
local net
local ip = luci.http.env.REMOTE_ADDR
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