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
local ipkgfile = "/etc/opkg.conf" 

f = SimpleForm("ipkgconf", translate("a_s_p_ipkg"))

t = f:field(TextValue, "lines")
t.rows = 10
function t.cfgvalue()
	return luci.fs.readfile(ipkgfile) or ""
end

f:append(Template("admin_system/ipkg"))

function f.handle(self, state, data)
	if state == FORM_VALID then
		if (luci.fs.readfile(ipkgfile) or "") ~= data.lines then
			luci.fs.writefile(ipkgfile, data.lines)
		end
	end
	return true
end

return f
