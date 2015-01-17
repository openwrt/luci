-- Copyright 2012 Manuel Munz <freifunk at somakoma dot de>
-- Licensed to the public under the Apache License 2.0.

local uci = require "luci.model.uci".cursor()
local fs = require "nixio.fs"
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
local file
for file in fs.dir("/usr/lib/lua/luci/view/freifunk/widgets/") do
	if file ~= "." and file ~= ".." then
		tmpl:value(file)
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
	local file
	for file in fs.dir(dir) do
		local filename = string.gsub(file, ".html", "")
		if not utl.contains(active, filename) then
			fs.unlink(dir .. file)
		end
	end
end

return m
