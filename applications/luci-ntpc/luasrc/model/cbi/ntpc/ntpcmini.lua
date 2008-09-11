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
require("luci.tools.webadmin")
m = Map("ntpclient", translate("ntpc"), translate("ntpc_desc"))

s = m:section(TypedSection, "ntpclient", translate("general"))
s.anonymous = true

s:option(DummyValue, "_time", translate("ntpc_current")).value = os.date("%c")

s:option(Value, "interval", translate("ntpc_interval")).rmempty = true


s3 = m:section(TypedSection, "ntpserver", translate("ntpc_timeserver"))
s3.anonymous = true
s3.addremove = true
s3.template = "cbi/tblsection"

s3:option(Value, "hostname", translate("hostname"))
s3:option(Value, "port", translate("port")).rmempty = true

return m