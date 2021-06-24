-- Copyright 2017 Florian Eckert <fe@dev.tdt.de>
-- Licensed to the public under the GNU General Public License v2.

local net = require "luci.model.network".init()

local s, m, o

m = Map("mwan3", translate("MWAN - Globals"))

s = m:section(NamedSection, "globals", "globals", nil)

o = s:option(Value, "mmx_mask",
	translate("Firewall mask"),
	translate("Enter value in hex, starting with <code>0x</code>"))
o.datatype = "hex(4)"
o.default = "0x3F00"

o = s:option(Flag, "logging",
	translate("Logging"),
	translate("Enables global firewall logging"))

o = s:option(ListValue, "loglevel",
	translate("Loglevel"),
	translate("Firewall loglevel"))
o.default = "notice"
o:value("emerg", translate("Emergency"))
o:value("alert", translate("Alert"))
o:value("crit", translate("Critical"))
o:value("error", translate("Error"))
o:value("warning", translate("Warning"))
o:value("notice", translate("Notice"))
o:value("info", translate("Info"))
o:value("debug", translate("Debug"))
o:depends("logging", "1")

o = s:option(DynamicList, "rt_table_lookup",
	translate("Routing table lookup"),
	translate("Also scan this Routing table for connected networks"))
o.datatype = "integer"
o:value("220", translatef("Routing table %d", 220))

return m
