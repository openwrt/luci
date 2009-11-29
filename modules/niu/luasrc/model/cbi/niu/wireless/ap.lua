local cursor = require "luci.model.uci".cursor()

if not cursor:get("wireless", "ap") then
	cursor:section("wireless", "wifi-iface", "ap",
		{device = "_", doth = "1", _niu = "1", mode = "ap"})
	cursor:save("wireless")
end

local function deviceroute(self)
	cursor:unload("wireless")
	local d = cursor:get("wireless", "ap", "device")
	local t = cursor:get("wireless", "ap", "_cfgtpl")
	if d ~= "none" then
		cursor:delete_all("wireless", "wifi-iface", function(s)
			return s.device == d and s._niu ~= "1"
		end)
		cursor:set("wireless", d, "disabled", 0)
		cursor:set("wireless", "ap", "network", "lan")
		if t and #t > 0 then
			cursor:delete("wireless", "ap", "_cfgtpl")
			cursor:set("wireless", "ap", "ssid", cursor:get("wireless", "bridge", "ssid"))
			cursor:set("wireless", "ap", "encryption", cursor:get("wireless", "bridge", "encryption"))
			cursor:set("wireless", "ap", "key", cursor:get("wireless", "bridge", "key"))
			cursor:set("wireless", "ap", "wds", "1")
		end
		
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

d:add("device", "niu/wireless/apdevice")
d:add("deviceroute", deviceroute)
d:set("ap1", "niu/wireless/ap1")

function d.on_cancel()
	cursor:revert("wireless")
end

function d.on_done()
	cursor:commit("wireless")
end

return d