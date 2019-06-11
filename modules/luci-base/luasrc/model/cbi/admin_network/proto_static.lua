-- Copyright 2011 Jo-Philipp Wich <jow@openwrt.org>
-- Licensed to the public under the Apache License 2.0.

local map, section, net = ...
local ifc = net:get_interface()

local netmask, gateway, broadcast, dns, accept_ra, send_rs, ip6addr, ip6gw
local mtu, metric, usecidr, ipaddr_single, ipaddr_multi


local function is_cidr(s)
	return (type(s) == "string" and luci.ip.IPv4(s) and s:find("/"))
end

usecidr = section:taboption("general", Value, "ipaddr_usecidr")
usecidr.forcewrite = true

usecidr.cfgvalue = function(self, section)
	local cfgvalue = self.map:get(section, "ipaddr")
	return (type(cfgvalue) == "table" or is_cidr(cfgvalue)) and "1" or "0"
end

usecidr.render = function(self, section, scope)
	luci.template.Template(nil, [[
		<input type="hidden"<%= attr("id", cbid) .. attr("name", cbid) .. attr("value", value) %> />
	]]):render({
		cbid = self:cbid(section),
		value = self:cfgvalue(section)
	})
end

usecidr.write = function(self, section)
	local cfgvalue = self.map:get(section, "ipaddr")
	local formvalue = (self:formvalue(section) == "1") and ipaddr_multi:formvalue(section) or ipaddr_single:formvalue(section)
	local equal = (cfgvalue == formvalue)

	if not equal and type(cfgvalue) == "table" and type(formvalue) == "table" and #cfgvalue == #formvalue then
		equal = true

		local _, v
		for _, v in ipairs(cfgvalue) do
			if v ~= formvalue[_] then
				equal = false
				break
			end
		end
	end

	if not equal then
		self.map:set(section, "ipaddr", formvalue or "")
	end

	return not equal
end


ipaddr_multi = section:taboption("general", DynamicList, "ipaddrs", translate("IPv4 address"))
ipaddr_multi:depends("ipaddr_usecidr", "1")
ipaddr_multi.datatype = "or(cidr4,ipnet4)"
ipaddr_multi.placeholder = translate("Add IPv4 address…")

ipaddr_multi.alias = "ipaddr"
ipaddr_multi.write = function() end
ipaddr_multi.remove = function() end
ipaddr_multi.cfgvalue = function(self, section)
	local addr = self.map:get(section, "ipaddr")
	local mask = self.map:get(section, "netmask")

	if is_cidr(addr) then
		return { addr }
	elseif type(addr) == "string" and
	       type(mask) == "string" and
	       #addr > 0 and #mask > 0
	then
		return { "%s/%s" %{ addr, mask } }
	elseif type(addr) == "table" then
		return addr
	else
		return {}
	end
end


ipaddr_single = section:taboption("general", Value, "ipaddr", translate("IPv4 address"))
ipaddr_single:depends("ipaddr_usecidr", "0")
ipaddr_single.datatype = "ip4addr"
ipaddr_single.template = "cbi/ipaddr"
ipaddr_single.write = function() end
ipaddr_single.remove = function() end


netmask = section:taboption("general", Value, "netmask", translate("IPv4 netmask"))
netmask:depends("ipaddr_usecidr", "0")
netmask.datatype = "ip4addr"
netmask:value("255.255.255.0")
netmask:value("255.255.0.0")
netmask:value("255.0.0.0")


gateway = section:taboption("general", Value, "gateway", translate("IPv4 gateway"))
gateway.datatype = "ip4addr"


broadcast = section:taboption("general", Value, "broadcast", translate("IPv4 broadcast"))
broadcast.datatype = "ip4addr"


dns = section:taboption("general", DynamicList, "dns",
	translate("Use custom DNS servers"))

dns.datatype = "ipaddr"
dns.cast     = "string"


if luci.model.network:has_ipv6() then

	local ip6assign = section:taboption("general", Value, "ip6assign", translate("IPv6 assignment length"),
		translate("Assign a part of given length of every public IPv6-prefix to this interface"))
	ip6assign:value("", translate("disabled"))
	ip6assign:value("64")
	ip6assign.datatype = "max(64)"

	local ip6hint = section:taboption("general", Value, "ip6hint", translate("IPv6 assignment hint"),
		translate("Assign prefix parts using this hexadecimal subprefix ID for this interface."))
	for i=33,64 do ip6hint:depends("ip6assign", i) end

	ip6addr = section:taboption("general", DynamicList, "ip6addr", translate("IPv6 address"))
	ip6addr.datatype = "ip6addr"
	ip6addr.placeholder = translate("Add IPv6 address…")
	ip6addr:depends("ip6assign", "")


	ip6gw = section:taboption("general", Value, "ip6gw", translate("IPv6 gateway"))
	ip6gw.datatype = "ip6addr"
	ip6gw:depends("ip6assign", "")


	local ip6prefix = s:taboption("general", Value, "ip6prefix", translate("IPv6 routed prefix"),
		translate("Public prefix routed to this device for distribution to clients."))
	ip6prefix.datatype = "ip6addr"
	ip6prefix:depends("ip6assign", "")

	local ip6ifaceid = s:taboption("general", Value, "ip6ifaceid", translate("IPv6 suffix"),
		translate("Optional. Allowed values: 'eui64', 'random', fixed value like '::1' " ..
			"or '::1:2'. When IPv6 prefix (like 'a:b:c:d::') is received from a " ..
			"delegating server, use the suffix (like '::1') to form the IPv6 address " ..
			"('a:b:c:d::1') for the interface."))
	ip6ifaceid.datatype = "ip6hostid"
	ip6ifaceid.placeholder = "::1"
	ip6ifaceid.rmempty = true

end


luci.tools.proto.opt_macaddr(section, ifc, translate("Override MAC address"))


mtu = section:taboption("advanced", Value, "mtu", translate("Override MTU"))
mtu.placeholder = "1500"
mtu.datatype    = "max(9200)"


metric = section:taboption("advanced", Value, "metric",
	translate("Use gateway metric"))

metric.placeholder = "0"
metric.datatype    = "uinteger"
