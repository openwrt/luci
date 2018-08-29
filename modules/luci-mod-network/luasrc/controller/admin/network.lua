-- Copyright 2008 Steven Barth <steven@midlink.org>
-- Copyright 2011-2018 Jo-Philipp Wich <jo@mein.io>
-- Licensed to the public under the Apache License 2.0.

module("luci.controller.admin.network", package.seeall)

function index()
	local uci = require("luci.model.uci").cursor()
	local page

--	if page.inreq then
		local has_switch = false

		uci:foreach("network", "switch",
			function(s)
				has_switch = true
				return false
			end)

		if has_switch then
			page  = node("admin", "network", "vlan")
			page.target = cbi("admin_network/vlan")
			page.title  = _("Switch")
			page.order  = 20

			page = entry({"admin", "network", "switch_status"}, call("switch_status"), nil)
			page.leaf = true
		end


		local has_wifi = false

		uci:foreach("wireless", "wifi-device",
			function(s)
				has_wifi = true
				return false
			end)

		if has_wifi then
			page = entry({"admin", "network", "wireless_join"}, post("wifi_join"), nil)
			page.leaf = true

			page = entry({"admin", "network", "wireless_add"}, post("wifi_add"), nil)
			page.leaf = true

			page = entry({"admin", "network", "wireless_status"}, call("wifi_status"), nil)
			page.leaf = true

			page = entry({"admin", "network", "wireless_reconnect"}, post("wifi_reconnect"), nil)
			page.leaf = true

			page = entry({"admin", "network", "wireless_scan_trigger"}, post("wifi_scan_trigger"), nil)
			page.leaf = true

			page = entry({"admin", "network", "wireless_scan_results"}, call("wifi_scan_results"), nil)
			page.leaf = true

			page = entry({"admin", "network", "wireless"}, arcombine(cbi("admin_network/wifi_overview"), cbi("admin_network/wifi")), _("Wireless"), 15)
			page.leaf = true
			page.subindex = true

			if page.inreq then
				local wdev
				local net = require "luci.model.network".init(uci)
				for _, wdev in ipairs(net:get_wifidevs()) do
					local wnet
					for _, wnet in ipairs(wdev:get_wifinets()) do
						entry(
							{"admin", "network", "wireless", wnet:id()},
							alias("admin", "network", "wireless"),
							wdev:name() .. ": " .. wnet:shortname()
						)
					end
				end
			end
		end


		page = entry({"admin", "network", "iface_add"}, form("admin_network/iface_add"), nil)
		page.leaf = true

		page = entry({"admin", "network", "iface_status"}, call("iface_status"), nil)
		page.leaf = true

		page = entry({"admin", "network", "iface_reconnect"}, post("iface_reconnect"), nil)
		page.leaf = true

		page = entry({"admin", "network", "network"}, arcombine(cbi("admin_network/network"), cbi("admin_network/ifaces")), _("Interfaces"), 10)
		page.leaf   = true
		page.subindex = true

		if page.inreq then
			uci:foreach("network", "interface",
				function (section)
					local ifc = section[".name"]
					if ifc ~= "loopback" then
						entry({"admin", "network", "network", ifc},
						true, ifc:upper())
					end
				end)
		end


		if nixio.fs.access("/etc/config/dhcp") then
			page = node("admin", "network", "dhcp")
			page.target = cbi("admin_network/dhcp")
			page.title  = _("DHCP and DNS")
			page.order  = 30

			page = node("admin", "network", "hosts")
			page.target = cbi("admin_network/hosts")
			page.title  = _("Hostnames")
			page.order  = 40
		end

		page  = node("admin", "network", "routes")
		page.target = cbi("admin_network/routes")
		page.title  = _("Static Routes")
		page.order  = 50

		page = node("admin", "network", "diagnostics")
		page.target = template("admin_network/diagnostics")
		page.title  = _("Diagnostics")
		page.order  = 60

		page = entry({"admin", "network", "diag_ping"}, post("diag_ping"), nil)
		page.leaf = true

		page = entry({"admin", "network", "diag_nslookup"}, post("diag_nslookup"), nil)
		page.leaf = true

		page = entry({"admin", "network", "diag_traceroute"}, post("diag_traceroute"), nil)
		page.leaf = true

		page = entry({"admin", "network", "diag_ping6"}, post("diag_ping6"), nil)
		page.leaf = true

		page = entry({"admin", "network", "diag_traceroute6"}, post("diag_traceroute6"), nil)
		page.leaf = true
--	end
end

function wifi_join()
	local tpl  = require "luci.template"
	local http = require "luci.http"
	local dev  = http.formvalue("device")
	local ssid = http.formvalue("join")

	if dev and ssid then
		local cancel = (http.formvalue("cancel") or http.formvalue("cbi.cancel"))
		if not cancel then
			local cbi = require "luci.cbi"
			local map = luci.cbi.load("admin_network/wifi_add")[1]

			if map:parse() ~= cbi.FORM_DONE then
				tpl.render("header")
				map:render()
				tpl.render("footer")
			end

			return
		end
	end

	tpl.render("admin_network/wifi_join")
end

function wifi_add()
	local dev = luci.http.formvalue("device")
	local ntm = require "luci.model.network".init()

	dev = dev and ntm:get_wifidev(dev)

	if dev then
		local net = dev:add_wifinet({
			mode       = "ap",
			ssid       = "OpenWrt",
			encryption = "none",
			disabled   = 1
		})

		ntm:save("wireless")
		luci.http.redirect(net:adminlink())
	end
end

function iface_status(ifaces)
	local netm = require "luci.model.network".init()
	local rv   = { }

	local iface
	for iface in ifaces:gmatch("[%w%.%-_]+") do
		local net = netm:get_network(iface)
		local device = net and net:get_interface()
		if device then
			local data = {
				id         = iface,
				desc       = net:get_i18n(),
				proto      = net:proto(),
				uptime     = net:uptime(),
				gwaddr     = net:gwaddr(),
				ipaddrs    = net:ipaddrs(),
				ip6addrs   = net:ip6addrs(),
				dnsaddrs   = net:dnsaddrs(),
				ip6prefix  = net:ip6prefix(),
				errors     = net:errors(),
				name       = device:shortname(),
				type       = device:type(),
				typename   = device:get_type_i18n(),
				ifname     = device:name(),
				macaddr    = device:mac(),
				is_up      = net:is_up() and device:is_up(),
				is_alias   = net:is_alias(),
				is_dynamic = net:is_dynamic(),
				is_auto    = net:is_auto(),
				rx_bytes   = device:rx_bytes(),
				tx_bytes   = device:tx_bytes(),
				rx_packets = device:rx_packets(),
				tx_packets = device:tx_packets(),

				subdevices = { }
			}

			for _, device in ipairs(net:get_interfaces() or {}) do
				data.subdevices[#data.subdevices+1] = {
					name       = device:shortname(),
					type       = device:type(),
					typename   = device:get_type_i18n(),
					ifname     = device:name(),
					macaddr    = device:mac(),
					is_up      = device:is_up(),
					rx_bytes   = device:rx_bytes(),
					tx_bytes   = device:tx_bytes(),
					rx_packets = device:rx_packets(),
					tx_packets = device:tx_packets(),
				}
			end

			rv[#rv+1] = data
		else
			rv[#rv+1] = {
				id   = iface,
				name = iface,
				type = "ethernet"
			}
		end
	end

	if #rv > 0 then
		luci.http.prepare_content("application/json")
		luci.http.write_json(rv)
		return
	end

	luci.http.status(404, "No such device")
end

function iface_reconnect(iface)
	local netmd = require "luci.model.network".init()
	local net = netmd:get_network(iface)
	if net then
		luci.sys.call("env -i /sbin/ifup %s >/dev/null 2>/dev/null"
			% luci.util.shellquote(iface))
		luci.http.status(200, "Reconnected")
		return
	end

	luci.http.status(404, "No such interface")
end

function wifi_status(devs)
	local s    = require "luci.tools.status"
	local rv   = { }

	if type(devs) == "string" then
		local dev
		for dev in devs:gmatch("[%w%.%-]+") do
			rv[#rv+1] = s.wifi_network(dev)
		end
	end

	if #rv > 0 then
		luci.http.prepare_content("application/json")
		luci.http.write_json(rv)
		return
	end

	luci.http.status(404, "No such device")
end

function wifi_reconnect(radio)
	local rc = luci.sys.call("env -i /sbin/wifi up %s" % luci.util.shellquote(radio))

	if rc == 0 then
		luci.http.status(200, "Reconnected")
	else
		luci.http.status(500, "Error")
	end
end

local function _wifi_get_scan_results(cache_key)
	local results = luci.util.ubus("session", "get", {
		ubus_rpc_session = luci.model.uci:get_session_id(),
		keys = { cache_key }
	})

	if type(results) == "table" and
	   type(results.values) == "table" and
	   type(results.values[cache_key]) == "table"
	then
		return results.values[cache_key]
	end

	return { }
end

function wifi_scan_trigger(radio, update)
	local iw = radio and luci.sys.wifi.getiwinfo(radio)

	if not iw then
		luci.http.status(404, "No such radio device")
		return
	end

	luci.http.status(204, "Scan scheduled")

	if nixio.fork() == 0 then
		io.stderr:close()
		io.stdout:close()

		local _, bss
		local data, bssids = { }, { }
		local cache_key = "scan_%s" % radio

		luci.util.ubus("session", "set", {
			ubus_rpc_session = luci.model.uci:get_session_id(),
			values = { [cache_key] = nil }
		})

		for _, bss in ipairs(iw.scanlist or { }) do
			data[_] = bss
			bssids[bss.bssid] = bss
		end

		if update then
			for _, bss in ipairs(_wifi_get_scan_results(cache_key)) do
				if not bssids[bss.bssid] then
					bss.stale = true
					data[#data + 1] = bss
				end
			end
		end

		luci.util.ubus("session", "set", {
			ubus_rpc_session = luci.model.uci:get_session_id(),
			values = { [cache_key] = data }
		})
	end
end

function wifi_scan_results(radio)
	local results = radio and _wifi_get_scan_results("scan_%s" % radio)

	if results and #results > 0 then
		luci.http.prepare_content("application/json")
		luci.http.write_json(results)
	else
		luci.http.status(404, "No wireless scan results")
	end
end

function switch_status(switches)
	local s = require "luci.tools.status"

	luci.http.prepare_content("application/json")
	luci.http.write_json(s.switch_status(switches))
end

function diag_command(cmd, addr)
	if addr and addr:match("^[a-zA-Z0-9%-%.:_]+$") then
		luci.http.prepare_content("text/plain")

		local util = io.popen(cmd % luci.util.shellquote(addr))
		if util then
			while true do
				local ln = util:read("*l")
				if not ln then break end
				luci.http.write(ln)
				luci.http.write("\n")
			end

			util:close()
		end

		return
	end

	luci.http.status(500, "Bad address")
end

function diag_ping(addr)
	diag_command("ping -c 5 -W 1 %s 2>&1", addr)
end

function diag_traceroute(addr)
	diag_command("traceroute -q 1 -w 1 -n %s 2>&1", addr)
end

function diag_nslookup(addr)
	diag_command("nslookup %s 2>&1", addr)
end

function diag_ping6(addr)
	diag_command("ping6 -c 5 %s 2>&1", addr)
end

function diag_traceroute6(addr)
	diag_command("traceroute6 -q 1 -w 2 -n %s 2>&1", addr)
end
