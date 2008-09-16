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

local fs = require "luci.fs"
local devices = {}
luci.util.update(devices, fs.glob("/dev/sd*") or {})
luci.util.update(devices, fs.glob("/dev/hd*") or {})
luci.util.update(devices, fs.glob("/dev/scd*") or {})
luci.util.update(devices, fs.glob("/dev/mmc*") or {})

local size = {}
for i, dev in ipairs(devices) do
	local s = tonumber((luci.fs.readfile("/sys/class/block/%s/size" % dev:sub(6))))
	size[dev] = s and math.floor(s / 2048)
end


m = Map("fstab", translate("a_s_fstab"))

local mounts = luci.sys.mounts()

v = m:section(Table, mounts, translate("a_s_fstab_active"))

fs = v:option(DummyValue, "fs", translate("filesystem"))

mp = v:option(DummyValue, "mountpoint", translate("a_s_fstab_mountpoint"))

avail = v:option(DummyValue, "avail", translate("a_s_fstab_avail"))
function avail.cfgvalue(self, section)
	return luci.tools.webadmin.byte_format(
		( tonumber(mounts[section].available) or 0 ) * 1024
	) .. " / " .. luci.tools.webadmin.byte_format(
		( tonumber(mounts[section].blocks) or 0 ) * 1024
	)
end

used = v:option(DummyValue, "used", translate("a_s_fstab_used"))
function used.cfgvalue(self, section)
	return ( mounts[section].percent or "0%" ) .. " (" ..
	luci.tools.webadmin.byte_format(
		( tonumber(mounts[section].used) or 0 ) * 1024
	) .. ")"
end



mount = m:section(TypedSection, "mount", translate("a_s_fstab_mountpoints"), translate("a_s_fstab_mountpoints1"))
mount.anonymous = true
mount.addremove = true
mount.template = "cbi/tblsection"

mount:option(Flag, "enabled", translate("enable"))
dev = mount:option(Value, "device", translate("device"), translate("a_s_fstab_device1"))
for i, d in ipairs(devices) do
	dev:value(d, size[d] and "%s (%s MB)" % {d, size[d]})
end

mount:option(Value, "target", translate("a_s_fstab_mountpoint"))
mount:option(Value, "fstype", translate("filesystem"), translate("a_s_fstab_fs1"))
mount:option(Value, "options", translate("options"), translatef("manpage", "siehe '%s' manpage", "mount"))


swap = m:section(TypedSection, "swap", "SWAP", translate("a_s_fstab_swap1"))
swap.anonymous = true
swap.addremove = true
swap.template = "cbi/tblsection"

swap:option(Flag, "enabled", translate("enable"))
dev = swap:option(Value, "device", translate("device"), translate("a_s_fstab_device1"))
for i, d in ipairs(devices) do
	dev:value(d, size[d] and "%s (%s MB)" % {d, size[d]})
end

return m
