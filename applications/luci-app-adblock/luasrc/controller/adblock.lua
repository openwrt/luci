-- Copyright 2017 Dirk Brenken (dev@brenken.org)
-- This is free software, licensed under the Apache License, Version 2.0

module("luci.controller.adblock", package.seeall)

local fs = require("nixio.fs")
local util = require("luci.util")
local template = require("luci.template")
local i18n = require("luci.i18n")

function index()
	if not nixio.fs.access("/etc/config/adblock") then
		return
	end
	entry({"admin", "services", "adblock"}, firstchild(), _("Adblock"), 30).dependent = false
	entry({"admin", "services", "adblock", "tab_from_cbi"}, cbi("adblock/overview_tab", {hideresetbtn=true, hidesavebtn=true}), _("Overview"), 10).leaf = true
	entry({"admin", "services", "adblock", "logfile"}, call("logread"), _("View Logfile"), 20).leaf = true
	entry({"admin", "services", "adblock", "advanced"}, firstchild(), _("Advanced"), 100)
	entry({"admin", "services", "adblock", "advanced", "blacklist"}, cbi("adblock/blacklist_tab"), _("Edit Blacklist"), 110).leaf = true
	entry({"admin", "services", "adblock", "advanced", "whitelist"}, cbi("adblock/whitelist_tab"), _("Edit Whitelist"), 120).leaf = true
	entry({"admin", "services", "adblock", "advanced", "configuration"}, cbi("adblock/configuration_tab"), _("Edit Configuration"), 130).leaf = true
	entry({"admin", "services", "adblock", "advanced", "query"}, call("query"), _("Query domains"), 140).leaf = true
	entry({"admin", "services", "adblock", "advanced", "result"}, call("queryData"), nil, 150).leaf = true
end

function logread()
	local logfile = util.trim(util.exec("logread -e 'adblock'"))
	template.render("adblock/logread", {title = i18n.translate("Adblock Logfile"), content = logfile})
end

function query()
	template.render("adblock/query", {title = i18n.translate("Adblock Domain Query")})
end

function queryData(domain)
	if domain and domain:match("^[a-zA-Z0-9%-%._]+$") then
		luci.http.prepare_content("text/plain")
		local cmd = "/etc/init.d/adblock query %q 2>&1"
		local util = io.popen(cmd % domain)
		if util then
			while true do
				local line = util:read("*l")
				if not line then
					break
				end
				luci.http.write(line)
				luci.http.write("\n")
			end
			util:close()
		end
	end
end
