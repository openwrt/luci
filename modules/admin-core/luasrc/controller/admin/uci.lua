module("luci.controller.admin.uci", package.seeall)

function index()
	node("admin", "uci", "changes").target = call("action_changes")
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
	local changes = convert_changes(luci.model.uci.changes())
	luci.template.render("admin_uci/changes", {changes=changes})
end

function action_apply()
	local changes = luci.model.uci.changes()
	local output  = ""
	
	if changes then
		local com = {}
		local run = {}
		
		-- Collect files to be applied and commit changes
		for r, tbl in pairs(changes) do
			if r then
				luci.model.uci.load(r)
				luci.model.uci.commit(r)
				luci.model.uci.unload(r)
				if luci.config.uci_oncommit and luci.config.uci_oncommit[r] then
					run[luci.config.uci_oncommit[r]] = true
				end
			end
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
		for r, tbl in pairs(changes) do
			luci.model.uci.load(r)
			luci.model.uci.revert(r)
			luci.model.uci.unload(r)
		end
	end
	
	luci.template.render("admin_uci/revert", {changes=convert_changes(changes)})
end
