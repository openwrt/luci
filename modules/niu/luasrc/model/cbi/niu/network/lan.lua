local uci = require "luci.model.uci"
local cursor = uci.cursor()
local d = Delegator()
d.allow_finish = true
d.allow_back = true
d.allow_cancel = true

d:add("lan1", "niu/network/lan1")

function d.on_cancel()
	cursor:revert("network")
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

	cursor:set("network", "lan", "type", "bridge")
	cursor:commit("network")
	cursor:commit("dhcp")
end

return d