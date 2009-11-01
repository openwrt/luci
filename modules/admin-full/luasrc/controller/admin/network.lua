--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--
module("luci.controller.admin.network", package.seeall)

function index()
	require("luci.i18n")
	local uci = require("luci.model.uci").cursor()
	local i18n = luci.i18n.translate

	local page  = node("admin", "network")
	page.target = alias("admin", "network", "network")
	page.title  = i18n("Network")
	page.order  = 50
	page.index  = true

	local page  = node("admin", "network", "vlan")
	page.target = cbi("admin_network/vlan")
	page.title  = i18n("Switch")
	page.order  = 20

	local page = entry({"admin", "network", "wireless"}, arcombine(template("admin_network/wifi_overview"), cbi("admin_network/wifi")), i18n("Wifi"), 15)
	page.leaf = true
	page.subindex = true

	local page = entry({"admin", "network", "wireless_join"}, call("wifi_join"), nil, 16)
	page.leaf = true

	local page = entry({"admin", "network", "wireless_delete"}, call("wifi_delete"), nil, 16)
	page.leaf = true

	local page = entry({"admin", "network", "network"}, arcombine(cbi("admin_network/network"), cbi("admin_network/ifaces")), i18n("Interfaces"), 10)
	page.leaf   = true
	page.subindex = true

	local page = entry({"admin", "network", "add"}, cbi("admin_network/iface_add"), nil)
	page.leaf = true

	uci:foreach("network", "interface",
		function (section)
			local ifc = section[".name"]
			if ifc ~= "loopback" then
				entry({"admin", "network", "network", ifc},
				 true,
				 ifc:upper())
			end
		end
	)

	local page  = node("admin", "network", "dhcp")
	page.target = cbi("admin_network/dhcp")
	page.title  = "DHCP"
	page.order  = 30
	page.subindex = true

	entry(
	 {"admin", "network", "dhcp", "leases"},
	 cbi("admin_network/dhcpleases"),
	 i18n("Leases")
	)

	local page  = node("admin", "network", "hosts")
	page.target = cbi("admin_network/hosts")
	page.title  = i18n("Hostnames")
	page.order  = 40

	local page  = node("admin", "network", "routes")
	page.target = cbi("admin_network/routes")
	page.title  = i18n("Static Routes")
	page.order  = 50

end

function wifi_join()
	local function param(x)
		return luci.http.formvalue(x)
	end

	local function ptable(x)
		x = param(x)
		return x and (type(x) ~= "table" and { x } or x) or {}
	end

	local dev  = param("device")
	local ssid = param("join")

	if dev and ssid then
		local wep     = (tonumber(param("wep")) == 1)
		local wpa     = tonumber(param("wpa_version")) or 0
		local channel = tonumber(param("channel"))
		local mode    = param("mode")
		local bssid   = param("bssid")

		local confirm = (param("confirm") == "1")
		local cancel  = param("cancel") and true or false

		if confirm and not cancel then
			local fixed_bssid = (param("fixed_bssid") == "1")
			local replace_net = (param("replace_net") == "1")
			local autoconnect = (param("autoconnect") == "1")
			local attach_intf = param("attach_intf")

			local uci = require "luci.model.uci".cursor()

			if replace_net then
				uci:delete_all("wireless", "wifi-iface")
			end

			local wificonf = {
				device  = dev,
				mode    = (mode == "Ad-Hoc" and "adhoc" or "sta"),
				ssid    = ssid
			}

			if attach_intf and uci:get("network", attach_intf) == "interface" then
				-- target network already has a interface, make it a bridge
				uci:set("network", attach_intf, "type", "bridge")
				uci:save("network")
				uci:commit("network")

				wificonf.network = attach_intf

				if autoconnect then
					require "luci.sys".call("/sbin/ifup " .. attach_intf)
				end
			end

			if fixed_bssid then
				wificonf.bssid = bssid
			end

			if wep then
				wificonf.encryption = "wep"
				wificonf.key = param("key")
			elseif wpa > 0 then
				wificonf.encryption = param("wpa_suite")
				wificonf.key = param("key")
			end

			local s = uci:section("wireless", "wifi-iface", nil, wificonf)
			uci:delete("wireless", dev, "disabled")
			uci:set("wireless", dev, "channel", channel)

			uci:save("wireless")
			uci:commit("wireless")

			if autoconnect then
				require "luci.sys".call("/sbin/wifi")
			end

			luci.http.redirect(luci.dispatcher.build_url("admin/network/wireless"))
		elseif cancel then
			luci.http.redirect(luci.dispatcher.build_url("admin/network/wireless_join?device=" .. dev))
		else
			luci.template.render("admin_network/wifi_join_settings")
		end
	else
		luci.template.render("admin_network/wifi_join")
	end
end

function wifi_delete(network)
	local uci = require "luci.model.uci".cursor()
	local wlm = require "luci.model.wireless"

	wlm.init(uci)
	wlm:del_network(network)

	uci:save("wireless")
	luci.http.redirect(luci.dispatcher.build_url("admin/network/wireless"))
end
