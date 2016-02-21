-- Copyright 2016 Openwrt.org
-- Licensed to the public under the Apache License 2.0.

m = Map("adblock", translate("Adblock"),
	translate("Configuration of the adblock package to block ad/abuse domains by using DNS."))

-- General options

s = m:section(NamedSection, "global", "adblock", translate("Global options"))

o1 = s:option(Flag, "adb_enabled", translate("Enable adblock"))
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

des = bl:option(DummyValue, "adb_srcdesc", translate("Description"))
des.rmempty  = false

-- Additional options

s2 = m:section(NamedSection, "backup", "service", translate("Backup options"))

o4 = s2:option(Flag, "enabled", translate("Enable blocklist backup"))
o4.rmempty = false
o4.default = 0

o5 = s2:option(Value, "adb_backupdir", translate("Backup directory"))
o5.rmempty = false
o5.datatype = "directory"

s3 = m:section(NamedSection, "log", "service", translate("Log options"))

o6 = s3:option(Flag, "enabled", translate("Enable log"))
o6.rmempty = false
o6.default = 0

o7 = s3:option(Value, "adb_logfile", translate("Log file"))
o7.rmempty = false
o7.datatype = "string"

-- Extra options

e = m:section(NamedSection, "global", "adblock", translate("Extra options"),
	translate("Options for further tweaking in case the defaults are not suitable for you."))

a1 = e:option(Value, "adb_port", translate("Port of the adblock uhttpd instance"))
a1.optional = true
a1.rmempty = true
a1.default = 65535
a1.datatype = "port"

a2 = e:option(Value, "adb_nullipv4", translate("IPv4 blackhole ip address"))
a2.optional = true
a2.rmempty = true
a2.default = "192.0.2.1"
a2.datatype = "ip4addr"

a3 = e:option(Value, "adb_nullipv6", translate("IPv6 blackhole ip address"))
a3.optional = true
a3.rmempty = true
a3.default = "::ffff:c000:0201"
a3.datatype = "ip6addr"

a4 = e:option(Value, "adb_maxtime", translate("Download timeout limit in seconds"))
a4.optional = true
a4.rmempty = true
a4.default = 60
a4.datatype = "uinteger"

a5 = e:option(Value, "adb_maxloop", translate("Timeout limit for active wan lookup at startup"))
a5.optional = true
a5.rmempty = true
a5.default = 20
a5.datatype = "uinteger"

a6 = e:option(Value, "adb_wanif", translate("Name of the logical wan interface"))
a6.optional = true
a6.rmempty = true
a6.default = "wan"
a6.datatype = "network"

a7 = e:option(Value, "adb_lanif", translate("Name of the logical lan interface"))
a7.optional = true
a7.rmempty = true
a7.default = "lan"
a7.datatype = "network"

a8 = e:option(Value, "adb_probeipv4", translate("IPv4 address used for uplink online check"))
a8.optional = true
a8.rmempty = true
a8.default = "8.8.8.8"
a8.datatype = "ip4addr"

a9 = e:option(Value, "adb_probeipv6", translate("IPv6 address used for uplink online check"))
a9.optional = true
a9.rmempty = true
a9.default = "2001:4860:4860::8888"
a9.datatype = "ip6addr"

return m

