-- Copyright 2019 Telco Antennas Pty Ltd <nicholas.smith@telcoantennas.com.au>
-- SPDX-License-Identifier: Apache-2.0

local netmod = luci.model.network
local interface = luci.model.network.interface
local proto = netmod:register_protocol("modemmanager")

function proto.get_i18n(self)
	return luci.i18n.translate("Mobile Data")
end

function proto.ifname(self)
	local base = netmod._M.protocol
	local ifname = base.ifname(self) -- call base class "protocol.ifname(self)"

	-- Note: ifname might be nil if the adapter could not be determined through ubus (default name to carrier-wan in this case)
	if ifname == nil then
		ifname = "carrier-" .. self.sid
	end
	return ifname
end

function proto.get_interface(self)
	return interface(self:ifname(), self)
end

function proto.opkg_package(self)
	return "modemmanager"
end

function proto.is_installed(self)
	return nixio.fs.access("/lib/netifd/proto/modemmanager.sh")
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

function proto.contains_interface(self, ifc)
	 return (netmod:ifnameof(ifc) == self:ifname())
end

netmod:register_pattern_virtual("^mobiledata%-%w")

netmod:register_error_code("CALL_FAILED",	luci.i18n.translate("Call failed.  Ensure that your SIM is active and has data."))
netmod:register_error_code("NO_CID",		luci.i18n.translate("Unable to obtain client ID from the carrier.  Check your SIM or try again in a few minutes."))
netmod:register_error_code("PLMN_FAILED",	luci.i18n.translate("Setting PLMN failed"))
