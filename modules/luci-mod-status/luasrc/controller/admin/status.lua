-- Copyright 2008 Steven Barth <steven@midlink.org>
-- Copyright 2011 Jo-Philipp Wich <jow@openwrt.org>
-- Licensed to the public under the Apache License 2.0.

module("luci.controller.admin.status", package.seeall)

function action_syslog()
	local syslog = luci.sys.syslog()
	luci.template.render("admin_status/syslog", {syslog=syslog})
end

function action_dmesg()
	local dmesg = luci.sys.dmesg()
	luci.template.render("admin_status/dmesg", {dmesg=dmesg})
end

function dump_iptables(family, table)
	local prefix = (family == "6") and "ip6" or "ip"
	local ok, lines = pcall(io.lines, "/proc/net/%s_tables_names" % prefix)
	if ok and lines then
		local s
		for s in lines do
			if s == table then
				luci.http.prepare_content("text/plain")
				luci.sys.process.exec({
					"/usr/sbin/%stables" % prefix, "-w", "-t", table,
					"--line-numbers", "-nxvL"
				}, luci.http.write)
				return
			end
		end
	end

	luci.http.status(404, "No such table")
	luci.http.prepare_content("text/plain")
end

function action_iptables()
	if luci.http.formvalue("zero") then
		if luci.http.formvalue("family") == "6" then
			luci.util.exec("/usr/sbin/ip6tables -Z")
		else
			luci.util.exec("/usr/sbin/iptables -Z")
		end
	elseif luci.http.formvalue("restart") then
		luci.util.exec("/etc/init.d/firewall restart")
	end

	luci.http.redirect(luci.dispatcher.build_url("admin/status/iptables"))
end
