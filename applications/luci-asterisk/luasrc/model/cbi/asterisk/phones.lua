--[[
LuCI - Lua Configuration Interface

Copyright 2008 Jo-Philipp Wich <xm@subsignal.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--

local ast = require("luci.asterisk")

cbimap = Map("asterisk", "Registered Phones")
cbimap.pageaction = false

local sip_peers = { }
cbimap.uci:foreach("asterisk", "sip",
	function(s)
		if s.type ~= "peer" then
			s.name = s['.name']
			s.info = ast.sip.peer(s.name)
			sip_peers[s.name] = s
		end
	end)


sip_table = cbimap:section(TypedSection, "sip", "SIP Phones")
sip_table.template  = "cbi/tblsection"
sip_table.extedit   = luci.dispatcher.build_url("admin", "asterisk", "phones", "sip", "%s")
sip_table.addremove = true

sip_table.hidden = {
	type        = "friend",
	qualify     = "yes",
	host        = "dynamic",
	nat         = "no",
	canreinvite = "no"
}

function sip_table.filter(self, s)
	return s and cbimap.uci:get("asterisk", s, "type") ~= "peer"
end

function sip_table.create(self, section)
	if TypedSection.create(self, section) then
		created = section
	else
		self.invalid_cts = true
	end
end

function sip_table.parse(self, ...)
	TypedSection.parse(self, ...)
	if created then
		cbimap.uci:save("asterisk")
		luci.http.redirect(luci.dispatcher.build_url(
			"admin", "asterisk", "phones", "sip", created
		))
	end
end


user = sip_table:option(DummyValue, "username")
function user.cfgvalue(self, s)
	return sip_peers[s] and sip_peers[s].callerid or
		AbstractValue.cfgvalue(self, s)
end

host = sip_table:option(DummyValue, "host")
function host.cfgvalue(self, s)
	if sip_peers[s] and sip_peers[s].info.address then
		return "%s:%i" %{ sip_peers[s].info.address, sip_peers[s].info.port }
	else
		return "n/a"
	end
end

context = sip_table:option(DummyValue, "context")
context.href = luci.dispatcher.build_url("admin", "asterisk", "dialplan")

nat = sip_table:option(DummyValue, "nat")
function nat.cfgvalue(self, s)
	return sip_peers[s] and sip_peers[s].info.Nat or "none"
end

online = sip_table:option(DummyValue, "online")
function online.cfgvalue(self, s)
	if sip_peers[s] and sip_peers[s].info.online == nil then
		return "n/a"
	else
		return sip_peers[s] and sip_peers[s].info.online
			and "yes" or "no (%s)" % {
				sip_peers[s] and sip_peers[s].info.Status:lower() or "unknown"
			}
	end
end

delay = sip_table:option(DummyValue, "delay")
function delay.cfgvalue(self, s)
	if sip_peers[s] and sip_peers[s].info.online then
		return "%i ms" % sip_peers[s].info.delay
	else
		return "n/a"
	end
end

info = sip_table:option(Button, "_info", "Info")
function info.write(self, s)
	luci.http.redirect(luci.dispatcher.build_url(
		"admin", "asterisk", "phones", "sip", s, "info"
	))
end

return cbimap
