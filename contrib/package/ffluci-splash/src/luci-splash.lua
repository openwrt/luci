#!/usr/bin/lua
package.path  = "/usr/lib/lua/?.lua;/usr/lib/lua/?/init.lua;" .. package.path
package.cpath = "/usr/lib/lua/?.so;" .. package.cpath

require("ffluci.http")
require("ffluci.sys")
require("ffluci.model.uci")

-- Init state session
uci = ffluci.model.uci.Session("/var/state")


-- Parse stdin and do something
function main(argv)
	local cmd = argv[1]
	local arg = argv[2]
	
	if not cmd then
		print("Usage: " .. argv[0] .. " <status|add|remove|sync> [MAC]")
		os.exit(1)
	elseif cmd == "status" then
		if not arg then
			os.exit(1)
		end
		
		if iswhitelisted(arg) then
			print("whitelisted")
			os.exit(0)
		end
		
		if haslease(arg) then
			print("lease")
			os.exit(0)
		end		
		
		print("unknown")
		os.exit(0)
	elseif cmd == "add" then
		if not arg then
			os.exit(1)
		end
		
		if not haslease(arg) then
			add_lease(arg)
		else
			print("already leased!")
			os.exit(2)
		end
		os.exit(0)
	elseif cmd == "remove" then
		if not cmd[2] then
			os.exit(1)
		end
		
		remove_lease(arg)
		os.exit(0)		
	elseif cmd == "sync" then
		sync()
		os.exit(0)
	end
end

-- Add a lease to state and invoke add_rule
function add_lease(mac)
	local key = uci:add("luci_splash", "lease")
	uci:set("luci_splash", key, "mac", mac)
	uci:set("luci_splash", key, "start", os.time())
	add_rule(mac)
end


-- Remove a lease from state and invoke remove_rule
function remove_lease(mac)
	mac = mac:lower()

	for k, v in pairs(uci:show("luci_splash").luci_splash) do
		if v.mac:lower() == mac then
			remove_rule(mac)
			uci:del("luci_splash", k)
		end
	end
end


-- Add an iptables rule
function add_rule(mac)
	return os.execute("iptables -t nat -I luci_splash_leases -m mac --mac-source '"..mac.."' -j RETURN")
end


-- Remove an iptables rule
function remove_rule(mac)
	return os.execute("iptables -t nat -D luci_splash_leases -m mac --mac-source '"..mac.."' -j RETURN")
end


-- Check whether a MAC-Address is listed in the lease state list
function haslease(mac)
	mac = mac:lower()
	
	for k, v in pairs(uci:show("luci_splash").luci_splash) do
		if v[".type"] == "lease" and v.mac and v.mac:lower() == mac then
			return true
		end
	end
	
	return false
end


-- Check whether a MAC-Address is whitelisted
function iswhitelisted(mac)
	mac = mac:lower()
	
	for k, v in pairs(uci:show("luci_splash").luci_splash) do
		if v[".type"] == "whitelist" and v.mac and v.mac:lower() == mac then
			return true
		end
	end
	
	return false
end


-- Returns a list of MAC-Addresses for which a rule is existing
function listrules()
	local cmd = "iptables -t nat -L luci_splash_leases | grep RETURN |"
	cmd = cmd .. "egrep -io [0-9a-f]+:[0-9a-f]+:[0-9a-f]+:[0-9a-f]+:[0-9a-f]+:[0-9a-f]+"
	return ffluci.util.split(ffluci.sys.exec(cmd))
end


-- Synchronise leases, remove abandoned rules
function sync()
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
		if #r > 0 and not written[r] then
			remove_rule(r)
		end
	end
end

main(arg)