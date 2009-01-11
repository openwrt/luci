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

module("luci.controller.asterisk", package.seeall)

function index()

	entry({"admin", "services", "asterisk"}, 				  cbi("asterisk"), 			  "Asterisk",				80).i18n = "asterisk"

	entry({"admin", "services", "asterisk", "voice"},         cbi("asterisk-voice"),      "Voice Functions",        1)
	entry({"admin", "services", "asterisk", "meetme"},        cbi("asterisk-meetme"),     "Meetme Conferences",     2)

	entry({"admin", "services", "asterisk", "iax-conns"},     cbi("asterisk-iax-connections"), "IAX Connections",   3)
	entry({"admin", "services", "asterisk", "sip-conns"},     cbi("asterisk-sip-connections"), "SIP Connections", 	4)

	entry({"admin", "services", "asterisk", "dialplans"},     cbi("asterisk-dialplans"),  "Dial Plans", 			5)

	entry({"admin", "services", "asterisk", "mod"},           cbi("asterisk-mod-app"),    "Modules", 				4)
	entry({"admin", "services", "asterisk", "mod", "app"},    cbi("asterisk-mod-app"),    "Applications", 			1)
	entry({"admin", "services", "asterisk", "mod", "cdr"},    cbi("asterisk-mod-cdr"),    "Call Detail Records", 	2)
	entry({"admin", "services", "asterisk", "mod", "chan"},   cbi("asterisk-mod-chan"),   "Channels", 				3)
	entry({"admin", "services", "asterisk", "mod", "codec"},  cbi("asterisk-mod-codec"),  "Codecs", 				4)
	entry({"admin", "services", "asterisk", "mod", "format"}, cbi("asterisk-mod-format"), "Format",					5)
	entry({"admin", "services", "asterisk", "mod", "func"},   cbi("asterisk-mod-func"),   "Functions", 				6)
	entry({"admin", "services", "asterisk", "mod", "pbx"},    cbi("asterisk-mod-pbx"),    "PBX", 					7)
	entry({"admin", "services", "asterisk", "mod", "res"},    cbi("asterisk-mod-res"),    "Resources", 				8)
	entry({"admin", "services", "asterisk", "mod", "res", "feature"},
		cbi("asterisk-mod-res-feature"), "Feature Module Configuration", 9 )


	entry({"admin", "asterisk"},                    cbi("asterisk/main"),        "Asterisk",  99).i18n = "asterisk"

	entry({"admin", "asterisk", "phones"},          cbi("asterisk/phones"),      "Phones",     1)
	entry({"admin", "asterisk", "phones", "sip"},   cbi("asterisk/phone_sip"),   nil,          1).leaf = true
	entry({"admin", "asterisk", "phones", "exten"}, cbi("asterisk/phone_exten"), "Extensions", 2).leaf = true

	entry({"admin", "asterisk", "trunks"},          cbi("asterisk/trunks"),      "Trunks",     2)
	entry({"admin", "asterisk", "trunks", "sip"},   cbi("asterisk/trunk_sip"),   nil,          1).leaf = true


end
