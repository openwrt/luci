#!/usr/bin/haserl --shell=luac --accept-none
dofile("/usr/lib/luci-splash/splash.lua")

local written = {}
local time = os.time()

-- Current leases in state files
local leases = uci:show("luci_splash").luci_splash

-- Convert leasetime to seconds
local leasetime = tonumber(uci:get("luci_splash", "general", "leasetime")) * 3600

-- Clean state file
uci:revert("luci_splash")


-- For all leases
for k, v in pairs(uci:show("luci_splash")) do
	if v[".type"] == "lease" then
		if os.difftime(time, tonumber(v.start)) > leasetime then
			-- Remove expired
			remove_rule(v.mac)
		else
			-- Rewrite state
			local n = uci:add("luci_splash", "lease")
			uci:set("luci_splash", n, "mac", v.mac)
			uci:set("luci_splash", n, "start", v.start)
			written[v.mac] = 1
		end
	end
end


-- Delete rules without state
for i, r in ipairs(listrules()) do
	if not written[r] then
		remove_rule(r)
	end
end