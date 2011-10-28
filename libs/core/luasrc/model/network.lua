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

local type, next, pairs, ipairs, loadfile, table, tonumber, math, i18n
	= type, next, pairs, ipairs, loadfile, table, tonumber, math, luci.i18n

local require = require

local nxo = require "nixio"
local nfs = require "nixio.fs"
local ipc = require "luci.ip"
local sys = require "luci.sys"
local utl = require "luci.util"
local dsp = require "luci.dispatcher"
local uci = require "luci.model.uci"

module "luci.model.network"


IFACE_PATTERNS_VIRTUAL  = { }
IFACE_PATTERNS_IGNORE   = { "^wmaster%d", "^wifi%d", "^hwsim%d", "^imq%d", "^ifb%d", "^mon%.wlan%d", "^sit%d", "^lo$" }
IFACE_PATTERNS_WIRELESS = { "^wlan%d", "^wl%d", "^ath%d", "^%w+%.network%d" }


protocol = utl.class()

local _protocols = { }

local _interfaces, _bridge, _switch, _tunnel
local _uci_real, _uci_state

function _filter(c, s, o, r)
	local val = _uci_real:get(c, s, o)
	if val then
		local l = { }
		if type(val) == "string" then
			for val in val:gmatch("%S+") do
				if val ~= r then
					l[#l+1] = val
				end
			end
			if #l > 0 then
				_uci_real:set(c, s, o, table.concat(l, " "))
			else
				_uci_real:delete(c, s, o)
			end
		elseif type(val) == "table" then
			for _, val in ipairs(val) do
				if val ~= r then
					l[#l+1] = val
				end
			end
			if #l > 0 then
				_uci_real:set(c, s, o, l)
			else
				_uci_real:delete(c, s, o)
			end
		end
	end
end

function _append(c, s, o, a)
	local val = _uci_real:get(c, s, o) or ""
	if type(val) == "string" then
		local l = { }
		for val in val:gmatch("%S+") do
			if val ~= a then
				l[#l+1] = val
			end
		end
		l[#l+1] = a
		_uci_real:set(c, s, o, table.concat(l, " "))
	elseif type(val) == "table" then
		local l = { }
		for _, val in ipairs(val) do
			if val ~= a then
				l[#l+1] = val
			end
		end
		l[#l+1] = a
		_uci_real:set(c, s, o, l)
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
	return _uci_real:get(c, s, o)
end

function _set(c, s, o, v)
	if v ~= nil then
		if type(v) == "boolean" then v = v and "1" or "0" end
		return _uci_real:set(c, s, o, v)
	else
		return _uci_real:delete(c, s, o)
	end
end

function _wifi_iface(x)
	local _, p
	for _, p in ipairs(IFACE_PATTERNS_WIRELESS) do
		if x:match(p) then
			return true
		end
	end
	return false
end

function _wifi_lookup(ifn)
	-- got a radio#.network# pseudo iface, locate the corresponding section
	local radio, ifnidx = ifn:match("^(%w+)%.network(%d+)$")
	if radio and ifnidx then
		local sid = nil
		local num = 0

		ifnidx = tonumber(ifnidx)
		_uci_real:foreach("wireless", "wifi-iface",
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

		_uci_state:foreach("wireless", "wifi-iface",
			function(s)
				if s.ifname == ifn then
					sid = s['.name']
					return false
				end
			end)

		return sid
	end
end

function _iface_virtual(x)
	local _, p
	for _, p in ipairs(IFACE_PATTERNS_VIRTUAL) do
		if x:match(p) then
			return true
		end
	end
	return false
end

function _iface_ignore(x)
	local _, p
	for _, p in ipairs(IFACE_PATTERNS_IGNORE) do
		if x:match(p) then
			return true
		end
	end
	return _iface_virtual(x)
end


function init(cursor)
	_uci_real  = cursor or _uci_real or uci.cursor()
	_uci_state = _uci_real:substate()

	_interfaces = { }
	_bridge     = { }
	_switch     = { }
	_tunnel     = { }

	-- read interface information
	local n, i
	for n, i in ipairs(nxo.getifaddrs()) do
		local name = i.name:match("[^:]+")
		local prnt = name:match("^([^%.]+)%.")

		if _iface_virtual(name) then
			_tunnel[name] = true
		end

		if _tunnel[name] or not _iface_ignore(name) then
			_interfaces[name] = _interfaces[name] or {
				idx      = i.ifindex or n,
				name     = name,
				rawname  = i.name,
				flags    = { },
				ipaddrs  = { },
				ip6addrs = { }
			}

			if prnt then
				_switch[name] = true
				_switch[prnt] = true
			end

			if i.family == "packet" then
				_interfaces[name].flags   = i.flags
				_interfaces[name].stats   = i.data
				_interfaces[name].macaddr = i.addr
			elseif i.family == "inet" then
				_interfaces[name].ipaddrs[#_interfaces[name].ipaddrs+1] = ipc.IPv4(i.addr, i.netmask)
			elseif i.family == "inet6" then
				_interfaces[name].ip6addrs[#_interfaces[name].ip6addrs+1] = ipc.IPv6(i.addr, i.netmask)
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
					ifnames = { _interfaces[r[4]] }
				}
				if b.ifnames[1] then
					b.ifnames[1].bridge = b
				end
				_bridge[r[1]] = b
			elseif b then
				b.ifnames[#b.ifnames+1] = _interfaces[r[2]]
				b.ifnames[#b.ifnames].bridge = b
			end
		end
	end

	return _M
end

function save(self, ...)
	_uci_real:save(...)
	_uci_real:load(...)
end

function commit(self, ...)
	_uci_real:commit(...)
	_uci_real:load(...)
end

function ifnameof(self, x)
	if utl.instanceof(x, interface) then
		return x:name()
	elseif utl.instanceof(x, protocol) then
		return x:ifname()
	elseif type(x) == "string" then
		return x:match("^[^:]+")
	end
end

function get_protocol(self, protoname, netname)
	local v = _protocols[protoname]
	if v then
		return v(netname or "__dummy__")
	end
end

function get_protocols(self)
	local p = { }
	local _, v
	for _, v in ipairs(_protocols) do
		p[#p+1] = v("__dummy__")
	end
	return p
end

function register_protocol(self, protoname)
	local proto = utl.class(protocol)

	function proto.__init__(self, name)
		self.sid = name
	end

	function proto.proto(self)
		return protoname
	end

	_protocols[#_protocols+1] = proto
	_protocols[protoname]     = proto

	return proto
end

function register_pattern_virtual(self, pat)
	IFACE_PATTERNS_VIRTUAL[#IFACE_PATTERNS_VIRTUAL+1] = pat
end


function has_ipv6(self)
	return nfs.access("/proc/net/ipv6_route")
end

function add_network(self, n, options)
	local oldnet = self:get_network(n)
	if n and #n > 0 and n:match("^[a-zA-Z0-9_]+$") and not oldnet then
		if _uci_real:section("network", "interface", n, options) then
			return network(n)
		end
	elseif oldnet and oldnet:is_empty() then
		if options then
			local k, v
			for k, v in pairs(options) do
				oldnet:set(k, v)
			end
		end
		return oldnet
	end
end

function get_network(self, n)
	if n and _uci_real:get("network", n) == "interface" then
		return network(n)
	end
end

function get_networks(self)
	local nets = { }
	local nls = { }

	_uci_real:foreach("network", "interface",
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
	local r = _uci_real:delete("network", n)
	if r then
		_uci_real:delete_all("network", "alias",
			function(s) return (s.interface == n) end)

		_uci_real:delete_all("network", "route",
			function(s) return (s.interface == n) end)

		_uci_real:delete_all("network", "route6",
			function(s) return (s.interface == n) end)

		_uci_real:foreach("wireless", "wifi-iface",
			function(s)
				if s.network == n then
					_uci_real:delete("wireless", s['.name'], "network")
				end
			end)
	end
	return r
end

function rename_network(self, old, new)
	local r
	if new and #new > 0 and new:match("^[a-zA-Z0-9_]+$") and not self:get_network(new) then
		r = _uci_real:section("network", "interface", new, _uci_real:get_all("network", old))

		if r then
			_uci_real:foreach("network", "alias",
				function(s)
					if s.interface == old then
						_uci_real:set("network", s['.name'], "interface", new)
					end
				end)

			_uci_real:foreach("network", "route",
				function(s)
					if s.interface == old then
						_uci_real:set("network", s['.name'], "interface", new)
					end
				end)

			_uci_real:foreach("network", "route6",
				function(s)
					if s.interface == old then
						_uci_real:set("network", s['.name'], "interface", new)
					end
				end)

			_uci_real:foreach("wireless", "wifi-iface",
				function(s)
					if s.network == old then
						_uci_real:set("wireless", s['.name'], "network", new)
					end
				end)

			_uci_real:delete("network", old)
		end
	end
	return r or false
end

function get_interface(self, i)
	if _interfaces[i] or _wifi_iface(i) then
		return interface(i)
	else
		local ifc
		local num = { }
		_uci_real:foreach("wireless", "wifi-iface",
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
	local seen = { }
	local nfs = { }
	local baseof = { }

	-- find normal interfaces
	_uci_real:foreach("network", "interface",
		function(s)
			for iface in utl.imatch(s.ifname) do
				if not _iface_ignore(iface) and not _wifi_iface(iface) then
					seen[iface] = true
					nfs[iface] = interface(iface)
				end
			end
		end)

	for iface in utl.kspairs(_interfaces) do
		if not (seen[iface] or _iface_ignore(iface) or _wifi_iface(iface)) then
			nfs[iface] = interface(iface)
		end
	end

	-- find vlan interfaces
	_uci_real:foreach("network", "switch_vlan",
		function(s)
			if not s.device then
				return
			end

			local base = baseof[s.device]
			if not base then
				if not s.device:match("^eth%d") then
					local l
					for l in utl.execi("swconfig dev %q help 2>/dev/null" % s.device) do
						if not base then
							base = l:match("^%w+: (%w+)")
						end
					end
					if not base or not base:match("^eth%d") then
						base = "eth0"
					end
				else
					base = s.device
				end
				baseof[s.device] = base
			end

			local vid = tonumber(s.vid or s.vlan)
			if vid ~= nil and vid >= 0 and vid <= 4095 then
				local iface = "%s.%d" %{ base, vid }
				if not seen[iface] then
					seen[iface] = true
					nfs[iface] = interface(iface)
				end
			end
		end)

	for iface in utl.kspairs(nfs) do
		ifaces[#ifaces+1] = nfs[iface]
	end

	-- find wifi interfaces
	local num = { }
	local wfs = { }
	_uci_real:foreach("wireless", "wifi-iface",
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
	if _uci_real:get("wireless", dev) == "wifi-device" then
		return wifidev(dev)
	end
end

function get_wifidevs(self)
	local devs = { }
	local wfd  = { }

	_uci_real:foreach("wireless", "wifi-device",
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
		_uci_real:get("wireless", options.device) == "wifi-device"
	then
		local wnet = _uci_real:section("wireless", "wifi-iface", nil, options)
		return wifinet(wnet)
	end
end

function del_wifinet(self, net)
	local wnet = _wifi_lookup(net)
	if wnet then
		_uci_real:delete("wireless", wnet)
		return true
	end
	return false
end


function network(name, proto)
	if name then
		local p = proto or _uci_real:get("network", name, "proto")
		local c = p and _protocols[p] or protocol
		return c(name)
	end
end

function protocol.__init__(self, name)
	self.sid = name
end

function protocol._get(self, opt)
	local v = _uci_real:get("network", self.sid, opt)
	if type(v) == "table" then
		return table.concat(v, " ")
	end
	return v or ""
end

function protocol._ip(self, opt, family, list)
	local ip = _uci_state:get("network", self.sid, opt)
	local fc = (family == 6) and ipc.IPv6 or ipc.IPv4
	if ip or list then
		if list then
			local l = { }
			for ip in utl.imatch(ip) do
				ip = fc(ip)
				if ip then l[#l+1] = ip:string() end
			end
			return l
		else
			ip = fc(ip)
			return ip and ip:string()
		end
	end
end

function protocol.get(self, opt)
	return _get("network", self.sid, opt)
end

function protocol.set(self, opt, val)
	return _set("network", self.sid, opt, val)
end

function protocol.ifname(self)
	local p = self:proto()
	if self:is_bridge() then
		return "br-" .. self.sid
	elseif self:is_virtual() then
		return p .. "-" .. self.sid
	else
		local num = { }
		local dev = _uci_real:get("network", self.sid, "ifname") or
			_uci_state:get("network", self.sid, "ifname")

		dev = (type(dev) == "table") and dev[1] or dev
		dev = (dev ~= nil) and dev:match("%S+")

		if not dev then
			_uci_real:foreach("wireless", "wifi-iface",
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

function protocol.proto(self)
	return "none"
end

function protocol.get_i18n(self)
	local p = self:proto()
	if p == "none" then
		return i18n.translate("Unmanaged")
	elseif p == "static" then
		return i18n.translate("Static address")
	elseif p == "dhcp" then
		return i18n.translate("DHCP client")
	else
		return i18n.translate("Unknown")
	end
end

function protocol.type(self)
	return self:_get("type")
end

function protocol.name(self)
	return self.sid
end

function protocol.uptime(self)
	local cnt = tonumber(_uci_state:get("network", self.sid, "connect_time"))
	if cnt ~= nil then
		return nxo.sysinfo().uptime - cnt
	else
		return 0
	end
end

function protocol.expires(self)
	local a = tonumber(_uci_state:get("network", self.sid, "lease_acquired"))
	local l = tonumber(_uci_state:get("network", self.sid, "lease_lifetime"))
	if a and l then
		l = l - (nxo.sysinfo().uptime - a)
		return l > 0 and l or 0
	end
	return -1
end

function protocol.metric(self)
	return tonumber(_uci_state:get("network", self.sid, "metric")) or 0
end

function protocol.ipaddr(self)
	return self:_ip("ipaddr", 4)
end

function protocol.netmask(self)
	return self:_ip("netmask", 4)
end

function protocol.gwaddr(self)
	return self:_ip("gateway", 4)
end

function protocol.dnsaddrs(self)
	return self:_ip("dns", 4, true)
end

function protocol.ip6addr(self)
	local ip6 = self:_ip("ip6addr", 6)
	if not ip6 then
		local ifc = _interfaces[self:ifname()]
		if ifc and ifc.ip6addrs then
			local a
			for _, a in ipairs(ifc.ip6addrs) do
				if not a:is6linklocal() then
					ip6 = a:string()
					break
				end
			end
		end
	end
	return ip6
end

function protocol.gw6addr(self)
	local ip6 = self:_ip("ip6gw", 6)
	if not ip6 then
		local dr6 = sys.net.defaultroute6()
		if dr6 and dr6.device == self:ifname() then
			return dr6.nexthop:string()
		end
	end
	return ip6
end

function protocol.dns6addrs(self)
	return self:_ip("dns", 6, true)
end

function protocol.is_bridge(self)
	return (not self:is_virtual() and self:type() == "bridge")
end

function protocol.opkg_package(self)
	return nil
end

function protocol.is_installed(self)
	return true
end

function protocol.is_virtual(self)
	return false
end

function protocol.is_floating(self)
	return false
end

function protocol.is_empty(self)
	if self:is_floating() then
		return false
	else
		local rv = true

		if (self:_get("ifname") or ""):match("%S+") then
			rv = false
		end

		_uci_real:foreach("wireless", "wifi-iface",
			function(s)
				if s.network == self.sid then
					rv = false
					return false
				end
			end)

		return rv
	end
end

function protocol.add_interface(self, ifname)
	ifname = _M:ifnameof(ifname)
	if ifname and not self:is_floating() then
		-- remove the interface from all ifaces
		_uci_real:foreach("network", "interface",
			function(s)
				_filter("network", s['.name'], "ifname", ifname)
			end)

		-- if its a wifi interface, change its network option
		local wif = _wifi_lookup(ifname)
		if wif then
			_uci_real:set("wireless", wif, "network", self.sid)

		-- add iface to our iface list
		else
			_append("network", self.sid, "ifname", ifname)
		end
	end
end

function protocol.del_interface(self, ifname)
	ifname = _M:ifnameof(ifname)
	if ifname and not self:is_floating() then
		-- if its a wireless interface, clear its network option
		local wif = _wifi_lookup(ifname)
		if wif then	_uci_real:delete("wireless", wif, "network") end

		-- remove the interface
		_filter("network", self.sid, "ifname", ifname)
	end
end

function protocol.get_interface(self)
	if self:is_virtual() then
		_tunnel[self:proto() .. "-" .. self.sid] = true
		return interface(self:proto() .. "-" .. self.sid, self)
	elseif self:is_bridge() then
		_bridge["br-" .. self.sid] = true
		return interface("br-" .. self.sid, self)
	else
		local ifn = nil
		local num = { }
		for ifn in utl.imatch(_uci_real:get("network", self.sid, "ifname")) do
			ifn = ifn:match("^[^:/]+")
			return ifn and interface(ifn, self)
		end
		ifn = nil
		_uci_real:foreach("wireless", "wifi-iface",
			function(s)
				if s.device then
					num[s.device] = num[s.device] and num[s.device] + 1 or 1
					if s.network == self.sid then
						ifn = s.ifname or "%s.network%d" %{ s.device, num[s.device] }
						return false
					end
				end
			end)
		return ifn and interface(ifn, self)
	end
end

function protocol.get_interfaces(self)
	if self:is_bridge() or (self:is_virtual() and not self:is_floating()) then
		local ifaces = { }

		local ifn
		local nfs = { }
		for ifn in utl.imatch(self:get("ifname")) do
			ifn = ifn:match("^[^:/]+")
			nfs[ifn] = interface(ifn, self)
		end

		for ifn in utl.kspairs(nfs) do
			ifaces[#ifaces+1] = nfs[ifn]
		end

		local num = { }
		local wfs = { }
		_uci_real:foreach("wireless", "wifi-iface",
			function(s)
				if s.device then
					num[s.device] = num[s.device] and num[s.device] + 1 or 1
					if s.network == self.sid then
						ifn = "%s.network%d" %{ s.device, num[s.device] }
						wfs[ifn] = interface(ifn, self)
					end
				end
			end)

		for ifn in utl.kspairs(wfs) do
			ifaces[#ifaces+1] = wfs[ifn]
		end

		return ifaces
	end
end

function protocol.contains_interface(self, ifname)
	ifname = _M:ifnameof(ifname)
	if not ifname then
		return false
	elseif self:is_virtual() and self:proto() .. "-" .. self.sid == ifname then
		return true
	elseif self:is_bridge() and "br-" .. self.sid == ifname then
		return true
	else
		local ifn
		for ifn in utl.imatch(self:get("ifname")) do
			ifn = ifn:match("[^:]+")
			if ifn == ifname then
				return true
			end
		end

		local wif = _wifi_lookup(ifname)
		if wif then
			return (_uci_real:get("wireless", wif, "network") == self.sid)
		end
	end

	return false
end

function protocol.adminlink(self)
	return dsp.build_url("admin", "network", "network", self.sid)
end


interface = utl.class()

function interface.__init__(self, ifname, network)
	local wif = _wifi_lookup(ifname)
	if wif then self.wif = wifinet(wif) end

	self.ifname  = self.ifname or ifname
	self.dev     = _interfaces[self.ifname]
	self.network = network
end

function interface.name(self)
	return self.wif and self.wif:ifname() or self.ifname
end

function interface.mac(self)
	return (self.dev and self.dev.macaddr or "00:00:00:00:00:00"):upper()
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
	elseif _bridge[self.ifname] then
		return "bridge"
	elseif _tunnel[self.ifname] then
		return "tunnel"
	elseif self.ifname:match("%.") then
		return "vlan"
	elseif _switch[self.ifname] then
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
	elseif x == "vlan" then
		return i18n.translate("VLAN Interface")
	elseif x == "tunnel" then
		return i18n.translate("Tunnel Interface")
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
	if not self.network then
		if self.dev and self.dev.network then
			self.network = _M:get_network(self.dev.network)
		end
	end

	if not self.network then
		local net
		for _, net in ipairs(_M:get_networks()) do
			if net:contains_interface(self.ifname) or
			   net:ifname() == self.ifname
			then
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
	self.sid    = dev
	self.iwinfo = dev and sys.wifi.getiwinfo(dev) or { }
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

function wifidev.hwmodes(self)
	local l = self.iwinfo.hwmodelist
	if l and next(l) then
		return l
	else
		return { b = true, g = true }
	end
end

function wifidev.get_i18n(self)
	local t = "Generic"
	if self.iwinfo.type == "wl" then
		t = "Broadcom"
	elseif self.iwinfo.type == "madwifi" then
		t = "Atheros"
	end

	local m = ""
	local l = self:hwmodes()
	if l.a then m = m .. "a" end
	if l.b then m = m .. "b" end
	if l.g then m = m .. "g" end
	if l.n then m = m .. "n" end

	return "%s 802.11%s Wireless Controller (%s)" %{ t, m, self:name() }
end

function wifidev.is_up(self)
	local up = false

	_uci_state:foreach("wireless", "wifi-iface",
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
	if _uci_real:get("wireless", net) == "wifi-iface" then
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

	_uci_real:foreach("wireless", "wifi-iface",
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

	local wnet = _uci_real:section("wireless", "wifi-iface", nil, options)
	if wnet then
		return wifinet(wnet, options)
	end
end

function wifidev.del_wifinet(self, net)
	if utl.instanceof(net, wifinet) then
		net = net.sid
	elseif _uci_real:get("wireless", net) ~= "wifi-iface" then
		net = _wifi_lookup(net)
	end

	if net and _uci_real:get("wireless", net, "device") == self.sid then
		_uci_real:delete("wireless", net)
		return true
	end

	return false
end


wifinet = utl.class()

function wifinet.__init__(self, net, data)
	self.sid = net

	local num = { }
	local netid
	_uci_real:foreach("wireless", "wifi-iface",
		function(s)
			if s.device then
				num[s.device] = num[s.device] and num[s.device] + 1 or 1
				if s['.name'] == self.sid then
					netid = "%s.network%d" %{ s.device, num[s.device] }
					return false
				end
			end
		end)

	local dev = _uci_state:get("wireless", self.sid, "ifname") or netid

	self.netid  = netid
	self.wdev   = dev
	self.iwinfo = dev and sys.wifi.getiwinfo(dev) or { }
	self.iwdata = data or _uci_state:get_all("wireless", self.sid) or
		_uci_real:get_all("wireless", self.sid) or { }
end

function wifinet.get(self, opt)
	return _get("wireless", self.sid, opt)
end

function wifinet.set(self, opt, val)
	return _set("wireless", self.sid, opt, val)
end

function wifinet.mode(self)
	return _uci_state:get("wireless", self.sid, "mode") or "ap"
end

function wifinet.ssid(self)
	return _uci_state:get("wireless", self.sid, "ssid")
end

function wifinet.bssid(self)
	return _uci_state:get("wireless", self.sid, "bssid")
end

function wifinet.network(self)
	return _uci_state:get("wifinet", self.sid, "network")
end

function wifinet.id(self)
	return self.netid
end

function wifinet.name(self)
	return self.sid
end

function wifinet.ifname(self)
	local ifname = self.iwinfo.ifname
	if not ifname or ifname:match("^wifi%d") or ifname:match("^radio%d") then
		ifname = self.wdev
	end
	return ifname
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

	if     m == "ap"      then m = "Master"
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
	return _stror(self.iwinfo.bssid, self.iwdata.bssid) or "00:00:00:00:00:00"
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
		tonumber(_uci_state:get("wireless", self.iwdata.device, "channel"))
end

function wifinet.signal(self)
	return self.iwinfo.signal or 0
end

function wifinet.noise(self)
	return self.iwinfo.noise or 0
end

function wifinet.country(self)
	return self.iwinfo.country or "00"
end

function wifinet.txpower(self)
	return self.iwinfo.txpower or 0
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
	return dsp.build_url("admin", "network", "wireless", self.netid)
end

function wifinet.get_network(self)
	if _uci_real:get("network", self.iwdata.network) == "interface" then
		return network(self.iwdata.network)
	end
end

function wifinet.get_interface(self)
	return interface(self:ifname())
end


-- setup base protocols
_M:register_protocol("static")
_M:register_protocol("dhcp")
_M:register_protocol("none")

-- load protocol extensions
local exts = nfs.dir(utl.libpath() .. "/model/network")
if exts then
	local ext
	for ext in exts do
		if ext:match("%.lua$") then
			require("luci.model.network." .. ext:gsub("%.lua$", ""))
		end
	end
end
