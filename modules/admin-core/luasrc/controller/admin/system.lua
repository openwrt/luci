module("luci.controller.admin.system", package.seeall)

require("luci.sys")
require("luci.http")
require("luci.util")
require("luci.fs")
require("luci.model.ipkg")
require("luci.model.uci")

function index()
	entry({"admin", "system"}, template("admin_system/index"), "System", 30)
	entry({"admin", "system", "packages"}, call("action_packages"), "Paketverwaltung", 10)
	entry({"admin", "system", "packages", "ipkg"}, call("action_ipkg"), "IPKG-Konfiguration")
	entry({"admin", "system", "passwd"}, call("action_passwd"), "Passwort ändern", 20)
	entry({"admin", "system", "sshkeys"}, call("action_sshkeys"), "SSH-Schlüssel", 30)
	entry({"admin", "system", "hostname"}, cbi("admin_system/hostname"), "Hostname", 40)
	entry({"admin", "system", "fstab"}, cbi("admin_system/fstab"), "Einhängepunkte", 50)
	entry({"admin", "system", "upgrade"}, call("action_upgrade"), "Firmwareupgrade", 60)
	entry({"admin", "system", "reboot"}, call("action_reboot"), "Neu starten", 70)
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
	local ipkg = luci.model.ipkg
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
	local ret  = nil
	local plat = luci.fs.mtime("/lib/upgrade/platform.sh")
	
	local image   = luci.http.upload("image")
	local keepcfg = luci.http.formvalue("keepcfg")
	
	if plat and image then
		local kpattern = nil
		if keepcfg then
			local files = luci.model.uci.sections("luci").flash_keep
			if files.luci and files.luci.flash_keep then
				kpattern = ""
				for k,v in pairs(files.luci.flash_keep) do
					kpattern = kpattern .. " " ..  v
				end
			end
		end
		ret = luci.sys.flash(image, kpattern)
	end
	
	luci.template.render("admin_system/upgrade", {sysupgrade=plat, ret=ret})
end