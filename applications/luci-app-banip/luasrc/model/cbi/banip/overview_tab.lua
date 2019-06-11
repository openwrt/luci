-- Copyright 2018-2019 Dirk Brenken (dev@brenken.org)
-- This is free software, licensed under the Apache License, Version 2.0

local fs   = require("nixio.fs")
local uci  = require("luci.model.uci").cursor()
local net  = require "luci.model.network".init()
local util = require("luci.util")
local dump = util.ubus("network.interface", "dump", {})

m = Map("banip", translate("banIP"),
	translate("Configuration of the banIP package to block ip adresses/subnets via IPSet. ")
	..translatef("For further information "
	.. "<a href=\"%s\" target=\"_blank\">"
	.. "check the online documentation</a>", "https://github.com/openwrt/packages/blob/master/net/banip/files/README.md"))

-- Main banIP Options

s = m:section(NamedSection, "global", "banip")

o1 = s:option(Flag, "ban_enabled", translate("Enable banIP"))
o1.default = o1.disabled
o1.rmempty = false

o2 = s:option(Flag, "ban_automatic", translate("Automatic WAN Interface Detection"))
o2.default = o2.enabled
o2.rmempty = false

o3 = s:option(MultiValue, "ban_iface", translate("Interface Selection"),
	translate("Disable the automatic WAN detection and select your preferred interface(s) manually."))
if dump then
	local i, v
	for i, v in ipairs(dump.interface) do
		if v.interface ~= "loopback" and v.interface ~= "lan" then
			local device = v.l3_device or v.device or "-"
			o3:value(v.interface, v.interface.. " (" ..device.. ")")
		end
	end
end
o3.widget = "checkbox"
o3.rmempty = false

o4 = s:option(ListValue, "ban_fetchutil", translate("Download Utility"),
	translate("List of supported and fully pre-configured download utilities."))
o4:value("uclient-fetch")
o4:value("wget")
o4:value("curl")
o4:value("aria2c")
o4:value("wget-nossl", "wget-nossl (noSSL)")
o4:value("busybox", "wget-busybox (noSSL)")
o4.default = "uclient-fetch"
o4.rmempty = false
	
-- Runtime Information

ds = s:option(DummyValue, "_dummy")
ds.template = "banip/runtime"

-- Source Table

bl = m:section(TypedSection, "source", translate("IP Blocklist Sources"))
bl.template = "banip/sourcelist"

ssl = bl:option(DummyValue, "ban_src", translate("SSL req."))
function ssl.cfgvalue(self, section)
	local source = self.map:get(section, "ban_src") or self.map:get(section, "ban_src_6")
	if source then
		if source:match("https://") then
			return translate("Yes")
		else
			return translate("No")
		end
	end
	return translate("n/a")
end

name_4 = bl:option(Flag, "ban_src_on", translate("enable IPv4"))
name_4.rmempty = false

name_6 = bl:option(Flag, "ban_src_on_6", translate("enable IPv6"))
name_6.rmempty = false

type = bl:option(ListValue, "ban_src_ruletype", translate("SRC/DST"))
type:value("src")
type:value("dst")
type:value("src+dst")
type.default = "src"
type.rmempty = false

des = bl:option(DummyValue, "ban_src_desc", translate("Description"))

cat = bl:option(DynamicList, "ban_src_cat", translate("ASN/Country"))
cat.datatype = "uciname"
cat.optional = true

-- Extra options

e = m:section(NamedSection, "extra", "banip", translate("Extra Options"),
	translate("Options for further tweaking in case the defaults are not suitable for you."))

e1 = e:option(Flag, "ban_debug", translate("Verbose Debug Logging"),
	translate("Enable verbose debug logging in case of any processing error."))
e1.rmempty = false

e2 = e:option(Flag, "ban_nice", translate("Low Priority Service"),
	translate("Set the nice level to 'low priority' and banIP background processing will take less resources from the system. ")
	..translate("This change requires a manual service stop/re-start to take effect."))
e2.disabled = "0"
e2.enabled = "10"
e2.rmempty = false

e3 = e:option(Flag, "ban_backup", translate("Enable Blocklist Backup"),
	translate("Create compressed blocklist backups, they will be used in case of download errors or during startup in 'backup mode'."))
e3.rmempty = false

e4 = e:option(Value, "ban_backupdir", translate("Backup Directory"),
	translate("Target directory for banIP backups. Please use preferably a non-volatile disk, e.g. an external usb stick."))
e4:depends("ban_backup", 1)
e4.datatype = "directory"
e4.default = "/mnt"
e4.rmempty = true

e5 = e:option(Flag, "ban_backupboot", translate("Backup Mode"),
	translate("Do not automatically update blocklists during startup, use their backups instead."))
e5:depends("ban_backup", 1)
e5.rmempty = true

e6 = e:option(Value, "ban_maxqueue", translate("Max. Download Queue"),
	translate("Size of the download queue to handle downloads &amp; IPset processing in parallel (default '4'). ")
	.. translate("For further performance improvements you can raise this value, e.g. '8' or '16' should be safe."))
e6.default = 4
e6.datatype = "range(1,32)"
e6.rmempty = false

-- Optional Extra Options

e20 = e:option(Value, "ban_triggerdelay", translate("Trigger Delay"),
	translate("Additional trigger delay in seconds before banIP processing begins."))
e20.default = 2
e20.datatype = "range(1,60)"
e20.optional = true

e21 = e:option(Value, "ban_fetchparm", translate("Download Options"),
	translate("Special options for the selected download utility, e.g. '--timeout=20 --no-check-certificate -O'."))
e21.optional = true

e22 = e:option(Value, "ban_wan_input_chain", translate("WAN Input Chain IPv4"))
e22.default = "input_wan_rule"
e22.datatype = "uciname"
e22.optional = true

e23 = e:option(Value, "ban_wan_forward_chain", translate("WAN Forward Chain IPv4"))
e23.default = "forwarding_wan_rule"
e23.datatype = "uciname"
e23.optional = true

e24 = e:option(Value, "ban_lan_input_chain", translate("LAN Input Chain IPv4"))
e24.default = "input_lan_rule"
e24.datatype = "uciname"
e24.optional = true

e25 = e:option(Value, "ban_lan_forward_chain", translate("LAN Forward Chain IPv4"))
e25.default = "forwarding_lan_rule"
e25.datatype = "uciname"
e25.optional = true

e26 = e:option(ListValue, "ban_target_src", translate("SRC Target IPv4"))
e26:value("REJECT")
e26:value("DROP")
e26.default = "DROP"
e26.optional = true

e27 = e:option(ListValue, "ban_target_dst", translate("DST Target IPv4"))
e27:value("REJECT")
e27:value("DROP")
e27.default = "REJECT"
e27.optional = true

e28 = e:option(Value, "ban_wan_input_chain_6", translate("WAN Input Chain IPv6"))
e28.default = "input_wan_rule"
e28.datatype = "uciname"
e28.optional = true

e29 = e:option(Value, "ban_wan_forward_chain_6", translate("WAN Forward Chain IPv6"))
e29.default = "forwarding_wan_rule"
e29.datatype = "uciname"
e29.optional = true

e30 = e:option(Value, "ban_lan_input_chain_6", translate("LAN Input Chain IPv6"))
e30.default = "input_lan_rule"
e30.datatype = "uciname"
e30.optional = true

e31 = e:option(Value, "ban_lan_forward_chain_6", translate("LAN Forward Chain IPv6"))
e31.default = "forwarding_lan_rule"
e31.datatype = "uciname"
e31.optional = true

e32 = e:option(ListValue, "ban_target_src_6", translate("SRC Target IPv6"))
e32:value("REJECT")
e32:value("DROP")
e32.default = "DROP"
e32.optional = true

e33 = e:option(ListValue, "ban_target_dst_6", translate("DST Target IPv6"))
e33:value("REJECT")
e33:value("DROP")
e33.default = "REJECT"
e33.optional = true

return m
