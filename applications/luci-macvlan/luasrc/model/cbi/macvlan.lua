--[[
--macvlan configuration page. Made by 981213
--
]]--

local fs = require "nixio.fs"

local cmd = "mwan3 status | grep -c \"is online (tracking active)\""
local shellpipe = io.popen(cmd,"r")
local ifnum = shellpipe:read("*a")
shellpipe:close()


m = Map("macvlan", translate("Create virtual WAN interfaces"),
        translatef("Here you can create some virtual WAN interfaces with MACVLAN driver.Set wan metric first!<br />Connected interface count: ")..ifnum)

s = m:section(TypedSection, "macvlan", translate(" "))
s.anonymous = true

switch = s:option(Flag, "enabled", translate("Enable"))
switch.rmempty = false

wannum = s:option(Value, "wannum", translate("Number of virtual WAN"))
wannum.datatype = "range(0,20)"
wannum.optional = false

wansw = s:option(Flag, "wansw", translate("Use WAN to diag"), translate("Uncheck this if you use a VLAN interface."))
wansw.rmempty = false

diagchk = s:option(Flag, "diagchk", translate("Enable auto reconnect"))
diagchk.rmempty = false

diagnum = s:option(Value, "diagnum", translate("Minimnum connected interface"),translate("Rediag if the number of connected interfaces is less then this."))
diagnum.datatype = "range(0,20)"
diagnum.optional = false


o = s:option(DummyValue, "_rediag", translate("rediag"))
o.template = "macvlan/macvlan_rediag"
o.width    = "10%"

local apply = luci.http.formvalue("cbi.apply")
if apply then
	os.execute('/bin/genwancfg &')
end

return m


