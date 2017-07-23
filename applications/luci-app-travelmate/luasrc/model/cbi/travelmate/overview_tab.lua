-- Copyright 2017 Dirk Brenken (dev@brenken.org)
-- This is free software, licensed under the Apache License, Version 2.0

local fs = require("nixio.fs")
local uci = require("luci.model.uci").cursor()
local json = require("luci.jsonc")
local nw  = require("luci.model.network").init()
local fw  = require("luci.model.firewall").init()
local trmiface = uci.get("travelmate", "global", "trm_iface") or "trm_wwan"
local trminput = uci.get("travelmate", "global", "trm_rtfile") or "/tmp/trm_runtime.json"
local uplink = uci.get("network", trmiface) or ""
local parse = json.parse(fs.readfile(trminput) or "")

m = Map("travelmate", translate("Travelmate"),
	translate("Configuration of the travelmate package to to enable travel router functionality. ")
	.. translatef("For further information "
	.. "<a href=\"%s\" target=\"_blank\">"
	.. "see online documentation</a>", "https://github.com/openwrt/packages/blob/master/net/travelmate/files/README.md"))

function m.on_after_commit(self)
	luci.sys.call("/etc/init.d/travelmate restart >/dev/null 2>&1")
	luci.http.redirect(luci.dispatcher.build_url("admin", "services", "travelmate"))
end

s = m:section(NamedSection, "global", "travelmate")

-- Interface Wizard

if uplink == "" then
	dv = s:option(DummyValue, "nil", translate("Interface Wizard"))
	dv.template = "cbi/nullsection"

	o = s:option(Value, "trm_iface", translate("Uplink interface"))
	o.datatype = "and(uciname,rangelength(3,15))"
	o.default = "trm_wwan"
	o.rmempty = false

	function o.validate(self, value)
		iface = value
		return iface
	end

	function o.write(self, section, value)
		uci:set("travelmate", section, "trm_iface", iface)
		uci:save("travelmate")
		uci:commit("travelmate")
	end

	btn = s:option(Button, "", translate("Create Uplink Interface"),
		translate("Create a new wireless wan uplink interface, configure it to use dhcp and ")
		.. translate("add it to the wan zone of the firewall. This step has only to be done once."))
	btn.inputtitle = translate("Add Interface")
	btn.inputstyle = "apply"
	btn.disabled = false
	function btn.write()
		local net = nw:add_network(iface, { proto = "dhcp" })
		if net then
			nw:save("network")
			nw:commit("network")
			local zone = fw:get_zone_by_network("wan")
			if zone then
				zone:add_network(iface)
				fw:save("firewall")
				fw:commit("firewall")
				luci.sys.call("env -i /bin/ubus call network reload >/dev/null 2>&1")
			end
		end
		luci.http.redirect(luci.dispatcher.build_url("admin", "services", "travelmate"))
	end
	return m
end

-- Main travelmate options

o1 = s:option(Flag, "trm_enabled", translate("Enable travelmate"))
o1.default = o1.disabled
o1.rmempty = false

o2 = s:option(Flag, "trm_automatic", translate("Enable 'automatic' mode"),
	translate("Keep travelmate in an active state."))
o2.default = o2.enabled
o2.rmempty = false

o3 = s:option(Value, "trm_iface", translate("Uplink / Trigger interface"),
	translate("Name of the uplink interface that triggers travelmate processing."))
o3.datatype = "and(uciname,rangelength(3,15))"
o3.default = "trm_wwan"
o3.rmempty = false

o4 = s:option(Value, "trm_triggerdelay", translate("Trigger delay"),
	translate("Additional trigger delay in seconds before travelmate processing begins."))
o4.default = 2
o4.datatype = "range(1,90)"
o4.rmempty = false

o5 = s:option(Flag, "trm_debug", translate("Enable verbose debug logging"))
o5.default = o5.disabled
o5.rmempty = false

-- Runtime information

ds = s:option(DummyValue, "_dummy", translate("Runtime information"))
ds.template = "cbi/nullsection"

dv1 = s:option(DummyValue, "status", translate("Online Status"))
dv1.template = "travelmate/runtime"
if parse == nil then
	dv1.value = translate("n/a")
elseif parse.data.station_connection == "true" then
	dv1.value = translate("connected")
else
	dv1.value = translate("not connected")
end

dv2 = s:option(DummyValue, "travelmate_version", translate("Travelmate version"))
dv2.template = "travelmate/runtime"
if parse ~= nil then
	dv2.value = parse.data.travelmate_version or translate("n/a")
else
	dv2.value = translate("n/a")
end

dv3 = s:option(DummyValue, "station_ssid", translate("Station SSID"))
dv3.template = "travelmate/runtime"
if parse ~= nil then
	dv3.value = parse.data.station_ssid or translate("n/a")
else
	dv3.value = translate("n/a")
end

dv4 = s:option(DummyValue, "station_interface", translate("Station Interface"))
dv4.template = "travelmate/runtime"
if parse ~= nil then
	dv4.value = parse.data.station_interface or translate("n/a")
else
	dv4.value = translate("n/a")
end

dv5 = s:option(DummyValue, "station_radio", translate("Station Radio"))
dv5.template = "travelmate/runtime"
if parse ~= nil then
	dv5.value = parse.data.station_radio or translate("n/a")
else
	dv5.value = translate("n/a")
end

dv6 = s:option(DummyValue, "last_rundate", translate("Last rundate"))
dv6.template = "travelmate/runtime"
if parse ~= nil then
	dv6.value = parse.data.last_rundate or translate("n/a")
else
	dv6.value = translate("n/a")
end

-- Extra options

e = m:section(NamedSection, "global", "travelmate", translate("Extra options"),
translate("Options for further tweaking in case the defaults are not suitable for you."))

e1 = e:option(Value, "trm_radio", translate("Radio selection"),
	translate("Restrict travelmate to a dedicated radio, e.g. 'radio0'"))
e1.rmempty = true

e2 = e:option(Value, "trm_maxretry", translate("Connection Limit"),
	translate("How many times should travelmate try to connect to an Uplink"))
e2.default = 3
e2.datatype = "range(1,10)"
e2.rmempty = false

e3 = e:option(Value, "trm_maxwait", translate("Interface Timeout"),
	translate("How long should travelmate wait for a successful wlan interface reload"))
e3.default = 30
e3.datatype = "range(5,60)"
e3.rmempty = false

e4 = e:option(Value, "trm_timeout", translate("Overall Timeout"),
	translate("Timeout in seconds between retries in 'automatic' mode"))
e4.default = 60
e4.datatype = "range(5,300)"
e4.rmempty = false

return m
