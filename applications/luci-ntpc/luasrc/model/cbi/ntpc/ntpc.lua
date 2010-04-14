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
m = Map("ntpclient", translate("Time Synchronisation"), translate("Synchronizes the system time"))

s = m:section(TypedSection, "ntpclient", translate("General"))
s.anonymous = true
s.addremove = false

s:option(DummyValue, "_time", translate("Current system time")).value = os.date("%c")

s:option(Value, "interval", translate("Update interval (in seconds)")).rmempty = true
s:option(Value, "count", translate("Count of time measurements"), translate("empty = infinite")).rmempty = true


s2 = m:section(TypedSection, "ntpdrift", translate("Clock Adjustment"))
s2.anonymous = true
s2.addremove = false
s2:option(Value, "freq", translate("Offset frequency")).rmempty = true

s3 = m:section(TypedSection, "ntpserver", translate("Time Servers"))
s3.anonymous = true
s3.addremove = true
s3.template = "cbi/tblsection"

s3:option(Value, "hostname", translate("Hostname"))
s3:option(Value, "port", translate("Port")).rmempty = true

return m
