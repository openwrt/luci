--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--
module("luci.controller.admin.services", package.seeall)

function index()
	luci.i18n.loadc("admin-core")
	local i18n = luci.i18n.translate
	
	local page  = node("admin", "services", "crontab")
	page.target = form("admin_services/crontab")
	page.title  = i18n("a_s_crontab")
	page.order  = 50

	local page  = node("admin", "services")
	page.target = template("admin_services/index")
	page.title  = i18n("services", "Dienste")  
	page.order  = 40
	page.index  = true
	
	if nixio.fs.access("/etc/config/lucittpd") then
		local page  = node("admin", "services", "lucittpd")
		page.target = cbi("admin_services/lucittpd")
		page.title  = "LuCIttpd"
		page.order  = 10
	end

	if nixio.fs.access("/etc/config/httpd") then
		local page  = node("admin", "services", "httpd")
		page.target = cbi("admin_services/httpd")
		page.title  = "Busybox HTTPd"
		page.order  = 11
	end
	
	local page  = node("admin", "services", "dropbear")
	page.target = cbi("admin_services/dropbear")
	page.title  = "Dropbear SSHd"
	page.order  = 20
	
	local page  = node("admin", "services", "dnsmasq")
	page.target = cbi("admin_services/dnsmasq")
	page.title  = "Dnsmasq"
	page.order  = 30
end
