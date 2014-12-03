--[[
LuCI - Network model - relay protocol extension

Copyright 2011 Jo-Philipp Wich <xm@subsignal.org>

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

local netmod = luci.model.network
local device = luci.util.class(netmod.interface)

netmod:register_pattern_virtual("^relay-%w")

local proto = netmod:register_protocol("relay")

function proto.get_i18n(self)
	return luci.i18n.translate("Relay bridge")
end

function proto.ifname(self)
	return "relay-" .. self.sid
end

function proto.opkg_package(self)
	return "relayd"
end

function proto.is_installed(self)
	return nixio.fs.access("/etc/init.d/relayd")
end

function proto.is_floating(self)
	return true
end

function proto.is_virtual(self)
	return true
end

function proto.get_interface(self)
	return device(self.sid, self)
end

function proto.get_interfaces(self)
	if not self.ifaces then
		local ifs = { }
		local _, net, dev

		for net in luci.util.imatch(self:_get("network")) do
			net = netmod:get_network(net)
			if net then
				dev = net:get_interface()
				if dev then
					ifs[dev:name()] = dev
				end
			end
		end

		for dev in luci.util.imatch(self:_get("ifname")) do
			dev = netmod:get_interface(dev)
			if dev then
				ifs[dev:name()] = dev
			end
		end

		self.ifaces = { }

		for _, dev in luci.util.kspairs(ifs) do
			self.ifaces[#self.ifaces+1] = dev
		end
	end

	return self.ifaces
end

function proto.uptime(self)
	local net
	local upt = 0
	for net in luci.util.imatch(self:_get("network")) do
		net = netmod:get_network(net)
		if net then
			upt = math.max(upt, net:uptime())
		end
	end
	return upt
end


function device.__init__(self, ifname, network)
	self.ifname  = ifname
	self.network = network
end

function device.type(self)
	return "tunnel"
end

function device.is_up(self)
	if self.network then
		local _, dev
		for _, dev in ipairs(self.network:get_interfaces()) do
			if not dev:is_up() then
				return false
			end
		end
		return true
	end
	return false
end

function device._stat(self, what)
	local v = 0
	if self.network then
		local _, dev
		for _, dev in ipairs(self.network:get_interfaces()) do
			v = v + dev[what](dev)
		end
	end
	return v
end

function device.rx_bytes(self) return self:_stat("rx_bytes") end
function device.tx_bytes(self) return self:_stat("tx_bytes") end
function device.rx_packets(self) return self:_stat("rx_packets") end
function device.tx_packets(self) return self:_stat("tx_packets") end

function device.mac(self)
	if self.network then
		local _, dev
		for _, dev in ipairs(self.network:get_interfaces()) do
			return dev:mac()
		end
	end
end

function device.ipaddrs(self)
	local addrs = { }
	if self.network then
		addrs[1] = luci.ip.IPv4(self.network:_get("ipaddr"))
	end
	return addrs
end

function device.ip6addrs(self)
	return { }
end

function device.shortname(self)
	return "%s %q" % { luci.i18n.translate("Relay"), self.ifname }
end

function device.get_type_i18n(self)
	return luci.i18n.translate("Relay Bridge")
end
