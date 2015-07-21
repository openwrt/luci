--[[
Sync Dial Luci configuration page.
Copyright (C) 2015 GuoGuo <gch981213@gmail.com>
]]--

local fs = require "nixio.fs"

local cmd = "mwan3 status | grep -c \"is online (tracking active)\""
local shellpipe = io.popen(cmd,"r")
local ifnum = shellpipe:read("*a")
shellpipe:close()


m = Map("syncdial", translate("创建虚拟WAN接口"),
        translatef("使用macvlan驱动创建多个虚拟WAN口。<br />当前在线接口数量：")..ifnum)

s = m:section(TypedSection, "syncdial", translate(" "))
s.anonymous = true

switch = s:option(Flag, "enabled", "启用")
switch.rmempty = false

--s:option(Flag, "force_redial", "强制全部重拨", "如果有接口掉线则强制所有接口下线重拨。").rmempty = false

wannum = s:option(Value, "wannum", "虚拟WAN接口数量")
wannum.datatype = "range(0,4)"
wannum.optional = false

diagchk = s:option(Flag, "dialchk", "启用掉线检测")
diagchk.rmempty = false

diagnum = s:option(Value, "dialnum", "最低在线接口数量", "如果在线接口数量小于这个值则重拨。")
diagnum.datatype = "range(0,5)"
diagnum.optional = false

dialwait = s:option(Value, "dialwait", "重拨等待时间", "重拨时，接口全部下线后下一次拨号前的等待时间。单位：秒 最小值：5秒")
dialwait.datatype = "and(uinteger,min(5))"
dialwait.optional = false

o = s:option(DummyValue, "_redial", "重新并发拨号")
o.template = "syncdial/redial_button"
o.width    = "10%"

return m


