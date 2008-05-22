module("ffluci.controller.admin.uci", package.seeall)
require("ffluci.util")
require("ffluci.sys")

function index()
	node("admin", "uci", "changes").target = template("admin_uci/changes")
	node("admin", "uci", "revert").target  = action_revert
	node("admin", "uci", "apply").target   = action_apply
end

-- This function has a higher priority than the admin_uci/apply template
function action_apply()
	local changes = ffluci.model.uci.changes()
	local output  = ""
	
	if changes then
		local com = {}
		local run = {}
		
		-- Collect files to be applied and commit changes
		for i, line in ipairs(ffluci.util.split(changes)) do
			local r = line:match("^-?([^.]+)")
			if r then
				com[r] = true
				
				if ffluci.config.uci_oncommit and ffluci.config.uci_oncommit[r] then
					run[ffluci.config.uci_oncommit[r]] = true
				end
			end
		end
		
		-- Apply
		for config, i in pairs(com) do
			ffluci.model.uci.commit(config)
		end 
		
		-- Search for post-commit commands
		for cmd, i in pairs(run) do
			output = output .. cmd .. ":" .. ffluci.sys.exec(cmd) .. "\n"
		end
	end
	
	ffluci.template.render("admin_uci/apply", {changes=changes, output=output})
end


function action_revert()
	local changes = ffluci.model.uci.changes()
	if changes then
		local revert = {}
		
		-- Collect files to be reverted
		for i, line in ipairs(ffluci.util.split(changes)) do
			local r = line:match("^-?([^.]+)")
			if r then
				revert[r] = true
			end
		end
		
		-- Revert them
		for k, v in pairs(revert) do
			ffluci.model.uci.revert(k)
		end
	end
	
	ffluci.template.render("admin_uci/revert", {changes=changes})
end