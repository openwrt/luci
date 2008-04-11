-- ToDo: Autodetect things, maybe use MultiValue instead, Translate, Add descriptions
m = Map("network", "VLAN", "Konfguriert den Switch des Routers.")

s = m:section(TypedSection, "switch")

for i = 0, 15 do
	s:option(Value, "vlan"..i, "vlan"..i).optional = true
end

return m