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
	local has_wifi = nixio.fs.stat("/etc/config/wireless")
	local has_switch = false

	uci:foreach("network", "switch",
		function(s)
			has_switch = true
			return false
		end
	)

	local page  = node("admin", "network")
	page.target = alias("admin", "network", "network")
	page.title  = i18n("Network")
	page.order  = 50
	page.index  = true

	if has_switch then
		local page  = node("admin", "network", "vlan")
		page.target = cbi("admin_network/vlan")
		page.title  = i18n("Switch")
		page.order  = 20
	end

	if has_wifi and has_wifi.size > 0 then
		local page

		page = entry({"admin", "network", "wireless"}, arcombine(template("admin_network/wifi_overview"), cbi("admin_network/wifi")), i18n("Wifi"), 15)
		page.leaf = true
		page.subindex = true

		page = entry({"admin", "network", "wireless_join"}, call("wifi_join"), nil, 16)
		page.leaf = true

		page = entry({"admin", "network", "wireless_add"}, call("wifi_add"), nil, 16)
		page.leaf = true

		page = entry({"admin", "network", "wireless_delete"}, call("wifi_delete"), nil, 16)
		page.leaf = true

		page = entry({"admin", "network", "wireless_status"}, call("wifi_status"), nil, 16)
		page.leaf = true
	end

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

	if nixio.fs.access("/etc/config/dhcp") then
		local page  = node("admin", "network", "dhcpleases")
		page.target = cbi("admin_network/dhcpleases")
		page.title  = i18n("DHCP Leases")
		page.order  = 30
	end

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
		local cancel  = (param("cancel") or param("cbi.cancel")) and true or false

		if cancel then
			luci.http.redirect(luci.dispatcher.build_url("admin/network/wireless_join?device=" .. dev))
		else
			local cbi = require "luci.cbi"
			local tpl = require "luci.template"
			local map = luci.cbi.load("admin_network/wifi_add")[1]

			if map:parse() ~= cbi.FORM_DONE then
				tpl.render("header")
				map:render()
				tpl.render("footer")
			end
		end
	else
		luci.template.render("admin_network/wifi_join")
	end
end

function wifi_add()
	local dev = luci.http.formvalue("device")
	local uci = require "luci.model.uci".cursor()
	local wlm = require "luci.model.wireless"

	if dev then
		wlm.init(uci)

		local net = wlm:add_network({
			device     = dev,
			mode       = "ap",
			ssid       = "OpenWrt",
			encryption = "none"
		})

		uci:save("wireless")
		luci.http.redirect(luci.dispatcher.build_url("admin/network/wireless", dev, net:name()))
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

function wifi_status()
	local function jsondump(x)
		if x == nil then
			luci.http.write("null")
		elseif type(x) == "table" then
			local k, v
			if type(next(x)) == "number" then
				luci.http.write("[ ")
				for k, v in ipairs(x) do
					jsondump(v)
					if next(x, k) then
						luci.http.write(", ")
					end
				end
				luci.http.write(" ]")
			else
				luci.http.write("{ ")
				for k, v in pairs(x) do
				luci.http.write("%q: " % k)
					jsondump(v)
					if next(x, k) then
						luci.http.write(", ")
					end
				end
				luci.http.write(" }")
			end
		elseif type(x) == "number" or type(x) == "boolean" then
			luci.http.write(tostring(x))
		elseif type(x) == "string" then
			luci.http.write("%q" % tostring(x))
		end
	end


	local path = luci.dispatcher.context.requestpath
	local dev  = path[#path]
	local iw   = luci.sys.wifi.getiwinfo(dev)

	if iw then
		local f
		local j = { }
		for _, f in ipairs({
			"channel", "frequency", "txpower", "bitrate", "signal", "noise",
			"quality", "quality_max", "mode", "ssid", "bssid", "country",
			"encryption", "mbssid_support", "ifname"
		}) do
			j[f] = iw[f]
		end

		luci.http.prepare_content("application/json")
		jsondump(j)
		return
	end

	luci.http.status(404, "No such device")
end
