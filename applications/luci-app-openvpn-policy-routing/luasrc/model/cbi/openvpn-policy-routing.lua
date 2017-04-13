readmeURL = "https://github.com/openwrt/packages/tree/master/net/openvpn-policy-routing/files/README.md"
readmeURL = "https://github.com/stangri/openwrt-packages/blob/openvpn-policy-routing/net/openvpn-policy-routing/files/README.md"

function log(obj)
	if obj ~= nil then if type(obj) == "table" then luci.util.dumptable(obj) else luci.util.perror(obj) end else luci.util.perror("Empty object") end
end

-- General options
c = Map("openvpn-policy-routing", translate("OpenVPN/WAN Policy-Based Routing"))
s1 = c:section(NamedSection, "config", "openvpn-policy-routing", translate("General"))
s1.rmempty  = false

e = s1:option(Flag, "enabled", translate("Enable/start service"))
e.rmempty  = false

function e.cfgvalue(self, section)
	return self.map:get(section, "enabled") == "1" and luci.sys.init.enabled("openvpn-policy-routing") and self.enabled or self.disabled
end

function e.write(self, section, value)
	if value == "1" then
		luci.sys.call("/etc/init.d/openvpn-policy-routing enable >/dev/null")
		luci.sys.call("/etc/init.d/openvpn-policy-routing start >/dev/null")
	else
		luci.sys.call("/etc/init.d/openvpn-policy-routing stop >/dev/null")
	end
	return Flag.write(self, section, value)
end

se = s1:option(ListValue, "strict_enforcement", translate("Strict enforcement"),translate("See ")
  .. [[<a href="]] .. readmeURL .. [[#strict-enforcement" target="_blank">]]
  .. translate("README") .. [[</a>]] .. translate(" for details"))
se:value("0", translate("Do not enforce policies when their gateway is down"))
se:value("1", translate("Strictly enforce policies when their gateway is down"))
se.rmempty = false
se.default = 1

v = s1:option(ListValue, "verbosity", translate("Output verbosity"),translate("Controls both system log and console output verbosity"))
v:value("0", translate("Suppress output"))
v:value("1", translate("Some output"))
v:value("2", translate("Verbose output"))
v.rmempty = false
v.default = 2

-- Domains
if nixio.fs.access("/var/run/dnsmasq/") and nixio.fs.access("/etc/config/dhcp") then
  for f in nixio.fs.dir("/var/run/dnsmasq/") do
    if string.match(f, "dnsmasq.cfg.*.pid") then
      uci.cursor():foreach("dhcp", "dnsmasq", function(s)
        if s.port ~= "0" then
          dnsserver = "dnsmasq"
        end
      end)
    end
  end
end

if dnsserver == "dnsmasq" then
  d = Map("dhcp")
  s2 = d:section(TypedSection, "dnsmasq", translate("Domain-based Policies"))
  s2.anonymous = true
  di = s2:option(DynamicList, "ipset", translate("Domain Policies"), translate("Domains routed via specific gateways, see ")
    .. [[<a href="]] .. readmeURL .. [[#domain-based-policies" target="_blank">]]
    .. translate("README") .. [[</a>]] .. translate(" for details"))
else
  d = Map("openvpn-policy-routing")
  s2 = d:section(TypedSection, "domain-policy", translate("Domains"))
  s2.anonymous = true
  s2.addremove = true
  di = s2:option(DynamicList, "ipset", translate("Domain Policies"), translate("Domains routed via specific gateways, see ")
    .. [[<a href="]] .. readmeURL .. [[#domain-based-policies" target="_blank">]]
    .. translate("README") .. [[</a>]] .. translate(" for details"))
end

-- Policies
p = Map("openvpn-policy-routing")
p.tabbed = true
p.template="cbi/map-openvpn-policy-routing"

s3 = p:section(TypedSection, "policy", translate("IPv4/Port-based Policies"), translate("Comment, gateway and at least one other field are required. Placeholders below represent just the format/syntax and will not be used if fields are left blank."))
s3.template = "cbi/tblsection"
s3.sortable  = true
s3.anonymous = true
s3.addremove = true
-- function s3.validate(self, sid)
-- 	c  = self.map:get(sid, "comment")
-- 	la = self.map:get(sid, "local_addrs")
-- 	lp = self.map:get(sid, "local_ports")
-- 	ra = self.map:get(sid, "remote_addrs")
-- 	rp = self.map:get(sid, "remote_ports")
-- 	gw = self.map:get(sid, "gateway")
-- 	if c and gw then
-- 		if la or lp or ra or rp then
-- 			return sid
-- 		end
-- 	else
-- 		return sid
-- 	end
-- end

s3:option(Value, "comment", translate("Comment"))

la = s3:option(Value, "local_addrs", translate("Local addresses"))
la.datatype    = "ip4addr"
if uci.cursor():get("network", "lan", "ipaddr") and uci.cursor():get("network", "lan", "netmask") then
	la.placeholder = luci.ip.new(uci.cursor():get("network", "lan", "ipaddr") .. "/" .. uci.cursor():get("network", "lan", "netmask"))
end
la.rmempty = true

lp = s3:option(Value, "local_ports", translate("Local ports"))
lp.datatype    = "portrange"
lp.placeholder = "0-65535"
lp.rmempty = true

ra = s3:option(Value, "remote_addrs", translate("Remote addresses"))
ra.datatype    = "ip4addr"
ra.placeholder = "0.0.0.0/0"
ra.rmempty = true

rp = s3:option(Value, "remote_ports", translate("Remote ports"))
rp.datatype    = "portrange"
rp.placeholder = "0-65535"
rp.rmempty = true

gw = s3:option(ListValue, "gateway", translate("Gateway"))
-- gw.datatype = "network"
gw.rmempty = false
gw.default = "wan"
gw:value("wan")
for k, ifname in pairs(luci.sys.net.devices()) do
  if string.sub(ifname,1,3) == "tun" or string.sub(ifname,1,3) == "tap" then
		gw:value(ifname)
	end
end

-- IPv6 Policies
s4 = p:section(TypedSection, "policy_ipv6", translate("IPv6/Port-based Policies"), translate("Comment, gateway and at least one other field are required. Placeholders below represent just the format/syntax and will not be used if fields are left blank."))
s4.template = "cbi/tblsection"
s4.sortable  = true
s4.anonymous = true
s4.addremove = true

s4:option(Value, "comment", translate("Comment"))

la6 = s4:option(Value, "local_addrs", translate("Local addresses"))
la6.datatype    = "ip6addr"
la6.placeholder = uci.cursor():get("network", "lan", "ip6prefix") or "::/0"
la6.rmempty = true

lp6 = s4:option(Value, "local_ports", translate("Local ports"))
lp6.datatype    = "portrange"
lp6.placeholder = "0-65535"
lp6.rmempty = true

ra6 = s4:option(Value, "remote_addrs", translate("Remote addresses"))
ra6.datatype    = "ip6addr"
ra6.placeholder = "::/0"
ra6.rmempty = true

rp6 = s4:option(Value, "remote_ports", translate("Remote ports"))
rp6.datatype    = "portrange"
rp6.placeholder = "0-65535"
rp6.rmempty = true

gw6 = s4:option(ListValue, "gateway", translate("Gateway"))
gw6.rmempty = false
gw6.default = "wan"
gw6:value("wan")
for k, ifname in pairs(luci.sys.net.devices()) do
  if string.sub(ifname,1,3) == "tun" or string.sub(ifname,1,3) == "tap" then
		gw6:value(ifname)
	end
end

dscp = Map("openvpn-policy-routing")
s6 = dscp:section(NamedSection, "config", "openvpn-policy-routing", translate("DSCP Tagging"), translate("Set DSCP tags (in range between 1 and 63) for specific gateways."))
wan = s6:option(Value, "wan_dscp", translate("wan dscp tag"))
wan.datatype = "range(1, 63)"
wan.rmempty = true
luci.model.uci.cursor():foreach("network", "interface", function(s)
	local name=s['.name']
	local ifname=s['ifname']
	if name and ifname then
		if string.sub(ifname,1,3) == "tun" or string.sub(ifname,1,3) == "tap" then
			s6:option(Value, ifname .. "_dscp", ifname .. " " .. translate("dscp tag")).rmempty = true
		end
	end
end)

return c, d, p, dscp
