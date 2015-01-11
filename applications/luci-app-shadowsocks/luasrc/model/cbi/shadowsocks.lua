--[[
--Shadowsocks Client configuration page. Made by 981213
--
]]--

local fs = require "nixio.fs"

m = Map("shadowsocks", translate("Shadowsocks Client"),
        translatef("A fast tunnel proxy that help you get through firewalls.<br />Here you can setup a Shadowsocks Client on your router, and you should have a remote server."))

s = m:section(TypedSection, "shadowsocks", translate("Settings"))
s.anonymous = true

switch = s:option(Flag, "enabled", translate("Enable"))
switch.rmempty = false

server = s:option(Value, "server", translate("Server Address"))
server.optional = false

server_port = s:option(Value, "server_port", translate("Server Port"))
server_port.datatype = "range(0,65535)"
server_port.optional = false

local_port = s:option(Value, "local_port", translate("Local Port"))
local_port.datatype = "range(0,65535)"
local_port.optional = false

timeout = s:option(Value, "timeout", translate("Timeout"))
timeout.optional = false

password = s:option(Value, "password", translate("Password"))
password.password = true

cipher = s:option(ListValue, "method", translate("Cipher Method"))
cipher:value("table")
cipher:value("rc4")
cipher:value("rc4-md5")
cipher:value("aes-128-cfb")
cipher:value("aes-192-cfb")
cipher:value("aes-256-cfb")
cipher:value("bf-cfb")
cipher:value("cast5-cfb")
cipher:value("des-cfb")
cipher:value("camellia-128-cfb")
cipher:value("camellia-192-cfb")
cipher:value("camellia-256-cfb")
cipher:value("idea-cfb")
cipher:value("rc2-cfb")
cipher:value("seed-cfb")


--[[
local apply = luci.http.formvalue("cbi.apply")
if apply then
	os.execute("/etc/init.d/shadowsocks restart &")
end
]]--
return m


