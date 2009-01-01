--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>
Copyright 2008 Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

m = Map("samba")

s = m:section(TypedSection, "samba", "Samba")
s.anonymous = true

s:option(Value, "name")
s:option(Value, "description")
s:option(Value, "workgroup")
s:option(Flag, "homes")


s = m:section(TypedSection, "sambashare")
s.anonymous = true
s.addremove = true
s.template = "cbi/tblsection"

s:option(Value, "name", translate("name"))
s:option(Value, "path").titleref = luci.dispatcher.build_url("admin", "system", "fstab")

s:option(Value, "users").rmempty = true

ro = s:option(Flag, "read_only")
ro.rmempty = false
ro.enabled = "yes"
ro.disabled = "no"

go = s:option(Flag, "guest_ok")
go.rmempty = false
go.enabled = "yes"
go.disabled = "no"

cm = s:option(Value, "create_mask")
cm.rmempty = true
cm.size = 4

dm = s:option(Value, "dir_mask")
dm.rmempty = true
dm.size = 4


return m
