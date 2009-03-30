--[[
LuCI - Lua Configuration Interface

Copyright 2009 Jo-Philipp Wich <xm@subsignal.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

cbimap = Map("asterisk", "Voicemail - Mailboxes")

voicemail = cbimap:section(TypedSection, "voicemail", "Voicemail Boxes")
voicemail.addremove = true
voicemail.anonymous = true
voicemail.template = "cbi/tblsection"

context = voicemail:option(ListValue, "context", "Context")
context:value("default")

voicemail:option(Value, "number", "Mailbox Number", "Unique mailbox identifier")
voicemail:option(Value, "name", "Ownername", "Human readable display name")
voicemail:option(Value, "password", "Password", "Access protection")
voicemail:option(Value, "email", "eMail", "Where to send voice messages")
voicemail:option(Value, "page", "Pager", "Pager number")

zone = voicemail:option(ListValue, "zone", "Timezone", "Used time format")
zone.titleref = luci.dispatcher.build_url("admin/asterisk/voicemail/settings")
cbimap.uci:foreach("asterisk", "voicezone",
	function(s) zone:value(s['.name']) end)


return cbimap
