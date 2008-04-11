-- ToDo: Translate, Add descriptions and help texts
require("ffluci.model.uci")
require("ffluci.sys")

m = Map("dhcp", "DHCP")

s = m:section(TypedSection, "dhcp")
s.addremove = true
s.anonymous = true

iface = s:option(ListValue, "interface", "Schnittstelle")
for k, v in pairs(ffluci.model.uci.show("network").network) do
	if v[".type"] == "interface" and k ~= "loopback" then
		iface:value(k)
	end
end

s:option(Value, "start", "Start").rmempty = true

s:option(Value, "limit", "Limit").rmempty = true

s:option(Flag, "dynamicdhcp", "Dynamisches DHCP").rmempty = true

s:option(Value, "name", "Name").optional = true

s:option(Flag, "ignore", "Schnittstelle ignorieren").optional = true

s:option(Value, "netmask", "Netzmaske").optional = true

s:option(Flag, "force", "Start erzwingen").optional = true

for i, line in pairs(ffluci.sys.execl("dnsmasq --help dhcp")) do
	k, v = line:match("([^ ]+) +([^ ]+)")
	s:option(Value, "dhcp"..k, v).optional = true
end
	
return m