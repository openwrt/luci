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
