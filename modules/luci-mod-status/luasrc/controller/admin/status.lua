-- Copyright 2008 Steven Barth <steven@midlink.org>
-- Copyright 2011 Jo-Philipp Wich <jow@openwrt.org>
-- Licensed to the public under the Apache License 2.0.

module("luci.controller.admin.status", package.seeall)

function index()
	local page

	entry({"admin", "status", "overview"}, template("admin_status/index"), _("Overview"), 1)

	entry({"admin", "status", "iptables"}, template("admin_status/iptables"), _("Firewall"), 2).leaf = true

	entry({"admin", "status", "routes"}, template("admin_status/routes"), _("Routes"), 3)
	entry({"admin", "status", "syslog"}, call("action_syslog"), _("System Log"), 4)
	entry({"admin", "status", "dmesg"}, call("action_dmesg"), _("Kernel Log"), 5)
	entry({"admin", "status", "processes"}, view("status/processes"), _("Processes"), 6)

	entry({"admin", "status", "realtime"}, alias("admin", "status", "realtime", "load"), _("Realtime Graphs"), 7)

	entry({"admin", "status", "realtime", "load"}, view("status/load"), _("Load"), 1)
	entry({"admin", "status", "realtime", "bandwidth"}, view("status/bandwidth"), _("Traffic"), 2)
	entry({"admin", "status", "realtime", "wireless"}, view("status/wireless"), _("Wireless"), 3).uci_depends = { wireless = true }
	entry({"admin", "status", "realtime", "connections"}, view("status/connections"), _("Connections"), 4)

	entry({"admin", "status", "nameinfo"}, call("action_nameinfo")).leaf = true
end

function action_syslog()
	local syslog = luci.sys.syslog()
	luci.template.render("admin_status/syslog", {syslog=syslog})
end

function action_dmesg()
	local dmesg = luci.sys.dmesg()
	luci.template.render("admin_status/dmesg", {dmesg=dmesg})
end
