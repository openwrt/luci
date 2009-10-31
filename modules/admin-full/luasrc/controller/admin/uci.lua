--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--
module("luci.controller.admin.uci", package.seeall)

function index()
	local i18n = luci.i18n.translate
	local redir = luci.http.formvalue("redir", true) or 
	  luci.dispatcher.build_url(unpack(luci.dispatcher.context.request))
	
	entry({"admin", "uci"}, nil, i18n("Configuration"))
	entry({"admin", "uci", "changes"}, call("action_changes"), i18n("Changes"), 40).query = {redir=redir}
	entry({"admin", "uci", "revert"}, call("action_revert"), i18n("Revert"), 30).query = {redir=redir}
	entry({"admin", "uci", "apply"}, call("action_apply"), i18n("Apply"), 20).query = {redir=redir}
	entry({"admin", "uci", "saveapply"}, call("action_apply"), i18n("Save & Apply"), 10).query = {redir=redir}
end

function convert_changes(changes)
	local util = require "luci.util"
	
	local ret
	for r, tbl in pairs(changes) do
		for s, os in pairs(tbl) do
			for o, v in pairs(os) do
				ret = (ret and ret.."\n" or "") .. "%s%s.%s%s%s" % {
					v == "" and "-" or "",
					r,
					s,
					o ~= ".type" and "."..o or "",
					v ~= "" and "="..util.pcdata(v) or ""
				}
			end
		end
	end
	return ret
end

function action_changes()
	local changes = convert_changes(luci.model.uci.cursor():changes())
	luci.template.render("admin_uci/changes", {changes=changes})
end

function action_apply()
	local path = luci.dispatcher.context.path
	local uci = luci.model.uci.cursor()
	local changes = uci:changes()
	local reload = {}

	-- Collect files to be applied and commit changes
	for r, tbl in pairs(changes) do
		table.insert(reload, r)
		if path[#path] ~= "apply" then
			uci:load(r)
			uci:commit(r)
			uci:unload(r)
		end
	end
	
	local function _reload()
		local cmd = uci:apply(reload, true)
		return io.popen(cmd)
	end
	
	luci.template.render("admin_uci/apply", {changes=convert_changes(changes), reload=_reload})
end


function action_revert()
	local uci = luci.model.uci.cursor()
	local changes = uci:changes()

	-- Collect files to be reverted
	for r, tbl in pairs(changes) do
		uci:load(r)
		uci:revert(r)
		uci:unload(r)
	end
	
	luci.template.render("admin_uci/revert", {changes=convert_changes(changes)})
end
