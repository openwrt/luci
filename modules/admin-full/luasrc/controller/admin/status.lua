--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>
Copyright 2011 Jo-Philipp Wich <xm@subsignal.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--
module("luci.controller.admin.status", package.seeall)

function index()
	luci.i18n.loadc("base")
	local i18n = luci.i18n.translate

	entry({"admin", "status"}, alias("admin", "status", "overview"), i18n("Status"), 20).index = true
	entry({"admin", "status", "overview"}, template("admin_status/index"), i18n("Overview"), 1)
	entry({"admin", "status", "iptables"}, call("action_iptables"), i18n("Firewall"), 2).leaf = true
	entry({"admin", "status", "routes"}, template("admin_status/routes"), i18n("Routes"), 3)
	entry({"admin", "status", "syslog"}, call("action_syslog"), i18n("System Log"), 4)
	entry({"admin", "status", "dmesg"}, call("action_dmesg"), i18n("Kernel Log"), 5)

	entry({"admin", "status", "load"}, template("admin_status/load"), i18n("Realtime Load"), 6).leaf = true
	entry({"admin", "status", "load_status"}, call("action_load")).leaf = true

	entry({"admin", "status", "bandwidth"}, template("admin_status/bandwidth"), i18n("Realtime Traffic"), 7).leaf = true
	entry({"admin", "status", "bandwidth_status"}, call("action_bandwidth")).leaf = true

	entry({"admin", "status", "connections"}, template("admin_status/connections"), i18n("Realtime Connections"), 8).leaf = true
	entry({"admin", "status", "connections_status"}, call("action_connections")).leaf = true

	entry({"admin", "status", "processes"}, cbi("admin_status/processes"), i18n("Processes"), 20)
end

function action_syslog()
	local syslog = luci.sys.syslog()
	luci.template.render("admin_status/syslog", {syslog=syslog})
end

function action_dmesg()
	local dmesg = luci.sys.dmesg()
	luci.template.render("admin_status/dmesg", {dmesg=dmesg})
end

function action_iptables()
	if luci.http.formvalue("zero") then
		if luci.http.formvalue("zero") == "6" then
			luci.util.exec("ip6tables -Z")
		else
			luci.util.exec("iptables -Z")
		end
		luci.http.redirect(
			luci.dispatcher.build_url("admin", "status", "iptables")
		)
	elseif luci.http.formvalue("restart") == "1" then
		luci.util.exec("/etc/init.d/firewall restart")
		luci.http.redirect(
			luci.dispatcher.build_url("admin", "status", "iptables")
		)
	else
		luci.template.render("admin_status/iptables")
	end
end

function action_bandwidth()
	local path  = luci.dispatcher.context.requestpath
	local iface = path[#path]

	local fs = require "luci.fs"
	if fs.access("/var/lib/luci-bwc/if/%s" % iface) then
		luci.http.prepare_content("application/json")

		local bwc = io.popen("luci-bwc -i %q 2>/dev/null" % iface)
		if bwc then
			luci.http.write("[")

			while true do
				local ln = bwc:read("*l")
				if not ln then break end
				luci.http.write(ln)
			end

			luci.http.write("]")
			bwc:close()
		end

		return
	end

	luci.http.status(404, "No data available")
end

function action_load()
	local fs = require "luci.fs"
	if fs.access("/var/lib/luci-bwc/load") then
		luci.http.prepare_content("application/json")

		local bwc = io.popen("luci-bwc -l 2>/dev/null")
		if bwc then
			luci.http.write("[")

			while true do
				local ln = bwc:read("*l")
				if not ln then break end
				luci.http.write(ln)
			end

			luci.http.write("]")
			bwc:close()
		end

		return
	end

	luci.http.status(404, "No data available")
end

function action_connections()
	local fs  = require "luci.fs"
	local sys = require "luci.sys"

	luci.http.prepare_content("application/json")

	luci.http.write("{ connections: ")
	luci.http.write_json(sys.net.conntrack())

	if fs.access("/var/lib/luci-bwc/connections") then
		local bwc = io.popen("luci-bwc -c 2>/dev/null")
		if bwc then
			luci.http.write(", statistics: [")

			while true do
				local ln = bwc:read("*l")
				if not ln then break end
				luci.http.write(ln)
			end

			luci.http.write("]")
			bwc:close()
		end
	end

	luci.http.write(" }")
end
