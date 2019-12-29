-- Copyright 2008 Steven Barth <steven@midlink.org>
-- Copyright 2011 Jo-Philipp Wich <jow@openwrt.org>
-- Licensed to the public under the Apache License 2.0.

module("luci.controller.admin.status", package.seeall)

function index()
	local page

	entry({"admin", "status", "overview"}, template("admin_status/index"), _("Overview"), 1)

	entry({"admin", "status", "iptables"}, view("status/iptables"), _("Firewall"), 2).leaf = true

	entry({"admin", "status", "routes"}, view("status/routes"), _("Routes"), 3)
	entry({"admin", "status", "syslog"}, view("status/syslog"), _("System Log"), 4)
	entry({"admin", "status", "dmesg"}, view("status/dmesg"), _("Kernel Log"), 5)
	entry({"admin", "status", "processes"}, view("status/processes"), _("Processes"), 6)

	entry({"admin", "status", "realtime"}, alias("admin", "status", "realtime", "load"), _("Realtime Graphs"), 7)

	entry({"admin", "status", "realtime", "load"}, view("status/load"), _("Load"), 1)
	entry({"admin", "status", "realtime", "bandwidth"}, view("status/bandwidth"), _("Traffic"), 2)
	entry({"admin", "status", "realtime", "wireless"}, view("status/wireless"), _("Wireless"), 3).uci_depends = { wireless = true }
	entry({"admin", "status", "realtime", "connections"}, view("status/connections"), _("Connections"), 4)

	entry({"admin", "status", "nameinfo"}, call("action_nameinfo")).leaf = true
end
