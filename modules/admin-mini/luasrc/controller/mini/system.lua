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

	entry({"mini", "system"}, alias("mini", "system", "index"), i18n("system"), 40).index = true
	entry({"mini", "system", "index"}, cbi("mini/system"), i18n("general"), 1)
	entry({"mini", "system", "passwd"}, form("mini/passwd"), i18n("a_s_changepw"), 10)
	entry({"mini", "system", "backup"}, call("action_backup"), i18n("a_s_backup"), 80)
	entry({"mini", "system", "upgrade"}, call("action_upgrade"), i18n("a_s_flash"), 90)
	entry({"mini", "system", "reboot"}, call("action_reboot"), i18n("reboot"), 100)
end

function action_backup()
	local reset_avail = os.execute([[grep '"rootfs_data"' /proc/mtd >/dev/null 2>&1]]) == 0
	local restore_cmd = "gunzip | tar -xC/ >/dev/null 2>&1"
	local backup_cmd  = "tar -c %s | gzip 2>/dev/null"
	
	local restore_fpi 
	luci.http.setfilehandler(
		function(meta, chunk, eof)
			if not restore_fpi then
				restore_fpi = io.popen(restore_cmd, "w")
			end
			if chunk then
				restore_fpi:write(chunk)
			end
			if eof then
				restore_fpi:close()
			end
		end
	)
		  
	local upload = luci.http.formvalue("archive")
	local backup = luci.http.formvalue("backup")
	local reset  = reset_avail and luci.http.formvalue("reset")
	
	if upload and #upload > 0 then
		luci.template.render("mini/applyreboot")
		luci.sys.reboot()
	elseif backup then
		luci.util.perror(backup_cmd:format(_keep_pattern()))
		local backup_fpi = io.popen(backup_cmd:format(_keep_pattern()), "r")
		luci.http.header('Content-Disposition', 'attachment; filename="backup.tar.gz"')
		luci.http.prepare_content("application/x-targz")
		luci.ltn12.pump.all(luci.ltn12.source.file(backup_fpi), luci.http.write)
	elseif reset then
		luci.template.render("mini/applyreboot")
		luci.util.exec("mtd -r erase rootfs_data")
	else
		luci.template.render("mini/backup", {reset_avail = reset_avail})
	end
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
	local keep_avail = true

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
	local keepcfg = keep_avail and luci.http.formvalue("keepcfg")

	if plat and fname then
		ret = function()
			return luci.sys.flash(tmpfile, keepcfg and _keep_pattern())
		end
	end

	luci.http.prepare_content("text/html")
	luci.template.render("mini/upgrade", {sysupgrade=plat, ret=ret, keep_avail=keep_avail})
end

function _keep_pattern()
	local kpattern = ""
	local files = luci.model.uci.cursor():get_all("luci", "flash_keep")
	if files then
		kpattern = ""
		for k, v in pairs(files) do
			if k:sub(1,1) ~= "." and luci.fs.glob(v) then
				kpattern = kpattern .. " " ..  v
			end
		end
	end
	return kpattern
end