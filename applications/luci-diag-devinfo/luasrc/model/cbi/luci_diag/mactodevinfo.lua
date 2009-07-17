--[[
LuCI - Lua Configuration Interface

(c) 2009 Daniel Dickinson

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

m = Map("mactodevinfo", luci.i18n.translate("l_d_d_m_mac_to_devinfo_override"), translate("l_d_d_m_mac_to_devinfo_override_descr"))

s = m:section(TypedSection, "mactodevinfo", translate("l_d_d_m_mac_to_devinfo_section"), translate("l_d_d_m_mac_to_devinfo_section_descr"))
s.addremove = true
s.anonymous = true

v = s:option(Value, "name", translate("l_d_d_m_name"))
v.optional = true
v = s:option(Value, "maclow", translate("l_d_d_m_maclow"))
v.optional = false
v = s:option(Value, "machigh", translate("l_d_d_m_machigh"))
v.optional = false
v = s:option(Value, "vendor", translate("l_d_d_m_vendor"))
v.optional = false
v = s:option(Value, "devtype", translate("l_d_d_m_mactodevinfo_devtype"))
v.optional = false
v = s:option(Value, "model", translate("l_d_d_m_model"))
v.optional = false
v = s:option(Value, "ouiowneroverride", translate("l_d_d_m_ouiowneroverride"))
v.optional = true

return m
