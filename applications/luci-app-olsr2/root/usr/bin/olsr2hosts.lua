#!/usr/bin/lua

--[[
echo "*/5 * * * *     olsr2hosts.lua > /tmp/hosts/olsr2.tmp && mv /tmp/hosts/olsr2.tmp /tmp/hosts/olsr2" >> /etc/crontabs/root
echo "1 */1 * * *     rm /tmp/hosts/olsr2" >> /etc/crontabs/root
/etc/init.d/cron restart
uci set dhcp.odhcpd.maindhcp='0'
uci set dhcp.@dnsmasq[0].localservice='0'
uci set dhcp.@dnsmasq[0].add_local_fqdn='3'
uci set dhcp.@dnsmasq[0].add_wan_fqdn='3'
uci commit dhcp
/etc/init.d/dnsmasq restart

#dnsmasq need a dhcp config section for every interface with A, AAAA, in-addr.arpa, and ip6.arpa entry.
config dhcp 'lan'
        option interface 'lan'
        option ignore '1'

config dhcp 'radio0_mesh'
        option interface 'radio0_mesh'
        option ignore '1'

/etc/init.d/dnsmasq restart

]]--

local json = require "luci.json"
local utl = require "luci.util"
local uci = require "luci.model.uci".cursor()
local req_json
local telnet_port = uci:get_first("olsrd2", "telnet", "port")
local resolve = uci:get_first("luci_olsr2", "olsr2", "resolve")
local hosts = {}
local cov


if not telnet_port then
	print("no telnet port")
	os.exit("-1")
end

if not (resolve == "1") then
	print("no resolve 2",resolve)
	os.exit("-1")
end

req_json = json.decode(utl.exec("(echo '/nhdpinfo json neighbor /quit' | nc ::1 %d) 2>/dev/null" % telnet_port))
if not req_json then
	print("no olsr2")
	os.exit("-1")
end

for _, neighbors in pairs(req_json) do
	for nidx, neighbor in pairs(neighbors) do
		if not neighbor then
			return
		end
		local ip = neighbor["neighbor_originator"]
		local hostname
		local lookup
		hostname = nixio.getnameinfo(ip)
		if not hostname then
			lookup = utl.execi("nslookup %s 2>/dev/null" % ip.." "..ip)
			if lookup then
				for line in lookup do
					hostname = line:match("^.*name = (.+)") or hostname
				end
			end
		end
		if hostname then
			hosts[#hosts+1] = {}
			hosts[#hosts].hostname = hostname
			hosts[#hosts].ip = ip
			if lookup then
				cov = 1
			end
		end
	end
end
if cov then
	for _, val in ipairs(hosts) do
		print(val.ip,val.hostname)
	end
else
	os.exit("-1")
end
