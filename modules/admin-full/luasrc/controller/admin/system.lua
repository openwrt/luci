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
	
	entry({"admin", "system"}, alias("admin", "system", "system"), i18n("system"), 30)
	entry({"admin", "system", "system"}, cbi("admin_system/system"), i18n("system"), 1)
	entry({"admin", "system", "packages"}, call("action_packages"), i18n("a_s_packages"), 10)
	entry({"admin", "system", "packages", "ipkg"}, form("admin_system/ipkg"), i18n("a_s_p_ipkg"))
	entry({"admin", "system", "passwd"}, form("admin_system/passwd"), i18n("a_s_changepw"), 20)
	entry({"admin", "system", "sshkeys"}, form("admin_system/sshkeys"), i18n("a_s_sshkeys"), 30)
	entry({"admin", "system", "processes"}, form("admin_system/processes"), i18n("process_head"), 45)
	entry({"admin", "system", "fstab"}, cbi("admin_system/fstab"), i18n("a_s_fstab"), 50)
	entry({"admin", "system", "leds"}, cbi("admin_system/leds"), i18n("leds", "LEDs"), 60)
	entry({"admin", "system", "backup"}, call("action_backup"), i18n("a_s_backup"), 70)
	entry({"admin", "system", "upgrade"}, call("action_upgrade"), i18n("a_s_flash"), 80)
	entry({"admin", "system", "reboot"}, call("action_reboot"), i18n("reboot"), 90)
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
	local info = luci.model.ipkg.info(query and "*"..query.."*")
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
		luci.util.exec("mtd -r erase rootfs_data")
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

function action_upgrade()
	require("luci.model.uci")
	local mtdow = require "luci.sys.mtdow"
	local writer = mtdow.native_writer()
	local blocks = writer and writer.blocks
	local ltn12 = require "luci.ltn12"
	local uploads = {}
	local flash = {}
	
	writer.COPY[#writer.COPY + 1] = "/sbin/reboot"

	local ret
	local filepat = "/tmp/mtdblock.%s"
	local kfile = "/tmp/mtdappend.tgz"

	local keep_avail = false
	if blocks then
		for k, block in pairs(blocks) do
			if block.write ~= mtdow.WRITE_IMAGE then
				keep_avail = true
			end
		end
	end

	luci.http.setfilehandler(
		function(meta, chunk, eof)
			if not meta or not blocks or not blocks[meta.name] then
				return
			end
			if not uploads[meta.name] then
				uploads[meta.name] = io.open(filepat % meta.name, "w")
			end
			if chunk then
				uploads[meta.name]:write(chunk)
			end
			if eof then
				uploads[meta.name]:close()
				uploads[meta.name] = filepat % meta.name
			end
		end
	)

	luci.http.formvalue() -- Parse uploads
	local keepcfg = keep_avail and luci.http.formvalue("keepcfg")
	
	local function _kfile()
		luci.fs.unlink(kfile)
		
		local kpattern = ""
		local files = luci.model.uci.cursor():get_all("luci", "flash_keep")
		if files then
			kpattern = ""
			for k, v in pairs(files) do
				if k:sub(1,1) ~= "." and luci.fs.glob(v) then
					kpattern = kpattern .. " '" ..  v .. "'"
				end
			end
		end
		
		local stat = os.execute("tar czf '%s' %s >/dev/null 2>&1" % {kfile, kpattern})
		return stat == 0 and kfile
	end

	for name, file in pairs(uploads) do
		local e = {name=name, func=function()
			local imgstream = ltn12.source.file(io.open(file))
			local kf = blocks[name].write ~= mtdow.WRITE_IMAGE
			 and keepcfg and _kfile()
			return pcall(writer.write_block, writer, 
				name, imgstream, kf)
		end}
		
		if blocks[name].system then
			flash[#flash+1] = e
		else
			table.insert(flash, 1, e)
		end
	end
	
	local reboot = {}

	luci.template.render("admin_system/upgrade", {blocks=blocks,
		flash=flash, keep_avail=keep_avail, reboot=reboot})
	if reboot.exec then
		local pid = posix.fork()
		if pid == 0 then
			posix.sleep(1)
			posix.exec("/tmp/reboot")
		end
	end
end
