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
module("luci.controller.init", package.seeall)

function index()
	if not nixio.fs.access("/etc/rc.common") then
		return
	end

	require("luci.i18n")
	luci.i18n.loadc("initmgr")

	entry(
		{"admin", "system", "init"}, form("init/init"),
		luci.i18n.translate("initmgr", "Init Scripts")
	).i18n = "initmgr"
end
