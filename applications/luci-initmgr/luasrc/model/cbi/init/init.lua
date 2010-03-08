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

require("luci.sys")
require("luci.util")

local inits = { }

for _, name in ipairs(luci.sys.init.names()) do
	local index   = luci.sys.init.index(name)
	local enabled = luci.sys.init.enabled(name)

	inits["%02i.%s" % { index, name }] = {
		name    = name,
		index   = tostring(index),
		enabled = enabled
	}
end


m = SimpleForm("initmgr", translate("initmgr"), translate("initmgr_desc"))
m.reset = false
m.submit = false


s = m:section(Table, inits)

i = s:option(DummyValue, "index", translate("initmgr_index"))
n = s:option(DummyValue, "name", translate("initmgr_name"))


e = s:option(Button, "endisable", translate("initmgr_enabled"))

e.render = function(self, section, scope)
	if inits[section].enabled then
		self.title = translate("initmgr_enable", "Enabled")
		self.inputstyle = "save"
	else
		self.title = translate("initmgr_disable", "Disabled")
		self.inputstyle = "reset"
	end

	Button.render(self, section, scope)
end

e.write = function(self, section)
	if inits[section].enabled then
		inits[section].enabled = false
		return luci.sys.init.disable(inits[section].name)
	else
		inits[section].enabled = true
		return luci.sys.init.enable(inits[section].name)
	end
end


start = s:option(Button, "start", translate("initmgr_start",  "Start"))
start.inputstyle = "apply"
start.write = function(self, section)
	luci.sys.call("/etc/init.d/%s %s" %{ inits[section].name, self.option })
end

restart = s:option(Button, "restart", translate("initmgr_restart", "Restart"))
restart.inputstyle = "reload"
restart.write = start.write

stop = s:option(Button, "stop", translate("initmgr_stop",   "Stop"))
stop.inputstyle = "remove"
stop.write = start.write


return m

