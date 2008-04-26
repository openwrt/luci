package.path  = "/usr/lib/lua/?.lua;/usr/lib/lua/?/init.lua;" .. package.path
package.cpath = "/usr/lib/lua/?.so;" .. package.cpath

require("ffluci.http")
require("ffluci.sys")
require("ffluci.model.uci")

-- Init state session
uci = ffluci.model.uci.Session("/var/state")


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


-- Get the MAC-Address of current user
function ip4mac(ip)
	local mac = nil
	
	for i, l in ipairs(ffluci.sys.net.arptable()) do
		if l["IP address"] == ip then
			mac = l["HW address"]
		end
	end
	
	return mac
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