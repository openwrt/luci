m = Map("uvc-streamer", translate("uvc_streamer"), translate("uvc_streamer_desc"))

s = m:section(TypedSection, "uvc-streamer", translate("settings"))
s.addremove = false
s.anonymous = true

s:option(Flag, "enabled", translate("enabled", "Enable"))

s:option(Value, "device", translate("device")).rmempty = true

nm = s:option(Value, "resolution", translate("resolution"))
nm:value("640x480")
nm:value("320x240")
nm:value("160x120")

s:option(Value, "framespersecond", translate("framespersecond")).rmempty = true

s:option(Value, "port", translate("port", "Port")).rmempty = true

return m
