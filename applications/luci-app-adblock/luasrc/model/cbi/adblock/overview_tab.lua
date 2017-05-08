-- Copyright 2017 Dirk Brenken (dev@brenken.org)
-- This is free software, licensed under the Apache License, Version 2.0

local fs = require("nixio.fs")
local uci = require("uci")
local sys = require("luci.sys")
local json = require("luci.jsonc")
local adbinput = uci.get("adblock", "global", "adb_rtfile") or "/tmp/adb_runtime.json"
local parse = json.parse(fs.readfile(adbinput) or "")
local dnsFile1 = sys.exec("find '/tmp/dnsmasq.d/.adb_hidden' -maxdepth 1 -type f -name 'adb_list*' -print 2>/dev/null")
local dnsFile2 = sys.exec("find '/var/lib/unbound/.adb_hidden' -maxdepth 1 -type f -name 'adb_list*' -print 2>/dev/null")

m = Map("adblock", translate("Adblock"),
	translate("Configuration of the adblock package to block ad/abuse domains by using DNS. ")
	.. translatef("For further information "
	.. "<a href=\"%s\" target=\"_blank\">"
	.. "see online documentation</a>", "https://github.com/openwrt/packages/blob/master/net/adblock/files/README.md"))

function m.on_after_commit(self)
	luci.sys.call("/etc/init.d/adblock reload >/dev/null 2>&1")
	luci.http.redirect(luci.dispatcher.build_url("admin", "services", "adblock"))
end

-- Main adblock options

s = m:section(NamedSection, "global", "adblock")

o1 = s:option(Flag, "adb_enabled", translate("Enable adblock"))
o1.default = o1.enabled
o1.rmempty = false

btn = s:option(Button, "", translate("Suspend / Resume adblock"))
if dnsFile1 ~= "" or dnsFile2 ~= "" then
	btn.inputtitle = translate("Resume adblock")
	btn.inputstyle = "apply"
	btn.disabled = false
	function btn.write()
		luci.sys.call("/etc/init.d/adblock resume >/dev/null 2>&1")
		luci.http.redirect(luci.dispatcher.build_url("admin", "services", "adblock"))
	end
else
	btn.inputtitle = translate("Suspend adblock")
	btn.inputstyle = "reset"
	btn.disabled = false
	function btn.write()
		luci.sys.call("/etc/init.d/adblock suspend >/dev/null 2>&1")
		luci.http.redirect(luci.dispatcher.build_url("admin", "services", "adblock"))
	end
end

o2 = s:option(Value, "adb_iface", translate("Restrict interface trigger to certain interface(s)"),
	translate("Space separated list of interfaces that trigger adblock processing. "..
	"To disable event driven (re-)starts remove all entries."))
o2.rmempty = true

o3 = s:option(Value, "adb_triggerdelay", translate("Trigger delay"),
	translate("Additional trigger delay in seconds before adblock processing begins."))
o3.default = 2
o3.datatype = "range(1,90)"
o3.rmempty = false

o4 = s:option(Flag, "adb_debug", translate("Enable verbose debug logging"))
o4.default = o4.disabled
o4.rmempty = false

-- Runtime information

ds = s:option(DummyValue, "_dummy", translate("Runtime information"))
ds.template = "cbi/nullsection"

dv1 = s:option(DummyValue, "status", translate("Status"))
dv1.template = "adblock/runtime"
if parse == nil then
	dv1.value = translate("n/a")
elseif parse.data.blocked_domains == "0" then
	dv1.value = translate("no domains blocked")
elseif dnsFile1 ~= "" or dnsFile2 ~= "" then
	dv1.value = translate("suspended")
else
	dv1.value = translate("active")
end
dv2 = s:option(DummyValue, "adblock_version", translate("Adblock version"))
dv2.template = "adblock/runtime"
if parse ~= nil then
	dv2.value = parse.data.adblock_version or translate("n/a")
else
	dv2.value = translate("n/a")
end

dv3 = s:option(DummyValue, "fetch_info", translate("Download Utility (SSL Library)"),
	translate("For SSL protected blocklist sources you need a suitable SSL library, e.g. 'libustream-ssl' or the wget 'built-in'."))
dv3.template = "adblock/runtime"
if parse ~= nil then
	dv3.value = parse.data.fetch_info or translate("n/a")
else
	dv3.value = translate("n/a")
end

dv4 = s:option(DummyValue, "dns_backend", translate("DNS backend"))
dv4.template = "adblock/runtime"
if parse ~= nil then
	dv4.value = parse.data.dns_backend or translate("n/a")
else
	dv4.value = translate("n/a")
end

dv5 = s:option(DummyValue, "blocked_domains", translate("Blocked domains (overall)"))
dv5.template = "adblock/runtime"
if parse ~= nil then
	dv5.value = parse.data.blocked_domains or translate("n/a")
else
	dv5.value = translate("n/a")
end

dv6 = s:option(DummyValue, "last_rundate", translate("Last rundate"))
dv6.template = "adblock/runtime"
if parse ~= nil then
	dv6.value = parse.data.last_rundate or translate("n/a")
else
	dv6.value = translate("n/a")
end

-- Blocklist table

bl = m:section(TypedSection, "source", translate("Blocklist sources"),
	translate("Available blocklist sources. ")
	.. translate("Note that list URLs and Shallalist category selections are configurable in the 'Advanced' section."))
bl.template = "cbi/tblsection"

name = bl:option(Flag, "enabled", translate("Enabled"))
name.rmempty = false

ssl = bl:option(DummyValue, "adb_src", translate("SSL req."))
function ssl.cfgvalue(self, section)
	local source = self.map:get(section, "adb_src")
	if source and source:match("https://") then
		return translate("Yes")
	else
		return translate("No")
	end
end

des = bl:option(DummyValue, "adb_src_desc", translate("Description"))

-- Extra options

e = m:section(NamedSection, "global", "adblock", translate("Extra options"),
	translate("Options for further tweaking in case the defaults are not suitable for you."))

e1 = e:option(Flag, "adb_forcedns", translate("Force local DNS"),
	translate("Redirect all DNS queries to the local resolver."))
e1.default = e1.disabled
e1.rmempty = false

e2 = e:option(Flag, "adb_forcesrt", translate("Force Overall Sort"),
	translate("Enable memory intense overall sort / duplicate removal on low memory devices (&lt; 64 MB RAM)"))
e2.default = e2.disabled
e2.rmempty = false

e3 = e:option(Flag, "adb_backup", translate("Enable blocklist backup"))
e3.default = e3.disabled
e3.rmempty = false

e4 = e:option(Value, "adb_backupdir", translate("Backup directory"))
e4.datatype = "directory"
e4.rmempty = false

return m
