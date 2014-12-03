--[[
LuCI - Network model - 6to4, 6in4 & 6rd protocol extensions

Copyright 2011 Jo-Philipp Wich <xm@subsignal.org>
Copyright 2013 Steven Barth <steven@midlink.org>

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

local _, p
for _, p in ipairs({"dslite"}) do

	local proto = netmod:register_protocol(p)

	function proto.get_i18n(self)
		if p == "dslite" then
			return luci.i18n.translate("Dual-Stack Lite (RFC6333)")
		end
	end

	function proto.ifname(self)
		return p .. "-" .. self.sid
	end

	function proto.opkg_package(self)
		if p == "dslite" then
			return "ds-lite"
		end
	end

	function proto.is_installed(self)
		return nixio.fs.access("/lib/netifd/proto/" .. p .. ".sh")
	end

	function proto.is_floating(self)
		return true
	end

	function proto.is_virtual(self)
		return true
	end

	function proto.get_interfaces(self)
		return nil
	end

	function proto.contains_interface(self, ifname)
		return (netmod:ifnameof(ifc) == self:ifname())
	end

	netmod:register_pattern_virtual("^%s-%%w" % p)
end
