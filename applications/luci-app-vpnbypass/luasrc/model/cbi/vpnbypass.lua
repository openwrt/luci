m = Map("vpnbypass", translate("VPN Bypass Settings"))
s = m:section(NamedSection, "config", "vpnbypass")

-- General options
o1 = s:option(Flag, "enabled", translate("Enable VPN Bypass"))
o1.rmempty = false
o1.default = 0

-- Local Ports
p1 = s:option(DynamicList, "localport", translate("Local Ports to Bypass"), translate("Local ports to trigger VPN Bypass"))
p1.datatype    = "portrange"
p1.placeholder = "0-65535"
p1.addremove = true
p1.optional = true

-- Remote Ports
p2 = s:option(DynamicList, "remoteport", translate("Remote Ports to Bypass"), translate("Remote ports to trigger VPN Bypass"))
p2.datatype    = "portrange"
p2.placeholder = "0-65535"
p2.addremove = true
p2.optional = true

-- Local Subnets
r1 = s:option(DynamicList, "localsubnet", translate("Local IP Addresses to Bypass"), translate("Local IP addresses or subnets with direct internet access (outside of the VPN tunnel)"))
r1.datatype    = "ip4addr"
r1.placeholder = luci.ip.new(uci.cursor():get("network", "lan", "ipaddr") .. "/" .. uci.cursor():get("network", "lan", "netmask"))
r1.addremove = true
r1.optional = true

-- Remote Subnets
r2 = s:option(DynamicList, "remotesubnet", translate("Remote IP Addresses to Bypass"), translate("Remote IP addresses or subnets which will be accessed directly (outside of the VPN tunnel)"))
r2.datatype    = "ip4addr"
r2.placeholder = "0.0.0.0/0"
r2.addremove = true
r2.optional = true

-- Domains
d = Map("dhcp")
s4 = d:section(TypedSection, "dnsmasq")
s4.anonymous = true
di = s4:option(DynamicList, "ipset", translate("Domains to Bypass"),
    translate("Domains to be accessed directly (outside of the VPN tunnel), see ")
    .. [[<a href="https://github.com/openwrt/packages/tree/master/net/vpnbypass/files#bypass-domains-formatsyntax" target="_blank">]]
    .. translate("README") .. [[</a>]] .. translate(" for syntax"))

return m, d
