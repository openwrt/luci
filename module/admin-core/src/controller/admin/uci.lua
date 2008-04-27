module("ffluci.controller.admin.uci", package.seeall)
require("ffluci.util")
require("ffluci.sys")

-- This function has a higher priority than the admin_uci/apply template
function action_apply()
	local changes = ffluci.model.uci.changes()
	local output  = ""
	
	if changes then
		local apply = {}
		
		-- Collect files to be applied
		for i, line in ipairs(ffluci.util.split(changes)) do
			local r = line:match("^-?([^.]+)")
			if r and not ffluci.util.contains(apply, ffluci.config.uci_oncommit[r]) then
				table.insert(apply, ffluci.config.uci_oncommit[r])
			end
		end
		
		-- Commit changes
		ffluci.model.uci.commit()
		
		-- Search for post-commit commands
		if ffluci.config.uci_oncommit then
			for i, cmd in ipairs(apply) do
				if cmd then
					output = output .. cmd .. ":" .. ffluci.sys.exec(cmd)
				end
			end
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