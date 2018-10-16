-- Copyright 2017 Florian Eckert <fe@dev.tdt.de>
-- Licensed to the public under the GNU General Public License v2.

local net = require "luci.model.network".init()

local s, m, local_source, mask, rtmon

m = Map("mwan3", translate("MWAN - Globals"))

s = m:section(NamedSection, "globals", "globals", nil)

local_source = s:option(ListValue, "local_source",
	translate("Local source interface"),
	translate("Use the IP address of this interface as source IP " ..
	"address for traffic initiated by the router itself"))
local_source:value("none")
local_source.default = "none"
for _, net in ipairs(net:get_networks()) do
	if net:name() ~= "loopback" then
		local_source:value(net:name())
	end
end
local_source.rmempty = false

mask = s:option(
	Value,
	"mmx_mask",
	translate("Firewall mask"),
	translate("Enter value in hex, starting with <code>0x</code>"))
mask.datatype = "hex(4)"
mask.default = "0xff00"

rtmon = s:option(
	Value,
	"rtmon_interval",
	translate("Update interval"),
	translate("How often should rtmon update the interface routing table"))
rtmon.datatype = "integer"
rtmon.default = "5"
rtmon:value("1", translatef("%d second", 1))
rtmon:value("3", translatef("%d seconds", 3))
rtmon:value("5", translatef("%d seconds", 5))
rtmon:value("7", translatef("%d seconds", 7))
rtmon:value("10", translatef("%d seconds", 10))

return m
