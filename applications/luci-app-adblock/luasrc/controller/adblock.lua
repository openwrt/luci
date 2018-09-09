-- Copyright 2017-2018 Dirk Brenken (dev@brenken.org)
-- This is free software, licensed under the Apache License, Version 2.0

module("luci.controller.adblock", package.seeall)

local sys   = require("luci.sys")
local util  = require("luci.util")
local http  = require("luci.http")
local i18n  = require("luci.i18n")
local json  = require("luci.jsonc")
local uci   = require("luci.model.uci").cursor()

function index()
	if not nixio.fs.access("/etc/config/adblock") then
		return
	end
	entry({"admin", "services", "adblock"}, firstchild(), _("Adblock"), 30).dependent = false
	entry({"admin", "services", "adblock", "tab_from_cbi"}, cbi("adblock/overview_tab", {hideresetbtn=true, hidesavebtn=true}), _("Overview"), 10).leaf = true
	entry({"admin", "services", "adblock", "log"}, template("adblock/logread"), _("View Logfile"), 20).leaf = true
	entry({"admin", "services", "adblock", "advanced"}, firstchild(), _("Advanced"), 100)
	entry({"admin", "services", "adblock", "advanced", "blacklist"}, form("adblock/blacklist_tab"), _("Edit Blacklist"), 110).leaf = true
	entry({"admin", "services", "adblock", "advanced", "whitelist"}, form("adblock/whitelist_tab"), _("Edit Whitelist"), 120).leaf = true
	entry({"admin", "services", "adblock", "advanced", "configuration"}, form("adblock/configuration_tab"), _("Edit Configuration"), 130).leaf = true
	entry({"admin", "services", "adblock", "advanced", "query"}, template("adblock/query"), _("Query domains"), 140).leaf = true
	entry({"admin", "services", "adblock", "advanced", "result"}, call("queryData"), nil, 150).leaf = true
	entry({"admin", "services", "adblock", "logread"}, call("logread"), nil).leaf = true
	entry({"admin", "services", "adblock", "status"}, call("status_update"), nil).leaf = true
	entry({"admin", "services", "adblock", "action"}, call("adb_action"), nil).leaf = true
end

function adb_action(name)
	if name == "do_suspend" then
		luci.sys.call("/etc/init.d/adblock suspend >/dev/null 2>&1")
	elseif name == "do_resume" then
		luci.sys.call("/etc/init.d/adblock resume >/dev/null 2>&1")
	elseif name == "do_refresh" then
		luci.sys.call("/etc/init.d/adblock reload >/dev/null 2>&1")
	end
	luci.http.prepare_content("text/plain")	
	luci.http.write("0")
end

function status_update()
	local rt_file
	local content

	rt_file = uci:get("adblock", "global", "adb_rtfile") or "/tmp/adb_runtime.json"

	if nixio.fs.access(rt_file) then
		content = json.parse(nixio.fs.readfile(rt_file) or "")
		http.prepare_content("application/json")
		http.write_json(content)
	end
end

function logread()
	local content

	if nixio.fs.access("/var/log/messages") then
		content = util.trim(util.exec("grep -F 'adblock-' /var/log/messages"))
	else
		content = util.trim(util.exec("logread -e 'adblock-'"))
	end
	
	if content == "" then
		content = "No adblock related logs yet!"
	end
	http.write(content)
end

function queryData(domain)
	if domain then
		luci.http.prepare_content("text/plain")
		local cmd = "/etc/init.d/adblock query %s 2>&1"
		local util = io.popen(cmd % util.shellquote(domain))
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
