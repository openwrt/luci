-- Copyright 2016 Hannu Nyman
-- Copyright 2017 Dirk Brenken (dev@brenken.org)
-- This is free software, licensed under the Apache License, Version 2.0

local sys = require("luci.sys")
local util = require("luci.util")
local data = util.ubus("service", "get_data", "name", "adblock") or { }
local dnsFile1 = sys.exec("find '/tmp/dnsmasq.d' -maxdepth 1 -type f -name 'adb_list*' -print 2>/dev/null")
local dnsFile2 = sys.exec("find '/var/lib/unbound' -maxdepth 1 -type f -name 'adb_list*' -print 2>/dev/null")

m = Map("adblock", translate("Adblock"),
	translate("Configuration of the adblock package to block ad/abuse domains by using DNS. ")
	.. translate("For further information ")
	.. [[<a href="https://github.com/openwrt/packages/blob/master/net/adblock/files/README.md" target="_blank">]]
	.. translate("see online documentation")
	.. [[</a>]]
	.. translate("."))

-- Main adblock options

s = m:section(NamedSection, "global", "adblock")

o1 = s:option(Flag, "adb_enabled", translate("Enable adblock"))
o1.rmempty = false
o1.default = 0

btn = s:option(Button, "", translate("Suspend / Resume adblock"))
if data.adblock == nil then
	btn.inputtitle = "n/a"
	btn.inputstyle = nil
	btn.disabled = true
elseif dnsFile1 ~= "" or dnsFile2 ~= "" then
	btn.inputtitle = "Suspend adblock"
	btn.inputstyle = "reset"
	btn.disabled = false
	function btn.write()
		luci.sys.call("/etc/init.d/adblock suspend >/dev/null 2>&1")
	end
else
	btn.inputtitle = "Resume adblock"
	btn.inputstyle = "apply"
	btn.disabled = false
	function btn.write()
		luci.sys.call("/etc/init.d/adblock resume >/dev/null 2>&1")
	end
end

o2 = s:option(Flag, "adb_debug", translate("Enable verbose debug logging"))
o2.default = o2.disabled
o2.rmempty = false

o3 = s:option(Value, "adb_iface", translate("Restrict interface reload trigger to certain interface(s)"),
	translate("Space separated list of interfaces that trigger a reload action. "..
	"To disable reload trigger at all set it to 'false'."))
o3.rmempty =false

-- Runtime information

	ds = s:option(DummyValue, "_dummy", translate("Runtime information"))
	ds.template = "cbi/nullsection"

	dv1 = s:option(DummyValue, "adblock_version", translate("Adblock version"))
	dv1.template = "adblock/runtime"
	if data.adblock ~= nil then
		dv1.value = data.adblock.adblock.adblock_version or "n/a"
	else
		dv1.value = "n/a"
	end

	dv2 = s:option(DummyValue, "status", translate("Status"))
	dv2.template = "adblock/runtime"
	if data.adblock == nil then
		dv2.value = "n/a"
	elseif dnsFile1 ~= "" or dnsFile2 ~= "" then
		dv2.value = "active"
	else
		dv2.value = "suspended"
	end

	dv3 = s:option(DummyValue, "dns_backend", translate("DNS backend"))
	dv3.template = "adblock/runtime"
	if data.adblock ~= nil then
		dv3.value = data.adblock.adblock.dns_backend or "n/a"
	else
		dv3.value = "n/a"
	end

	dv4 = s:option(DummyValue, "blocked_domains", translate("Blocked domains (overall)"))
	dv4.template = "adblock/runtime"
	if data.adblock ~= nil then
		dv4.value = data.adblock.adblock.blocked_domains or "n/a"
	else
		dv4.value = "n/a"
	end

	dv5 = s:option(DummyValue, "last_rundate", translate("Last rundate"))
	dv5.template = "adblock/runtime"
	if data.adblock ~= nil then
		dv5.value = data.adblock.adblock.last_rundate or "n/a"
	else
		dv5.value = "n/a"
	end

-- Blocklist options

bl = m:section(TypedSection, "source", translate("Blocklist sources"),
	translate("Available blocklist sources. ")
	.. translate("Note that list URLs and Shallalist category selections are configurable in the 'Advanced' section."))
bl.template = "cbi/tblsection"

name = bl:option(Flag, "enabled", translate("Enabled"))
name.rmempty  = false

des = bl:option(DummyValue, "adb_src_desc", translate("Description"))

-- Backup options

s = m:section(NamedSection, "global", "adblock", translate("Backup options"))

o4 = s:option(Flag, "adb_backup", translate("Enable blocklist backup"))
o4.rmempty = false
o4.default = 0

o5 = s:option(Value, "adb_backupdir", translate("Backup directory"))
o5.rmempty = false
o5.datatype = "directory"

return m
