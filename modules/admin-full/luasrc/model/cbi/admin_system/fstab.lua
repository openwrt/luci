--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--
require("luci.tools.webadmin")
m = Map("fstab", translate("a_s_fstab"))

local mounts = luci.sys.mounts()

v = m:section(TypedSection, "_virtual", translate("a_s_fstab_active"))
v.anonymous = true
v.rowcolors = true
v.template  = "cbi/tblsection"

function v.cfgsections(self)
	local sections = {}
	for i=1,#mounts do
		table.insert(sections, i)
	end
	return sections
end

fs = v:option(DummyValue, "fs", translate("filesystem"))
function fs.cfgvalue(self, section)
	return mounts[section].fs
end

mp = v:option(DummyValue, "mountpoint", translate("a_s_fstab_mountpoint"))
function mp.cfgvalue(self, section)
	return mounts[section].mountpoint
end

avail = v:option(DummyValue, "avail", translate("a_s_fstab_avail"))
function avail.cfgvalue(self, section)
	return luci.tools.webadmin.byte_format(
	 tonumber(mounts[section].available) * 1024
	) .. " / " .. luci.tools.webadmin.byte_format(
	 tonumber(mounts[section].blocks) * 1024
	)
end

used = v:option(DummyValue, "used", translate("a_s_fstab_used"))
function used.cfgvalue(self, section)
	return mounts[section].percent .. " (" ..
	luci.tools.webadmin.byte_format(
	 tonumber(mounts[section].used) * 1024
	) .. ")"
end



mount = m:section(TypedSection, "mount", translate("a_s_fstab_mountpoints"), translate("a_s_fstab_mountpoints1"))
mount.anonymous = true
mount.addremove = true
mount.template = "cbi/tblsection"

mount:option(Flag, "enabled", translate("enable"))
mount:option(Value, "device", translate("device"), translate("a_s_fstab_device1"))
mount:option(Value, "target", translate("a_s_fstab_mountpoint"))
mount:option(Value, "fstype", translate("filesystem"), translate("a_s_fstab_fs1"))
mount:option(Value, "options", translate("options"), translatef("manpage", "siehe '%s' manpage", "mount"))


swap = m:section(TypedSection, "swap", "SWAP", translate("a_s_fstab_swap1"))
swap.anonymous = true
swap.addremove = true
swap.template = "cbi/tblsection"

swap:option(Flag, "enabled", translate("enable"))
swap:option(Value, "device", translate("device"), translate("a_s_fstab_device1"))

return m
