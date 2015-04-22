--[[
 Redsocks2 高级配置页面
 Copyright (C) 2015 GuoGuo <gch981213@gmail.com>
]]--

m = Map("redsocks2", translate("Redsocks2 - Advanced Options"))

s = m:section(TypedSection, "redsocks2_autoproxy", translate("Auto Proxy Options"))
s.anonymous = true

o = s:option(Value, "no_quick_check_seconds", translate("Direct Connect Timeout"))
o.datatype = "uinteger"

o = s:option(Value, "quick_connect_timeout", translate("Quick Check Timeout"))
o.datatype = "uinteger"

s = m:section(TypedSection, "redsocks2_ipcache", translate("IP Cache Options"))
s.anonymous = true

o = s:option(Value, "cache_size", translate("Max Cached Records(K)"))
o.datatype = "uinteger"

o = s:option(Value, "cache_file", translate("Cache File Path"))

o = s:option(Value, "stale_time", translate("Stale Time"))
o.datatype = "uinteger"

o = s:option(Value, "autosave_interval", translate("Autosave Interval"))
o.datatype = "uinteger"

o = s:option(Flag, "port_check", translate("Enable Port-based IP Cache"))
o.rmempty = false

return m
