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

featuremap = cbimap:section(TypedSection, "featuremap", "Feature Key maps", "")
featuremap.anonymous = true
featuremap.addremove = true

atxfer = featuremap:option(Value, "atxfer", "Attended transfer key", "")
atxfer.rmempty = true

blindxfer = featuremap:option(Value, "blindxfer", "Blind transfer key", "")
blindxfer.rmempty = true

disconnect = featuremap:option(Value, "disconnect", "Key to Disconnect call", "")
disconnect.rmempty = true

parkcall = featuremap:option(Value, "parkcall", "Key to Park call", "")
parkcall.rmempty = true


featurepark = cbimap:section(TypedSection, "featurepark", "Parking Feature", "")
featurepark.anonymous = true
featurepark.addremove = true

adsipark = featurepark:option(Flag, "adsipark", "ADSI Park", "")
adsipark.rmempty = true
adsipark:depends({ ["asterisk.featurepark.parkenabled"] = "true" })

atxfernoanswertimeout = featurepark:option(Value, "atxfernoanswertimeout", "Attended transfer timeout (sec)", "")
atxfernoanswertimeout.rmempty = true
atxfernoanswertimeout:depends({ ["asterisk.featurepark.parkenabled"] = "true" })

automon = featurepark:option(Value, "automon", "One touch record key", "")
automon.rmempty = true
automon:depends({ ["asterisk.featurepark.parkenabled"] = "true" })

context = featurepark:option(Value, "context", "Name of call context for parking", "")
context.rmempty = true
context:depends({ ["asterisk.featurepark.parkenabled"] = "true" })

courtesytone = featurepark:option(Value, "courtesytone", "Sound file to play to parked caller", "")
courtesytone.rmempty = true
courtesytone:depends({ ["asterisk.featurepark.parkenabled"] = "true" })

featuredigittimeout = featurepark:option(Value, "featuredigittimeout", "Max time (ms) between digits for feature activation", "")
featuredigittimeout.rmempty = true
featuredigittimeout:depends({ ["asterisk.featurepark.parkenabled"] = "true" })

findslot = featurepark:option(ListValue, "findslot", "Method to Find Parking slot", "")
findslot:value("first", "First available slot")
findslot:value("next", "Next free parking space")
findslot.rmempty = true
findslot:depends({ ["asterisk.featurepark.parkenabled"] = "true" })

parkedmusicclass = featurepark:option(Value, "parkedmusicclass", "", "")
parkedmusicclass.rmempty = true

parkedplay = featurepark:option(ListValue, "parkedplay", "Play courtesy tone to", "")
parkedplay:value("caller", "Caller")
parkedplay:value("parked", "Parked user")
parkedplay:value("both", "Both")
parkedplay.rmempty = true
parkedplay:depends({ ["asterisk.featurepark.parkenabled"] = "true" })

parkenabled = featurepark:option(Flag, "parkenabled", "Enable Parking", "")
parkenabled.rmempty = true

parkext = featurepark:option(Value, "parkext", "Extension to dial to park", "")
parkext.rmempty = true
parkext:depends({ ["asterisk.featurepark.parkenabled"] = "true" })

parkingtime = featurepark:option(Value, "parkingtime", "Parking time (secs)", "")
parkingtime.rmempty = true
parkingtime:depends({ ["asterisk.featurepark.parkenabled"] = "true" })

parkpos = featurepark:option(Value, "parkpos", "Range of extensions for call parking", "")
parkpos.rmempty = true
parkpos:depends({ ["asterisk.featurepark.parkenabled"] = "true" })

pickupexten = featurepark:option(Value, "pickupexten", "Pickup extension", "")
pickupexten.rmempty = true
pickupexten:depends({ ["asterisk.featurepark.parkenabled"] = "true" })

transferdigittimeout = featurepark:option(Value, "transferdigittimeout", "Seconds to wait bewteen digits when transferring", "")
transferdigittimeout.rmempty = true
transferdigittimeout:depends({ ["asterisk.featurepark.parkenabled"] = "true" })

xferfailsound = featurepark:option(Value, "xferfailsound", "sound when attended transfer is complete", "")
xferfailsound.rmempty = true
xferfailsound:depends({ ["asterisk.featurepark.parkenabled"] = "true" })

xfersound = featurepark:option(Value, "xfersound", "Sound when attended transfer fails", "")
xfersound.rmempty = true
xfersound:depends({ ["asterisk.featurepark.parkenabled"] = "true" })


return cbimap
