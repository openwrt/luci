--[[
LuCI - Network model - HSO protocol extension

Copyright 2015 Stanislas Bertrand <stanislasbertrand@gmail.com>

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

local proto = netmod:register_protocol("hso")

function proto.ifname(self)
		return "hso-" .. self.sid
end

function proto.get_i18n(self)
	return luci.i18n.translate("HSO")
end

function proto.opkg_package(self)
	return "comgt"
end

function proto.is_installed(self)
	return nixio.fs.access("/lib/netifd/proto/hso.sh")
end

function proto.is_floating(self)
	return false
end

function proto.is_virtual(self)
	return false
end

function proto.get_interfaces(self)
	return netmod.protocol.get_interfaces(self)
end

function proto.contains_interface(self, ifc)
	return netmod.protocol.contains_interface(self, ifc)
end

netmod:register_pattern_virtual("^hso-%%w")

