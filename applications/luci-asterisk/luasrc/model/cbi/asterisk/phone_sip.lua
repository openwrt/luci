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
-- SIP phone info
--
if arg[2] == "info" then
	form = SimpleForm("asterisk", "SIP Phone Information")
	form.reset  = false
	form.submit = "Back to overview"

	local info, keys = ast.sip.peer(arg[1])
	local data = { }

	for _, key in ipairs(keys) do
		data[#data+1] = {
			key = key,
			val = type(info[key]) == "boolean"
				and ( info[key] and "yes" or "no" )
				or  ( info[key] == nil or #info[key] == 0 )
					and "(none)"
					or  tostring(info[key])
		}
	end

	itbl = form:section(Table, data, "SIP Phone %q" % arg[1])
	itbl:option(DummyValue, "key", "Key")
	itbl:option(DummyValue, "val", "Value")

	function itbl.parse(...)
		luci.http.redirect(
			luci.dispatcher.build_url("admin", "asterisk", "phones")
		)
	end

	return form

--
-- SIP phone configuration
--
elseif arg[1] then
	cbimap = Map("asterisk", "Edit SIP Client")

	peer = cbimap:section(NamedSection, arg[1])
	peer.hidden = {
		type        = "friend",
		qualify     = "yes",
		host        = "dynamic",
		nat         = "no",
		canreinvite = "no"
	}

	back = peer:option(DummyValue, "_overview", "Back to phone overview")
	back.value = ""
	back.titleref = luci.dispatcher.build_url("admin", "asterisk", "phones")

	exten = peer:option(Value, "extension", "Extension Number")
	cbimap.uci:foreach("asterisk", "dialplanexten",
		function(s)
			exten:value(
				s.extension,
				"%s (via %s/%s)" %{ s.extension, s.type:upper(), s.target }
			)
		end)

	display = peer:option(Value, "callerid", "Display Name")

	username  = peer:option(Value, "username", "Authorization ID")
	password  = peer:option(Value, "secret", "Authorization Password")
	password.password = true

	active = peer:option(Flag, "disable", "Active")
	active.enabled  = "yes"
	active.disabled = "no"
	function active.cfgvalue(...)
		return AbstractValue.cfgvalue(...) or "yes"
	end

	regtimeout = peer:option(Value, "registertimeout", "Registration Time Value")
	function regtimeout.cfgvalue(...)
		return AbstractValue.cfgvalue(...) or "60"
	end

	sipport = peer:option(Value, "port", "SIP Port")
	function sipport.cfgvalue(...)
		return AbstractValue.cfgvalue(...) or "5060"
	end

	linekey = peer:option(ListValue, "_linekey", "Linekey Mode (broken)")
	linekey:value("", "Off")
	linekey:value("trunk", "Trunk Appearance")
	linekey:value("call", "Call Appearance")

	dialplan = peer:option(ListValue, "context", "Dialplan Context")
	cbimap.uci:foreach("asterisk", "dialplan",
		function(s) dialplan:value(s['.name']) end)

	return cbimap
end
