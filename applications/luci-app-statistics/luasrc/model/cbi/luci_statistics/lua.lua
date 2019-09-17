-- Copyright 2019 Florian Eckert <fe@dev.tdt.de>
-- Licensed to the public under the Apache License 2.0.

m = Map("collectd",
	translate("Lua Plugin Configuration"),
	translate("The lua plugin implements a Lua interpreter into collectd"))

-- collectd_lua config section
s = m:section( NamedSection, "plugin", "lua" )

-- collectd_lua.enable
enable = s:option( Flag, "enable", translate("Enable this plugin") )
enable.default = 0

-- collectd_lua.basepath (BasePath)
basepath = s:option( Value, "BasePath",
	translate("Script base path"),
	translate("The directory the Lua plugin looks in to find scripts")
basepath.datatype = "string"

-- collectd_lua.script (Script)
-- @todo

return m
