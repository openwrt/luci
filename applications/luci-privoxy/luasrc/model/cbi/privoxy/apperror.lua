--[[
LuCI - Lua Configuration Interface

Copyright 2014 Christian Schoenebeck <christian dot schoenebeck at gmail dot com>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

local CTRL = require "luci.controller.privoxy"	-- privoxy multiused functions
local DISP = require "luci.dispatcher"

-- Build javascript string to be displayed as version information
local VERSION = translate("Version Information")
		.. [[\n\nluci-app-privoxy]]
		.. [[\n\t]] .. translate("Version") .. [[:\t]] .. CTRL.version_luci_app
		.. [[\n\t]] .. translate("Build") .. [[:\t]] .. CTRL.ipkg_version("luci-app-privoxy").version
		.. [[\n\nprivoxy ]] .. translate("required") .. [[:]]
		.. [[\n\t]] .. translate("Version") .. [[:\t]] .. CTRL.version_required .. [[ ]] .. translate("or higher")
		.. [[\n\nprivoxy ]] .. translate("installed") .. [[:]]
		.. [[\n\t]] .. translate("Version") .. [[:\t]] .. CTRL.ipkg_version("privoxy").version
		.. [[\n\n]]
local HELP = [[<a href="http://www.privoxy.org/user-manual/config.html#%s" target="_blank">%s</a>]]

-- cbi-map -- ##################################################################
local m	= Map("privoxy")
m.title	= [[</a><a href="javascript:alert(']] 
	.. VERSION 
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
