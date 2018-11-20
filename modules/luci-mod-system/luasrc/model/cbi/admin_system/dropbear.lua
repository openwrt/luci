-- Copyright 2008 Steven Barth <steven@midlink.org>
-- Copyright 2011-2018 Jo-Philipp Wich <jo@mein.io>
-- Licensed to the public under the Apache License 2.0.

m = Map("dropbear", translate("SSH Access"),
	translate("Dropbear offers <abbr title=\"Secure Shell\">SSH</abbr> network shell access and an integrated <abbr title=\"Secure Copy\">SCP</abbr> server"))
m.apply_on_parse = true

s = m:section(TypedSection, "dropbear", translate("Dropbear Instance"))
s.anonymous = true
s.addremove = true


ni = s:option(Value, "Interface", translate("Interface"),
	translate("Listen only on the given interface or, if unspecified, on all"))

ni.template    = "cbi/network_netlist"
ni.nocreate    = true
ni.unspecified = true


pt = s:option(Value, "Port", translate("Port"),
	translate("Specifies the listening port of this <em>Dropbear</em> instance"))

pt.datatype = "port"
pt.default  = 22


pa = s:option(Flag, "PasswordAuth", translate("Password authentication"),
	translate("Allow <abbr title=\"Secure Shell\">SSH</abbr> password authentication"))

pa.enabled  = "on"
pa.disabled = "off"
pa.default  = pa.enabled
pa.rmempty  = false


ra = s:option(Flag, "RootPasswordAuth", translate("Allow root logins with password"),
	translate("Allow the <em>root</em> user to login with password"))

ra.enabled  = "on"
ra.disabled = "off"
ra.default  = ra.enabled


gp = s:option(Flag, "GatewayPorts", translate("Gateway ports"),
	translate("Allow remote hosts to connect to local SSH forwarded ports"))

gp.enabled  = "on"
gp.disabled = "off"
gp.default  = gp.disabled

return m
