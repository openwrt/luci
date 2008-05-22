module("ffluci.controller.admin.system", package.seeall)

require("ffluci.sys")
require("ffluci.http")
require("ffluci.util")
require("ffluci.fs")
require("ffluci.model.ipkg")
require("ffluci.model.uci")

function index()
	local page  = node("admin", "system")
	page.target = template("admin_system/index")
	page.title  = "System"  
	page.order  = 30
	
	local page  = node("admin", "system", "packages")
	page.target = action_packages
	page.title  = "Paketverwaltung"
	page.order  = 10
	
	local page  = node("admin", "system", "packages", "ipkg")
	page.target = action_ipkg
	page.title  = "IPKG-Konfiguration"
	
	local page  = node("admin", "system", "passwd")
	page.target = action_passwd
	page.title  = "Passwort ändern"
	page.order  = 20
	
	local page  = node("admin", "system", "sshkeys")
	page.target = action_sshkeys
	page.title  = "SSH-Schlüssel"
	page.order  = 30
	
	local page  = node("admin", "system", "hostname")
	page.target = cbi("admin_system/hostname")
	page.title  = "Hostname"
	page.order  = 40
	
	local page  = node("admin", "system", "fstab")
	page.target = cbi("admin_system/fstab")
	page.title  = "Einhängepunkte"
	page.order  = 50
	
	local page  = node("admin", "system", "upgrade")
	page.target = action_upgrade
	page.title  = "Firmwareupgrade"
	page.order  = 60
	
	local page  = node("admin", "system", "reboot")
	page.target = action_reboot
	page.title  = "Neu starten"
	page.order  = 70
end

function action_editor()
	local file = ffluci.http.formvalue("file", "")
	local data = ffluci.http.formvalue("data")
	local err  = nil
	local msg  = nil
	local stat = true
	
	if file and data then
		stat, err = ffluci.fs.writefile(file, data)
	end
	
	if not stat then
		err = ffluci.util.split(err, " ")
		table.remove(err, 1)
		msg = table.concat(err, " ")
	end
	
	local cnt, err = ffluci.fs.readfile(file)
	if cnt then
		cnt = ffluci.util.pcdata(cnt)
	end
	ffluci.template.render("admin_system/editor", {fn=file, cnt=cnt, msg=msg})	
end

function action_ipkg()
	local file = "/etc/ipkg.conf"
	local data = ffluci.http.formvalue("data")
	local stat = nil
	local err  = nil
	
	if data then
		stat, err = ffluci.fs.writefile(file, data)
	end	
	
	local cnt  = ffluci.fs.readfile(file)	
	if cnt then
		cnt = ffluci.util.pcdata(cnt)
	end
	
	ffluci.template.render("admin_system/ipkg", {cnt=cnt, msg=err})	
end

function action_packages()
	local ipkg = ffluci.model.ipkg
	local void = nil
	local submit = ffluci.http.formvalue("submit")
	
	
	-- Search query
	local query = ffluci.http.formvalue("query")
	query = (query ~= '') and query or nil
	
	
	-- Packets to be installed
	local install = submit and ffluci.http.formvaluetable("install")
	
	-- Install from URL
	local url = ffluci.http.formvalue("url")
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
	local remove = submit and ffluci.http.formvaluetable("remove")
	if remove then	
		for k, v in pairs(remove) do
			void, remove[k] = ipkg.remove(k)
		end	
	end
	
	
	-- Update all packets
	local update = ffluci.http.formvalue("update")
	if update then
		void, update = ipkg.update()
	end
	
	
	-- Upgrade all packets
	local upgrade = ffluci.http.formvalue("upgrade")
	if upgrade then
		void, upgrade = ipkg.upgrade()
	end
	
	
	-- Package info
	local info = ffluci.model.ipkg.info(query)
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
	
	ffluci.template.render("admin_system/packages", {pkgs=pkgs, query=query,
	 install=install, remove=remove, update=update, upgrade=upgrade})	
end

function action_passwd()
	local p1 = ffluci.http.formvalue("pwd1")
	local p2 = ffluci.http.formvalue("pwd2")
	local stat = nil
	
	if p1 or p2 then
		if p1 == p2 then
			stat = ffluci.sys.user.setpasswd("root", p1)
		else
			stat = 10
		end
	end
	
	ffluci.template.render("admin_system/passwd", {stat=stat})
end

function action_reboot()
	local reboot = ffluci.http.formvalue("reboot")
	ffluci.template.render("admin_system/reboot", {reboot=reboot})
	if reboot then
		ffluci.sys.reboot()
	end
end

function action_sshkeys()
	local file = "/etc/dropbear/authorized_keys"
	local data = ffluci.http.formvalue("data")
	local stat = nil
	local err  = nil
	
	if data then
		stat, err = ffluci.fs.writefile(file, data)
	end	
	
	local cnt  = ffluci.fs.readfile(file)	
	if cnt then
		cnt = ffluci.util.pcdata(cnt)
	end
	
	ffluci.template.render("admin_system/sshkeys", {cnt=cnt, msg=err})	
end

function action_upgrade()
	local ret  = nil
	local plat = ffluci.fs.mtime("/lib/upgrade/platform.sh")
	
	local image   = ffluci.http.upload("image")
	local keepcfg = ffluci.http.formvalue("keepcfg")
	
	if plat and image then
		local kpattern = nil
		if keepcfg then
			local files = ffluci.model.uci.sections("luci").flash_keep
			if files.luci and files.luci.flash_keep then
				kpattern = ""
				for k,v in pairs(files.luci.flash_keep) do
					kpattern = kpattern .. " " ..  v
				end
			end
		end
		ret = ffluci.sys.flash(image, kpattern)
	end
	
	ffluci.template.render("admin_system/upgrade", {sysupgrade=plat, ret=ret})
end