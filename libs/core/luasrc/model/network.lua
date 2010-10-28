--[[
LuCI - Network model

Copyright 2009-2010 Jo-Philipp Wich <xm@subsignal.org>

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

local type, pairs, ipairs, loadfile, table, tonumber, i18n
	= type, pairs, ipairs, loadfile, table, tonumber, luci.i18n

local nxo = require "nixio"
local ipc = require "luci.ip"
local sys = require "luci.sys"
local utl = require "luci.util"
local dsp = require "luci.dispatcher"
local uci = require "luci.model.uci"

module "luci.model.network"


local ifs, brs, sws, uci_r, uci_s

function list_remove(c, s, o, r)
	local val = uci_r:get(c, s, o)
	if val then
		local l = { }
		if type(val) == "string" then
			for val in val:gmatch("%S+") do
				if val ~= r then
					l[#l+1] = val
				end
			end
			if #l > 0 then
				uci_r:set(c, s, o, table.concat(l, " "))
			else
				uci_r:delete(c, s, o)
			end
		elseif type(val) == "table" then
			for _, val in ipairs(val) do
				if val ~= r then
					l[#l+1] = val
				end
			end
			if #l > 0 then
				uci_r:set(c, s, o, l)
			else
				uci_r:delete(c, s, o)
			end
		end
	end
end

function list_add(c, s, o, a)
	local val = uci_r:get(c, s, o) or ""
	if type(val) == "string" then
		local l = { }
		for val in val:gmatch("%S+") do
			if val ~= a then
				l[#l+1] = val
			end
		end
		l[#l+1] = a
		uci_r:set(c, s, o, table.concat(l, " "))
	elseif type(val) == "table" then
		local l = { }
		for _, val in ipairs(val) do
			if val ~= a then
				l[#l+1] = val
			end
		end
		l[#l+1] = a
		uci_r:set(c, s, o, l)
	end
end

function wifi_iface(x)
	return (
		x:match("^wlan%d") or x:match("^wl%d") or x:match("^ath%d") or
		x:match("^%w+%.network%d")
	)
end

function wifi_lookup(ifn)
	-- got a radio#.network# pseudo iface, locate the corresponding section
	local radio, ifnidx = ifn:match("^(%w+)%.network(%d+)$")
	if radio and ifnidx then
		local sid = nil
		local num = 0

		ifnidx = tonumber(ifnidx)
		uci_r:foreach("wireless", "wifi-iface",
			function(s)
				if s.device == radio then
					num = num + 1
					if num == ifnidx then
						sid = s['.name']
						return false
					end
				end
			end)

		return sid

	-- looks like wifi, try to locate the section via state vars
	elseif wifi_iface(ifn) then
		local sid = nil

		uci_s:foreach("wireless", "wifi-iface",
			function(s)
				if s.ifname == ifn then
					sid = s['.name']
					return false
				end
			end)

		return sid
	end
end

function iface_ignore(x)
	return (
		x:match("^wmaster%d") or x:match("^wifi%d") or x:match("^hwsim%d") or
		x:match("^imq%d") or x:match("^mon.wlan%d") or x:match("^6in4-%w") or
		x:match("^3g-%w") or x:match("^ppp-%w") or x:match("^pppoe-%w") or
		x:match("^pppoa-%w") or	x == "lo"
	)
end


function init(cursor)
	if cursor then
		uci_r = cursor
		uci_s = cursor:substate()

		ifs = { }
		brs = { }
		sws = { }

		-- read interface information
		local n, i
		for n, i in ipairs(nxo.getifaddrs()) do
			local name = i.name:match("[^:]+")
			local prnt = name:match("^([^%.]+)%.")

			if not iface_ignore(name) then
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
		if uci_r:section("network", "interface", n, options) then
			return network(n)
		end
	end
end

function get_network(self, n)
	if n and uci_r:get("network", n) == "interface" then
		return network(n)
	end
end

function get_networks(self)
	local nets = { }
	uci_r:foreach("network", "interface",
		function(s)
			nets[#nets+1] = network(s['.name'])
		end)
	return nets
end

function del_network(self, n)
	local r = uci_r:delete("network", n)
	if r then
		uci_r:foreach("network", "alias",
			function(s)
				if s.interface == n then
					uci_r:delete("network", s['.name'])
				end
			end)

		uci_r:foreach("network", "route",
			function(s)
				if s.interface == n then
					uci_r:delete("network", s['.name'])
				end
			end)

		uci_r:foreach("network", "route6",
			function(s)
				if s.interface == n then
					uci_r:delete("network", s['.name'])
				end
			end)

		uci_r:foreach("wireless", "wifi-iface",
			function(s)
				if s.network == n then
					uci_r:delete("wireless", s['.name'], "network")
				end
			end)

		uci_r:delete("network", n)
	end
	return r
end

function rename_network(self, old, new)
	local r
	if new and #new > 0 and new:match("^[a-zA-Z0-9_]+$") and not self:get_network(new) then
		r = uci_r:section("network", "interface", new, uci_r:get_all("network", old))

		if r then
			uci_r:foreach("network", "alias",
				function(s)
					if s.interface == old then
						uci_r:set("network", s['.name'], "interface", new)
					end
				end)

			uci_r:foreach("network", "route",
				function(s)
					if s.interface == old then
						uci_r:set("network", s['.name'], "interface", new)
					end
				end)

			uci_r:foreach("network", "route6",
				function(s)
					if s.interface == old then
						uci_r:set("network", s['.name'], "interface", new)
					end
				end)

			uci_r:foreach("wireless", "wifi-iface",
				function(s)
					if s.network == old then
						uci_r:set("wireless", s['.name'], "network", new)
					end
				end)

			uci_r:delete("network", old)
		end
	end
	return r or false
end

function get_interface(self, i)
	if ifs[i] or wifi_iface(i) then
		return interface(i)
	else
		local ifc
		local num = { }
		uci_r:foreach("wireless", "wifi-iface",
			function(s)
				if s.device then
					num[s.device] = num[s.device] and num[s.device] + 1 or 1
					if s['.name'] == i then
						ifc = interface(
							"%s.network%d" %{s.device, num[s.device] })
						return false
					end
				end
			end)
		return ifc
	end
end

function get_interfaces(self)
	local iface
	local ifaces = { }

	-- find normal interfaces
	for iface in utl.kspairs(ifs) do
		if not iface_ignore(iface) and not wifi_iface(iface) then
			ifaces[#ifaces+1] = interface(iface)
		end
	end

	-- find wifi interfaces
	local num = { }
	local wfs = { }
	uci_r:foreach("wireless", "wifi-iface",
		function(s)
			if s.device then
				num[s.device] = num[s.device] and num[s.device] + 1 or 1
				local i = "%s.network%d" %{ s.device, num[s.device] }
				wfs[i] = interface(i)
			end
		end)

	for iface in utl.kspairs(wfs) do
		ifaces[#ifaces+1] = wfs[iface]
	end

	return ifaces
end

function ignore_interface(self, x)
	return iface_ignore(x)
end


network = utl.class()

function network.__init__(self, name)
	self.sid = name
end

function network._get(self, opt)
	local v = uci_r:get("network", self.sid, opt)
	if type(v) == "table" then
		return table.concat(v, " ")
	end
	return v or ""
end

function network.ifname(self)
	local p = self:proto()
	if self:is_bridge() then
		return "br-" .. self.sid
	elseif self:is_virtual() then
		return p .. "-" .. self.sid
	else
		local dev = self:_get("ifname") or
			uci_r:get("network", self.sid, "ifname")

		dev = dev and dev:match("%S+")

		if not dev then
			uci_r:foreach("wireless", "wifi-iface",
				function(s)
					if s.device then
						num[s.device] = num[s.device]
							and num[s.device] + 1 or 1

						if s.network == self.sid then
							dev = "%s.network%d" %{ s.device, num[s.device] }
							return false
						end
					end
				end)
		end

		return dev
	end
end

function network.device(self)
	local dev = self:_get("device")
	if not dev or dev:match("[^%w%-%.%s]") then
		dev = uci_r:get("network", self.sid, "ifname")
	end
	return dev
end

function network.proto(self)
	return self:_get("proto") or "none"
end

function network.type(self)
	return self:_get("type")
end

function network.name(self)
	return self.sid
end

function network.is_bridge(self)
	return (self:type() == "bridge")
end

function network.is_virtual(self)
	local p = self:proto()
	return (
		p == "3g" or p == "6in4" or p == "ppp" or
		p == "pppoe" or p == "pppoa"
	)
end

function network.is_empty(self)
	if self:is_virtual() then
		return false
	else
		local rv = true

		if (self:_get("ifname") or ""):match("%S+") then
			rv = false
		end

		uci_r:foreach("wireless", "wifi-iface",
			function(s)
				if s.network == self.sid then
					rv = false
					return false
				end
			end)

		return rv
	end
end

function network.add_interface(self, ifname)
	if not self:is_virtual() then
		if type(ifname) ~= "string" then
			ifname = ifname:name()
		else
			ifname = ifname:match("[^%s:]+")
		end

		-- remove the interface from all ifaces
		uci_r:foreach("network", "interface",
			function(s)
				list_remove("network", s['.name'], "ifname", ifname)
			end)

		-- if its a wifi interface, change its network option
		local wif = wifi_lookup(ifname)
		if wif then
			uci_r:set("wireless", wif, "network", self.sid)

		-- add iface to our iface list
		else
			list_add("network", self.sid, "ifname", ifname)
		end
	end
end

function network.del_interface(self, ifname)
	if not self:is_virtual() then
		if type(ifname) ~= "string" then
			ifname = ifname:name()
		else
			ifname = ifname:match("[^%s:]+")
		end

		-- if its a wireless interface, clear its network option
		local wif = wifi_lookup(ifname)
		if wif then	uci_r:delete("wireless", wif, "network") end

		-- remove the interface
		list_remove("network", self.sid, "ifname", ifname)
	end
end

function network.get_interfaces(self)
	local ifaces = { }

	local ifn
	if self:is_virtual() then
		ifn = self:proto() .. "-" .. self.sid
		ifaces = { interface(ifn) }
	else
		local nfs = { }
		for ifn in self:_get("ifname"):gmatch("%S+") do
			ifn = ifn:match("[^:]+")
			nfs[ifn] = interface(ifn)
		end

		for ifn in utl.kspairs(nfs) do
			ifaces[#ifaces+1] = nfs[ifn]
		end

		local num = { }
		local wfs = { }
		uci_r:foreach("wireless", "wifi-iface",
			function(s)
				if s.device then
					num[s.device] = num[s.device] and num[s.device] + 1 or 1
					if s.network == self.sid then
						ifn = "%s.network%d" %{ s.device, num[s.device] }
						wfs[ifn] = interface(ifn)
					end
				end
			end)

		for ifn in utl.kspairs(wfs) do
			ifaces[#ifaces+1] = wfs[ifn]
		end
	end

	return ifaces
end

function network.contains_interface(self, ifname)
	if type(ifname) ~= "string" then
		ifname = ifname:name()
	else
		ifname = ifname:match("[^%s:]+")
	end

	local ifn
	if self:is_virtual() then
		ifn = self:proto() .. "-" .. self.sid
		return ifname == ifn
	else
		for ifn in self:_get("ifname"):gmatch("%S+") do
			ifn = ifn:match("[^:]+")
			if ifn == ifname then
				return true
			end
		end

		local wif = wifi_lookup(ifname)
		if wif then
			return (uci_r:get("wireless", wif, "network") == self.sid)
		end
	end

	return false
end

function network.adminlink(self)
	return dsp.build_url("admin", "network", "network", self.sid)
end


interface = utl.class()
function interface.__init__(self, ifname)
	self.wif = wifi_lookup(ifname)

	if self.wif then
		self.ifname = uci_s:get("wireless", self.wif, "ifname")
		self.iwinfo = self.ifname and sys.wifi.getiwinfo(self.ifname) or { }
		self.iwdata = uci_s:get_all("wireless", self.wif) or { }
		self.iwname = ifname
	end

	self.ifname = self.ifname or ifname
	self.dev    = ifs[self.ifname]
end

function interface.name(self)
	return self.wif and uci_s:get("wireless", self.wif, "ifname") or self.ifname
end

function interface.mac(self)
	return self.dev and self.dev or "00:00:00:00:00:00"
end

function interface.ipaddrs(self)
	return self.dev and self.dev.ipaddrs or { }
end

function interface.ip6addrs(self)
	return self.dev and self.dev.ip6addrs or { }
end

function interface.type(self)
	if wifi_iface(self.ifname) then
		return "wifi"
	elseif brs[self.ifname] then
		return "bridge"
	elseif sws[self.ifname] or self.ifname:match("%.") then
		return "switch"
	else
		return "ethernet"
	end
end

function _choose(s1, s2)
	if not s1 or #s1 == 0 then
		return s2 and #s2 > 0 and s2
	else
		return s1
	end
end

function interface.shortname(self)
	if self.iwinfo or self.iwdata then
		return "%s %q" %{
			i18n.translate(self.iwinfo.mode),
			_choose(self.iwinfo.ssid,  self.iwdata.ssid ) or
			_choose(self.iwinfo.bssid, self.iwdata.bssid) or
			"%s (%s)" %{ i18n.translate("unknown"), self.ifname }
		}
	else
		return self.ifname
	end
end

function interface.get_i18n(self)
	if self.iwinfo or self.iwdata then
		return "%s: %s %q" %{
			i18n.translate("Wireless Network"),
			_choose(self.iwinfo.mode,  self.iwdata.mode ),
			_choose(self.iwinfo.ssid,  self.iwdata.ssid ) or
			_choose(self.iwinfo.bssid, self.iwdata.bssid) or
			"%s (%s)" %{ i18n.translate("unknown"), self.ifname }
		}
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

function interface.adminlink(self)
	if self:type() == "wifi" then
		return dsp.build_url("admin", "network", "wireless",
			self.iwdata.device, self.iwname)
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
	return self.dev and self.dev.flags and self.dev.flags.up or false
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
