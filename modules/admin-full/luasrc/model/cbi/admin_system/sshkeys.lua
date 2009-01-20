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
local keyfile = "/etc/dropbear/authorized_keys" 

f = SimpleForm("sshkeys", translate("a_s_sshkeys"), translate("a_s_sshkeys1"))

t = f:field(TextValue, "keys")
t.rmempty = true
t.rows = 10
function t.cfgvalue()
	return luci.fs.readfile(keyfile) or ""
end

function f.handle(self, state, data)
	if state == FORM_VALID then
		if data.keys then
			luci.fs.writefile(keyfile, data.keys:gsub("\r\n", "\n"))
		end
	end
	return true
end

return f
