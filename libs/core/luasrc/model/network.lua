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
	if ifs[i] then
		return interface(i)
	else
		local j
		for j, _ in pairs(ifs) do
			if ifs[j].sid == i then
				return interface(j)
			end
		end
	end
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
		return i18n.translate("Wireless Adapter")
	elseif x == "bridge" then
		return i18n.translate("Bridge")
	elseif x == "switch" then
		return i18n.translate("Ethernet Switch")
	else
		return i18n.translate("Ethernet Adapter")
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

--[==[
#!/usr/bin/lua

local uci = require "luci.model.uci".cursor_state()
local utl = require "luci.util"
local sys = require "luci.sys"
local lip = require "luci.ip"
local nxo = require "nixio"
local nfs = require "nixio.fs"

-- patch uci
local x = getmetatable(uci)

function x:list(...)
	local val = self:get(...)
	local lst = { }

	if type(val) == "list" then
		local _, v
		for _, v in ipairs(val) do
			local i
			for i in v:gmatch("%S+") do
				lst[#lst+1] = i
			end
		end
	elseif type(val) == "string" then
		local i
		for i in val:gmatch("%S+") do
			lst[#lst+1] = i
		end
	end

	return lst
end


system = utl.class()

system._switches = { }
system._vlans    = { }

function system:__init__()
	self._networks = { }

	uci:foreach("network2", "interface",
		function(s)
			self._networks[#self._networks+1] = system.network(s, self)
		end)
end

function system:networks()
	local index = 0
	return function()
		if index <= #self._networks then
			index = index + 1
			return self._networks[index]
		else
			return nil
		end
	end
end

function system:find_network(name)
	local v
	for _, v in ipairs(self._networks) do
		if v:name() == name then
			return v
		end
	end
end

function system:find_interface(name)
	local v
	for _, v in ipairs(self._networks) do
		local i
		for i in v:interfaces() do
			if i:is_bridge() then
				local p
				for p in i:interfaces() do
					if p:name() == name then
						return p
					end
				end
			end

			if i:name() == name then
				return i
			end
		end
	end
end

function system:delete_network(name)
	local i
	for i = 1, #self._networks do
		if self._networks[i]:name() == name then
			local x

			for x in self._networks[i]:aliases() do
				uci:delete("network2", x:name())
			end

			for x in self._networks[i]:routes() do
				uci:delete("network2", x:name())
			end

			uci:delete("network2", self._networks[i])
			table.remove(self._networks, i)

			return true
		end
	end
	return false
end

function system:print()
	local v
	for v in self:networks() do
		print(v:name())
		v:print()
		print("--")
	end
end

function system.ignore_iface(ifn)
	return (nil ~= (
		ifn:match("^wlan%d") or 
		ifn:match("^ath%d")  or
		ifn:match("^wl%d")   or
		ifn:match("^imq%d")  or
		ifn:match("^br%-")   or
		ifn:match("^/dev/")
	))
end

function system.find_wifi_networks(net)
	local lst = { }
	local cnt = 0

	uci:foreach("wireless", "wifi-iface",
		function(s)
			if s.device and s.network == net then
				lst[#lst+1] = { s.device, s['.name'], cnt }
			end
			cnt = cnt + 1
		end)

	return lst
end

function system.find_iface_names(net)
	local lst = { }

	local val = uci:list("network2", net, "device")
	if #val == 0 or val[1]:match("^/dev/") then
		val = uci:list("network2", net, "ifname")
	end

	local ifn
	for _, ifn in ipairs(val) do
		if not system.ignore_iface(ifn) then
			lst[#lst+1] = ifn
		end
	end
	
	return lst
end

function system.find_switch(name)
	local swname, swdev, swvlan

	-- find switch
	uci:foreach("network2", "switch",
		function(s)
			swname = s.name or s['.name']

			-- special: rtl8366s is eth0 (wan is eth1)
			if swname == "rtl8366s" then
				swdev = "eth0"

			-- special: rtl8366rb is eth0 (wan + lan)
			elseif swname == "rtl8366rb" then
				swdev = "eth0"

			-- treat swname as swdev
			else
				swdev = swname
			end

			return false
		end)

	-- find first vlan
	if swdev then
		uci:foreach("network2", "switch_vlan",
			function(s)
				if s.device == swname then
					local vlan = tonumber(s.vlan)
					if vlan and (not swvlan or vlan < swvlan) then
						swvlan = vlan
					end
				end
			end)
	end


	local veth, vlan = name:match("^(%S+)%.(%d+)$")

	-- have vlan id and matching switch
	if vlan and veth == swdev then
		return swname, swdev, vlan

	-- have no vlan id but matching switch, assume first switch vlan
	elseif not vlan and name == swdev then
		return swname, swdev, swvlan

	-- have vlan and no matching switch, assume software vlan
	elseif vlan then
		return nil, veth, vlan
	end
end


system.network = utl.class()

function system.network:__init__(s, sys)
	self._name    = s['.name']
	self._sys     = sys
	self._routes  = { }
	self._aliases = { }

	if s.type == "bridge" then
		self._interfaces = { system.network.bridge(s['.name'], self) }
	else
		self._interfaces = { }

		local ifn

		-- find wired ifaces
		for _, ifn in ipairs(system.find_iface_names(self._name)) do
			self._interfaces[#self._interfaces+1] = system.network.iface(ifn, self)
		end

		-- find wifi networks
		for _, ifn in ipairs(system.find_wifi_networks(self._name)) do
			self._interfaces[#self._interfaces+1] = system.network.iface(ifn, self)
		end
	end

	-- find ipv4 routes
	uci:foreach("network2", "route",
		function(s)
			if s.interface == self._name and s.target then
				self._routes[#self._routes+1] = system.network.route(s, self)
			end
		end)

	-- find ipv6 routes
	uci:foreach("network2", "route6",
		function(s)
			if s.interface == self._name and s.target then
				self._routes[#self._routes+1] = system.network.route(s, self)
			end
		end)

	-- find aliases
	uci:foreach("network2", "alias",
		function(s)
			if s.interface == self._name and s.proto then
				self._aliases[#self._aliases+1] = system.network.alias(s, self)
			end
		end)
end

function system.network:name()
	return self._name
end

function system.network:system()
	return self._sys
end

function system.network:interfaces()
	local index = 0
	return function()
		if index <= #self._interfaces then
			index = index + 1
			return self._interfaces[index]
		else
			return nil
		end
	end
end

function system.network:interface()
	return self._interfaces[1]
end

function system.network:num_routes()
	return #self._routes
end

function system.network:routes()
	local index = 0
	return function()
		if index <= #self._routes then
			index = index + 1
			return self._routes[index]
		else
			return nil
		end
	end
end

function system.network:num_aliases()
	return #self._aliases
end

function system.network:aliases()
	local index = 0
	return function()
		if index <= #self._aliases then
			index = index + 1
			return self._aliases[index]
		else
			return nil
		end
	end
end

function system.network:delete_route(rt)
	local i
	for i = 1, #self._routes do
		if self._routes[i]:name() == rt:name() then
			uci:delete("network2", rt:name())
			table.remove(self._routes, i)
			return true
		end
	end
	return false
end

function system.network:delete_alias(al)
	local i
	for i = 1, #self._aliases do
		if self._aliases[i]:name() == al:name() then
			uci:delete("network2", al:name())
			table.remove(self._aliases, i)
			return true
		end
	end
	return false
end

function system.network:print()
	self:interface():print()
end


system.network.iface = utl.class()

function system.network.iface:__init__(ifn, net, parent)
	self._net    = net
	self._parent = parent

	-- is a wifi iface
	if type(ifn) == "table" then
		local wifidev, network, index = unpack(ifn)

		self._name    = "%s.%d" %{ wifidev, index }
		self._wifidev = wifidev
		self._wifinet = index
		self._ifname  = uci:get("wireless", network, "ifname") or self._name

	-- is a wired iface
	else
		self._name   = ifn
		self._ifname = ifn

		local switch, swdev, vlan = system.find_switch(self._ifname)

		if switch then
			self._switch = system.switch(switch, swdev, self)
		end

		if vlan then
			self._vlan = system.vlan(vlan, self._switch, self)
		end
	end
end

function system.network.iface:name()
	return self._name
end

function system.network.iface:parent()
	return self._parent
end

function system.network.iface:network()
	return self._net
end

function system.network.iface:is_managed()
	return (self._net ~= nil)
end

function system.network.iface:is_vlan()
	return (self._vlan ~= nil)
end

function system.network.iface:is_software_vlan()
	return (not self._switch and self._vlan ~= nil)
end

function system.network.iface:is_hardware_vlan()
	return (self._switch ~= nil and self._vlan ~= nil)
end

function system.network.iface:_sysfs(path, default)
	path = "/sys/class/net/%s/%s" %{ self._ifname, path }

	local data = nfs.readfile(path)

	if type(default) == "number" then
		return tonumber(data) or default
	elseif data and #data > 0 then
		return data and data:gsub("%s+$", "") or default
	end

	return default
end

function system.network.iface:rx_bytes()
	return self:_sysfs("statistics/rx_bytes", 0)
end

function system.network.iface:tx_bytes()
	return self:_sysfs("statistics/tx_bytes", 0)
end

function system.network.iface:rx_packets()
	return self:_sysfs("statistics/rx_packets", 0)
end

function system.network.iface:tx_packets()
	return self:_sysfs("statistics/tx_packets", 0)
end

function system.network.iface:macaddr()
	return self:_sysfs("address")
end

function system.network.iface:mtu()
	return self:_sysfs("mtu", 1500)
end

function system.network.iface:is_bridge()
	return (self:_sysfs("bridge/max_age", 0) > 0)
end

function system.network.iface:is_bridge_port()
	return (self:_sysfs("brport/port_no", 0) > 0)
end

function system.network.iface:delete()
	if self._wifidev then
		local cnt = 0
		uci:foreach("wireless", "wifi-iface", 
			function(s)
				cnt = cnt + 1
				if s.device == self._wifidev and cnt == self._wifinet then
					uci:delete("wireless", s['.name'])
					return false
				end
			end)
	end
end

function system.network.iface:print()
	if self._wifidev then
		print("  wifi: ", self._wifidev, "net: ", self._wifinet)
	else
		print("  iface: ", self._name)
	end

	print("    rx: ", self:rx_bytes(), self:rx_packets())
	print("    tx: ", self:tx_bytes(), self:tx_packets())
	print("    mtu: ", self:mtu())
	print("    mac: ", self:macaddr())
	print("    bridge? ", self:is_bridge())
	print("    port? ", self:is_bridge_port())
	print("    swvlan? ", self:is_software_vlan())
	print("    hwvlan? ", self:is_hardware_vlan())

	if self._switch then
		self._switch:print()
	end

	if self._vlan then
		self._vlan:print()
	end
end


system.network.bridge = utl.class(system.network.iface)

function system.network.bridge:__init__(brn, net)
	self._net    = net
	self._name   = "br-" .. brn
	self._ifname = self._name
	self._interfaces = { }

	local ifn

	-- find wired ifaces
	for _, ifn in ipairs(system.find_iface_names(brn)) do
		self._interfaces[#self._interfaces+1] = system.network.iface(ifn, net, self)
	end

	-- find wifi networks
	for _, ifn in ipairs(system.find_wifi_networks(brn)) do
		self._interfaces[#self._interfaces+1] = system.network.iface(ifn, net, self)
	end
end

function system.network.bridge:interfaces()
	local index = 0
	return function()
		if index <= #self._interfaces then
			index = index + 1
			return self._interfaces[index]
		else
			return nil
		end
	end
end

function system.network.bridge:print()
	local v
	for v in self:interfaces() do
		io.write("  port: ")
		v:print()
	end
	print("  rx: ", self:rx_bytes(), self:rx_packets())
	print("  tx: ", self:tx_bytes(), self:tx_packets())
	print("  mtu: ", self:mtu())
	print("  mac: ", self:macaddr())
	print("  bridge? ", self:is_bridge())
	print("  port? ", self:is_bridge_port())
end


system.network.route = utl.class()

function system.network.route:__init__(rt, net)
	self._net    = net
	self._name   = rt['.name']
	self._ipv6   = (rt['.type'] == "route6")
	self._mtu    = tonumber(rt.mtu) or (net and net:interface():mtu() or 1500)
	self._metric = tonumber(rt.metric) or 0

	if self._ipv6 then
		self._gateway = lip.IPv6(rt.gateway or "::")
		self._target  = lip.IPv6(rt.target  or "::")
	else
		self._gateway = lip.IPv4(rt.gateway or "0.0.0.0")
		self._target  = lip.IPv4(rt.target  or "0.0.0.0", rt.netmask or "0.0.0.0")
	end
end

function system.network.route:name()
	return self._name
end

function system.network.route:network()
	return self._net
end

function system.network.route:mtu()
	return self._mtu
end

function system.network.route:metric()
	return self._metric
end

function system.network.route:is_ipv4()
	return not self._ipv6
end

function system.network.route:is_ipv6()
	return self._ipv6
end

function system.network.route:target()
	return self._target
end

function system.network.route:gateway()
	return self._gateway
end


system.network.alias = utl.class()

function system.network.alias:__init__(a, net)
	self._net  = net
	self._name = a['.name']
end


system.switch = utl.class()

function system.switch:__init__(switch, swdev, net)
	self._name   = switch
	self._ifname = swdev
	self._net    = net

	if not system._switches[switch] then
		local x = io.popen("swconfig dev %q help 2>/dev/null" % switch)
		if x then
			local desc = x:read("*l")

			if desc then
				local name, num_ports, num_cpu, num_vlans =
					desc:match("Switch %d: %S+%((.-)%), ports: (%d+) %(cpu @ (%d+)%), vlans: (%d+)")

				self._model   = name
				self._ports   = tonumber(num_ports)
				self._cpuport = tonumber(num_cpu)
				self._vlans   = tonumber(num_vlans)
			end

			x:close()

		elseif nfs.access("/proc/switch/%s" % switch) then
			self._model   = self:_proc("driver", switch)
			self._ports   = self:_proc_count("port", 6)
			self._vlans   = self:_proc_count("vlan", 16)
		end

		-- defaults
		self._model   = self._model   or switch
		self._ports   = self._ports   or 6
		self._vlans   = self._vlans   or 16
		self._cpuport = self._cpuport or 5

		system._switches[switch] = self
	else
		self._model   = system._switches[switch]._model
		self._ports   = system._switches[switch]._ports
		self._vlans   = system._switches[switch]._vlans
		self._cpuport = system._switches[switch]._cpuport
	end
end

function system.switch:_proc(path, default)
	local data = nfs.readfile("/proc/switch/%s/%s" %{ self._name, path })
	if data then
		return data:gsub("%s+$", "")
	end
	return default
end

function system.switch:_proc_count(path, default)
	local cnt = 0
	for _ in nfs.dir("/proc/switch/%s/%s" %{ self._name, path }) do
		cnt = cnt + 1
	end
	return cnt > 0 and cnt or default
end

function system.switch:name()
	return self._name
end

function system.switch:model()
	return self._model
end

function system.switch:num_possible_vlans()
	return self._vlans
end

function system.switch:num_active_vlans()
	local cnt = 0
	uci:foreach("network2", "switch_vlan",
		function(s)
			if s.device == self._name then cnt = cnt + 1 end
		end)
	return cnt
end

function system.switch:vlans()
	local index = 0
	local vlans = { }

	uci:foreach("network2", "switch_vlan",
		function(s)
			if s.device == self._name and tonumber(s.vlan) then
				vlans[#vlans+1] = tonumber(s.vlan)
			end
		end)

	return function()
		if index <= #vlans then
			index = index + 1
			return system.vlan(vlans[index], self)
		else
			return nil
		end
	end
end

function system.switch:num_ports()
	return self._ports
end

function system.switch:delete_vlan(vlan)
	local rv = false

	uci:foreach("network2", "switch_vlan",
		function(s)
			if s.device == self._name and tonumber(s.vlan) == vlan then
				rv = true
				uci:delete("network2", s['.name'])

				if system._vlans[s.device] and system._vlans[s.device][vlan] then
					table.remove(system._vlans[s.device], vlan)
				end

				return false
			end
		end)

	return rv
end

function system.switch:print()
	print("Switch:", self._model)
	print("  Ports:", self._ports, "Cpu:", self._cpuport)
	print("  Vlans:", self._vlans)
end


system.vlan = utl.class()

function system.vlan:__init__(vlan, switch, iface)
	self._vlan   = vlan
	self._switch = switch
	self._iface  = iface

	local swid = (switch and switch:name()) or (iface and iface:name()) or ""

	if not system._vlans[swid] or not system._vlans[swid][vlan] then
		self._ports  = { }

		if switch then
			uci:foreach("network2", "switch_vlan",
				function(s)
					if s.device == switch:name() and tonumber(s.vlan) == vlan then
						local p
						for _, p in ipairs(uci:list("network2", s['.name'], "ports")) do
							self._ports[#self._ports+1] = system.vlan.port(p, self)
						end
						self._name = s['.name']
					end
				end)
		else
			self._ports[#self._ports+1] = system.vlan.port("0t", self)
		end

		system._vlans[swid] = system._vlans[swid] or { }
		system._vlans[swid][vlan] = self
	else
		self._ports = system._vlans[swid][vlan]._ports
	end
end

function system.vlan:name()
	return self._name
end

function system.vlan:number()
	return self._vlan
end

function system.vlan:switch()
	return self._switch
end

function system.vlan:interface()
	return self._iface
end

function system.vlan:is_software()
	return (self._switch == nil)
end

function system.vlan:is_hardware()
	return not self:is_software()
end

function system.vlan:num_ports()
	return #self._ports
end

function system.vlan:ports()
	local index = 0
	return function()
		if index <= #self._ports then
			index = index + 1
			return self._ports[index]
		else
			return nil
		end
	end
end

function system.vlan:_update()
	local i
	local ports = { }

	for i = 1, #self._ports do
		ports[#ports+1] = self._ports[i]:string()
	end

	uci:set("network2", self._name, "ports", table.concat(ports, " "))
end

function system.vlan:delete_port(port)
	if self._switch then
		local i
		for i = 1, #self._ports do
			if self._ports[i]:number() == port then
				table.remove(self._ports, i)
				self:_update()
				return true
			end
		end
	end
	return false
end

function system.vlan:print()
	print(" Vlan:", self._vlan, "Software?", self:is_software())
	local p
	for p in self:ports() do
		p:print()
	end
end


system.vlan.port = utl.class()

function system.vlan.port:__init__(port, vlan)
	local num, tag = port:match("^(%d+)([tu]?)")

	self._vlan   = vlan
	self._port   = tonumber(num)
	self._tagged = (tag == "t")
end

function system.vlan.port:number()
	return self._port
end

function system.vlan.port:vlan()
	return self._vlan
end

function system.vlan.port:string()
	return "%i%s" %{ self._port, self._tagged ? "t" : "" }
end

function system.vlan.port:is_tagged()
	return self._tagged
end

function system.vlan.port:print()
	print("  Port:", self._port, "Tagged:", self._tagged)
end


-- ------------------------------

local s = system()

s:print()

s:find_network("wan"):print()
s:find_interface("eth0"):parent():print()

]==]
