-- Copyright 2016 Hannu Nyman
-- Licensed to the public under the Apache License 2.0.

m = Map("adblock", translate("Adblock"),
	translate("Configuration of the adblock package to block ad/abuse domains by using DNS."))

-- General options

s = m:section(NamedSection, "global", "adblock", translate("Global options"))

o1 = s:option(Flag, "adb_enabled", translate("Enable adblock"))
o1.rmempty = false
o1.default = 0

o3 = s:option(Value, "adb_whitelist", translate("Whitelist file"),
     translate("File with whitelisted hosts/domains that are allowed despite being on a blocklist."))
o3.rmempty = false
o3.datatype = "file"

-- Blocklist options

bl = m:section(TypedSection, "source", translate("Blocklist sources"),
	translate("Available blocklist sources (")
	.. [[<a href="https://github.com/openwrt/packages/blob/master/net/adblock/files/README.md" target="_blank">]]
	.. translate("see list details")
	.. [[</a>]]
	.. translate("). Note that list URLs and Shallalist category selections are not configurable via Luci."))
bl.template = "cbi/tblsection"

name = bl:option(Flag, "enabled", translate("Enabled"))
name.rmempty  = false

des = bl:option(DummyValue, "adb_src_desc", translate("Description"))

-- Additional options

s2 = m:section(NamedSection, "global", "adblock", translate("Backup options"))

o4 = s2:option(Flag, "adb_backup", translate("Enable blocklist backup"))
o4.rmempty = false
o4.default = 0

o5 = s2:option(Value, "adb_backupdir", translate("Backup directory"))
o5.rmempty = false
o5.datatype = "directory"

-- Extra options

e = m:section(NamedSection, "global", "adblock", translate("Extra options"),
	translate("Options for further tweaking in case the defaults are not suitable for you."))

a = e:option(Flag, "adb_debug", translate("Enable verbose debug logging"))
a.default = a.disabled
a.rmempty = false

a = e:option(Value, "adb_iface", translate("Restrict reload trigger to certain interface(s)"),
	translate("Space separated list of wan interfaces that trigger reload action. " ..
		"To disable reload trigger set it to 'false'. Default: empty"))
a.datatype = "network"
a.rmempty = true

return m

