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
m = Map("ntpclient", translate("ntpc"), translate("ntpc_desc"))

s = m:section(TypedSection, "ntpclient", translate("ntpc_timeserver"))
s.anonymous = true
s.addremove = true
s.template = "cbi/tblsection"

s:option(Value, "hostname", translate("hostname"))
s:option(Value, "port", translate("port")).rmempty = true
s:option(Value, "count", translate("ntpc_count"), translate("ntpc_count_desc"))

return m