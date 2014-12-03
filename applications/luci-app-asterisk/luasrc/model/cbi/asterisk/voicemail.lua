--[[
LuCI - Lua Configuration Interface

Copyright 2009 Jo-Philipp Wich <xm@subsignal.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

local ast = require "luci.asterisk"

cbimap = Map("asterisk", "Voicemail - Mailboxes")

voicemail = cbimap:section(TypedSection, "voicemail", "Voicemail Boxes")
voicemail.addremove = true
voicemail.anonymous = true
voicemail.template = "cbi/tblsection"

context = voicemail:option(ListValue, "context", "Context")
context:value("default")

number = voicemail:option(Value, "number",
	"Mailbox Number", "Unique mailbox identifier")

function number.write(self, s, val)
	if val and #val > 0 then
		local old = self:cfgvalue(s)
		self.map.uci:foreach("asterisk", "dialplanvoice",
			function(v)
				if v.voicebox == old then
					self.map:set(v['.name'], "voicebox", val)
				end
			end)
		Value.write(self, s, val)
	end
end


voicemail:option(Value, "name", "Ownername", "Human readable display name")
voicemail:option(Value, "password", "Password", "Access protection")
voicemail:option(Value, "email", "eMail", "Where to send voice messages")
voicemail:option(Value, "page", "Pager", "Pager number")

zone = voicemail:option(ListValue, "zone", "Timezone", "Used time format")
zone.titleref = luci.dispatcher.build_url("admin/asterisk/voicemail/settings")
cbimap.uci:foreach("asterisk", "voicezone",
	function(s) zone:value(s['.name']) end)

function voicemail.remove(self, s)
	return ast.voicemail.remove(self.map:get(s, "number"), self.map.uci)
end


return cbimap
