module("ffluci.controller.admin.system", package.seeall)

require("ffluci.sys")
require("ffluci.http")
require("ffluci.util")
require("ffluci.fs")

menu = {
	descr   = "System",
	order   = 20,
	entries = {
		{action = "passwd", descr = "Passwort ändern"},
		{action = "sshkeys", descr = "SSH-Schlüssel"},
		{action = "reboot", descr = "Neu starten"},
	}
}

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
	ffluci.template.render("admin_system/reboot")
	ffluci.sys.reboot()
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