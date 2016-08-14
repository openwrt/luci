-- Copyright 2015 Daniel Dickinson <openwrt@daniel.thecshore.com>
-- Licensed to the public under the Apache License 2.0.

local m, s, o

m = Map("nut_cgi", translate("Network UPS Tools (CGI)"),
	translate("Network UPS Tools CGI Configuration"))

s = m:section(DummySection)

function s.set(self, section, option, value)
end

function s.del(self, section)
end

function s.remove(self, section)
end

o=s:option(SimpleButton, "nut_cgi_page", translate('Go to NUT CGI Page'))
o.section = { }
o.section[".name"] = "1"

function o.write(self, section, value)
	luci.http.redirect("/nut")
end

s = m:section(TypedSection, "host", translate("Host"))
s.addremove = true
s.anonymous = true

o = s:option(Value, "upsname", translate("UPS name"), translate("As configured by NUT"))
o.optional = false

o = s:option(Value, "hostname", translate("Hostname or IP address"))
o.optional = false
o.datatype = "host"

o = s:option(Value, "port", translate("Port"))
o.datatype = "port"
o.optional = true
o.placeholder = 3493

o = s:option(Value, "displayname", translate("Display name"))
o.optional = false

return m
