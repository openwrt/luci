-- Copyright 2016 Joerg Schueler-Maroldt <schueler.maroldt@gmail.com>
-- Licensed to the public under the Apache License 2.0.

local map, section, net = ...

local device, apn, pincode, auth, username, password
local ipv6, maxwait, defaultroute, metric, peerdns, dns,
      keepalive_failure, keepalive_interval, demand


ifname = section:taboption("general", Value, "ifname", translate("Network device"))
ifname.rmempty = false
local ifname_suggestions = nixio.fs.glob("/dev/wwan[0-9]*")
if ifname_suggestions then
	local node
	for node in ifname_suggestions do
		ifname:value(node)
	end
end

apn = section:taboption("general", Value, "apn", translate("Access Point Name (APN)"))
pincode = section:taboption("general", Value, "pincode", translate("SIM-Pincode"))
username = section:taboption("general", Value, "username", translate("Username"))
password = section:taboption("general", Value, "password", translate("Password"))
password.password = true
delay = section:taboption("general", Value, "delay", translate("Delay before start AT-commands"))
mode = section:taboption("general", Value, "mode", translate("Network mode"))
mode:value("", translate("No change"))
mode:value("auto", "Automatic")
mode:value("preferlte", "prefer LTE")
mode:value("preferumts", "prefer UMTS")
mode:value("lte", "LTE only")
mode:value("umts", "UMTS only")
mode:value("gsm", "GSM/EDGE only")

