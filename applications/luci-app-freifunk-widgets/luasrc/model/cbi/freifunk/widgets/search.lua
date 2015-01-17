-- Copyright 2012 Manuel Munz <freifunk at somakoma dot de>
-- Licensed to the public under the Apache License 2.0.

local map, section = ...
local utl = require "luci.util"

local form, ferr = loadfile(utl.libpath() .. "/model/cbi/freifunk/widgets/heightwidth.lua")
if form then
	setfenv(form, getfenv(1))(m, wdg)
end

local engine = wdg:option(DynamicList, "engine", translate("Search Engine"),
	translate("Use the form Name|URL, where URL must be a full URL to the search engine "  ..
		  "including the query GET parameter, e.g. 'Google|http://www.google.de/search?q='")
	)
