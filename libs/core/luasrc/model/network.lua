--[[
LuCI - Network model

Copyright 2009 Jo-Philipp Wich <xm@subsignal.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

]]--

local type, pairs, ipairs, loadfile, table, i18n
	= type, pairs, ipairs, loadfile, table, luci.i18n

local lmo = require "lmo"
local nxo = require "nixio"
local nfs = require "nixio.fs"
local iwi = require "iwinfo"
local ipc = require "luci.ip"
local utl = require "luci.util"
local uct = require "luci.model.uci.bind"

module "luci.model.network"

-- load extensions
local ext
local handler = { }

for ext in nfs.glob(utl.libpath() .. "/model/network/*.lua") do
	if nfs.access(ext) then
		local m = loadfile(ext)
		if m then
			handler[#handler+1] = m()
		end
	end
end

function foreach_handler(code, ...)
	local h
	for _, h in ipairs(handler) do
		if code(h, ...) then
			return true
		end
	end
	return false
end

local ub = uct.bind("network")
local ifs, brs, sws

function init(cursor)
	if cursor then
		cursor:unload("network")
		cursor:load("network")
		ub:init(cursor)

		ifs = { }
		brs = { }
		sws = { }

		-- init handler
		foreach_handler(function(h)
			h:init(cursor)
			h:find_interfaces(ifs, brs)
		end)

		-- read interface information
		local n, i
		for n, i in ipairs(nxo.getifaddrs()) do
			local name = i.name:match("[^:]+")
			local prnt = name:match("^([^%.]+)%.")

			if not _M:ignore_interface(name) then
				ifs[name] = ifs[name] or {
					idx      = i.ifindex or n,
					name     = name,
					rawname  = i.name,
					flags    = { },
					ipaddrs  = { },
					ip6addrs = { }
				}

				if prnt then
					sws[name] = true
					sws[prnt] = true
				end

				if i.family == "packet" then
					ifs[name].flags   = i.flags
					ifs[name].stats   = i.data
					ifs[name].macaddr = i.addr
				elseif i.family == "inet" then
					ifs[name].ipaddrs[#ifs[name].ipaddrs+1] = ipc.IPv4(i.addr, i.netmask)
				elseif i.family == "inet6" then
					ifs[name].ip6addrs[#ifs[name].ip6addrs+1] = ipc.IPv6(i.addr, i.netmask)
				end
			end
		end

		-- read bridge informaton
		local b, l
		for l in utl.execi("brctl show") do
			if not l:match("STP") then
				local r = utl.split(l, "%s+", nil, true)
				if #r == 4 then
					b = {
						name    = r[1],
						id      = r[2],
						stp     = r[3] == "yes",
						ifnames = { ifs[r[4]] }
					}
					if b.ifnames[1] then
						b.ifnames[1].bridge = b
					end
					brs[r[1]] = b
				elseif b then
					b.ifnames[#b.ifnames+1] = ifs[r[2]]
					b.ifnames[#b.ifnames].bridge = b
				end
			end
		end
	end
end

function has_ipv6(self)
	return nfs.access("/proc/net/ipv6_route")
end

function add_network(self, n, options)
	if n and #n > 0 and n:match("^[a-zA-Z0-9_]+$") and not self:get_network(n) then
		if ub.uci:section("network", "interface", n, options) then
			return network(n)
		end
	end
end

function get_network(self, n)
	if n and ub.uci:get("network", n) == "interface" then
		return network(n)
	end
end

function get_networks(self)
	local nets = { }
	ub.uci:foreach("network", "interface",
		function(s)
			nets[#nets+1] = network(s['.name'])
		end)
	return nets
end

function del_network(self, n)
	local r = ub.uci:delete("network", n)
	if r then
		ub.uci:foreach("network", "alias",
			function(s)
				if s.interface == n then
					ub.uci:delete("network", s['.name'])
				end
			end)
		ub.uci:foreach("network", "route",
			function(s)
				if s.interface == n then
					ub.uci:delete("network", s['.name'])
				end
			end)
		ub.uci:foreach("network", "route6",
			function(s)
				if s.interface == n then
					ub.uci:delete("network", s['.name'])
				end
			end)

		foreach_handler(function(h) h:del_network(n) end)
	end
	return r
end

function rename_network(self, old, new)
	local r
	if new and #new > 0 and new:match("^[a-zA-Z0-9_]+$") and not self:get_network(new) then
		r = ub.uci:section("network", "interface", new,
			ub.uci:get_all("network", old))

		if r then
			ub.uci:foreach("network", "alias",
				function(s)
					if s.interface == old then
						ub.uci:set("network", s['.name'], "interface", new)
					end
				end)
			ub.uci:foreach("network", "route",
				function(s)
					if s.interface == old then
						ub.uci:set("network", s['.name'], "interface", new)
					end
				end)
			ub.uci:foreach("network", "route6",
				function(s)
					if s.interface == old then
						ub.uci:set("network", s['.name'], "interface", new)
					end
				end)

			foreach_handler(function(h) h:rename_network(old, new) end)
		end
	end
	return r or false
end

function get_interface(self, i)
	return ifs[i] and interface(i)
end

function get_interfaces(self)
	local ifaces = { }
	local iface
	for iface, _ in pairs(ifs) do
		ifaces[#ifaces+1] = interface(iface)
	end
	return ifaces
end

function ignore_interface(self, x)
	if foreach_handler(function(h) return h:ignore_interface(x) end) then
		return true
	else
		return (x:match("^wmaster%d") or x:match("^wifi%d")
			or x:match("^hwsim%d") or x:match("^imq%d") or x == "lo")
	end
end


network = ub:section("interface")
network:property("device")
network:property("ifname")
network:property("proto")
network:property("type")

function network.name(self)
	return self.sid
end

function network.is_bridge(self)
	return (self:type() == "bridge")
end

function network.add_interface(self, ifname)
	local ifaces, iface

	if type(ifname) ~= "string" then
		ifaces = { ifname:name() }
	else
		ifaces = ub:list(ifname)
	end

	for _, iface in ipairs(ifaces) do
		if ifs[iface] then
			-- make sure the interface is removed from all networks
			local i = interface(iface)
			local n = i:get_network()
			if n then n:del_interface(iface) end

			if ifs[iface].handler then
				ifs[iface].handler:add_interface(self, iface, ifs[iface])
			else
				self:ifname(ub:list((self:ifname() or ''), iface))
			end
		end
	end
end

function network.del_interface(self, ifname)
	if type(ifname) ~= "string" then
		ifname = ifname:name()
	end

	if ifs[ifname] and ifs[ifname].handler then
		ifs[ifname].handler:del_interface(self, ifname, ifs[ifname])
	else
		self:ifname(ub:list((self:ifname() or ''), nil, ifname))
	end
end

function network.get_interfaces(self)
	local ifaces = { }
	local iface
	for _, iface in ipairs(ub:list(self:ifname())) do
		iface = iface:match("[^:]+")
		if ifs[iface] then
			ifaces[#ifaces+1] = interface(iface)
		end
	end
	for iface, _ in pairs(ifs) do
		if ifs[iface].network == self:name() then
			ifaces[#ifaces+1] = interface(iface)
		end
	end
	return ifaces
end

function network.contains_interface(self, iface)
	local i
	local ifaces = ub:list(self:ifname())

	if type(iface) ~= "string" then
		iface = iface:name()
	end

	for _, i in ipairs(ifaces) do
		if i == iface then
			return true
		end
	end

	for i, _ in pairs(ifs) do
		if ifs[i].dev and ifs[i].dev.network == self:name() then
			return true
		end
	end

	return false
end


interface = utl.class()
function interface.__init__(self, ifname)
	if ifs[ifname] then
		self.ifname = ifname
		self.dev    = ifs[ifname]
		self.br     = brs[ifname]
	end
end

function interface.name(self)
	return self.ifname
end

function interface.mac(self)
	return self.dev.macaddr or "00:00:00:00:00:00"
end

function interface.ipaddrs(self)
	return self.dev.ipaddrs or { }
end

function interface.ip6addrs(self)
	return self.dev.ip6addrs or { }
end

function interface.type(self)
	if self.dev and self.dev.type then
		return self.dev.type
	elseif brs[self.ifname] then
		return "bridge"
	elseif sws[self.ifname] or self.ifname:match("%.") then
		return "switch"
	else
		return "ethernet"
	end
end

function interface.shortname(self)
	if self.dev and self.dev.handler then
		return self.dev.handler:shortname(self)
	else
		return self.ifname
	end
end

function interface.get_i18n(self)
	if self.dev and self.dev.handler then
		return self.dev.handler:get_i18n(self)
	else
		return "%s: %q" %{ self:get_type_i18n(), self:name() }
	end
end

function interface.get_type_i18n(self)
	local x = self:type()
	if x == "wifi" then
		return i18n.translate("a_s_if_wifidev", "Wireless Adapter")
	elseif x == "bridge" then
		return i18n.translate("a_s_if_bridge", "Bridge")
	elseif x == "switch" then
		return i18n.translate("a_s_if_ethswitch", "Ethernet Switch")
	else
		return i18n.translate("a_s_if_ethdev", "Ethernet Adapter")
	end
end

function interface.ports(self)
	if self.br then
		local iface
		local ifaces = { }
		for _, iface in ipairs(self.br.ifnames) do
			ifaces[#ifaces+1] = interface(iface.name)
		end
		return ifaces
	end
end

function interface.bridge_id(self)
	if self.br then
		return self.br.id
	else
		return nil
	end
end

function interface.bridge_stp(self)
	if self.br then
		return self.br.stp
	else
		return false
	end
end

function interface.is_up(self)
	return self.dev.flags and self.dev.flags.up
end

function interface.is_bridge(self)
	return (self:type() == "bridge")
end

function interface.is_bridgeport(self)
	return self.dev and self.dev.bridge and true or false
end

function interface.tx_bytes(self)
	return self.dev and self.dev.stats
		and self.dev.stats.tx_bytes or 0
end

function interface.rx_bytes(self)
	return self.dev and self.dev.stats
		and self.dev.stats.rx_bytes or 0
end

function interface.tx_packets(self)
	return self.dev and self.dev.stats
		and self.dev.stats.tx_packets or 0
end

function interface.rx_packets(self)
	return self.dev and self.dev.stats
		and self.dev.stats.rx_packets or 0
end

function interface.get_network(self)
	if self.dev and self.dev.network then
		self.network = _M:get_network(self.dev.network)
	end

	if not self.network then
		local net
		for _, net in ipairs(_M:get_networks()) do
			if net:contains_interface(self.ifname) then
				self.network = net
				return net
			end
		end
	else
		return self.network
	end
end

