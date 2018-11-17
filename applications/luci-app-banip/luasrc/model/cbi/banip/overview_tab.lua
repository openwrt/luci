-- Copyright 2018 Dirk Brenken (dev@brenken.org)
-- This is free software, licensed under the Apache License, Version 2.0

local fs      = require("nixio.fs")
local uci     = require("luci.model.uci").cursor()
local sys     = require("luci.sys")
local net     = require "luci.model.network".init()
local util    = require("luci.util")
local dump    = util.ubus("network.interface", "dump", {})
local devices = sys.net:devices()

m = Map("banip", translate("banIP"),
	translate("Configuration of the banIP package to block ip adresses/subnets via IPSet. ")
	.. translatef("For further information "
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
for _, dev in ipairs(devices) do
	if dev ~= "lo" and dev ~= "br-lan" then
		local iface = net:get_interface(dev)
		if iface then
			iface = iface:get_networks() or {}
			for k, v in pairs(iface) do
				iface[k] = iface[k].sid
				if iface[k] ~= "lan" then
					o3:value(iface[k], iface[k].. " (" ..dev.. ")")
				end
			end
		end
	end
end
o3.widget = "checkbox"
o3.default = ban_iface
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
e1.default = e1.disabled
e1.rmempty = false

e2 = e:option(Flag, "ban_nice", translate("Low Priority Service"),
	translate("Set the nice level to 'low priority' and banIP background processing will take less resources from the system. ")
	..translate("This change requires a manual service stop/re-start to take effect."))
e2.default = e2.disabled
e2.disabled = "0"
e2.enabled = "10"
e2.rmempty = false

e3 = e:option(Value, "ban_maxqueue", translate("Max. Download Queue"),
	translate("Size of the download queue to handle downloads &amp; IPset processing in parallel (default '8'). ")
	.. translate("For further performance improvements you can raise this value, e.g. '16' or '32' should be safe."))
e3.default = 8
e3.datatype = "range(1,32)"
e3.rmempty = false

e4 = e:option(Value, "ban_triggerdelay", translate("Trigger Delay"),
	translate("Additional trigger delay in seconds before banIP processing begins."))
e4.default = 2
e4.datatype = "range(1,60)"
e4.optional = true

e5 = e:option(Value, "ban_fetchparm", translate("Download Options"),
	translate("Special options for the selected download utility, e.g. '--timeout=20 --no-check-certificate -O'."))
e5.optional = true

e10 = e:option(Value, "ban_wan_input_chain", translate("WAN Input Chain IPv4"))
e10.default = "input_wan_rule"
e10.datatype = "uciname"
e10.optional = true

e11 = e:option(Value, "ban_wan_forward_chain", translate("WAN Forward Chain IPv4"))
e11.default = "forwarding_wan_rule"
e11.datatype = "uciname"
e11.optional = true

e12 = e:option(Value, "ban_lan_input_chain", translate("LAN Input Chain IPv4"))
e12.default = "input_lan_rule"
e12.datatype = "uciname"
e12.optional = true

e13 = e:option(Value, "ban_lan_forward_chain", translate("LAN Forward Chain IPv4"))
e13.default = "forwarding_lan_rule"
e13.datatype = "uciname"
e13.optional = true

e14 = e:option(ListValue, "ban_target_src", translate("SRC Target IPv4"))
e14:value("REJECT")
e14:value("DROP")
e14.default = "DROP"
e14.optional = true

e15 = e:option(ListValue, "ban_target_dst", translate("DST Target IPv4"))
e15:value("REJECT")
e15:value("DROP")
e15.default = "REJECT"
e15.optional = true

e16 = e:option(Value, "ban_wan_input_chain_6", translate("WAN Input Chain IPv6"))
e16.default = "input_wan_rule"
e16.datatype = "uciname"
e16.optional = true

e17 = e:option(Value, "ban_wan_forward_chain_6", translate("WAN Forward Chain IPv6"))
e17.default = "forwarding_wan_rule"
e17.datatype = "uciname"
e17.optional = true

e18 = e:option(Value, "ban_lan_input_chain_6", translate("LAN Input Chain IPv6"))
e18.default = "input_lan_rule"
e18.datatype = "uciname"
e18.optional = true

e19 = e:option(Value, "ban_lan_forward_chain_6", translate("LAN Forward Chain IPv6"))
e19.default = "forwarding_lan_rule"
e19.datatype = "uciname"
e19.optional = true

e20 = e:option(ListValue, "ban_target_src_6", translate("SRC Target IPv6"))
e20:value("REJECT")
e20:value("DROP")
e20.default = "DROP"
e20.optional = true

e21 = e:option(ListValue, "ban_target_dst_6", translate("DST Target IPv6"))
e21:value("REJECT")
e21:value("DROP")
e21.default = "REJECT"
e21.optional = true

return m
