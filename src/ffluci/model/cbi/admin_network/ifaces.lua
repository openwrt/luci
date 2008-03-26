m = Map("network", "Schnittstellen")

s = m:section(TypedSection, "interface")
s.addremove = true

p = s:option(ListValue, "proto", "Protokoll")
p:add_value("static", "statisch")
p:add_value("dhcp", "DHCP")
s:option(Value, "ipaddr", "IP-Adresse").optional = 1
s:option(Value, "netmask", "Netzmaske").optional = 1
s:option(Value, "gateway", "Gateway").optional = 1
s:option(Value, "dns", "DNS").optional = 1
s:option(Value, "mtu", "MTU").optional = 1

return m