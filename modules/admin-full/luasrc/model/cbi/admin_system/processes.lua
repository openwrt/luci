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
f = SimpleForm("processes", translate("process_head"), translate("process_descr"))
f.reset = false
f.submit = false

t = f:section(Table, luci.sys.process.list())
t:option(DummyValue, "PID", translate("process_pid"))
t:option(DummyValue, "USER", translate("process_owner"))
t:option(DummyValue, "COMMAND", translate("process_command"))
t:option(DummyValue, "%CPU", translate("process_cpu"))
t:option(DummyValue, "%MEM", translate("process_mem"))

hup = t:option(Button, "_hup", translate("process_hup"))
hup.inputstyle = "reload"
function hup.write(self, section)
	null, self.tag_error[section] = luci.sys.process.signal(section, 1)
end

term = t:option(Button, "_term", translate("process_term"))
term.inputstyle = "remove"
function term.write(self, section)
	null, self.tag_error[section] = luci.sys.process.signal(section, 15)
end

kill = t:option(Button, "_kill", translate("process_kill"))
kill.inputstyle = "reset"
function kill.write(self, section)
	null, self.tag_error[section] = luci.sys.process.signal(section, 9)
end

return f