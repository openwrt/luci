module("ffluci.controller.admin.system", package.seeall)

require("ffluci.sys")
require("ffluci.http")

menu = {
	descr   = "System",
	order   = 20,
	entries = {
		{action = "passwd", descr = "Passwort"},
	}
}

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