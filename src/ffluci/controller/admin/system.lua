module("ffluci.controller.admin.system", package.seeall)

require("ffluci.util")
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
		cm = "(echo '"..p1.."';sleep 1;echo '"..p2.."') | passwd root 2>&1"
		msg = ffluci.util.exec(cm)
	end
	
	ffluci.template.render("admin_system/passwd", {msg=msg})
end