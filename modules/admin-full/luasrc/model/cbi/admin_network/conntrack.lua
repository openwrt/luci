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

f = SimpleForm("conntrack", translate("a_n_conntrack"), translate("a_n_conntrack_desc"))
f.reset = false
f.submit = false

t = f:section(Table, luci.sys.net.conntrack())
l3 = t:option(DummyValue, "layer3", translate("network"))
function l3.cfgvalue(self, ...)
	return DummyValue.cfgvalue(self, ...):upper()
end


l4 = t:option(DummyValue, "layer4", translate("protocol"))
function l4.cfgvalue(self, ...)
	return DummyValue.cfgvalue(self, ...):upper()
end

s = t:option(DummyValue, "src", translate("source"))
function s.cfgvalue(self, section)
	return "%s:%s" % { self.map:get(section, "src"),
					 self.map:get(section, "sport") or "*" }
end

d = t:option(DummyValue, "dst", translate("destination"))
function d.cfgvalue(self, section)
	return "%s:%s" % { self.map:get(section, "dst"),
					 self.map:get(section, "dport") or "*" }
end

return f