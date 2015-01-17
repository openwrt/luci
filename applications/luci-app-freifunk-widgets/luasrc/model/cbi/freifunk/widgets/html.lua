-- Copyright 2012 Manuel Munz <freifunk at somakoma dot de>
-- Licensed to the public under the Apache License 2.0.

local map, section = ...
local utl = require "luci.util"
local fs = require "nixio.fs"
local file = "/usr/share/customtext/" .. arg[1] .. ".html"

local form, ferr = loadfile(utl.libpath() .. "/model/cbi/freifunk/widgets/heightwidth.lua")
if form then
	setfenv(form, getfenv(1))(m, wdg)
end

t = wdg:option(TextValue, "_text")
t.rmempty = true
t.rows = 20


function t.cfgvalue()
        return fs.readfile(file) or ""
end

function t.write(self, section, value)
        return fs.writefile(file, value)
end

function t.remove(self, section)
        return fs.unlink(file)
end


