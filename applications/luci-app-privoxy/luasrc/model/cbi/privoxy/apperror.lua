-- Copyright 2014 Christian Schoenebeck <christian dot schoenebeck at gmail dot com>
-- Licensed under the Apache License, Version 2.0

local CTRL = require "luci.controller.privoxy"	-- this application's controller
local DISP = require "luci.dispatcher"
local SYS  = require "luci.sys"

local HELP = [[<a href="http://www.privoxy.org/user-manual/config.html#%s" target="_blank">%s</a>]]

-- cbi-map -- ##################################################################
local m	= Map("privoxy")
m.title	= [[</a><a href="javascript:alert(']]
		.. translate("Version Information")
		.. [[\n\nluci-app-privoxy]]
		.. [[\n\t]] .. translate("Version") .. [[:\t]]
		.. SYS.exec([[opkg list-installed ]] .. [[luci-app-privoxy]] .. [[ | cut -d " " -f 3 ]])
		.. [[\n\nprivoxy ]] .. translate("required") .. [[:]]
		.. [[\n\t]] .. translate("Version") .. [[:\t]] .. CTRL.PRIVOXY_MIN .. [[ ]] .. translate("or higher")
		.. [[\n\nprivoxy ]] .. translate("installed") .. [[:]]
		.. [[\n\t]] .. translate("Version") .. [[:\t]]
		.. SYS.exec([[opkg list-installed ]] .. [[privoxy]] .. [[ | cut -d " " -f 3 ]])
		.. [[\n\n]]
 	.. [[')">]]
	.. translate("Privoxy WEB proxy")
m.description = translate("Privoxy is a non-caching web proxy with advanced filtering "
		.. "capabilities for enhancing privacy, modifying web page data and HTTP headers, "
		.. "controlling access, and removing ads and other obnoxious Internet junk.")

-- cbi-section -- ##############################################################
local s = m:section(SimpleSection)
s.title = [[<font color="red">]] .. [[<strong>]]
	.. translate("Software update required")
	.. [[</strong>]] .. [[</font>]]

-- old privoxy sofware version --------------------------------------------------------------
local v    = s:option(DummyValue, "_update_needed")
v.titleref = DISP.build_url("admin", "system", "packages")
v.rawhtml  = true
--v.title    = [[<h3>]] .. [[<font color="red">]] .. [[<strong>]]
--	   .. translate("Software update required")
--	   .. [[</strong>]] .. [[</font>]] .. [[</h3>]] .. [[<br />]]
v.value    = [[<h3>]] .. [[<strong>]]
	   .. translate("The currently installed 'privoxy' package is not supported by LuCI application.")
	   .. [[<br />]]
	   .. translate("Please update to the current version!")
	   .. [[</strong>]] .. [[</h3>]]
return m
