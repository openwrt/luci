--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>
Copyright 2008 Jo-Philipp Wich <xm@leipzig.freifunk.net>
Copyright 2011 Patrick Grimm <patrick@pberg.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--

module "luci.controller.ffwizard"

function index()
	require("luci.i18n").loadc("ffwizard")
	local i18n = luci.i18n.translate

	entry({"admin", "freifunk", "ffwizard"}, form("freifunk/ffwizard"), i18n("Wizard"), 40)
	assign({"mini", "freifunk", "ffwizard"}, {"admin", "freifunk", "ffwizard"}, i18n("Wizard"), 40)
	
	entry({"admin", "freifunk", "ffwizard_error"}, template("freifunk/ffwizard_error"))
	assign({"mini", "freifunk", "ffwizard_error"}, {"admin", "freifunk", "ffwizard_error"})
end

