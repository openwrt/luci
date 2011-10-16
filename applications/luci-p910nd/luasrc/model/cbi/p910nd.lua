--[[

LuCI p910nd
(c) 2008 Yanira <forum-2008@email.de>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--

local uci = luci.model.uci.cursor_state()

m = Map("p910nd", translate("p910nd - Printer server"),
        translatef("First you have to install the packages to get support for USB (kmod-usb-printer) or parallel port (kmod-lp)."))

s = m:section(TypedSection, "p910nd", translate("Settings"))
s.addremove = true
s.anonymous = true

s:option(Flag, "enabled", translate("enable"))

s:option(Value, "device", translate("Device")).rmempty = true

p = s:option(ListValue, "port", translate("Port"), translate("TCP listener port."))
p.rmempty = true
for i=0,9 do
	p:value(i, 9100+i)
end

s:option(Flag, "bidirectional", translate("Bidirectional mode"))

return m
