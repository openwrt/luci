module("ffluci.controller.admin.system", package.seeall)

require("ffluci.sys")
require("ffluci.http")
require("ffluci.util")
require("ffluci.fs")

menu = {
	descr   = "System",
	order   = 20,
	entries = {
		{action = "passwd", descr = "Passwort"},
	}
}

function action_editor()
	local file = ffluci.http.formvalue("file")
	local data = ffluci.http.formvalue("data")
	local err  = nil
	local msg  = nil
	local stat = nil
	
	if file and data then
		stat, err = pcall(ffluci.fs.writefile, file, data)
	end
	
	if not stat then
		err = ffluci.util.split(err, " ")
		table.remove(err, 1)
		msg = table.concat(err, " ")
	end
	
	local stat, cnt = pcall(ffluci.fs.readfile, fname)
	if stat and cnt then
		cnt = ffluci.util.pcdata(cnt)
	else
		cnt = nil
	end
	ffluci.template.render("admin_system/editor", {fn=file, cnt=cnt, msg=msg})	
end

function action_passwd()
	local p1 = ffluci.http.formvalue("pwd1")
	local p2 = ffluci.http.formvalue("pwd2")
	local msg = nil
	local cm
	
	if p1 or p2 then
		msg = ffluci.sys.user.setpasswd("root", p1, p2)
	end
	
	ffluci.template.render("admin_system/passwd", {msg=msg})
end