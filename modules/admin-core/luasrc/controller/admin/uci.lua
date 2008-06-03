module("luci.controller.admin.uci", package.seeall)
require("luci.util")
require("luci.sys")

function index()
	node("admin", "uci", "changes").target = template("admin_uci/changes")
	node("admin", "uci", "revert").target  = call("action_revert")
	node("admin", "uci", "apply").target   = call("action_apply")
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
					val = "="..v
				end
				str = str.."."..r
				if o ~= ".type" then
					str = str.."."..o
				end
				table.insert(ret, str..val)
			end
		end
	end
end

-- This function has a higher priority than the admin_uci/apply template
function action_apply()
	local changes = luci.model.uci.changes()
	local output  = ""
	
	if changes then
		local com = {}
		local run = {}
		
		-- Collect files to be applied and commit changes
		for r, tbl in pairs(changes) do
			if r then
				com[r] = true
				
				if luci.config.uci_oncommit and luci.config.uci_oncommit[r] then
					run[luci.config.uci_oncommit[r]] = true
				end
			end
		end
		
		-- Apply
		for config, i in pairs(com) do
			luci.model.uci.commit(config)
		end 
		
		-- Search for post-commit commands
		for cmd, i in pairs(run) do
			output = output .. cmd .. ":" .. luci.sys.exec(cmd) .. "\n"
		end
	end
	
	
	luci.template.render("admin_uci/apply", {changes=convert_changes(changes), output=output})
end


function action_revert()
	local changes = luci.model.uci.changes()
	if changes then
		local revert = {}
		
		-- Collect files to be reverted
		for r, tbl in ipairs(changes) do
			if r then
				revert[r] = true
			end
		end
		
		-- Revert them
		for k, v in pairs(revert) do
			luci.model.uci.revert(k)
		end
	end
	
	luci.template.render("admin_uci/revert", {changes=convert_changes(changes)})
end
