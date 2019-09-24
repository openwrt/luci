-- Copyright 2008 Steven Barth <steven@midlink.org>
-- Copyright 2008-2011 Jo-Philipp Wich <jow@openwrt.org>
-- Licensed to the public under the Apache License 2.0.

module("luci.controller.admin.system", package.seeall)

function index()
	local fs = require "nixio.fs"

	entry({"admin", "system", "system"}, view("system/system"), _("System"), 1)

	entry({"admin", "system", "admin"}, firstchild(), _("Administration"), 2)
	entry({"admin", "system", "admin", "password"}, view("system/password"), _("Router Password"), 1)

	if fs.access("/etc/config/dropbear") then
		entry({"admin", "system", "admin", "dropbear"}, view("system/dropbear"), _("SSH Access"), 2)
		entry({"admin", "system", "admin", "sshkeys"}, view("system/sshkeys"), _("SSH-Keys"), 3)
	end

	entry({"admin", "system", "startup"}, view("system/startup"), _("Startup"), 45)
	entry({"admin", "system", "crontab"}, view("system/crontab"), _("Scheduled Tasks"), 46)

	if fs.access("/sbin/block") and fs.access("/etc/config/fstab") then
		entry({"admin", "system", "mounts"}, view("system/mounts"), _("Mount Points"), 50)
	end

	local nodes, number = fs.glob("/sys/class/leds/*")
	if number > 0 then
		entry({"admin", "system", "leds"}, view("system/leds"), _("<abbr title=\"Light Emitting Diode\">LED</abbr> Configuration"), 60)
	end

	entry({"admin", "system", "flash"}, view("system/flash"), _("Backup / Flash Firmware"), 70)

	entry({"admin", "system", "reboot"}, template("admin_system/reboot"), _("Reboot"), 90)
	entry({"admin", "system", "reboot", "call"}, post("action_reboot"))
end

function action_reboot()
	luci.sys.reboot()
end
