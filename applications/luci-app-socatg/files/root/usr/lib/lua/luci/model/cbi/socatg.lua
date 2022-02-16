local sys = require("luci.sys")

m = Map("socatg", "ipv6端口转发")
m.description = translate('<a href=\"https://github.com/big-tooth/luci-app-socatg\" target=\"_blank\"> GitHub 项目地址 </a>')

s = m:section(TypedSection, "socatg", "")
s.addremove = false
s.anonymous = true

v6port = s:option(Value, "v6port", translate("v6port"))
v4host = s:option(Value, "v4host", translate("v4host"))
v4port = s:option(Value, "v4port", translate("v4port"))

local apply = luci.http.formvalue("cbi.apply")
if apply then
	io.popen("/etc/init.d/socatg restart")
end

return m