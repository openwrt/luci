-- Copyright 2012 Manuel Munz <freifunk at somakoma dot de>
-- Licensed to the public under the Apache License 2.0.

local map, section = ...
local utl = require "luci.util"

local form, ferr = loadfile(utl.libpath() .. "/model/cbi/freifunk/widgets/heightwidth.lua")
if form then
	setfenv(form, getfenv(1))(m, wdg)
end

local url = wdg:option(Value, "url", translate("URL"))
url.default = "http://www.freifunk.net"
