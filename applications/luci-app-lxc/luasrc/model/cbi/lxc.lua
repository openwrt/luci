--[[

LuCI LXC module

Copyright (C) 2014, Cisco Systems, Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

Author: Petar Koretic <petar.koretic@sartura.hr>

]]--

local fs = require "nixio.fs"

m = Map("lxc", translate("LXC Containers"),
	translate("<b>Please note:</b> For LXC Containers you need a custom OpenWrt image.<br />")
	.. translate("The image should include at least support for 'kernel cgroups', 'kernel namespaces' and 'miscellaneous LXC related options'."))

if fs.access("/etc/config/lxc") then
	m:section(SimpleSection).template = "lxc"

	s = m:section(TypedSection, "lxc", translate("Options"))
	s.anonymous = true
	s.addremove = false

	s:option(Value, "url", translate("Containers URL"))
end

return m
