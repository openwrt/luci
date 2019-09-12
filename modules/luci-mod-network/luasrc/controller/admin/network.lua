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
			entry({"admin", "network", "switch"}, view("network/switch"), _("Switch"), 20)
		end


		local has_wifi = false

		uci:foreach("wireless", "wifi-device",
			function(s)
				has_wifi = true
				return false
			end)

		if has_wifi then
			page = entry({"admin", "network", "wireless_status"}, call("wifi_status"), nil)
			page.leaf = true

			page = entry({"admin", "network", "wireless_reconnect"}, post("wifi_reconnect"), nil)
			page.leaf = true

			page = entry({"admin", "network", "wireless"}, view("network/wireless"), _('Wireless'), 15)
			page.leaf = true
		end


		page = entry({"admin", "network", "iface_status"}, call("iface_status"), nil)
		page.leaf = true

		page = entry({"admin", "network", "iface_reconnect"}, post("iface_reconnect"), nil)
		page.leaf = true

		page = entry({"admin", "network", "iface_down"}, post("iface_down"), nil)
		page.leaf = true

		page = entry({"admin", "network", "network"}, view("network/interfaces"), _("Interfaces"), 10)
		page.leaf   = true
		page.subindex = true


		if nixio.fs.access("/etc/config/dhcp") then
			page = node("admin", "network", "dhcp")
			page.target = view("network/dhcp")
			page.title  = _("DHCP and DNS")
			page.order  = 30

			page = node("admin", "network", "hosts")
			page.target = view("network/hosts")
			page.title  = _("Hostnames")
			page.order  = 40
		end

		page  = node("admin", "network", "routes")
		page.target = view("network/routes")
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

local function addr2dev(addr, src)
	local ip = require "luci.ip"
	local route = ip.route(addr, src)
	if not src and route and route.src then
		route = ip.route(addr, route.src:string())
	end
	return route and route.dev
end

function iface_down(iface, force)
	local netmd = require "luci.model.network".init()
	local peer = luci.http.getenv("REMOTE_ADDR")
	local serv = luci.http.getenv("SERVER_ADDR")

	if force ~= "force" and serv and peer then
		local dev = addr2dev(peer, serv)
		if dev then
			local nets = netmd:get_networks()
			local outnet = nil
			local _, net, ai

			for _, net in ipairs(nets) do
				if net:contains_interface(dev) then
					outnet = net
					break
				end
			end

			if outnet:name() == iface then
				luci.http.status(409, "Is inbound interface")
				return
			end

			local peeraddr = outnet:get("peeraddr")
			for _, ai in ipairs(peeraddr and nixio.getaddrinfo(peeraddr) or {}) do
				local peerdev = addr2dev(ai.address)
				for _, net in ipairs(peerdev and nets or {}) do
					if net:contains_interface(peerdev) and net:name() == iface then
						luci.http.status(409, "Is inbound interface")
						return
					end
				end
			end
		end
	end

	if netmd:get_network(iface) then
		luci.sys.call("env -i /sbin/ifdown %s >/dev/null 2>/dev/null"
			% luci.util.shellquote(iface))
		luci.http.status(200, "Shut down")
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
	local rc = luci.sys.call("env -i /sbin/wifi up %s >/dev/null" % luci.util.shellquote(radio))

	if rc == 0 then
		luci.http.status(200, "Reconnected")
	else
		luci.http.status(500, "Error")
	end
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
