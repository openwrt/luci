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

meetme = cbimap:section(TypedSection, "meetme", "Meetme Conference", "")

adminpin = meetme:option(Value, "adminpin", "Admin PIN", "")
adminpin.rmempty = true

pin = meetme:option(Value, "pin", "Meeting PIN", "")
pin.rmempty = true


meetmegeneral = cbimap:section(TypedSection, "meetmegeneral", "Meetme Conference General Options", "")
meetmegeneral.anonymous = true
meetmegeneral.addremove = true

audiobuffers = meetmegeneral:option(Value, "audiobuffers", "Number of 20ms audio buffers to be used", "")
audiobuffers.rmempty = true


return cbimap
