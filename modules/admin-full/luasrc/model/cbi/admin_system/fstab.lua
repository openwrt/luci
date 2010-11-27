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
mount.extedit  = luci.dispatcher.build_url("admin/system/fstab/mount/%s")

mount.create = function(...)
	local sid = TypedSection.create(...)
	if sid then
		luci.http.redirect(mount.extedit % sid)
		return
	end
end


mount:option(Flag, "enabled", translate("Enabled")).rmempty = false

dev = mount:option(DummyValue, "device", translate("Device"))
dev.cfgvalue = function(self, section)
	local v

	v = m.uci:get("fstab", section, "uuid")
	if v then return "UUID: %s" % v end

	v = m.uci:get("fstab", section, "label")
	if v then return "Label: %s" % v end

	v = Value.cfgvalue(self, section) or "?"
	return size[v] and "%s (%s MB)" % {v, size[v]} or v
end

mp = mount:option(DummyValue, "target", translate("Mount Point"))
mp.cfgvalue = function(self, section)
	if m.uci:get("fstab", section, "is_rootfs") == "1" then
		return "/overlay"
	else
		return Value.cfgvalue(self, section) or "?"
	end
end

fs = mount:option(DummyValue, "fstype", translate("Filesystem"))
fs.cfgvalue = function(self, section)
	return Value.cfgvalue(self, section) or "?"
end

op = mount:option(DummyValue, "options", translate("Options"))
op.cfgvalue = function(self, section)
	return Value.cfgvalue(self, section) or "defaults"
end

rf = mount:option(DummyValue, "is_rootfs", translate("Root"))
rf.cfgvalue = function(self, section)
	return Value.cfgvalue(self, section) == "1"
		and translate("yes") or translate("no")
end

ck = mount:option(DummyValue, "enabled_fsck", translate("Check"))
ck.cfgvalue = function(self, section)
	return Value.cfgvalue(self, section) == "1"
		and translate("yes") or translate("no")
end


swap = m:section(TypedSection, "swap", "SWAP", translate("If your physical memory is insufficient unused data can be temporarily swapped to a swap-device resulting in a higher amount of usable <abbr title=\"Random Access Memory\">RAM</abbr>. Be aware that swapping data is a very slow process as the swap-device cannot be accessed with the high datarates of the <abbr title=\"Random Access Memory\">RAM</abbr>."))
swap.anonymous = true
swap.addremove = true
swap.template = "cbi/tblsection"
swap.extedit  = luci.dispatcher.build_url("admin/system/fstab/swap/%s")

swap.create = function(...)
	local sid = TypedSection.create(...)
	if sid then
		luci.http.redirect(swap.extedit % sid)
		return
	end
end


swap:option(Flag, "enabled", translate("Enabled")).rmempty = false

dev = swap:option(DummyValue, "device", translate("Device"))
dev.cfgvalue = function(self, section)
	local v

	v = m.uci:get("fstab", section, "uuid")
	if v then return "UUID: %s" % v end

	v = m.uci:get("fstab", section, "label")
	if v then return "Label: %s" % v end

	v = Value.cfgvalue(self, section) or "?"
	return size[v] and "%s (%s MB)" % {v, size[v]} or v
end

return m
