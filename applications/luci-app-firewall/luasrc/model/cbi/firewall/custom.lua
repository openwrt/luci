--[[
LuCI - Lua Configuration Interface

Copyright 2011 Jo-Philipp Wich <xm@subsignal.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

local fs = require "nixio.fs"

local f = SimpleForm("firewall",
	translate("Firewall - Custom Rules"),
	translate("Custom rules allow you to execute arbritary iptables commands \
		which are not otherwise covered by the firewall framework. \
		The commands are executed after each firewall restart, right after \
		the default ruleset has been loaded."))

local o = f:field(Value, "_custom")

o.template = "cbi/tvalue"
o.rows = 20

function o.cfgvalue(self, section)
	return fs.readfile("/etc/firewall.user")
end

function o.write(self, section, value)
	value = value:gsub("\r\n?", "\n")
	fs.writefile("/etc/firewall.user", value)
end

return f
