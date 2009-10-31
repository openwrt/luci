--[[
LuCI - Wireless model

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

local pairs, i18n, uci, math = pairs, luci.i18n, luci.model.uci, math

local iwi = require "iwinfo"
local utl = require "luci.util"
local uct = require "luci.model.uci.bind"

module "luci.model.wireless"

local ub = uct.bind("wireless")
local st, ifs

function init(cursor)
	cursor:unload("wireless")
	cursor:load("wireless")
	ub:init(cursor)

	st = uci.cursor_state()
	ifs = { }

	local count = 0

	ub.uci:foreach("wireless", "wifi-iface",
		function(s)
			count = count + 1

			local id = "%s.network%d" %{ s.device, count }

			ifs[id] = {
				id    = id,
				sid   = s['.name'],
				count = count
			}

			local dev = st:get("wireless", s['.name'], "ifname")
				or st:get("wireless", s['.name'], "device")

			local wtype = dev and iwi.type(dev)

			if dev and wtype then
				ifs[id].winfo = iwi[wtype]
				ifs[id].wdev  = dev
			end
		end)
end

function get_device(self, dev)
	return device(dev)
end

function get_devices(self)
	local devs = { }
	ub.uci:foreach("wireless", "wifi-device",
		function(s) devs[#devs+1] = device(s['.name']) end)
	return devs
end

function get_network(self, id)
	if ifs[id] then
		return network(ifs[id].sid)
	else
		local n
		for n, _ in pairs(ifs) do
			if ifs[n].sid == id then
				return network(id)
			end
		end
	end
end

function shortname(self, iface)
	if iface.wdev and iface.winfo then
		return "%s %q" %{
			i18n.translate(iface:active_mode()), 
			iface:active_ssid() or i18n.translate("(hidden)")
		}
	else
		return iface:name()
	end
end

function get_i18n(self, iface)
	if iface.wdev and iface.winfo then
		return "%s: %s %q (%s)" %{
			i18n.translate("Wireless Network"),
			i18n.translate(iface:active_mode()),
			iface:active_ssid() or i18n.translate("(hidden)"), iface.wdev
		}
	else
		return "%s: %q" %{ i18n.translate("Wireless Network"), iface:name() }
	end
end

function del_network(self, id)
	if ifs[id] then
		ub.uci:delete("wireless", ifs[id].sid)
		ifs[id] = nil
	else
		local n
		for n, _ in pairs(ifs) do
			if ifs[n].sid == id then
				ub.uci:delete("wireless", id)
				ifs[n] = nil
			end
		end
	end
end

function find_interfaces(self, iflist, brlist)
	local iface
	for iface, _ in pairs(ifs) do
		iflist[iface] = ifs[iface]
	end
end

function ignore_interface(self, iface)
	if ifs and ifs[iface] then
		return false
	else
		return iwi.type(iface) and true or false
	end
end

function add_interface(self, net, iface)
	if ifs and ifs[iface] and ifs[iface].sid then
		ub.uci:set("wireless", ifs[iface].sid, "network", net:name())
		ifs[iface].network = net:name()
		return true
	end

	return false
end

function del_interface(self, net, iface)
	if ifs and ifs[iface] and ifs[iface].sid then
		ub.uci:delete("wireless", ifs[iface].sid, "network")
		--return true
	end

	return false
end


device = ub:section("wifi-device")
device:property("type")
device:property("channel")
device:property_bool("disabled")

function device.name(self)
	return self.sid
end

function device.is_up(self)
	local rv = false

	if not self:disabled() then
		st:foreach("wireless", "wifi-iface",
			function(s)
				if s.device == self:name() and s.up == "1" then
					rv = true
					return false
				end
			end)
	end

	return rv
end

function device.get_networks(self)
	local nets = { }

	ub.uci:foreach("wireless", "wifi-iface",
		function(s)
			if s.device == self:name() then
				nets[#nets+1] = network(s['.name'])
			end
		end)

	return nets
end


network = ub:section("wifi-iface")
network:property("mode")
network:property("ssid")
network:property("bssid")
network:property("network")

function network._init(self, sid)
	local count = 0

	ub.uci:foreach("wireless", "wifi-iface",
		function(s)
			count = count + 1
			return s['.name'] ~= sid
		end)

	local parent_dev = st:get("wireless", sid, "device")

	local dev = st:get("wireless", sid, "ifname")
		or parent_dev

	if dev then
		self.id = "%s.network%d" %{ parent_dev, count }

		local wtype = iwi.type(dev)
		if dev and wtype then
			self.winfo = iwi[wtype]
			self.wdev  = dev
		end
	end
end

function network.name(self)
	return self.id
end

function network.ifname(self)
	return self.wdev
end

function network.get_device(self)
	if self.device then
		return device(self.device)
	end
end

function network.is_up(self)
	return (st:get("wireless", self.sid, "up") == "1")
end

function network.active_mode(self)
	local m = self.winfo and self.winfo.mode(self.wdev)
	if not m then
		m = self:mode()
		if     m == "ap"      then m = "AP"
		elseif m == "sta"     then m = "Client"
		elseif m == "adhoc"   then m = "Ad-Hoc"
		elseif m == "mesh"    then m = "Mesh"
		elseif m == "monitor" then m = "Monitor"
		end
	end
	return m or "Client"
end

function network.active_mode_i18n(self)
	return i18n.translate(self:active_mode())
end

function network.active_ssid(self)
	return self.winfo and self.winfo.ssid(self.wdev) or
		self:ssid()
end

function network.active_bssid(self)
	return self.winfo and self.winfo.bssid(self.wdev) or
		self:bssid() or "00:00:00:00:00:00"
end

function network.active_encryption(self)
	return self.winfo and self.winfo.enctype(self.wdev) or "-"
end

function network.assoclist(self)
	return self.winfo and self.winfo.assoclist(self.wdev) or { }
end

function network.frequency(self)
	local freq = self.winfo and self.winfo.frequency(self.wdev)
	return freq and freq > 0 and "%.03f" % (freq / 1000)
end

function network.bitrate(self)
	local rate = self.winfo and self.winfo.bitrate(self.wdev)
	return rate and rate > 0 and (rate / 1000)
end

function network.channel(self)
	return self.winfo and self.winfo.channel(self.wdev)
end

function network.signal(self)
	return self.winfo and self.winfo.signal(self.wdev) or 0
end

function network.noise(self)
	return self.winfo and self.winfo.noise(self.wdev) or 0
end

function network.signal_level(self, s, n)
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

function network.signal_percent(self)
	local qc = self.winfo and
		self.winfo.quality(self.wdev) or 0

	local qm = self.winfo and
		self.winfo.quality_max(self.wdev) or 0

	if qc > 0 and qm > 0 then
		return math.floor((100 / qm) * qc)
	else
		return 0
	end
end

