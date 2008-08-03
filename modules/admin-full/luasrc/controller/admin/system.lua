--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--
module("luci.controller.admin.system", package.seeall)

function index()
	luci.i18n.loadc("admin-core")
	local i18n = luci.i18n.translate
	
	entry({"admin", "system"}, template("admin_system/index"), i18n("system", "System"), 30)
	entry({"admin", "system", "packages"}, call("action_packages"), i18n("a_s_packages", "Paketverwaltung"), 10)
	entry({"admin", "system", "packages", "ipkg"}, call("action_ipkg"), i18n("a_s_p_ipkg", "IPKG-Konfiguration"))
	entry({"admin", "system", "passwd"}, call("action_passwd"), i18n("a_s_changepw", "Passwort ändern"), 20)
	entry({"admin", "system", "sshkeys"}, call("action_sshkeys"), i18n("a_s_sshkeys", "SSH-Schlüssel"), 30)
	entry({"admin", "system", "system"}, cbi("admin_system/system"), i18n("system", "System"), 40)
	entry({"admin", "system", "fstab"}, cbi("admin_system/fstab"), i18n("a_s_fstab", "Einhängepunkte"), 50)
	entry({"admin", "system", "backup"}, call("action_backup"), i18n("a_s_backup"), 60)
	entry({"admin", "system", "upgrade"}, call("action_upgrade"), i18n("a_s_flash", "Firmwareupgrade"), 70)
	entry({"admin", "system", "reboot"}, call("action_reboot"), i18n("reboot", "Neu starten"), 80)
end

function action_editor()
	local file = luci.http.formvalue("file", "")
	local data = luci.http.formvalue("data")
	local err  = nil
	local msg  = nil
	local stat = true
	
	if file and data then
		stat, err = luci.fs.writefile(file, data)
	end
	
	if not stat then
		err = luci.util.split(err, " ")
		table.remove(err, 1)
		msg = table.concat(err, " ")
	end
	
	local cnt, err = luci.fs.readfile(file)
	if cnt then
		cnt = luci.util.pcdata(cnt)
	end
	luci.template.render("admin_system/editor", {fn=file, cnt=cnt, msg=msg})	
end

function action_ipkg()
	local file = "/etc/ipkg.conf"
	local data = luci.http.formvalue("data")
	local stat = nil
	local err  = nil
	
	if data then
		stat, err = luci.fs.writefile(file, data)
	end	
	
	local cnt  = luci.fs.readfile(file)	
	if cnt then
		cnt = luci.util.pcdata(cnt)
	end
	
	luci.template.render("admin_system/ipkg", {cnt=cnt, msg=err})	
end

function action_packages()
	local ipkg = require("luci.model.ipkg")
	local void = nil
	local submit = luci.http.formvalue("submit")
	
	
	-- Search query
	local query = luci.http.formvalue("query")
	query = (query ~= '') and query or nil
	
	
	-- Packets to be installed
	local install = submit and luci.http.formvaluetable("install")
	
	-- Install from URL
	local url = luci.http.formvalue("url")
	if url and url ~= '' and submit then
		if not install then
			install = {}
		end
		install[url] = 1
	end
	
	-- Do install
	if install then
		for k, v in pairs(install) do
			void, install[k] = ipkg.install(k)
		end
	end
	
	
	-- Remove packets
	local remove = submit and luci.http.formvaluetable("remove")
	if remove then	
		for k, v in pairs(remove) do
			void, remove[k] = ipkg.remove(k)
		end	
	end
	
	
	-- Update all packets
	local update = luci.http.formvalue("update")
	if update then
		void, update = ipkg.update()
	end
	
	
	-- Upgrade all packets
	local upgrade = luci.http.formvalue("upgrade")
	if upgrade then
		void, upgrade = ipkg.upgrade()
	end
	
	
	-- Package info
	local info = luci.model.ipkg.info(query)
	info = info or {}
	local pkgs = {}
	
	-- Sort after status and name
	for k, v in pairs(info) do
		local x = 0
		for i, j in pairs(pkgs) do
			local vins = (v.Status and v.Status.installed)
			local jins = (j.Status and j.Status.installed)
			if vins ~= jins then
				if vins then
					break
				end
			else
				if j.Package > v.Package then
					break
				end
			end
			x = i
		end
		table.insert(pkgs, x+1, v)
	end 
	
	luci.template.render("admin_system/packages", {pkgs=pkgs, query=query,
	 install=install, remove=remove, update=update, upgrade=upgrade})	
end

function action_backup()
	local reset_avail = luci.sys.exec([[grep '"rootfs_data"' /proc/mtd >/dev/null 2>&1]]) == 0
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
		luci.template.render("admin_system/applyreboot")
		luci.sys.reboot()
	elseif backup then
		luci.util.perror(backup_cmd:format(_keep_pattern()))
		local backup_fpi = io.popen(backup_cmd:format(_keep_pattern()), "r")
		luci.http.header('Content-Disposition', 'attachment; filename="backup.tar.gz"')
		luci.http.prepare_content("application/x-targz")
		luci.ltn12.pump.all(luci.ltn12.source.file(backup_fpi), luci.http.write)
	elseif reset then
		luci.template.render("admin_system/applyreboot")
		luci.sys.exec("mtd -r erase rootfs_data")
	else
		luci.template.render("admin_system/backup", {reset_avail = reset_avail})
	end
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
	
	luci.template.render("admin_system/passwd", {stat=stat})
end

function action_reboot()
	local reboot = luci.http.formvalue("reboot")
	luci.template.render("admin_system/reboot", {reboot=reboot})
	if reboot then
		luci.sys.reboot()
	end
end

function action_sshkeys()
	local file = "/etc/dropbear/authorized_keys"
	local data = luci.http.formvalue("data")
	local stat = nil
	local err  = nil
	
	if data then
		stat, err = luci.fs.writefile(file, data)
	end	
	
	local cnt  = luci.fs.readfile(file)	
	if cnt then
		cnt = luci.util.pcdata(cnt)
	end
	
	luci.template.render("admin_system/sshkeys", {cnt=cnt, msg=err})	
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
		ret = luci.sys.flash(tmpfile, keepcfg and _keep_pattern())
	end

	luci.template.render("admin_system/upgrade", {sysupgrade=plat, ret=ret})
end

function _keep_pattern()
	local kpattern = ""
	local files = luci.model.uci.get_all("luci", "flash_keep")
	if files then
		kpattern = ""
		for k,v in pairs(files) do
			kpattern = kpattern .. " " ..  v
		end
	end
	return kpattern
end