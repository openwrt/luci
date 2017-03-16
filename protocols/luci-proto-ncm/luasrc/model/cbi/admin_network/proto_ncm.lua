-- Copyright 2016 Joerg Schueler-Maroldt <schueler.maroldt@gmail.com>
-- Licensed to the public under the Apache License 2.0.

local map, section, net = ...
local device, apn, ipv6, pincode, username, password, delay, mode

device = section:taboption("general", Value, "device", translate("Control device"))
device.rmempty = false
local device_suggestions = nixio.fs.glob("/dev/tty[A-Z]*")
if device_suggestions then
	local node
	for node in device_suggestions do
		device:value(node)
	end
end

apn = section:taboption("general", Value, "apn", translate("Access Point Name (APN)"))
ipv6 = section:taboption("general", Flag, "ipv6", translate("IPv4/IPv6 APN"))
ipv6.default = '1'
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

