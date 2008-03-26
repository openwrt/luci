m = Map("network", "VLAN", "Konfguriert den Switch des Routers.")

s = m:section(TypedSection, "switch")

-- ToDo: Autodetect things, maybe use MultiValue instead
for i = 0, 15 do
	local c = s:option(Value, "vlan"..i, "vlan"..i)
	c.default = "5"
	c.optional = true
end

return m