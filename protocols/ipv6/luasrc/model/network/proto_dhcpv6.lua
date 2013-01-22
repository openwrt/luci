--[[
LuCI - Network model - dhcpv6 protocol extension

Copyright 2013 Jo-Philipp Wich <xm@subsignal.org>

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

local proto = luci.model.network:register_protocol("dhcpv6")

function proto.get_i18n(self)
	return luci.i18n.translate("DHCPv6 client")
end

function proto.is_installed(self)
	return nixio.fs.access("/lib/netifd/proto/dhcpv6.sh")
end

function proto.opkg_package(self)
	return "ipv6-support"
end
