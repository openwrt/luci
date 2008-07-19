--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>
Copyright 2008 Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

module("luci.controller.mini.system", package.seeall)

function index()
	luci.i18n.loadc("admin-core")
	local i18n = luci.i18n.translate

	entry({"mini", "system"}, alias("mini", "system", "index"), i18n("system"), 40)
	entry({"mini", "system", "index"}, cbi("mini/system"), i18n("general"), 1)
	entry({"mini", "system", "passwd"}, call("action_passwd"), i18n("a_s_changepw"), 10)
	entry({"mini", "system", "upgrade"}, call("action_upgrade"), i18n("a_s_flash"), 90)
	entry({"mini", "system", "reboot"}, call("action_reboot"), i18n("reboot"), 100)
end

function action_reboot()
	local reboot = luci.http.formvalue("reboot")
	luci.template.render("mini/reboot", {reboot=reboot})
	if reboot then
		luci.sys.reboot()
	end
end

function action_upgrade()
	require("luci.model.uci")

	local ret  = nil
	local plat = luci.fs.mtime("/lib/upgrade/platform.sh")
	local tmpfile = "/tmp/firmware.img"

	local file
	luci.http.setfilehandler(
		function(meta, chunk, eof)
			if not file then
				file = io.open(tmpfile, "w")
			end
			if chunk then
				file:write(chunk)
			end
			if eof then
				file:close()
			end
		end
	)

	local fname   = luci.http.formvalue("image")
	local keepcfg = luci.http.formvalue("keepcfg")

	if plat and fname then
		local kpattern = nil
		if keepcfg then
			local files = luci.model.uci.get_all("luci", "flash_keep")
			if files.luci and files.luci.flash_keep then
				kpattern = ""
				for k,v in pairs(files.luci.flash_keep) do
					kpattern = kpattern .. " " ..  v
				end
			end
		end
		ret = luci.sys.flash(tmpfile, kpattern)
	end

	luci.template.render("mini/upgrade", {sysupgrade=plat, ret=ret})
end

function action_passwd()
	local p1 = luci.http.formvalue("pwd1")
	local p2 = luci.http.formvalue("pwd2")
	local stat = nil

	if p1 or p2 then
		if p1 == p2 then
			stat = luci.sys.user.setpasswd("root", p1)
		else
			stat = 10
		end
	end

	luci.template.render("mini/passwd", {stat=stat})
end