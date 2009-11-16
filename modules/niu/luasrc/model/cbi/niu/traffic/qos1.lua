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

local sys = require "luci.sys"
local fs = require "nixio.fs"

m = Map("qos", translate("Manage Prioritization (QoS)"), translate([[Different
kinds of network traffic usually have different transmission requirements.
For example the important factor for a large HTTP-download is bandwith whereas
VoIP has a large focus on low packet latency. Prioritization takes these quality
of service factors into account and optimizes priorities to allow reasonable 
performance for time critical services.]]))

s = m:section(NamedSection, "wan", "interface", translate("General Settings"),
translate([[For QoS to work correctly you need to provide the upload and
download speed of your internet connection. Values are in kilobits per second.
For comparison a standard consumer ADSL connection has between 1000 and 25000
kbps as donwload speed and between 128 and 1000 kbps upload speed.]]))
s.addremove = false

local en = s:option(ListValue, "enabled", translate("Prioritization"))
en:value("1", "Enable Quality of Service")
en:value("0", "Disable")

local dl = s:option(Value, "download", translate("Maximum Download Speed"), "kbps")
dl:depends("enabled", "1")

local ul = s:option(Value, "upload", translate("Maximum Upload Speed"), "kbps")
ul:depends("enabled", "1")

s = m:section(TypedSection, "classify", translate("Finetuning"), translate([[
The QoS application provides different useful default prioritization rules not
listed here that cover many common use-cases. You however can add custom rules
to finetune the prioritization process.]]))
s.template = "cbi/tblsection"

s.anonymous = true
s.addremove = true

n = s:option(Value, "_name", translate("Name"), translate("optional"))

srch = s:option(Value, "srchost", translate("Local IP-Address"))
srch.rmempty = true
srch:value("", translate("all"))
for i, dataset in ipairs(sys.net.arptable()) do
	srch:value(dataset["IP address"])
end

p = s:option(ListValue, "proto", translate("Protocol"))
p:value("", translate("all"))
p:value("tcp", "TCP")
p:value("udp", "UDP")
p.rmempty = true

ports = s:option(Value, "ports", translate("Ports"))
ports.rmempty = true
ports:value("", translate("any"))

if fs.access("/etc/l7-protocols") then
	l7 = s:option(ListValue, "layer7", translate("Service"))
	l7.rmempty = true
	l7:value("", translate("all"))
	for f in fs.glob("/etc/l7-protocols/*.pat") do
		l7:value(f:sub(19, #f-4))
	end
end

s:option(Value, "connbytes", translate("Bytes sent"), translate("from[-to]"))

t = s:option(ListValue, "target", translate("Priority"))
t:value("Priority", translate("Highest"))
t:value("Express", translate("High"))
t:value("Normal", translate("Normal"))
t:value("Bulk", translate("Low"))
t.default = "Normal"

return m
