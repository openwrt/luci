--[[
LuCI - Lua Configuration Interface

Copyright 2009 Jo-Philipp Wich <xm@subsignal.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

local nw   = require "luci.model.network"
local fw   = require "luci.model.firewall"
local wl   = require "luci.model.wireless"
local uci  = require "luci.model.uci".cursor()
local http = require "luci.http"

local iw = luci.sys.wifi.getiwinfo(http.formvalue("device"))

m = SimpleForm("network", translate("Join Network: Settings"))
m.cancel = translate("Back to scan results")
m.reset = false

function m.on_cancel()
	local dev = http.formvalue("device")
	http.redirect(luci.dispatcher.build_url(
		dev and "admin/network/wireless_join?device=" .. dev
			or "admin/network/wireless"
	))
end

nw.init(uci)
fw.init(uci)
wl.init(uci)

m.hidden = {
	device      = http.formvalue("device"),
	join        = http.formvalue("join"),
	channel     = http.formvalue("channel"),
	mode        = http.formvalue("mode"),
	bssid       = http.formvalue("bssid"),
	wep         = http.formvalue("wep"),
	wpa_suites	= http.formvalue("wpa_suites"),
	wpa_version = http.formvalue("wpa_version")
}

if iw and iw.mbssid_support then
	replace = m:field(Flag, "replace", translate("Replace wireless configuration"),
		translate("An additional network will be created if you leave this unchecked."))
else
	replace = m:field(DummyValue, "replace", translate("Replace wireless configuration"))
	replace.default = translate("The hardware is not multi-SSID capable and existing " ..
		"configuration will be replaced if you proceed.")

	function replace.formvalue() return "1" end
end

if http.formvalue("wep") == "1" then
	key = m:field(Value, "key", translate("WEP passphrase"),
		translate("Specify the secret encryption key here."))

	key.password = true

elseif (tonumber(m.hidden.wpa_version) or 0) > 0 and m.hidden.wpa_suites == "PSK" then
	key = m:field(Value, "key", translate("WPA passphrase"),
		translate("Specify the secret encryption key here."))

	key.password = true
	--m.hidden.wpa_suite = (tonumber(http.formvalue("wpa_version")) or 0) >= 2 and "psk2" or "psk"
end

attachnet = m:field(Flag, "_attach", translate("Attach to existing network"),
	translate("If the interface is attached to an existing network it will be <em>bridged</em> " ..
		"to the existing interfaces and is covered by the firewall zone of the choosen network. " ..
		"Uncheck this option to define a new standalone network."
	))

attachnet.rmempty = false
attachnet.default = http.formvalue("cbi.submit") and nil or "1"

function attachnet.formvalue(self, section)
	if not http.formvalue("cbi.submit") then
		return m.hidden.mode == "Ad-Hoc" and "0" or "1"
	else
		return Value.formvalue(self, section) and "1" or "0"
	end
end

attachnet.cfgvalue = attachnet.formvalue

newnet = m:field(Value, "_netname_new", translate("Name of the new network"),
	translate("The allowed characters are: <code>A-Z</code>, <code>a-z</code>, " ..
		"<code>0-9</code> and <code>_</code>"
	))

newnet:depends("_attach", "")
newnet.default = m.hidden.mode == "Ad-Hoc" and "mesh"

addnet = m:field(Value, "_netname_attach",
	translate("Network to attach interface to"))

addnet.template = "cbi/network_netlist"
addnet.widget = "radio"
addnet.default = "wan"
addnet.nocreate = true
addnet:depends("_attach", "1")

fwzone = m:field(Value, "_fwzone",
	translate("Create / Assign firewall-zone"),
	translate("Choose the firewall zone you want to assign to this interface. Select <em>unspecified</em> to remove the interface from the associated zone or fill out the <em>create</em> field to define a new zone and attach the interface to it."))

fwzone.template = "cbi/firewall_zonelist"
fwzone:depends("_attach", "")
fwzone.default = m.hidden.mode == "Ad-Hoc" and "mesh"

function attachnet.parse(self, section)
	Flag.parse(self, section)

	if http.formvalue("cbi.submit") then
		local net, zone
		local value = self:formvalue(section)

		if value == "1" then
			net = nw:get_network(addnet:formvalue(section))
			if net then
				net:type("bridge")
			end
		else
			local zval = fwzone:formvalue(section)

			net = nw:add_network(newnet:formvalue(section), { proto = "dhcp" })
			zone = fw:get_zone(zval)

			if not zone and zval == '-' then
				zval = m:formvalue(fwzone:cbid(section) .. ".newzone")
				if zval and #zval > 0 then
					zone = fw:add_zone(zval)
				end
			end
		end

		if not net then
			self.error = { [section] = "missing" }
		else
			local wdev = wl:get_device(m.hidden.device)
			wdev:disabled(false)
			wdev:channel(m.hidden.channel)

			if replace:formvalue(section) then
				local n
				for _, n in ipairs(wdev:get_networks()) do
					wl:del_network(n:name())
				end
			end

			local wconf = {
				device  = m.hidden.device,
				ssid    = m.hidden.join,
				mode    = (m.hidden.mode == "Ad-Hoc" and "adhoc" or "sta"),
				network = net:name()
			}

			if m.hidden.wep == "1" then
				wconf.encryption = "wep"
				wconf.key        = key and key:formvalue(section) or ""
			elseif (tonumber(m.hidden.wpa_version) or 0) > 0 then
				wconf.encryption = (tonumber(m.hidden.wpa_version) or 0) >= 2 and "psk2" or "psk"
				wconf.key        = key and key:formvalue(section) or ""
			else
				wconf.encryption = "none"
			end

			if wconf.mode == "adhoc" then
				wconf.bssid = m.hidden.bssid
			end

			local wnet = wl:add_network(wconf)

			if wnet then
				if zone then
					fw:del_network(net:name())
					zone:add_network(net:name())
				end

				uci:save("wireless")
				uci:save("network")
				uci:save("firewall")

				uci:commit("wireless")
				uci:commit("network")
				uci:commit("firewall")

				luci.http.redirect(luci.dispatcher.build_url("admin/network/wireless",
					wdev:name(), wnet:name()))
			end
		end
	end
end

attachnet.remove = attachnet.write

function fwzone.cfgvalue(self, section)
	self.iface = section
	local z = fw:get_zone_by_network(section)
	return z and z:name()
end

return m
