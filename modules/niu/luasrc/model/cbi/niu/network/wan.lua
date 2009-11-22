local cursor = require "luci.model.uci".cursor()

if not cursor:get("network", "wan") then
	cursor:section("network", "interface", "wan", {proto = "none"})
	cursor:save("network")
end

if not cursor:get("wireless", "client") then
	cursor:section("wireless", "wifi-iface", "client",
		{device = "_", doth = "1", _niu = "1", mode = "sta"})
	cursor:save("wireless")
end

local function deviceroute(self)
	cursor:unload("network")
	local wd = cursor:get("network", "wan", "_wandev") or ""
	
	if wd == "none" then
		cursor:set("network", "wan", "proto", "none")
	end
	
	if wd:find("ethernet:") == 1 then
		cursor:set("network", "wan", "defaultroute", "1")
		cursor:set("network", "wan", "ifname", wd:sub(10))
		self:set_route("etherwan")
	else
		cursor:delete("network", "wan", "ifname")
	end
	
	if wd:find("wlan:") == 1 then
		local widev = wd:sub(6)
		if cursor:get("wireless", "client", "device") ~= widev then
			cursor:delete("wireless", "client", "network")
			cursor:set("wireless", "client", "device", widev)
		end
		self:set_route("wlanwan1", "wlanwan2")
	else
		cursor:delete("wireless", "client", "device")
		cursor:delete("wireless", "client", "network")
	end
	
	
	cursor:save("wireless")
	cursor:save("network")
end


local d = Delegator()
d.allow_finish = true
d.allow_back = true
d.allow_cancel = true

d:add("device", "niu/network/wandevice")
d:add("deviceroute", deviceroute)
d:set("etherwan", "niu/network/etherwan")
d:set("wlanwan1", "niu/network/wlanwanscan")
d:set("wlanwan2", "niu/network/wlanwan")

function d.on_cancel()
	cursor:revert("network")
	cursor:revert("wireless")
end

function d.on_done()
	cursor:commit("network")
	cursor:commit("wireless")
end

return d