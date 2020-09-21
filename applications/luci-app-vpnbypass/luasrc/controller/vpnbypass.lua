module("luci.controller.vpnbypass", package.seeall)
function index()
	if nixio.fs.access("/etc/config/vpnbypass") then
		local e = entry({"admin", "vpn"}, firstchild(), _("VPN"), 60)
		e.dependent = false
		e.acl_depends = { "luci-app-vpnbypass" }
		entry({"admin", "vpn", "vpnbypass"}, cbi("vpnbypass"), _("VPN Bypass"))
		entry({"admin", "vpn", "vpnbypass", "action"}, call("vpnbypass_action"), nil).leaf = true
	end
end

function vpnbypass_action(name)
	local packageName = "vpnbypass"
	local http = require "luci.http"
	local sys = require "luci.sys"
	local uci = require "luci.model.uci".cursor()
	local util = require "luci.util"
	if name == "start" then
		sys.init.start(packageName)
	elseif name == "action" then
		util.exec("/etc/init.d/" .. packageName .. " restart >/dev/null 2>&1")
		util.exec("/etc/init.d/dnsmasq restart >/dev/null 2>&1")
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
