-- ToDo: Translate, Add descriptions and help texts
m = Map("network", "Schnittstellen")

s = m:section(TypedSection, "interface")
s.addremove = true
s:exclude("loopback")
s:depends("proto", "static")
s:depends("proto", "dhcp")

p = s:option(ListValue, "proto", "Protokoll")
p:value("static", "statisch")
p:value("dhcp", "DHCP")

s:option(Value, "ifname", "Schnittstelle")

s:option(Value, "ipaddr", "IP-Adresse")

s:option(Value, "netmask", "Netzmaske"):depends("proto", "static")

gw = s:option(Value, "gateway", "Gateway")
gw:depends("proto", "static")
gw.rmempty = true

dns = s:option(Value, "dns", "DNS-Server")
dns:depends("proto", "static")
dns.optional = true

mtu = s:option(Value, "mtu", "MTU")
mtu.optional = true
mtu.isinteger = true

return m