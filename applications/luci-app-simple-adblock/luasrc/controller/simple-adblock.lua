module("luci.controller.simple-adblock", package.seeall)
function index()
	if nixio.fs.access("/etc/config/simple-adblock") then
		entry({"admin", "services", "simple-adblock"}, cbi("simple-adblock"), _("Simple AdBlock")).acl_depends = { "luci-app-simple-adblock" }
		entry({"admin", "services", "simple-adblock", "action"}, call("simple_adblock_action"), nil).leaf = true
	end
end

function simple_adblock_action(name)
	local packageName = "simple-adblock"
	local http = require "luci.http"
	local sys = require "luci.sys"
	local uci = require "luci.model.uci".cursor()
	local util = require "luci.util"
	if name == "start" then
		sys.init.start(packageName)
	elseif name == "action" then
		util.exec("/etc/init.d/" .. packageName .. " dl >/dev/null 2>&1")
	elseif name == "stop" then
		sys.init.stop(packageName)
	elseif name == "enable" then
		uci:set(packageName, "config", "enabled", "1")
		uci:commit(packageName)
	elseif name == "disable" then
		uci:set(packageName, "config", "enabled", "0")
		uci:commit(packageName)
	end
	http.prepare_content("text/plain")
	http.write("0")
end
