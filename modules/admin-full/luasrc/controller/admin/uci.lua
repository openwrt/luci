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
	
	entry({"admin", "uci"}, nil, i18n("config"))
	entry({"admin", "uci", "changes"}, call("action_changes"), i18n("changes"), 40)
	entry({"admin", "uci", "revert"}, call("action_revert"), i18n("revert"), 30)
	entry({"admin", "uci", "apply"}, call("action_apply"), i18n("apply"), 20)
	entry({"admin", "uci", "saveapply"}, call("action_apply"), i18n("saveapply"), 10)
end

function convert_changes(changes)
	local ret = {}
	for r, tbl in pairs(changes) do
		for s, os in pairs(tbl) do
			for o, v in pairs(os) do
				local val, str
				if (v == "") then
					str = "-"
					val = ""
				else
					str = ""
					val = "="..luci.util.pcdata(v)
				end
				str = r.."."..s
				if o ~= ".type" then
					str = str.."."..o
				end
				table.insert(ret, str..val)
			end
		end
	end
	return table.concat(ret, "\n")
end

function action_changes()
	local changes = convert_changes(luci.model.uci.cursor():changes())
	luci.template.render("admin_uci/changes", {changes=changes})
end

function action_apply()
	local path = luci.dispatcher.context.path
	
	local output  = ""
	local uci = luci.model.uci.cursor()
	local changes = uci:changes()
	
	if changes then
		local com = {}
		local run = {}
		
		-- Collect files to be applied and commit changes
		for r, tbl in pairs(changes) do
			if r then
				if path[#path] ~= "apply" then
					uci:load(r)
					uci:commit(r)
					uci:unload(r)
				end
				if luci.config.uci_oncommit and luci.config.uci_oncommit[r] then
					run[luci.config.uci_oncommit[r]] = true
				end
			end
		end
		
		-- Search for post-commit commands
		for cmd, i in pairs(run) do
			output = output .. cmd .. ":" .. luci.util.exec(cmd) .. "\n"
		end
	end
	
	
	luci.template.render("admin_uci/apply", {changes=convert_changes(changes), output=output})
end


function action_revert()
	local uci = luci.model.uci.cursor()
	local changes = uci:changes()
	if changes then
		local revert = {}
		
		-- Collect files to be reverted
		for r, tbl in pairs(changes) do
			uci:load(r)
			uci:revert(r)
			uci:unload(r)
		end
	end
	
	luci.template.render("admin_uci/revert", {changes=convert_changes(changes)})
end
