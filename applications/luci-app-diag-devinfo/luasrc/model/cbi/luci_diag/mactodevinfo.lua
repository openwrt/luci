-- Copyright 2009 Daniel Dickinson
-- Licensed to the public under the Apache License 2.0.

m = Map("mactodevinfo", luci.i18n.translate("MAC Device Info Overrides"), translate("Override the information returned by the MAC to Device Info Script (mac-to-devinfo) for a specified range of MAC Addresses"))

s = m:section(TypedSection, "mactodevinfo", translate("MAC Device Override"), translate("MAC range and information used to override system and IEEE databases"))
s.addremove = true
s.anonymous = true

v = s:option(Value, "name", translate("Name"))
v.optional = true
v = s:option(Value, "maclow", translate("Beginning of MAC address range"))
v.optional = false
v = s:option(Value, "machigh", translate("End of MAC address range"))
v.optional = false
v = s:option(Value, "vendor", translate("Vendor"))
v.optional = false
v = s:option(Value, "devtype", translate("Device Type"))
v.optional = false
v = s:option(Value, "model", translate("Model"))
v.optional = false
v = s:option(Value, "ouiowneroverride", translate("OUI Owner"))
v.optional = true

return m
