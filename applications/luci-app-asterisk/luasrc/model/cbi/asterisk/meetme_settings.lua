--[[
LuCI - Lua Configuration Interface

Copyright 2009 Jo-Philipp Wich <xm@subsignal.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

cbimap = Map("asterisk", "MeetMe - Common Settings",
	"Common settings for MeetMe phone conferences.")

meetme = cbimap:section(TypedSection, "meetmegeneral", "General MeetMe Options")
meetme.addremove = false
meetme.anonymous = true

audiobuffers = meetme:option(ListValue, "audiobuffers",
	"Number of 20ms audio buffers to use for conferences")

for i = 2, 32 do audiobuffers:value(i) end


return cbimap
