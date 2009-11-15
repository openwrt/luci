local cursor = require "luci.model.uci".cursor()

if not cursor:get("wireless", "ap") then
	cursor:section("wireless", "wifi-iface", "ap",
		{device = "_", doth = "1", wmm = "1", _niu = "1", mode = "ap"})
	cursor:save("wireless")
end

local function deviceroute(self)
	cursor:unload("wireless")
	local d = cursor:get("wireless", "ap", "device")
	if d ~= "none" then
		cursor:delete_all("wireless", "wifi-iface", function(s)
			return s.device == d and s._niu ~= "1"
		end)
		cursor:set("wireless", d, "disabled", 0)
		cursor:set("wireless", "ap", "network", "lan")
		self:set("ap1", load("niu/wireless/ap1"))
		self:set_route("ap1")
	else
		cursor:delete("wireless", "ap", "network")
	end
	cursor:save("wireless")
end


local d = Delegator()
d.allow_finish = true
d.allow_back = true
d.allow_cancel = true

d:add("device", load("niu/wireless/apdevice"))
d:add("deviceroute", deviceroute)

function d.on_cancel()
	cursor:revert("wireless")
end

function d.on_done()
	cursor:commit("wireless")
end

return d