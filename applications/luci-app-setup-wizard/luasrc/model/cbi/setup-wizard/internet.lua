-- Copyright 2018 Rosy Song <rosysong@rosinson.com>
-- Licensed to the public under the Apache License 2.0.

local fs = require "nixio.fs"
local uci = require "luci.model.uci".cursor()
local has_wifi =  ((fs.stat("/etc/config/wireless", "size") or 0) > 0)
local nurl = "complete"

if has_wifi then nurl = "wireless" end

m = SimpleForm("internet", translate("Setup Wizard - Internet Access"))
m.submit = translate("Next")

-- m.back = translate("Back")
-- m.redirect = luci.dispatcher.build_url("admin/system/setup-wizard")

m.reset = false
m.flow = { skip = true }

o = m:field(ListValue, "proto", translate("Protocol"))
o.default = "pppoe"
o:value("pppoe", "PPPoE")
o:value("dhcp", "DHCP client")

username = m:field(Value, "username", translate("PAP/CHAP username"))
username:depends("proto", "pppoe")

password = m:field(Value, "password", translate("PAP/CHAP password"))
password.password = true
password:depends("proto", "pppoe")

dc = m:field(DummyValue, "dhcp", translate("Tips"))
dc.default = translate("Enterprises and Organizations often use this approach")
dc:depends("proto", "dhcp")

function m.handle(self, state, data)
	return true
end

function m.parse(sf)
	local state = SimpleForm.parse(sf)
	if state == FORM_SKIP then
		luci.http.redirect(luci.dispatcher.build_url("admin/system/setup-wizard/" .. nurl) .. "?fromurl=internet")
	else
		local p = luci.http.formvalue("cbid.internet.1.proto")
		local u = luci.http.formvalue("cbid.internet.1.username")
		local k = luci.http.formvalue("cbid.internet.1.password")
		if p then
			if u and k and #u > 0 and #k > 0 then
				uci:set("network", "wan", "proto", "pppoe")
				uci:set("network", "wan", "username", u)
				uci:set("network", "wan", "password", k)
			else
				uci:set("network", "wan", "proto", "dhcp")
			end
			luci.http.redirect(luci.dispatcher.build_url("admin/system/setup-wizard/" .. nurl) .. "?has_wan_changes=1&fromurl=internet")
		end
	end
end

return m
