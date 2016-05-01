-- Copyright 2016 Openwrt.org
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

fdns = s:option(Flag, "adb_forcedns", translate("Redirect all DNS queries to the local resolver"),
        translate("When adblock is active, all DNS queries are redirected to the local resolver " ..
        "in this server by default. You can disable that to allow queries to external DNS servers."))
fdns.rmempty = false
fdns.default = fdns.enabled

tot = s:option(DummyValue, "adb_overall_count", translate("Total count of blocked domains"))

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
cou = bl:option(DummyValue, "adb_src_count", translate("Count"))
upd = bl:option(DummyValue, "adb_src_timestamp", translate("List date/state"))

-- Additional options

s2 = m:section(NamedSection, "backup", "service", translate("Backup options"))

o4 = s2:option(Flag, "enabled", translate("Enable blocklist backup"))
o4.rmempty = false
o4.default = 0

o5 = s2:option(Value, "adb_dir", translate("Backup directory"))
o5.rmempty = false
o5.datatype = "directory"

-- Extra options

e = m:section(NamedSection, "global", "adblock", translate("Extra options"),
	translate("Options for further tweaking in case the defaults are not suitable for you."))

a1 = e:option(Value, "adb_nullport", translate("Port of the adblock uhttpd instance"))
a1.optional = true
a1.default = 65535
a1.datatype = "port"

a2 = e:option(Value, "adb_nullipv4", translate("IPv4 blackhole ip address"))
a2.optional = true
a2.default = "192.0.2.1"
a2.datatype = "ip4addr"

a3 = e:option(Value, "adb_nullipv6", translate("IPv6 blackhole ip address"))
a3.optional = true
a3.default = "::ffff:c000:0201"
a3.datatype = "ip6addr"

a7 = e:option(Value, "adb_lanif", translate("Name of the logical lan interface"))
a7.optional = true
a7.default = "lan"
a7.datatype = "network"

return m

