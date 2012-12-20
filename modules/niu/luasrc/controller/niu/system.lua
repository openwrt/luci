--[[
LuCI - Lua Development Framework

Copyright 2009 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

local require, pairs, unpack, tonumber = require, pairs, unpack, tonumber
module "luci.controller.niu.system"

function index()
	local toniu = {on_success_to={"niu"}}

	local e = entry({"niu", "system"}, alias("niu"), "System", 40)
	e.niu_dbtemplate = "niu/system"
	e.niu_dbtasks = true
	e.niu_dbicon = "icons32/preferences-system.png"

	entry({"niu", "system", "general"}, 
	cbi("niu/system/general", toniu), "Configure Device", 1)
	
	entry({"niu", "system", "backup"}, call("backup"), "Backup or Restore Settings", 2)
	entry({"niu", "system", "upgrade"}, call("upgrade"), "Upgrade Firmware", 30)
end

function backup()
	local dsp = require "luci.dispatcher"
	local os, io = require "os", require "io"
	local uci = require "luci.model.uci".inst
	local nixio, nutl = require "nixio", require "nixio.util"
	local fs = require "nixio.fs"
	local http = require "luci.http"
	local tpl = require "luci.template"
	
	local restore_fpi 
	http.setfilehandler(
		function(meta, chunk, eof)
			if not restore_fpi then
				restore_fpi = io.popen("tar -xzC/ >/dev/null 2>&1", "w")
			end
			if chunk then
				restore_fpi:write(chunk)
			end
			if eof then
				restore_fpi:close()
			end
		end
	)
	
	local reset_avail = (fs.readfile("/proc/mtd") or ""):find('"rootfs_data"')
	local upload = http.formvalue("archive")
	local backup = http.formvalue("backup")
	local reset  = reset_avail and http.formvalue("reset")
	local backup_cmd  = "tar -cz %s 2>/dev/null"
	
	if http.formvalue("cancel") then
		return http.redirect(dsp.build_url("niu"))
	end
	
	if backup then
		local call = {"/bin/tar", "-cz"}
		for k, v in pairs(uci:get_all("luci", "flash_keep")) do
			if k:byte() ~= 46 then	-- k[1] ~= "."
				nutl.consume(fs.glob(v), call)
			end
		end
		
		
		http.header(
			'Content-Disposition', 'attachment; filename="backup-%s-%s.tar.gz"' % {
				nixio.uname().nodename, os.date("%Y-%m-%d")
			}
		)
		http.prepare_content("application/x-targz")
		
		
		local fdin, fdout = nixio.pipe()
		local devnull = nixio.open("/dev/null", "r+")
		local proc = nixio.fork()
		
		if proc == 0 then
			fdin:close()
			nixio.dup(devnull, nixio.stdin)
			nixio.dup(devnull, nixio.stderr)
			nixio.dup(fdout, nixio.stdout)
			nixio.exec(unpack(call))
			os.exit(1)
		end
		
		fdout:close()
		http.splice(fdin)
		http.close()
	elseif (upload and #upload > 0) or reset then
		tpl.render("niu/system/reboot")
		if nixio.fork() == 0 then
			nixio.nanosleep(1)
			if reset then
				nixio.execp("mtd", "-r", "erase", "rootfs_data")
			else
				nixio.execp("reboot")
			end
			os.exit(1)
		end
	else
		tpl.render("niu/system/backup", {reset_avail = reset_avail})
	end
end

function upgrade()
	local io, os, table = require "io", require "os", require "table"
	local uci = require "luci.store".uci_state
	local http = require "luci.http"
	local util = require "luci.util"
	local tpl = require "luci.template"
	local nixio = require "nixio", require "nixio.util", require "nixio.fs"


	local tmpfile = "/tmp/firmware.img"
	
	local function image_supported()
		-- XXX: yay...
		return ( 0 == os.execute(
			". /lib/functions.sh; " ..
			"include /lib/upgrade; " ..
			"platform_check_image %q >/dev/null"
				% tmpfile
		) )
	end
	
	local function image_checksum()
		return (util.exec("md5sum %q" % tmpfile):match("^([^%s]+)"))
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
	http.setfilehandler(
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
	local step         = tonumber(http.formvalue("step") or 1)
	local has_image    = nixio.fs.access(tmpfile)
	local has_support  = image_supported()
	local has_platform = nixio.fs.access("/lib/upgrade/platform.sh")
	local has_upload   = http.formvalue("image")
	
	-- This does the actual flashing which is invoked inside an iframe
	-- so don't produce meaningful errors here because the the 
	-- previous pages should arrange the stuff as required.
	if step == 4 then
		if has_platform and has_image and has_support then
			-- Mimetype text/plain
			http.prepare_content("text/plain")
			
			local call = {}
			for k, v in pairs(uci:get_all("luci", "flash_keep")) do
				if k:byte() ~= 46 then	-- k[1] ~= "."
					nixio.util.consume(nixio.fs.glob(v), call)
				end
			end

			-- Now invoke sysupgrade
			local keepcfg = keep_avail and http.formvalue("keepcfg") == "1"
			local fd = io.popen("/sbin/luci-flash %s %q" %{
				keepcfg and "-k %q" % table.concat(call, " ") or "", tmpfile
			})

			if fd then
				while true do
					local ln = fd:read("*l")
					if not ln then break end
					http.write(ln .. "\n")
				end
				fd:close()
			end

			-- Make sure the device is rebooted
			if nixio.fork() == 0 then
				nixio.nanosleep(1)
				nixio.execp("reboot")
				os.exit(1)
			end
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
			
		tpl.render("niu/system/upgrade", {
			step=1,
			bad_image=(has_image and not has_support or false),
			keepavail=keep_avail,
			supported=has_platform
		} )

	-- Step 2: present uploaded file, show checksum, confirmation
	elseif step == 2 then
		tpl.render("niu/system/upgrade", {
			step=2,
			checksum=image_checksum(),
			filesize=nixio.fs.stat(tmpfile).size,
			flashsize=storage_size(),
			keepconfig=(keep_avail and http.formvalue("keepcfg") == "1")
		} )
	
	-- Step 3: load iframe which calls the actual flash procedure
	elseif step == 3 then
		tpl.render("niu/system/upgrade", {
			step=3,
			keepconfig=(keep_avail and http.formvalue("keepcfg") == "1")
		} )
	end	
end
