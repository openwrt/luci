--[[
LuCI - Network model - 3G, PPP, PPtP, PPPoE and PPPoA protocol extension

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
local proto  = luci.util.class(netmod.proto.generic)

netmod.IFACE_PATTERNS_VIRTUAL[#netmod.IFACE_PATTERNS_VIRTUAL+1] = "^3g-%w"
netmod.IFACE_PATTERNS_VIRTUAL[#netmod.IFACE_PATTERNS_VIRTUAL+1] = "^ppp-%w"
netmod.IFACE_PATTERNS_VIRTUAL[#netmod.IFACE_PATTERNS_VIRTUAL+1] = "^pptp-%w"
netmod.IFACE_PATTERNS_VIRTUAL[#netmod.IFACE_PATTERNS_VIRTUAL+1] = "^pppoe-%w"
netmod.IFACE_PATTERNS_VIRTUAL[#netmod.IFACE_PATTERNS_VIRTUAL+1] = "^pppoa-%w"

function proto.__init__(self, name)
	self.sid = name
end

function proto.ifname(self)
	return self:proto() .. "-" .. self.sid
end

function proto.is_floating(self)
	return (self:proto() ~= "pppoe")
end

function proto.is_virtual(self)
	return true
end

function proto.get_interfaces(self)
	if self:is_floating() then
		return nil
	else
		return netmod.proto.generic.get_interfaces(self)
	end
end

function proto.contains_interface(self, ifc)
	if self:is_floating() then
		return (netmod:ifnameof(ifc) == self:ifname())
	else
		return netmod.proto.generic.contains_interface(self, ifname)
	end
end


netmod.proto["3g"]    = proto
netmod.proto["ppp"]   = proto
netmod.proto["pptp"]  = proto
netmod.proto["pppoe"] = proto
netmod.proto["pppoa"] = proto
