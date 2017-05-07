-- Copyright 2017 Dirk Brenken (dev@brenken.org)
-- This is free software, licensed under the Apache License, Version 2.0

module("luci.controller.travelmate", package.seeall)

local fs = require("nixio.fs")
local util = require("luci.util")
local template = require("luci.template")
local i18n = require("luci.i18n")

function index()
	if not nixio.fs.access("/etc/config/travelmate") then
		return
	end
	entry({"admin", "services", "travelmate"}, firstchild(), _("Travelmate"), 40).dependent = false
	entry({"admin", "services", "travelmate", "tab_from_cbi"}, cbi("travelmate/overview_tab", {hideresetbtn=true, hidesavebtn=true}), _("Overview"), 10).leaf = true
	entry({"admin", "services", "travelmate", "logfile"}, call("logread"), _("View Logfile"), 20).leaf = true
	entry({"admin", "services", "travelmate", "advanced"}, firstchild(), _("Advanced"), 100)
	entry({"admin", "services", "travelmate", "advanced", "configuration"}, cbi("travelmate/configuration_tab"), _("Edit Travelmate Configuration"), 110).leaf = true
	entry({"admin", "services", "travelmate", "advanced", "cfg_wireless"}, cbi("travelmate/cfg_wireless_tab"), _("Edit Wireless Configuration"), 120).leaf = true
	entry({"admin", "services", "travelmate", "advanced", "cfg_network"}, cbi("travelmate/cfg_network_tab"), _("Edit Network Configuration"), 130).leaf = true
	entry({"admin", "services", "travelmate", "advanced", "cfg_firewall"}, cbi("travelmate/cfg_firewall_tab"), _("Edit Firewall Configuration"), 140).leaf = true
end

function logread()
	local logfile = util.trim(util.exec("logread -e 'travelmate'"))
	template.render("travelmate/logread", {title = i18n.translate("Travelmate Logfile"), content = logfile})
end
