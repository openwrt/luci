--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>
Copyright 2008 Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--
f = SimpleForm("password", translate("a_s_changepw"), translate("a_s_changepw1"))

pw1 = f:field(Value, "pw1", translate("password"))
pw1.password = true

pw2 = f:field(Value, "pw2", translate("confirmation"))
pw2.password = true

function pw2.validate(self, value, section)
	return pw1:formvalue(section) == value and value
end

function f.handle(self, state, data)
	if state == FORM_VALID then
		local stat = luci.sys.user.setpasswd("root", data.pw1) == 0
		
		if stat then
			f.message = translate("a_s_changepw_changed")
		else
			f.errmessage = translate("unknownerror")
		end
		
		data.pw1 = nil
		data.pw2 = nil
	end
	return true
end

return f