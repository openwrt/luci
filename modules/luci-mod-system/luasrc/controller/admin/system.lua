-- Copyright 2008 Steven Barth <steven@midlink.org>
-- Copyright 2008-2011 Jo-Philipp Wich <jow@openwrt.org>
-- Licensed to the public under the Apache License 2.0.

module("luci.controller.admin.system", package.seeall)

function index()
	local fs = require "nixio.fs"

	entry({"admin", "system", "system"}, cbi("admin_system/system"), _("System"), 1)
	entry({"admin", "system", "clock_status"}, post_on({ set = true }, "action_clock_status"))
	entry({"admin", "system", "ntp_restart"}, call("action_ntp_restart"), nil).leaf = true

	entry({"admin", "system", "admin"}, firstchild(), _("Administration"), 2)
	entry({"admin", "system", "admin", "password"}, template("admin_system/password"), _("Router Password"), 1)
	entry({"admin", "system", "admin", "password", "json"}, post("action_password"))

	if fs.access("/etc/config/dropbear") then
		entry({"admin", "system", "admin", "dropbear"}, cbi("admin_system/dropbear"), _("SSH Access"), 2)
		entry({"admin", "system", "admin", "sshkeys"}, template("admin_system/sshkeys"), _("SSH-Keys"), 3)
		entry({"admin", "system", "admin", "sshkeys", "json"}, post_on({ keys = true }, "action_sshkeys"))
	end

	entry({"admin", "system", "startup"}, form("admin_system/startup"), _("Startup"), 45)
	entry({"admin", "system", "crontab"}, form("admin_system/crontab"), _("Scheduled Tasks"), 46)

	if fs.access("/sbin/block") and fs.access("/etc/config/fstab") then
		entry({"admin", "system", "fstab"}, cbi("admin_system/fstab"), _("Mount Points"), 50)
		entry({"admin", "system", "fstab", "mount"}, cbi("admin_system/fstab/mount"), nil).leaf = true
		entry({"admin", "system", "fstab", "swap"},  cbi("admin_system/fstab/swap"),  nil).leaf = true
	end

	local nodes, number = fs.glob("/sys/class/leds/*")
	if number > 0 then
		entry({"admin", "system", "leds"}, cbi("admin_system/leds"), _("<abbr title=\"Light Emitting Diode\">LED</abbr> Configuration"), 60)
	end

	entry({"admin", "system", "flashops"}, call("action_flashops"), _("Backup / Flash Firmware"), 70)
	entry({"admin", "system", "flashops", "reset"}, post("action_reset"))
	entry({"admin", "system", "flashops", "backup"}, post("action_backup"))
	entry({"admin", "system", "flashops", "backupmtdblock"}, post("action_backupmtdblock"))
	entry({"admin", "system", "flashops", "backupfiles"}, form("admin_system/backupfiles"))

	-- call() instead of post() due to upload handling!
	entry({"admin", "system", "flashops", "restore"}, call("action_restore"))
	entry({"admin", "system", "flashops", "sysupgrade"}, call("action_sysupgrade"))

	entry({"admin", "system", "reboot"}, template("admin_system/reboot"), _("Reboot"), 90)
	entry({"admin", "system", "reboot", "call"}, post("action_reboot"))
end

function action_clock_status()
	local set = tonumber(luci.http.formvalue("set"))
	if set ~= nil and set > 0 then
		local date = os.date("*t", set)
		if date then
			luci.sys.call("date -s '%04d-%02d-%02d %02d:%02d:%02d'" %{
				date.year, date.month, date.day, date.hour, date.min, date.sec
			})
			luci.sys.call("/etc/init.d/sysfixtime restart")
		end
	end

	luci.http.prepare_content("application/json")
	luci.http.write_json({ timestring = os.date("%c") })
end

function action_ntp_restart()
	if nixio.fs.access("/etc/init.d/sysntpd") then
		os.execute("/etc/init.d/sysntpd restart")
	end
	luci.http.prepare_content("text/plain")
	luci.http.write("0")
end

local function image_supported(image)
	return (os.execute("sysupgrade -T %q >/dev/null" % image) == 0)
end

local function image_checksum(image)
	return (luci.sys.exec("md5sum %q" % image):match("^([^%s]+)"))
end

local function image_sha256_checksum(image)
	return (luci.sys.exec("sha256sum %q" % image):match("^([^%s]+)"))
end

local function supports_sysupgrade()
	return nixio.fs.access("/lib/upgrade/platform.sh")
end

local function supports_reset()
	return (os.execute([[grep -sq "^overlayfs:/overlay / overlay " /proc/mounts]]) == 0)
end

local function storage_size()
	local size = 0
	if nixio.fs.access("/proc/mtd") then
		for l in io.lines("/proc/mtd") do
			local d, s, e, n = l:match('^([^%s]+)%s+([^%s]+)%s+([^%s]+)%s+"([^%s]+)"')
			if n == "linux" or n == "firmware" then
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


function action_flashops()
	--
	-- Overview
	--
	luci.template.render("admin_system/flashops", {
		reset_avail   = supports_reset(),
		upgrade_avail = supports_sysupgrade()
	})
end

function action_sysupgrade()
	local fs = require "nixio.fs"
	local http = require "luci.http"
	local image_tmp = "/tmp/firmware.img"

	local fp
	http.setfilehandler(
		function(meta, chunk, eof)
			if not fp and meta and meta.name == "image" then
				fp = io.open(image_tmp, "w")
			end
			if fp and chunk then
				fp:write(chunk)
			end
			if fp and eof then
				fp:close()
			end
		end
	)

	if not luci.dispatcher.test_post_security() then
		fs.unlink(image_tmp)
		return
	end

	--
	-- Cancel firmware flash
	--
	if http.formvalue("cancel") then
		fs.unlink(image_tmp)
		http.redirect(luci.dispatcher.build_url('admin/system/flashops'))
		return
	end

	--
	-- Initiate firmware flash
	--
	local step = tonumber(http.formvalue("step")) or 1
	if step == 1 then
		local force = http.formvalue("force")
		if image_supported(image_tmp) or force then
			luci.template.render("admin_system/upgrade", {
				checksum = image_checksum(image_tmp),
				sha256ch = image_sha256_checksum(image_tmp),
				storage  = storage_size(),
				size     = (fs.stat(image_tmp, "size") or 0),
				keep     = (not not http.formvalue("keep")),
				force    = (not not http.formvalue("force"))
			})
		else
			fs.unlink(image_tmp)
			luci.template.render("admin_system/flashops", {
				reset_avail   = supports_reset(),
				upgrade_avail = supports_sysupgrade(),
				image_invalid = true
			})
		end

	--
	-- Start sysupgrade flash
	--
	elseif step == 2 then
		local keep = (http.formvalue("keep") == "1") and "" or "-n"
		local force = (http.formvalue("force") == "1") and "-F" or ""
		luci.template.render("admin_system/applyreboot", {
			title = luci.i18n.translate("Flashing..."),
			msg   = luci.i18n.translate("The system is flashing now.<br /> DO NOT POWER OFF THE DEVICE!<br /> Wait a few minutes before you try to reconnect. It might be necessary to renew the address of your computer to reach the device again, depending on your settings."),
			addr  = (#keep > 0) and (#force > 0) and "192.168.1.1" or nil
		})
		luci.sys.process.exec({ "/bin/sh", "-c","sleep 1; killall dropbear uhttpd; sleep 1; /sbin/sysupgrade %s %s %q" %{ keep, force, image_tmp } }, nil, nil, true)
	end
end

function action_backup()
	luci.http.header('Content-Disposition', 'attachment; filename="backup-%s-%s.tar.gz"'
		%{ luci.sys.hostname(), os.date("%Y-%m-%d") })

	luci.http.prepare_content("application/x-targz")
	luci.sys.process.exec({ "/sbin/sysupgrade", "--create-backup", "-" }, luci.http.write)
end

function action_backupmtdblock()
	local mv = luci.http.formvalue("mtdblockname") or ""
	local m, n = mv:match('^([^%s%./"]+)/%d+/(%d+)$')

	if not m and n then
		luci.http.status(400, "Bad Request")
		return
	end

	luci.http.header('Content-Disposition', 'attachment; filename="backup-%s-%s-%s.bin"'
		%{ luci.sys.hostname(), m, os.date("%Y-%m-%d") })

	luci.http.prepare_content("application/octet-stream")
	luci.sys.process.exec({ "/bin/dd", "if=/dev/mtd%s" % n, "conv=fsync,notrunc" }, luci.http.write)
end

function action_restore()
	local fs = require "nixio.fs"
	local http = require "luci.http"
	local archive_tmp = "/tmp/restore.tar.gz"

	local fp
	http.setfilehandler(
		function(meta, chunk, eof)
			if not fp and meta and meta.name == "archive" then
				fp = io.open(archive_tmp, "w")
			end
			if fp and chunk then
				fp:write(chunk)
			end
			if fp and eof then
				fp:close()
			end
		end
	)

	if not luci.dispatcher.test_post_security() then
		fs.unlink(archive_tmp)
		return
	end

	local upload = http.formvalue("archive")
	if upload and #upload > 0 then
		if os.execute("gunzip -t %q >/dev/null 2>&1" % archive_tmp) == 0 then
			luci.template.render("admin_system/applyreboot")
			os.execute("tar -C / -xzf %q >/dev/null 2>&1" % archive_tmp)
			luci.sys.reboot()
		else
			luci.template.render("admin_system/flashops", {
				reset_avail   = supports_reset(),
				upgrade_avail = supports_sysupgrade(),
				backup_invalid = true
			})
		end
		return
	end

	http.redirect(luci.dispatcher.build_url('admin/system/flashops'))
end

function action_reset()
	if supports_reset() then
		luci.template.render("admin_system/applyreboot", {
			title = luci.i18n.translate("Erasing..."),
			msg   = luci.i18n.translate("The system is erasing the configuration partition now and will reboot itself when finished."),
			addr  = "192.168.1.1"
		})

		luci.sys.process.exec({ "/bin/sh", "-c", "sleep 1; killall dropbear uhttpd; sleep 1; jffs2reset -y && reboot" }, nil, nil, true)
		return
	end

	http.redirect(luci.dispatcher.build_url('admin/system/flashops'))
end

function action_password()
	local password = luci.http.formvalue("password")
	if not password then
		luci.http.status(400, "Bad Request")
		return
	end

	luci.http.prepare_content("application/json")
	luci.http.write_json({ code = luci.sys.user.setpasswd("root", password) })
end

function action_sshkeys()
	local keys = luci.http.formvalue("keys")
	if keys then
		keys = luci.jsonc.parse(keys)
		if not keys or type(keys) ~= "table" then
			luci.http.status(400, "Bad Request")
			return
		end

		local fd, err = io.open("/etc/dropbear/authorized_keys", "w")
		if not fd then
			luci.http.status(503, err)
			return
		end

		local _, k
		for _, k in ipairs(keys) do
			if type(k) == "string" and k:match("^%w+%-") then
				fd:write(k)
				fd:write("\n")
			end
		end

		fd:close()
	end

	local fd, err = io.open("/etc/dropbear/authorized_keys", "r")
	if not fd then
		luci.http.status(503, err)
		return
	end

	local rv = {}
	while true do
		local ln = fd:read("*l")
		if not ln then
			break
		elseif ln:match("^[%w%-]+%s+[A-Za-z0-9+/=]+$") or
		       ln:match("^[%w%-]+%s+[A-Za-z0-9+/=]+%s")
		then
			rv[#rv+1] = ln
		end
	end

	fd:close()

	luci.http.prepare_content("application/json")
	luci.http.write_json(rv)
end

function action_reboot()
	luci.sys.reboot()
end
