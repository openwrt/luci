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

	local page

	page = node("admin", "network")
	page.target = alias("admin", "network", "network")
	page.title  = i18n("Network")
	page.order  = 50
	page.index  = true

	if has_switch then
		page  = node("admin", "network", "vlan")
		page.target = cbi("admin_network/vlan")
		page.title  = i18n("Switch")
		page.order  = 20
	end

	if has_wifi and has_wifi.size > 0 then
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

	page = entry({"admin", "network", "network"}, arcombine(cbi("admin_network/network"), cbi("admin_network/ifaces")), i18n("Interfaces"), 10)
	page.leaf   = true
	page.subindex = true

	page = entry({"admin", "network", "iface_add"}, cbi("admin_network/iface_add"), nil)
	page.leaf = true

	page = entry({"admin", "network", "iface_delete"}, call("iface_delete"), nil)
	page.leaf = true

	page = entry({"admin", "network", "iface_status"}, call("iface_status"), nil)
	page.leaf = true

	page = entry({"admin", "network", "iface_reconnect"}, call("iface_reconnect"), nil)
	page.leaf = true

	page = entry({"admin", "network", "iface_shutdown"}, call("iface_shutdown"), nil)
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
		page = node("admin", "network", "dhcpleases")
		page.target = cbi("admin_network/dhcpleases")
		page.title  = i18n("DHCP Leases")
		page.order  = 30

		page = entry({"admin", "network", "dhcplease_status"}, call("lease_status"), nil)
		page.leaf = true

		page = node("admin", "network", "hosts")
		page.target = cbi("admin_network/hosts")
		page.title  = i18n("Hostnames")
		page.order  = 40
	end

	page  = node("admin", "network", "routes")
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
	local ntm = require "luci.model.network".init()

	dev = dev and ntm:get_wifidev(dev)

	if dev then
		local net = dev:add_wifinet({
			mode       = "ap",
			ssid       = "OpenWrt",
			encryption = "none"
		})

		ntm:save("wireless")
		luci.http.redirect(net:adminlink())
	end
end

function wifi_delete(network)
	local ntm = require "luci.model.network".init()

	ntm:del_wifinet(network)
	ntm:save("wireless")

	luci.http.redirect(luci.dispatcher.build_url("admin/network/wireless"))
end

function iface_status()
	local path = luci.dispatcher.context.requestpath
	local x    = luci.model.uci.cursor_state()
	local rv   = { }

	local iface
	for iface in path[#path]:gmatch("[%w%.%-]+") do
		local dev
		if x:get("network", iface, "type") == "bridge" then
			dev = "br-" .. iface
		else
			dev = x:get("network", iface, "device") or ""
		end

		if #dev == 0 or dev:match("^%d") or dev:match("%W") then
			dev = x:get("network", iface, "ifname") or ""
			dev = dev:match("%S+")
		end

		local info
		local data = { id = iface }
		for _, info in ipairs(nixio.getifaddrs()) do
			local name = info.name:match("[^:]+")
			if name == dev then
				if info.family == "packet" then
					data.flags   = info.flags
					data.stats   = info.data
					data.macaddr = info.addr
					data.ifname  = name
				elseif info.family == "inet" then
					data.ipaddrs = data.ipaddrs or { }
					data.ipaddrs[#data.ipaddrs+1] = {
						addr      = info.addr,
						broadaddr = info.broadaddr,
						dstaddr   = info.dstaddr,
						netmask   = info.netmask,
						prefix    = info.prefix
					}
				elseif info.family == "inet6" then
					data.ip6addrs = data.ip6addrs or { }
					data.ip6addrs[#data.ip6addrs+1] = {
						addr    = info.addr,
						netmask = info.netmask,
						prefix  = info.prefix
					}
				end
			end
		end

		if next(data) then
			rv[#rv+1] = data
		end
	end

	if #rv > 0 then
		luci.http.prepare_content("application/json")
		luci.http.write_json(rv)
		return
	end

	luci.http.status(404, "No such device")
end

function iface_reconnect()
	local path  = luci.dispatcher.context.requestpath
	local iface = path[#path]
	local netmd = require "luci.model.network".init()

	local net = netmd:get_network(iface)
	if net then
		local ifn
		for _, ifn in ipairs(net:get_interfaces()) do
			local wnet = ifn:get_wifinet()
			if wnet then
				local wdev = wnet:get_device()
				if wdev then
					luci.sys.call(
						"env -i /sbin/wifi up %q >/dev/null 2>/dev/null"
							% wdev:name()
					)

					luci.http.status(200, "Reconnected")
					return
				end
			end
		end

		luci.sys.call("env -i /sbin/ifup %q >/dev/null 2>/dev/null" % iface)
		luci.http.status(200, "Reconnected")
		return
	end

	luci.http.status(404, "No such interface")
end

function iface_shutdown()
	local path  = luci.dispatcher.context.requestpath
	local iface = path[#path]
	local netmd = require "luci.model.network".init()

	local net = netmd:get_network(iface)
	if net then
		luci.sys.call("env -i /sbin/ifdown %q >/dev/null 2>/dev/null" % iface)
		luci.http.status(200, "Shutdown")
		return
	end

	luci.http.status(404, "No such interface")
end

function iface_delete()
	local path  = luci.dispatcher.context.requestpath
	local iface = path[#path]
	local netmd = require "luci.model.network".init()

	local net = netmd:del_network(iface)
	if net then
		luci.sys.call("env -i /sbin/ifdown %q >/dev/null 2>/dev/null" % iface)
		luci.http.redirect(luci.dispatcher.build_url("admin/network/network"))
		netmd:commit("network")
		netmd:commit("wireless")
		return
	end

	luci.http.status(404, "No such interface")
end

function wifi_status()
	local path = luci.dispatcher.context.requestpath
	local arp  = luci.sys.net.arptable()
	local rv   = { }

	local dev
	for dev in path[#path]:gmatch("[%w%.%-]+") do
		local j = { id = dev }
		local iw = luci.sys.wifi.getiwinfo(dev)
		if iw then
			local f
			for _, f in ipairs({
				"channel", "frequency", "txpower", "bitrate", "signal", "noise",
				"quality", "quality_max", "mode", "ssid", "bssid", "country",
				"encryption", "ifname", "assoclist"
			}) do
				j[f] = iw[f]
			end
		end
		rv[#rv+1] = j
	end

	if #rv > 0 then
		luci.http.prepare_content("application/json")
		luci.http.write_json(rv)
		return
	end

	luci.http.status(404, "No such device")
end

function lease_status()
	local rv = { }
	local leasefile = "/var/dhcp.leases"

	local uci = require "luci.model.uci".cursor()
	local nfs = require "nixio.fs"

	uci:foreach("dhcp", "dnsmasq",
		function(s)
			if s.leasefile and nfs.access(s.leasefile) then
				leasefile = s.leasefile
				return false
			end
		end)

	local fd = io.open(leasefile, "r")
	if fd then
		while true do
			local ln = fd:read("*l")
			if not ln then
				break
			else
				local ts, mac, ip, name = ln:match("^(%d+) (%S+) (%S+) (%S+)")
				if ts and mac and ip and name then
					rv[#rv+1] = {
						expires  = os.difftime(tonumber(ts) or 0, os.time()),
						macaddr  = mac,
						ipaddr   = ip,
						hostname = (name ~= "*") and name
					}
				end
			end
		end
		fd:close()
	end

	luci.http.prepare_content("application/json")
	luci.http.write_json(rv)
end
