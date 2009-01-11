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

--
-- Specific SIP trunk
--
if arg[1] then
	cbimap = Map("asterisk", "Edit SIP Trunk")

	peer = cbimap:section(NamedSection, arg[1])
	peer.hidden = {
		type = "peer"
	}

	back = peer:option(DummyValue, "_overview", "Back to trunk overview")
	back.value = ""
	back.titleref = luci.dispatcher.build_url("admin", "asterisk", "trunks", "sip")

	sipdomain = peer:option(Value, "host", "SIP Domain")
	sipport   = peer:option(Value, "port", "SIP Port")
	sipport.default = 5060

	username  = peer:option(Value, "username", "Authorization ID")
	password  = peer:option(Value, "secret", "Authorization Password")
	password.password = true

	register = peer:option(ListValue, "register", "Register with peer")
	register:value("yes", "on")
	register:value("no", "off")

	regext = peer:option(Value, "registerextension", "Extension to register (optional)")
	regext:depends({register="yes"})

	didval = peer:option(ListValue, "_did", "Number of assigned DID numbers")
	for i=1,24 do didval:value(i) end

	return cbimap

--
-- Trunk overview
--
else
	cbimap = Map("asterisk", "asterisk", "")

	local sip_peers = { }
	cbimap.uci:foreach("asterisk", "sip",
		function(s)
			if s.type == "peer" then
				s.name = s['.name']
				s.info = ast.sip.peer(s.name)
				sip_peers[s.name] = s
			end
		end)


	sip_table = cbimap:section(Table, sip_peers, "SIP Trunks")
	sip_table.template = "cbi/tblsection"
	sip_table.extedit  = luci.dispatcher.build_url("admin", "asterisk", "trunks", "sip", "%s")

	name = sip_table:option(DummyValue, "name")
	user = sip_table:option(DummyValue, "username")

	host = sip_table:option(DummyValue, "host")
	function host.cfgvalue(self, s)
		if sip_peers[s].info.address then
			return "%s:%i" %{ sip_peers[s].info.address, sip_peers[s].info.port }
		else
			return "n/a"
		end
	end

	context = sip_table:option(DummyValue, "context")
	context.href = luci.dispatcher.build_url("admin", "asterisk", "dialplan")

	nat = sip_table:option(DummyValue, "nat")
	function nat.cfgvalue(self, s)
		return sip_peers[s].info.Nat or "none"
	end

	online = sip_table:option(DummyValue, "online")
	function online.cfgvalue(self, s)
		if sip_peers[s].info.online == nil then
			return "n/a"
		else
			return sip_peers[s].info.online and "yes" or "no"
		end
	end

	delay = sip_table:option(DummyValue, "delay")
	function delay.cfgvalue(self, s)
		if sip_peers[s].info.online then
			return "%i ms" % sip_peers[s].info.delay
		else
			return "n/a"
		end
	end

	return cbimap
end
