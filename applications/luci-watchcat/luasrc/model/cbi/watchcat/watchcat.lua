--[[
LuCI - Lua Configuration Interface

Copyright 2012 Christian Gagneraud <chris@techworks.ie>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

m = Map("system", 
	translate("Watchcat"), 
	translate("Watchcat allows to configure a periodic reboot and/or when " ..
		  "internet connection has been lost for a certain period of time."  
		 ))

s = m:section(TypedSection, "watchcat")
s.anonymous = true
s.addremove = true

mode = s:option(ListValue, "mode",
		translate("Operating mode"))
mode.default = "allways"
mode:value("ping", "Reboot on internet connection lost")
mode:value("allways", "Periodic reboot")

forcedelay = s:option(Value, "forcedelay",
		      translate("Forced reboot delay"),
		      translate("When rebooting the system the watchcat will trigger a soft reboot, " ..
				"Entering a non zero value here, will trigger a delayed hard reboot " ..
				"if the soft reboot fails. Enter a number of seconds to enable, " ..
				"use 0 to disable"))
forcedelay.datatype = "uinteger"
forcedelay.default = "0"

period = s:option(Value, "period", 
		  translate("Period"),
		  translate("In periodic mode, it defines the reboot period. " ..
			    "In internet mode, it defines the longest period of " .. 
			    "time without internet access before a reboot is engaged." ..
			    "Default unit is seconds, you can use the " ..
			    "suffix 'm' for minutes, 'h' for hours or 'd' " ..
			    "for days"))

pinghost = s:option(Value, "pinghost", 
		    translate("Ping host"),
		    translate("Host address to ping"))
pinghost.datatype = "host"
pinghost.default = "8.8.8.8"
pinghost:depends({mode="ping"})

pingperiod = s:option(Value, "pingperiod", 
		      translate("Ping period"),
		      translate("How often to check internet connection. " ..
				"Default unit is seconds, you can you use the " ..
				"suffix 'm' for minutes, 'h' for hours or 'd' " ..
				"for days"))
pingperiod:depends({mode="ping"})

return m
