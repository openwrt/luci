module("luci.controller.spoofer", package.seeall)

local uci = require "luci.model.uci"

function index()
    entry({"admin", "services", "spoofer"}, firstchild(), "Spoofer", 19.16)
    entry({"admin", "services", "spoofer", "results"}, cbi("spoofer/results"), "Spoofer Results", 1)
    entry({"admin", "services", "spoofer", "settings"}, cbi("spoofer/settings"), "Spoofer Settings", 2)
    entry({"admin", "services", "spoofer", "log"}, call("action_spooferlog")).leaf = true
end

function action_spooferlog(section)
    if section == nil then
	luci.dispatcher.error404("No such spoofer result log")
	return
    end
    local logfile = uci.cursor():get("spoofer", section, "log")
    if logfile == nil or not nixio.fs.access(logfile, "r") then
	luci.dispatcher.error404("No such spoofer result log")
	return
    end
    local spooferlog = nixio.fs.readfile(logfile)
    luci.template.render("spoofer/log", {spooferlog=spooferlog, logname=logfile})
end
