-- Copyright 2008 Steven Barth <steven@midlink.org>
-- Copyright 2011-2018 Jo-Philipp Wich <jo@mein.io>
-- Licensed to the public under the Apache License 2.0.

module("luci.controller.admin.network", package.seeall)

local function addr2dev(addr, src)
	local ip = require "luci.ip"
	local route = ip.route(addr, src)
	if not src and route and route.src then
		route = ip.route(addr, route.src:string())
	end
	return route and route.dev
end

function remote_addr()
	local uci    = require "luci.model.uci"
	local peer   = luci.http.getenv("REMOTE_ADDR")
	local serv   = luci.http.getenv("SERVER_ADDR")
	local device = addr2dev(peer, serv)
	local ifaces = luci.util.ubus("network.interface", "dump")
	local indevs = {}
	local inifs  = {}

	local result = {
		remote_addr        = peer,
		server_addr        = serv,
		inbound_devices    = {},
		inbound_interfaces = {}
	}

	if type(ifaces) == "table" and type(ifaces.interface) == "table" then
		for _, iface in ipairs(ifaces.interface) do
			if type(iface) == "table" then
				if iface.device == device or iface.l3_device == device then
					inifs[iface.interface] = true
					indevs[device] = true
				end

				local peeraddr = uci:get("network", iface.interface, "peeraddr")
				for _, ai in ipairs(peeraddr and nixio.getaddrinfo(peeraddr) or {}) do
					local peerdev = addr2dev(ai.address)
					if peerdev then
						for _, iface in ipairs(ifaces.interface) do
							if type(iface) == "table" and
							   (iface.device == peerdev or iface.l3_device == peerdev)
							then
								inifs[iface.interface] = true
								indevs[peerdev] = true
							end
						end
					end
				end
			end
		end
	end

	for k in pairs(inifs) do
		result.inbound_interfaces[#result.inbound_interfaces + 1] = k
	end

	for k in pairs(indevs) do
		result.inbound_devices[#result.inbound_devices + 1] = k
	end

	luci.http.prepare_content("application/json")
	luci.http.write_json(result)
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
