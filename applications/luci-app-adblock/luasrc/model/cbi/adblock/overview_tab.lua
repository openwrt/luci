-- Copyright 2017-2019 Dirk Brenken (dev@brenken.org)
-- This is free software, licensed under the Apache License, Version 2.0

local fs   = require("nixio.fs")
local uci  = require("luci.model.uci").cursor()
local util = require("luci.util")
local net  = require "luci.model.network".init()
local dump = util.ubus("network.interface", "dump", {})

m = Map("adblock", translate("Adblock"),
	translate("Configuration of the adblock package to block ad/abuse domains by using DNS. ")
	..translatef("For further information "
	.. "<a href=\"%s\" target=\"_blank\">"
	.. "check the online documentation</a>", "https://github.com/openwrt/packages/blob/master/net/adblock/files/README.md"))

-- Main adblock options

s = m:section(NamedSection, "global", "adblock")

o1 = s:option(Flag, "adb_enabled", translate("Enable Adblock"))
o1.default = o1.disabled
o1.rmempty = false

o2 = s:option(ListValue, "adb_dns", translate("DNS Backend (DNS Directory)"),
	translate("List of supported DNS backends with their default list export directory. ")
	..translate("To overwrite the default path use the 'DNS Directory' option in the extra section below."))
o2:value("dnsmasq", "dnsmasq (/tmp)")
o2:value("unbound", "unbound (/var/lib/unbound)")
o2:value("named", "named (/var/lib/bind)")
o2:value("kresd", "kresd (/etc/kresd)")
o2:value("dnscrypt-proxy","dnscrypt-proxy (/tmp)")
o2.default = "dnsmasq (/tmp)"
o2.rmempty = false

o3 = s:option(ListValue, "adb_fetchutil", translate("Download Utility"),
	translate("List of supported and fully pre-configured download utilities."))
o3:value("uclient-fetch")
o3:value("wget")
o3:value("curl")
o3:value("aria2c")
o3:value("wget-nossl", "wget-nossl (noSSL)")
o3:value("busybox", "wget-busybox (noSSL)")
o3.default = "uclient-fetch"
o3.rmempty = false

o4 = s:option(ListValue, "adb_trigger", translate("Startup Trigger"),
	translate("List of available network interfaces. Usually the startup will be triggered by the 'wan' interface. ")
	..translate("Choose 'none' to disable automatic startups, 'timed' to use a classic timeout (default 30 sec.) or select another trigger interface."))
o4:value("none")
o4:value("timed")
if dump then
	local i, v
	for i, v in ipairs(dump.interface) do
		if v.interface ~= "loopback" then
			local device = v.l3_device or v.device or "-"
			o4:value(v.interface, v.interface.. " (" ..device.. ")")
		end
	end
end
o4.rmempty = false

-- Runtime information

ds = s:option(DummyValue, "_dummy")
ds.template = "adblock/runtime"

-- Blocklist table

bl = m:section(TypedSection, "source", translate("Blocklist Sources"),
	translate("<b>Caution:</b> To prevent OOM exceptions on low memory devices with less than 64 MB free RAM, please only select a few of them!"))
bl.template = "adblock/blocklist"

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

cat = bl:option(DynamicList, "adb_src_cat", translate("Archive Categories"))
cat.datatype = "uciname"
cat.optional = true

-- Extra options

e = m:section(NamedSection, "extra", "adblock", translate("Extra Options"),
	translate("Options for further tweaking in case the defaults are not suitable for you."))

e1 = e:option(Flag, "adb_debug", translate("Verbose Debug Logging"),
	translate("Enable verbose debug logging in case of any processing error."))
e1.rmempty = false

e2 = e:option(Flag, "adb_nice", translate("Low Priority Service"),
	translate("Set the nice level to 'low priority' and the adblock background processing will take less resources from the system. ")
	..translate("This change requires a manual service stop/re-start to take effect."))
e2.disabled = "0"
e2.enabled = "10"
e2.rmempty = false

e3 = e:option(Flag, "adb_forcedns", translate("Force Local DNS"),
	translate("Redirect all DNS queries from 'lan' zone to the local resolver, apply to udp and tcp protocol on ports 53, 853 and 5353."))
e3.rmempty = false

e4 = e:option(Flag, "adb_backup", translate("Enable Blocklist Backup"),
	translate("Create compressed blocklist backups, they will be used in case of download errors or during startup in backup mode."))
e4.rmempty = false

e5 = e:option(Value, "adb_backupdir", translate("Backup Directory"),
	translate("Target directory for adblock backups. Please use only a non-volatile disk, e.g. an external usb stick."))
e5:depends("adb_backup", 1)
e5.datatype = "directory"
e5.default = "/mnt"
e5.rmempty = true

e6 = e:option(Flag, "adb_backup_mode", translate("Backup Mode"),
	translate("Do not automatically update blocklists during startup, use blocklist backups instead."))
e6:depends("adb_backup", 1)
e6.rmempty = true

e7 = e:option(Value, "adb_maxqueue", translate("Max. Download Queue"),
	translate("Size of the download queue to handle downloads &amp; list processing in parallel (default '8'). ")
	..translate("For further performance improvements you can raise this value, e.g. '8' or '16' should be safe."))
e7.default = 8
e7.datatype = "range(1,32)"
e7.rmempty = false

e8 = e:option(Flag, "adb_report", translate("Enable DNS Query Report"),
	translate("Gather dns related network traffic via tcpdump to provide a DNS Query Report on demand. ")
	..translate("Please note: this needs manual 'tcpdump-mini' package installation."))
e8.rmempty = false

e9 = e:option(Value, "adb_repdir", translate("Report Directory"),
	translate("Target directory for dns related report files. Please use preferably a non-volatile disk, e.g. an external usb stick."))
e9:depends("adb_report", 1)
e9.datatype = "directory"
e9.default = "/tmp"
e9.rmempty = true

e10 = e:option(Flag, "adb_notify", translate("Email Notification"),
	translate("Send notification emails in case of a processing error or if domain count is &le; 0. ")
	.. translate("Please note: this needs manual 'msmtp' package installation and setup."))
e10.rmempty = true

-- Optional Extra Options

e20 = e:option(Flag, "adb_jail", translate("'Jail' Blocklist Creation"),
	translate("Builds an additional 'Jail' list (/tmp/adb_list.jail) to block access to all domains except those listed in the whitelist file. ")
	.. translate("You can use this restrictive blocklist e.g. for guest wifi or kidsafe configurations."))
e20.optional = true
e20.default = nil

e21 = e:option(Value, "adb_notifycnt", translate("Email Notification Count"),
	translate("Raise the minimum email notification count, to get emails if the overall count is less or equal to the given limit (default 0), ")
	.. translate("e.g. to receive an email notification with every adblock update set this value to 150000."))
e21.default = 0
e21.datatype = "min(0)"
e21.optional = true

e22 = e:option(Value, "adb_dnsdir", translate("DNS Directory"),
	translate("Target directory for the generated blocklist 'adb_list.overall'."))
e22.datatype = "directory"
e22.optional = true

e23 = e:option(Value, "adb_whitelist", translate("Whitelist File"),
	translate("Full path to the whitelist file."))
e23.datatype = "file"
e23.default = "/etc/adblock/adblock.whitelist"
e23.optional = true

e24 = e:option(Value, "adb_triggerdelay", translate("Trigger Delay"),
	translate("Additional trigger delay in seconds before adblock processing begins."))
e24.datatype = "range(1,60)"
e24.optional = true

e25 = e:option(Flag, "adb_dnsflush", translate("Flush DNS Cache"),
	translate("Flush DNS Cache after adblock processing."))
e25.optional = true
e25.default = nil

e26 = e:option(ListValue, "adb_repiface", translate("Report Interface"),
	translate("Reporting interface used by tcpdump, set to 'any' for multiple interfaces (default 'br-lan'). ")
	..translate("This change requires a manual service stop/re-start to take effect."))
if dump then
	local i, v
	for i, v in ipairs(dump.interface) do
		if v.interface ~= "loopback" then
			local device = v.device
			if device then
				e26:value(device)
			end
		end
	end
end
e26:value("any")
e26.optional = true

e27 = e:option(Value, "adb_replisten", translate("Report Listen Port(s)"),
	translate("Space separated list of reporting port(s) used by tcpdump (default: '53'). ")
	..translate("This change requires a manual service stop/re-start to take effect."))
e27.default = 53
e27.optional = true

e28 = e:option(Value, "adb_repchunkcnt", translate("Report Chunk Count"),
	translate("Report chunk count used by tcpdump (default '5'). ")
	..translate("This change requires a manual service stop/re-start to take effect."))
e28.datatype = "range(1,10)"
e28.default = 5
e28.optional = true

e29 = e:option(Value, "adb_repchunksize", translate("Report Chunk Size"),
	translate("Report chunk size used by tcpdump in MB (default '1'). ")
	..translate("This change requires a manual service stop/re-start to take effect."))
e29.datatype = "range(1,10)"
e29.default = 1
e29.optional = true

return m
