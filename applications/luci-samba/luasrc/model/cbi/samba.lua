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

m = Map("samba", translate("Network Shares"))

s = m:section(TypedSection, "samba", "Samba")
s.anonymous = true

s:option(Value, "name", translate("Hostname"))
s:option(Value, "description", translate("Description"))
s:option(Value, "workgroup", translate("Workgroup"))
s:option(Flag, "homes", translate("Share home-directories"),
        translate("Allow system users to reach their home directories via " ..
                "network shares"))


s = m:section(TypedSection, "sambashare", translate("Shared Directories"))
s.anonymous = true
s.addremove = true
s.template = "cbi/tblsection"

s:option(Value, "name", translate("Name"))
pth = s:option(Value, "path", translate("Path"))
if nixio.fs.access("/etc/config/fstab") then
        pth.titleref = luci.dispatcher.build_url("admin", "system", "fstab")
end

s:option(Value, "users", translate("Allowed users")).rmempty = true

ro = s:option(Flag, "read_only", translate("Read-only"))
ro.rmempty = false
ro.enabled = "yes"
ro.disabled = "no"

go = s:option(Flag, "guest_ok", translate("Allow guests"))
go.rmempty = false
go.enabled = "yes"
go.disabled = "no"

cm = s:option(Value, "create_mask", translate("Create mask"),
        translate("Mask for new files"))
cm.rmempty = true
cm.size = 4

dm = s:option(Value, "dir_mask", translate("Directory mask"),
        translate("Mask for new directories"))
dm.rmempty = true
dm.size = 4


return m
