--[[
LuCI - Lua Configuration Interface

Copyright 2012 Manuel Munz <freifunk at somakoma dot de>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0
]]--

local uci = require "luci.model.uci".cursor()
local fs = require "luci.fs"
local utl = require "luci.util"
m = Map("freifunk-widgets", translate("Widgets"),
        translate("Configure installed widgets."))

wdg = m:section(TypedSection, "widget", translate("Widgets"))
wdg.addremove = true
wdg.extedit   = luci.dispatcher.build_url("admin/freifunk/widgets/widget/%s")
wdg.template  = "cbi/tblsection"
wdg.sortable  = true

--[[
function wdg.create(...)
	local sid = TypedSection.create(...)
	luci.http.redirect(wdg.extedit % sid)
end
]]--

local en = wdg:option(Flag, "enabled", translate("Enable"))
en.rmempty = false
--en.default = "0"
function en.cfgvalue(self, section)
	return Flag.cfgvalue(self, section) or "0"
end

local tmpl = wdg:option(ListValue, "template", translate("Template"))
for k, v in ipairs(fs.dir('/usr/lib/lua/luci/view/freifunk/widgets/')) do
	if v ~= "." and v ~= ".." then
		tmpl:value(v)
	end
end

local title = wdg:option(Value, "title", translate("Title"))
title.rmempty = true

local width = wdg:option(Value, "width", translate("Width"))
width.rmempty = true

local height = wdg:option(Value, "height", translate("Height"))
height.rmempty = true

local pr = wdg:option(Value, "paddingright", translate("Padding right"))
pr.rmempty = true

function m.on_commit(self)
	-- clean custom text files whose config has been deleted
	local dir = "/usr/share/customtext/"
	local active = {}
	uci:foreach("freifunk-widgets", "widget", function(s)
		if s["template"] == "html" then
			table.insert(active, s[".name"])
		end
	end )
	for k, v in ipairs(fs.dir(dir)) do
		filename = string.gsub(v, ".html", "")
		if not utl.contains(active, filename) then
			fs.unlink(dir .. v)
		end
	end
end

return m
