--[[
LuCI - Lua Configuration Interface

Copyright 2012 Manuel Munz <freifunk at somakoma dot de>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

]]--


local uci = require "luci.model.uci".cursor()
local dsp = require "luci.dispatcher"
local utl = require "luci.util"
local widget = uci:get("freifunk-widgets", arg[1], "template")
local title = uci:get("freifunk-widgets", arg[1], "title") or ""

m = Map("freifunk-widgets", translate("Widget"))
m.redirect = luci.dispatcher.build_url("admin/freifunk/widgets")

if not arg[1] or m.uci:get("freifunk-widgets", arg[1]) ~= "widget" then
	luci.http.redirect(m.redirect)
	return
end

wdg = m:section(NamedSection, arg[1], "widget", translate("Widget") .. " " .. title)
wdg.anonymous = true
wdg.addremove = false

local en = wdg:option(Flag, "enabled", translate("Enable"))
en.rmempty = false

local title = wdg:option(Value, "title", translate("Title"))
title.rmempty = true

local form = loadfile(
	utl.libpath() .. "/model/cbi/freifunk/widgets/%s.lua" % widget
)

if form then
	setfenv(form, getfenv(1))(m, wdg)
end

return m

