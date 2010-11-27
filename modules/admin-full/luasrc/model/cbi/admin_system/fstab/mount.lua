--[[
LuCI - Lua Configuration Interface

Copyright 2010 Jo-Philipp Wich <xm@subsignal.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

local fs   = require "nixio.fs"
local util = require "nixio.util"

local has_extroot = fs.access("/lib/preinit/00_extroot.conf")
local has_fscheck = fs.access("/lib/functions/fsck.sh")

local devices = {}
util.consume((fs.glob("/dev/sd*")), devices)
util.consume((fs.glob("/dev/hd*")), devices)
util.consume((fs.glob("/dev/scd*")), devices)
util.consume((fs.glob("/dev/mmc*")), devices)

local size = {}
for i, dev in ipairs(devices) do
	local s = tonumber((fs.readfile("/sys/class/block/%s/size" % dev:sub(6))))
	size[dev] = s and math.floor(s / 2048)
end


m = Map("fstab", translate("Mount Points - Mount Entry"))
m.redirect = luci.dispatcher.build_url("admin/system/fstab")

if not arg[1] or m.uci:get("fstab", arg[1]) ~= "mount" then
	luci.http.redirect(m.redirect)
	return
end



mount = m:section(NamedSection, arg[1], "mount", translate("Mount Entry"))
mount.anonymous = true
mount.addremove = false

mount:tab("general",  translate("General Settings"))
mount:tab("advanced", translate("Advanced Settings"))


mount:taboption("general", Flag, "enabled", translate("Enable this mount")).rmempty = false


o = mount:taboption("general", Value, "device", translate("Device"),
	translate("The device file of the memory or partition (<abbr title=\"for example\">e.g.</abbr> <code>/dev/sda1</code>)"))

for i, d in ipairs(devices) do
	o:value(d, size[d] and "%s (%s MB)" % {d, size[d]})
end

o = mount:taboption("advanced", Value, "uuid", translate("UUID"),
	translate("If specified, mount the device by its UUID instead of a fixed device node"))

o = mount:taboption("advanced", Value, "label", translate("Label"),
	translate("If specified, mount the device by the partition label instead of a fixed device node"))


o = mount:taboption("general", Value, "target", translate("Mount point"),
	translate("Specifies the directory the device is attached to"))

o:depends("is_rootfs", "")


o = mount:taboption("general", Value, "fstype", translate("Filesystem"),
	translate("The filesystem that was used to format the memory (<abbr title=\"for example\">e.g.</abbr> <samp><abbr title=\"Third Extended Filesystem\">ext3</abbr></samp>)"))

local fs
for fs in io.lines("/proc/filesystems") do
	fs = fs:match("%S+")
	if fs ~= "nodev" then
		o:value(fs)
	end
end


o = mount:taboption("advanced", Value, "options", translate("Mount options"),
	translate("See \"mount\" manpage for details"))

o.placeholder = "defaults"


if has_extroot then
	o = mount:taboption("general", Flag, "is_rootfs", translate("Use as root filesystem"),
		translate("Configures this mount as overlay storage for block-extroot"))

	o:depends("fstype", "jffs")
	o:depends("fstype", "ext2")
	o:depends("fstype", "ext3")
	o:depends("fstype", "ext4")
end

if has_fscheck then
	o = mount:taboption("general", Flag, "enabled_fsck", translate("Run filesystem check"),
		translate("Run a filesystem check before mounting the device"))
end

return m
