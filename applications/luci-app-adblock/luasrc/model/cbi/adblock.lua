-- Copyright 2016 Openwrt.org
-- Licensed to the public under the Apache License 2.0.

m = Map("adblock", translate("Adblock"),
	translate("Configuration of the adblock package to block ad/abuse domains by using DNS."))

-- General options

s = m:section(NamedSection, "global", "adblock", translate("Global options"))

o1 = s:option(Flag, "adb_enabled", translate("Enable"))
o1.rmempty = false
o1.default = 0

o2 = s:option(Value, "adb_blacklist", translate("Blacklist file"),
     translate("File with explicitly blacklisted hosts/domains."))
o2.rmempty = false
o2.datatype = "file"

o3 = s:option(Value, "adb_whitelist", translate("Whitelist file"),
     translate("File with whitelisted hosts/domains that are allowed despite being on a blocklist."))
o3.rmempty = false
o3.datatype = "file"

s2 = m:section(NamedSection, "backup", "service", translate("Backup options"))

o4 = s2:option(Flag, "enabled", translate("Enable blocklist backup"))
o4.rmempty = false
o4.default = 0

o5 = s2:option(Value, "adb_backupdir", translate("Backup directory"))
o5.rmempty = false
o5.datatype = "directory"

s3 = m:section(NamedSection, "debuglog", "service", translate("Debug log options"),
	translate("Verbose log for debuging purposes."))

o6 = s3:option(Flag, "enabled", translate("Enable debug log"))
o6.rmempty = false
o6.default = 0

o7 = s3:option(Value, "adb_logfile", translate("Debug log file"))
o7.rmempty = false
o7.datatype = "string"

-- Blocklist options

s3 = m:section(TypedSection, "source", translate("Blocklist sources"),
	translate("Available blocklist sources (")
	.. [[<a href="https://github.com/openwrt/packages/blob/master/net/adblock/files/README.md#main-features" target="_blank">]]
	.. translate("see list details")
	.. [[</a>]]
	.. translate("). Note that list URLs and Shallalist category selections are not configurable via Luci."))

name = s3:option(Flag, "enabled", translate("Enabled"))
name.rmempty  = false


return m

