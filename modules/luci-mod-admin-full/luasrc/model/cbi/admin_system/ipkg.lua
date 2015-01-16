-- Copyright 2008 Steven Barth <steven@midlink.org>
-- Copyright 2008-2011 Jo-Philipp Wich <jow@openwrt.org>
-- Licensed to the public under the Apache License 2.0.

local ipkgfile = "/etc/opkg.conf"

f = SimpleForm("ipkgconf", translate("OPKG-Configuration"))

f:append(Template("admin_system/ipkg"))

t = f:field(TextValue, "lines")
t.rows = 10
function t.cfgvalue()
	return nixio.fs.readfile(ipkgfile) or ""
end

function t.write(self, section, data)
	return nixio.fs.writefile(ipkgfile, data:gsub("\r\n", "\n"))
end

function f.handle(self, state, data)
	return true
end

return f
