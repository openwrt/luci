package.path  = "/usr/lib/lua/?.lua;/usr/lib/lua/?/init.lua;" .. package.path
package.cpath = "/usr/lib/lua/?.so;" .. package.cpath

require("ffluci.http")
require("ffluci.sys")
require("ffluci.model.uci")

ucis = ffluci.model.uci.Session("/var/state")

function add_lease(mac)
	local key = ucis:add("luci_splash", "lease")
	ucis:set("luci_splash", key, "mac", mac)
	add_rule(mac)
end

function add_rule(mac)
	return os.execute("iptables -t nat -I luci_splash_leases -m mac --source-mac '"..mac.."' -j RETURN")
end

function remove_rule(mac)
	return os.execute("iptables -t nat -D luci_splash_leases -m mac --source-mac '"..mac.."' -j RETURN")
end

function get_usermac()
	local ip  = ffluci.http.remote_addr()
	local mac = nil
	
	for i, l in ipairs(ffluci.sys.net.arptable()) do
		if l["IP address"] == ip then
			mac = l["HW address"]
		end
	end
	
	return mac
end

function haslease(mac)
	mac = mac:lower()
	local list = ucis:show("luci_splash").luci_splash
	
	for k, v in pairs(list) do
		if v[".type"] == "lease" and v.mac and v.mac:lower() == mac then
			return true
		end
	end
	
	return false
end

function isblacklisted(mac)
	mac = mac:lower()
	local list = ucis:show("luci_splash").luci_splash
	
	for k, v in pairs(list) do
		if v[".type"] == "blacklist" and v.mac and v.mac:lower() == mac then
			return true
		end
	end
	
	return false
end

function iswhitelisted(mac)
	mac = mac:lower()
	local list = ucis:show("luci_splash").luci_splash
	
	for k, v in pairs(list) do
		if v[".type"] == "whitelist" and v.mac and v.mac:lower() == mac then
			return true
		end
	end
	
	return false
end