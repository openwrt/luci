--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>
Copyright 2008-2009 Jo-Philipp Wich <xm@subsignal.org>

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
	
	entry({"admin", "system"}, alias("admin", "system", "system"), i18n("system"), 30).index = true
	entry({"admin", "system", "system"}, cbi("admin_system/system"), i18n("system"), 1)
	entry({"admin", "system", "packages"}, call("action_packages"), i18n("a_s_packages"), 10)
	entry({"admin", "system", "packages", "ipkg"}, form("admin_system/ipkg"))
	entry({"admin", "system", "passwd"}, form("admin_system/passwd"), i18n("a_s_changepw"), 20)
	entry({"admin", "system", "sshkeys"}, form("admin_system/sshkeys"), i18n("a_s_sshkeys"), 30)
	entry({"admin", "system", "processes"}, form("admin_system/processes"), i18n("process_head"), 45)
	entry({"admin", "system", "fstab"}, cbi("admin_system/fstab"), i18n("a_s_fstab"), 50)

	if nixio.fs.access("/sys/class/leds") then
		entry({"admin", "system", "leds"}, cbi("admin_system/leds"), i18n("leds", "LEDs"), 60)
	end

	entry({"admin", "system", "backup"}, call("action_backup"), i18n("a_s_backup"), 70)
	entry({"admin", "system", "upgrade"}, call("action_upgrade"), i18n("admin_upgrade"), 80)
	entry({"admin", "system", "reboot"}, call("action_reboot"), i18n("reboot"), 90)
end

function action_packages()
	local ipkg = require("luci.model.ipkg")
	local void = nil
	local submit = luci.http.formvalue("submit")
	local changes = false
	
	
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
		changes = true
	end
	
	-- Do install
	if install then
		for k, v in pairs(install) do
			void, install[k] = ipkg.install(k)
		end
		changes = true
	end
	
	
	-- Remove packets
	local remove = submit and luci.http.formvaluetable("remove")
	if remove then	
		for k, v in pairs(remove) do
			void, remove[k] = ipkg.remove(k)
		end
		changes = true
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
	 
	-- Remove index cache
	if changes then
		nixio.fs.unlink("/tmp/luci-indexcache")
	end	
end

function action_backup()
	local reset_avail = os.execute([[grep '"rootfs_data"' /proc/mtd >/dev/null 2>&1]]) == 0
	local restore_cmd = "tar -xzC/ >/dev/null 2>&1"
	local backup_cmd  = "tar -cz %s 2>/dev/null"

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
		local reader = ltn12_popen(backup_cmd:format(_keep_pattern()))
		luci.http.header('Content-Disposition', 'attachment; filename="backup-%s-%s.tar.gz"' % {
			luci.sys.hostname(), os.date("%Y-%m-%d")})
		luci.http.prepare_content("application/x-targz")
		luci.ltn12.pump.all(reader, luci.http.write)
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

	local tmpfile = "/tmp/firmware.img"
	
	local function image_supported()
		-- XXX: yay...
		return ( 0 == os.execute(
			". /etc/functions.sh; " ..
			"include /lib/upgrade; " ..
			"platform_check_image %q >/dev/null"
				% tmpfile
		) )
	end
	
	local function image_checksum()
		return (luci.sys.exec("md5sum %q" % tmpfile):match("^([^%s]+)"))
	end
	
	local function storage_size()
		local size = 0
		if nixio.fs.access("/proc/mtd") then
			for l in io.lines("/proc/mtd") do
				local d, s, e, n = l:match('^([^%s]+)%s+([^%s]+)%s+([^%s]+)%s+"([^%s]+)"')
				if n == "linux" then
					size = tonumber(s, 16)
					break
				end
			end
		elseif nixio.fs.access("/proc/partitions") then
			for l in io.lines("/proc/partitions") do
				local x, y, b, n = l:match('^%s*(%d+)%s+(%d+)%s+([^%s]+)%s+([^%s]+)')
				if b and n and not n:match('[0-9]') then
					size = tonumber(b) * 1024
					break
				end
			end
		end
		return size
	end


	-- Install upload handler
	local file
	luci.http.setfilehandler(
		function(meta, chunk, eof)
			if not nixio.fs.access(tmpfile) and not file and chunk and #chunk > 0 then
				file = io.open(tmpfile, "w")
			end
			if file and chunk then
				file:write(chunk)
			end
			if file and eof then
				file:close()
			end
		end
	)


	-- Determine state
	local keep_avail   = true
	local step         = tonumber(luci.http.formvalue("step") or 1)
	local has_image    = nixio.fs.access(tmpfile)
	local has_support  = image_supported()
	local has_platform = nixio.fs.access("/lib/upgrade/platform.sh")
	local has_upload   = luci.http.formvalue("image")
	
	-- This does the actual flashing which is invoked inside an iframe
	-- so don't produce meaningful errors here because the the 
	-- previous pages should arrange the stuff as required.
	if step == 4 then
		if has_platform and has_image and has_support then
			-- Mimetype text/plain
			luci.http.prepare_content("text/plain")

			-- Now invoke sysupgrade
			local keepcfg = keep_avail and luci.http.formvalue("keepcfg") == "1"
			local fd = io.popen("/sbin/luci-flash %s %q" %{
				keepcfg and "-k %q" % _keep_pattern() or "", tmpfile
			})

			if fd then
				while true do
					local ln = fd:read("*l")
					if not ln then break end
					luci.http.write(ln .. "\n")
				end
				fd:close()
			end

			-- Make sure the device is rebooted
			luci.sys.reboot()
		end


	--
	-- This is step 1-3, which does the user interaction and
	-- image upload.
	--

	-- Step 1: file upload, error on unsupported image format
	elseif not has_image or not has_support or step == 1 then
		-- If there is an image but user has requested step 1
		-- or type is not supported, then remove it.
		if has_image then
			nixio.fs.unlink(tmpfile)
		end
			
		luci.template.render("admin_system/upgrade", {
			step=1,
			bad_image=(has_image and not has_support or false),
			keepavail=keep_avail,
			supported=has_platform
		} )

	-- Step 2: present uploaded file, show checksum, confirmation
	elseif step == 2 then
		luci.template.render("admin_system/upgrade", {
			step=2,
			checksum=image_checksum(),
			filesize=nixio.fs.stat(tmpfile).size,
			flashsize=storage_size(),
			keepconfig=(keep_avail and luci.http.formvalue("keepcfg") == "1")
		} )
	
	-- Step 3: load iframe which calls the actual flash procedure
	elseif step == 3 then
		luci.template.render("admin_system/upgrade", {
			step=3,
			keepconfig=(keep_avail and luci.http.formvalue("keepcfg") == "1")
		} )
	end	
end

function _keep_pattern()
	local kpattern = ""
	local files = luci.model.uci.cursor():get_all("luci", "flash_keep")
	if files then
		kpattern = ""
		for k, v in pairs(files) do
			if k:sub(1,1) ~= "." and nixio.fs.glob(v)() then
				kpattern = kpattern .. " " ..  v
			end
		end
	end
	return kpattern
end

function ltn12_popen(command)

	local fdi, fdo = nixio.pipe()
	local pid = nixio.fork()

	if pid > 0 then
		fdo:close()
		local close
		return function()
			local buffer = fdi:read(2048)
			local wpid, stat = nixio.waitpid(pid, "nohang")
			if not close and wpid and stat == "exited" then
				close = true
			end

			if buffer and #buffer > 0 then
				return buffer
			elseif close then
				fdi:close()
				return nil
			end
		end
	elseif pid == 0 then
		nixio.dup(fdo, nixio.stdout)
		fdi:close()
		fdo:close()
		nixio.exec("/bin/sh", "-c", command)
	end
end
