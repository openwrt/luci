local uci = require "luci.model.uci"
local cursor = uci.cursor()

if not cursor:get("wireless", "bridge") then
	cursor:section("wireless", "wifi-iface", "bridge",
		{device = "_", doth = "1", _niu = "1", mode = "sta", wds = "1"})
	cursor:save("wireless")
end

local function deviceroute(self)
	cursor:unload("wireless")
	local d = cursor:get("wireless", "bridge", "device")
	if d ~= "none" then
		local nc = uci.cursor(nil, "")
		cursor:delete_all("wireless", "wifi-iface", function(s)
			return s.device == d and s._niu ~= "1"
		end)
		if nc:get("wireless", "bridge", "network")
		 ~= cursor:get("wireless", "bridge", "network") then
			cursor:delete("wireless", "bridge", "network")
		end
		cursor:set("wireless", d, "disabled", 0)
		cursor:foreach("dhcp", "dhcp", function(s)
			if s.interface == "lan" and s.ignore ~= "1" then 
				cursor:set("dhcp", s[".name"], "ignore", "1")
	 		end
		end)
		self:set_route("scan", "bridge", "bridgelan")
	else
		if cursor:get("wireless", "bridge", "network") then
			cursor:delete("wireless", "bridge", "network")
			cursor:foreach("dhcp", "dhcp", function(s)
				if s.interface == "lan" and s.ignore == "1" then 
					cursor:set("dhcp", s[".name"], "ignore", "0")
	 			end
			end)
			self:set_route("lan")
		end
	end
	cursor:save("dhcp")
	cursor:save("wireless")
end


local d = Delegator()
d.allow_finish = true
d.allow_back = true
d.allow_cancel = true

d:add("device", "niu/wireless/brdevice")
d:add("deviceroute", deviceroute)
d:set("scan", "niu/network/wlanwanscan")
d:set("bridge", "niu/network/wlanwan")
d:set("bridgelan", "niu/network/lan1")
d:set("lan", "niu/network/lan1")

function d.on_cancel()
	cursor:revert("network")
	cursor:revert("wireless")
	cursor:revert("dhcp")
end

function d.on_done()
	if uci.inst_state:get("network", "lan", "ipaddr") ~= cursor:get("network", "lan", "ipaddr") then
		local cs = uci.cursor_state()
		cs:set("network", "lan", "_ipchanged", "1")
		cs:save("network")
	end
	
	if cursor:get("network", "lan", "proto") == "dhcp" then
		local emergv4 = cursor:get("network", "lan", "_emergv4")
		if emergv4 then
			if cursor:get("network", "lan_ea") then
				cursor:set("network", "lan_ea", "ipaddr", emergv4)
			else
				cursor:section("network", "alias", "lan_ea", {
					ipaddr = emergv4,
					netmask = "255.255.255.0",
					network = "lan"
				})
			end
		else
			cursor:delete("network", "lan_ea")
		end
	end
	cursor:commit("network")
	cursor:commit("wireless")
	cursor:commit("dhcp")
end

return d