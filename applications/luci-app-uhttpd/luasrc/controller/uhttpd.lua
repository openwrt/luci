--[[

 uHttpd Luci configuration module.
 Copyright (c) 2015, GuoGuo <gch981213@gmail.com>

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

]]--

module("luci.controller.uhttpd", package.seeall)

function index()
	
	if not nixio.fs.access("/etc/config/uhttpd") then
		return
	end

	local page
	page = entry({"admin", "system", "uhttpd"}, cbi("uhttpd"), _("HTTP Service"), 90)
	page.dependent = true
end
