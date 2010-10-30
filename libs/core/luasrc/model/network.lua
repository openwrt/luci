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

local type, pairs, ipairs, loadfile, table, tonumber, math, i18n
	= type, pairs, ipairs, loadfile, table, tonumber, math, luci.i18n

local nxo = require "nixio"
local ipc = require "luci.ip"
local sys = require "luci.sys"
local utl = require "luci.util"
local dsp = require "luci.dispatcher"
local uci = require "luci.model.uci"

module "luci.model.network"


local ifs, brs, sws, uci_r, uci_s

function _list_del(c, s, o, r)
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

function _list_add(c, s, o, a)
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

function _stror(s1, s2)
	if not s1 or #s1 == 0 then
		return s2 and #s2 > 0 and s2
	else
		return s1
	end
end

function _get(c, s, o)
	return uci_r:get(c, s, o)
end

function _set(c, s, o, v)
	if v ~= nil then
		if type(v) == "boolean" then v = v and "1" or "0" end
		return uci_r:set(c, s, o, v)
	else
		return uci_r:del(c, s, o, v)
	end
end

function _wifi_iface(x)
	return (
		x:match("^wlan%d") or x:match("^wl%d") or x:match("^ath%d") or
		x:match("^%w+%.network%d")
	)
end

function _wifi_lookup(ifn)
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
	elseif _wifi_iface(ifn) then
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

function _iface_ignore(x)
	return (
		x:match("^wmaster%d") or x:match("^wifi%d") or x:match("^hwsim%d") or
		x:match("^imq%d") or x:match("^mon.wlan%d") or x:match("^6in4-%w") or
		x:match("^3g-%w") or x:match("^ppp-%w") or x:match("^pppoe-%w") or
		x:match("^pppoa-%w") or	x == "lo"
	)
end


function init(cursor)
	uci_r = cursor or luci.model.uci.cursor()
	uci_s = cursor:substate()

	ifs = { }
	brs = { }
	sws = { }

	-- read interface information
	local n, i
	for n, i in ipairs(nxo.getifaddrs()) do
		local name = i.name:match("[^:]+")
		local prnt = name:match("^([^%.]+)%.")

		if not _iface_ignore(name) then
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

	return _M
end

function save(self, ...)
	uci_r:save(...)
	uci_r:load(...)
end

function commit(self, ...)
	uci_r:commit(...)
	uci_r:load(...)
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
	local nls = { }

	uci_r:foreach("network", "interface",
		function(s)
			nls[s['.name']] = network(s['.name'])
		end)

	local n
	for n in utl.kspairs(nls) do
		nets[#nets+1] = nls[n]
	end

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
	if ifs[i] or _wifi_iface(i) then
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
		if not _iface_ignore(iface) and not _wifi_iface(iface) then
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
	return _iface_ignore(x)
end

function get_wifidev(self, dev)
	if uci_r:get("wireless", dev) == "wifi-device" then
		return wifidev(dev)
	end
end

function get_wifidevs(self)
	local devs = { }
	local wfd  = { }

	uci_r:foreach("wireless", "wifi-device",
		function(s) wfd[#wfd+1] = s['.name'] end)

	local dev
	for _, dev in utl.vspairs(wfd) do
		devs[#devs+1] = wifidev(dev)
	end

	return devs
end

function get_wifinet(self, net)
	local wnet = _wifi_lookup(net)
	if wnet then
		return wifinet(wnet)
	end
end

function add_wifinet(self, net, options)
	if type(options) == "table" and options.device and
		uci_r:get("wireless", options.device) == "wifi-device"
	then
		local wnet = uci_r:section("wireless", "wifi-iface", nil, options)
		return wifinet(wnet)
	end
end

function del_wifinet(self, net)
	local wnet = _wifi_lookup(net)
	if wnet then
		uci_r:delete("wireless", wnet)
		return true
	end
	return false
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

function network.get(self, opt)
	return _get("network", self.sid, opt)
end

function network.set(self, opt, val)
	return _set("network", self.sid, opt, val)
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
				_list_del("network", s['.name'], "ifname", ifname)
			end)

		-- if its a wifi interface, change its network option
		local wif = _wifi_lookup(ifname)
		if wif then
			uci_r:set("wireless", wif, "network", self.sid)

		-- add iface to our iface list
		else
			_list_add("network", self.sid, "ifname", ifname)
		end
	end
end

function network.del_interface(self, ifname)
	if not self:is_virtual() then
		if utl.instanceof(ifname, interface) then
			ifname = ifname:name()
		else
			ifname = ifname:match("[^%s:]+")
		end

		-- if its a wireless interface, clear its network option
		local wif = _wifi_lookup(ifname)
		if wif then	uci_r:delete("wireless", wif, "network") end

		-- remove the interface
		_list_del("network", self.sid, "ifname", ifname)
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

		local wif = _wifi_lookup(ifname)
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
	local wif = _wifi_lookup(ifname)
	if wif then self.wif = wifinet(wif) end

	self.ifname = self.ifname or ifname
	self.dev    = ifs[self.ifname]
end

function interface.name(self)
	return self.wif and self.wif:ifname() or self.ifname
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
	if self.wif or _wifi_iface(self.ifname) then
		return "wifi"
	elseif brs[self.ifname] then
		return "bridge"
	elseif sws[self.ifname] or self.ifname:match("%.") then
		return "switch"
	else
		return "ethernet"
	end
end

function interface.shortname(self)
	if self.wif then
		return "%s %q" %{
			self.wif:active_mode(),
			self.wif:active_ssid() or self.wif:active_bssid()
		}
	else
		return self.ifname
	end
end

function interface.get_i18n(self)
	if self.wif then
		return "%s: %s %q" %{
			i18n.translate("Wireless Network"),
			self.wif:active_mode(),
			self.wif:active_ssid() or self.wif:active_bssid()
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
	if self.wif then
		return self.wif:adminlink()
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
	if self.wif then
		return self.wif:is_up()
	else
		return self.dev and self.dev.flags and self.dev.flags.up or false
	end
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

function interface.get_wifinet(self)
	return self.wif
end


wifidev = utl.class()
function wifidev.__init__(self, dev)
	self.sid = dev
end

function wifidev.get(self, opt)
	return _get("wireless", self.sid, opt)
end

function wifidev.set(self, opt, val)
	return _set("wireless", self.sid, opt, val)
end

function wifidev.name(self)
	return self.sid
end

function wifidev.is_up(self)
	local up = false

	uci_s:foreach("wireless", "wifi-iface",
		function(s)
			if s.device == self.sid then
				if s.up == "1" then
					up = true
					return false
				end
			end
		end)

	return up
end

function wifidev.get_wifinet(self, net)
	if uci_r:get("wireless", net) == "wifi-iface" then
		return wifinet(net)
	else
		local wnet = _wifi_lookup(net)
		if wnet then
			return wifinet(wnet)
		end
	end
end

function wifidev.get_wifinets(self)
	local nets = { }

	uci_r:foreach("wireless", "wifi-iface",
		function(s)
			if s.device == self.sid then
				nets[#nets+1] = wifinet(s['.name'])
			end
		end)

	return nets
end

function wifidev.add_wifinet(self, options)
	options = options or { }
	options.device = self.sid

	local wnet = uci_r:section("wifidev", "wifi-iface", nil, options)
	if wnet then
		return wifinet(wnet)
	end
end

function wifidev.del_wifinet(self, net)
	if utl.instanceof(net, wifinet) then
		net = net.sid
	elseif uci_r:get("wireless", net) ~= "wifi-iface" then
		net = _wifi_lookup(net)
	end

	if net and uci_r:get("wireless", net, "device") == self.sid then
		uci_r:delete("wireless", net)
		return true
	end

	return false
end


wifinet = utl.class()
function wifinet.__init__(self, net)
	self.sid = net

	local dev = uci_s:get("wireless", self.sid, "ifname")
	if not dev then
		local num = { }
		uci_r:foreach("wireless", "wifi-iface",
			function(s)
				if s.device then
					num[s.device] = num[s.device] and num[s.device] + 1 or 1
					if s['.name'] == self.sid then
						dev = "%s.network%d" %{ s.device, num[s.device] }
						return false
					end
				end
			end)
	end

	self.wdev   = dev
	self.iwdata = uci_s:get_all("wireless", self.sid) or { }
	self.iwinfo = dev and sys.wifi.getiwinfo(dev) or { }
end

function wifinet.get(self, opt)
	return _get("wireless", self.sid, opt)
end

function wifinet.set(self, opt, val)
	return _set("wireless", self.sid, opt, val)
end

function wifinet.mode(self)
	return uci_s:get("wireless", self.sid, "mode") or "ap"
end

function wifinet.ssid(self)
	return uci_s:get("wireless", self.sid, "ssid")
end

function wifinet.bssid(self)
	return uci_s:get("wireless", self.sid, "bssid")
end

function wifinet.network(self)
	return uci_s:get("wifinet", self.sid, "network")
end

function wifinet.name(self)
	return self.sid
end

function wifinet.ifname(self)
	return self.iwinfo.ifname or self.wdev
end

function wifinet.get_device(self)
	if self.iwdata.device then
		return wifidev(self.iwdata.device)
	end
end

function wifinet.is_up(self)
	return (self.iwdata.up == "1")
end

function wifinet.active_mode(self)
	local m = _stror(self.iwinfo.mode, self.iwdata.mode) or "ap"

	if     m == "ap"      then m = "AP"
	elseif m == "sta"     then m = "Client"
	elseif m == "adhoc"   then m = "Ad-Hoc"
	elseif m == "mesh"    then m = "Mesh"
	elseif m == "monitor" then m = "Monitor"
	end

	return m
end

function wifinet.active_mode_i18n(self)
	return i18n.translate(self:active_mode())
end

function wifinet.active_ssid(self)
	return _stror(self.iwinfo.ssid, self.iwdata.ssid)
end

function wifinet.active_bssid(self)
	return _stror(self.iwinfo.bssid, self.iwinfo.bssid) or "00:00:00:00:00:00"
end

function wifinet.active_encryption(self)
	local enc = self.iwinfo and self.iwinfo.encryption
	return enc and enc.description or "-"
end

function wifinet.assoclist(self)
	return self.iwinfo.assoclist or { }
end

function wifinet.frequency(self)
	local freq = self.iwinfo.frequency
	if freq and freq > 0 then
		return "%.03f" % (freq / 1000)
	end
end

function wifinet.bitrate(self)
	local rate = self.iwinfo.bitrate
	if rate and rate > 0 then
		return (rate / 1000)
	end
end

function wifinet.channel(self)
	return self.iwinfo.channel or
		tonumber(uci_s:get("wireless", self.iwdata.device, "channel"))
end

function wifinet.signal(self)
	return self.iwinfo.signal or 0
end

function wifinet.noise(self)
	return self.iwinfo.noise or 0
end

function wifinet.signal_level(self, s, n)
	if self:active_bssid() ~= "00:00:00:00:00:00" then
		local signal = s or self:signal()
		local noise  = n or self:noise()

		if signal < 0 and noise < 0 then
			local snr = -1 * (noise - signal)
			return math.floor(snr / 5)
		else
			return 0
		end
	else
		return -1
	end
end

function wifinet.signal_percent(self)
	local qc = self.iwinfo.quality or 0
	local qm = self.iwinfo.quality_max or 0

	if qc > 0 and qm > 0 then
		return math.floor((100 / qm) * qc)
	else
		return 0
	end
end

function wifinet.shortname(self)
	return "%s %q" %{
		i18n.translate(self:active_mode()),
		self:active_ssid() or self:active_bssid()
	}
end

function wifinet.get_i18n(self)
	return "%s: %s %q (%s)" %{
		i18n.translate("Wireless Network"),
		i18n.translate(self:active_mode()),
		self:active_ssid() or self:active_bssid(),
		self:ifname()
	}
end

function wifinet.adminlink(self)
	return dsp.build_url("admin", "network", "wireless",
		self.iwdata.device, self.wdev)
end

function wifinet.get_network(self)
	if uci_r:get("network", self.iwdata.network) == "interface" then
		return network(self.iwdata.network)
	end
end

function wifinet.get_interface(self)
	return interface(self:ifname())
end
