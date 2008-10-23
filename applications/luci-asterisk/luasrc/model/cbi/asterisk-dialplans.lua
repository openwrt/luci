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

cbimap = Map("asterisk", "asterisk", "")

dialplan = cbimap:section(TypedSection, "dialplan", "Section dialplan", "")
dialplan.addremove = true
dialplan.dynamic = true

include = dialplan:option(Value, "include", "", "")
include.rmempty = true


dialplanexten = cbimap:section(TypedSection, "dialplanexten", "Dialplan Extension", "")
dialplanexten.anonymous = true
dialplanexten.addremove = true
dialplanexten.dynamic = true


dialplangeneral = cbimap:section(TypedSection, "dialplangeneral", "Dialplan General Options", "")
dialplangeneral.anonymous = true
dialplangeneral.addremove = true

allowtransfer = dialplangeneral:option(Flag, "allowtransfer", "Allow transfer", "")
allowtransfer.rmempty = true

canreinvite = dialplangeneral:option(ListValue, "canreinvite", "Reinvite/redirect media connections", "")
canreinvite:value("yes", "Yes")
canreinvite:value("nonat", "Yes when not behind NAT")
canreinvite:value("update", "Use UPDATE rather than INVITE for path redirection")
canreinvite:value("no", "No")
canreinvite.rmempty = true

clearglobalvars = dialplangeneral:option(Flag, "clearglobalvars", "Clear global vars", "")
clearglobalvars.rmempty = true


dialplangoto = cbimap:section(TypedSection, "dialplangoto", "Dialplan Goto", "")
dialplangoto.anonymous = true
dialplangoto.addremove = true
dialplangoto.dynamic = true


dialplanmeetme = cbimap:section(TypedSection, "dialplanmeetme", "Dialplan Conference", "")
dialplanmeetme.anonymous = true
dialplanmeetme.addremove = true
dialplanmeetme.dynamic = true


dialplansaytime = cbimap:section(TypedSection, "dialplansaytime", "Dialplan Time", "")
dialplansaytime.anonymous = true
dialplansaytime.addremove = true
dialplansaytime.dynamic = true


dialplanvoice = cbimap:section(TypedSection, "dialplanvoice", "Dialplan Voicemail", "")
dialplanvoice.anonymous = true
dialplanvoice.addremove = true
dialplanvoice.dynamic = true


dialzone = cbimap:section(TypedSection, "dialzone", "Dial Zones for Dialplan", "")
dialzone.addremove = true

addprefix = dialzone:option(Value, "addprefix", "Prefix to add matching dialplans", "")
addprefix.rmempty = true

international = dialzone:option(DynamicList, "international", "Match International prefix", "")
international.rmempty = true

localprefix = dialzone:option(Value, "localprefix", "Prefix (0) to add/remove to/from international numbers", "")
localprefix.rmempty = true

localzone = dialzone:option(Value, "localzone", "", "")
localzone.rmempty = true

match = dialzone:option(Value, "match", "Match plan", "")
match.rmempty = true

uses = dialzone:option(Value, "uses", "Connection to use", "")
uses.rmempty = true


return cbimap
