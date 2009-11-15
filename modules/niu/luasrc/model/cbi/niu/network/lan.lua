local uci = require "luci.model.uci"
local cursor = uci.cursor()
local d = Delegator()
d.allow_finish = true
d.allow_back = true
d.allow_cancel = true

d:add("lan1", load("niu/network/lan1"))
d:set("warnip", {Template("niu/network/warn_ip_change")})

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

	cursor:set("network", "lan", "type", "bridge")
	cursor:commit("network")
	cursor:commit("dhcp")
end

return d