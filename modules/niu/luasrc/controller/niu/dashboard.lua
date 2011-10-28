--[[
LuCI - Lua Development Framework

Copyright 2009 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--

local req = require
module "luci.controller.niu.dashboard"

function index()
	local uci = require "luci.model.uci"

	local root = node()
	if not root.lock then
		root.target = alias("niu")
		root.index = true
	end

	entry({"niu"}, alias("niu", "dashboard"), "NIU", 10)
	entry({"niu", "dashboard"}, call("dashboard"), "Dashboard", 1).css = 
	"niu.css"
end

local require = req

function dashboard()
	local dsp = require "luci.dispatcher"
	local tpl = require "luci.template"
	local utl = require "luci.util"
	local uci = require "luci.model.uci"

	local nds = dsp.node("niu").nodes
	tpl.render("niu/dashboard", {utl = utl, nodes = nds, dsp = dsp, tpl = tpl}) 
end
