--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>
Copyright 2008 Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

local fs = require "nixio.fs"
local cronfile = "/etc/crontabs/root" 

f = SimpleForm("crontab", translate("Scheduled Tasks"), translate("This is the system crontab in which scheduled tasks can be defined."))

t = f:field(TextValue, "crons")
t.rmempty = true
t.rows = 10
function t.cfgvalue()
	return fs.readfile(cronfile) or ""
end

function f.handle(self, state, data)
	if state == FORM_VALID then
		if data.crons then
			fs.writefile(cronfile, data.crons:gsub("\r\n", "\n"))
		end
	end
	return true
end

return f
