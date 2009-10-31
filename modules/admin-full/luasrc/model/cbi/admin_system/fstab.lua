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

local fs   = require "nixio.fs"
local util = require "nixio.util"

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


m = Map("fstab", translate("Mount Points"))

local mounts = luci.sys.mounts()

v = m:section(Table, mounts, translate("Mounted file systems"))

fs = v:option(DummyValue, "fs", translate("Filesystem"))

mp = v:option(DummyValue, "mountpoint", translate("Mount Point"))

avail = v:option(DummyValue, "avail", translate("Available"))
function avail.cfgvalue(self, section)
	return luci.tools.webadmin.byte_format(
		( tonumber(mounts[section].available) or 0 ) * 1024
	) .. " / " .. luci.tools.webadmin.byte_format(
		( tonumber(mounts[section].blocks) or 0 ) * 1024
	)
end

used = v:option(DummyValue, "used", translate("Used"))
function used.cfgvalue(self, section)
	return ( mounts[section].percent or "0%" ) .. " (" ..
	luci.tools.webadmin.byte_format(
		( tonumber(mounts[section].used) or 0 ) * 1024
	) .. ")"
end



mount = m:section(TypedSection, "mount", translate("Mount Points"), translate("Mount Points define at which point a memory device will be attached to the filesystem"))
mount.anonymous = true
mount.addremove = true
mount.template = "cbi/tblsection"

mount:option(Flag, "enabled", translate("enable")).rmempty = false
dev = mount:option(Value, "device", translate("Device"), translate("The device file of the memory or partition (<abbr title=\"for example\">e.g.</abbr> <code>/dev/sda1</code>)"))
for i, d in ipairs(devices) do
	dev:value(d, size[d] and "%s (%s MB)" % {d, size[d]})
end

mount:option(Value, "target", translate("Mount Point"))
mount:option(Value, "fstype", translate("Filesystem"), translate("The filesystem that was used to format the memory (<abbr title=\"for example\">e.g.</abbr> <samp><abbr title=\"Third Extended Filesystem\">ext3</abbr></samp>)"))
mount:option(Value, "options", translate("Options"), translate("See \"mount\" manpage for details"))


swap = m:section(TypedSection, "swap", "SWAP", translate("If your physical memory is insufficient unused data can be temporarily swapped to a swap-device resulting in a higher amount of usable <abbr title=\"Random Access Memory\">RAM</abbr>. Be aware that swapping data is a very slow process as the swap-device cannot be accessed with the high datarates of the <abbr title=\"Random Access Memory\">RAM</abbr>."))
swap.anonymous = true
swap.addremove = true
swap.template = "cbi/tblsection"

swap:option(Flag, "enabled", translate("enable")).rmempty = false
dev = swap:option(Value, "device", translate("Device"), translate("The device file of the memory or partition (<abbr title=\"for example\">e.g.</abbr> <code>/dev/sda1</code>)"))
for i, d in ipairs(devices) do
	dev:value(d, size[d] and "%s (%s MB)" % {d, size[d]})
end

return m
