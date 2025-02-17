--[[

LuCI LXC module

Copyright (C) 2014, Cisco Systems, Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

Author: Petar Koretic <petar.koretic@sartura.hr>

]]--

m = Map("lxc", translate("LXC Containers"),
	translate("<b>Please note:</b> LXC Containers require features not available on OpenWrt images for devices with small flash.<br />")
	.. translate("Also you may want to install 'kmod-veth' for optional network support."))
m:section(SimpleSection).template = "lxc"

s = m:section(TypedSection, "lxc", translate("Options"))
s.anonymous = true

o1 = s:option(Value, "url", translate("Containers URL"))
o1:value("images.linuxcontainers.org")
o1:value("repo.turris.cz/lxc", "repo.turris.cz/lxc (SSL req.)")
o1.default = "images.linuxcontainers.org"
o1.rmempty = false

o3 = s:option(Value, "min_space", translate("Free Space Threshold"),
	translate("Minimum required free space for LXC Container creation in KB"))
o3.default = "100000"
o3.datatype = "min(50000)"
o3.rmempty = false

o4 = s:option(Value, "min_temp", translate("Free Temp Threshold"),
	translate("Minimum required free temp space for LXC Container creation in KB"))
o4.default = "100000"
o4.datatype = "min(50000)"
o4.rmempty = false

return m
