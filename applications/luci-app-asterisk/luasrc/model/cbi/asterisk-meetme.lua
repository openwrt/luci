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

meetmegeneral = cbimap:section(TypedSection, "meetmegeneral", "Meetme Conference General Options", "")

audiobuffers = meetmegeneral:option(Value, "audiobuffers", "Number of 20ms audio buffers to be used", "")


meetme = cbimap:section(TypedSection, "meetme", "Meetme Conference", "")
meetme.addremove = true

adminpin = meetme:option(Value, "adminpin", "Admin PIN", "")
adminpin.password = true

pin = meetme:option(Value, "pin", "Meeting PIN", "")
pin.password = true


return cbimap
