module("ffluci.controller.public.olsr", package.seeall)
require("ffluci.sys")

function action_index()
	local data = fetch_txtinfo("links")
	
	if not data or not data.Links then
		ffluci.template.render("public_olsr/error_olsr")
		return nil
	end
	
	local function compare(a, b)
		if tonumber(a.ETX) == 0 then
			return false
		end
		
		if tonumber(b.ETX) == 0 then
			return true
		end
		
		return tonumber(a.ETX) < tonumber(b.ETX)
	end
	
	table.sort(data.Links, compare)
	
	ffluci.template.render("public_olsr/index", {links=data.Links})
end

function action_routes()
	local data = fetch_txtinfo("routes")
	
	if not data or not data.Routes then
		ffluci.template.render("public_olsr/error_olsr")
		return nil
	end
	
	local function compare(a, b)
		if tonumber(a.ETX) == 0 then
			return false
		end
		
		if tonumber(b.ETX) == 0 then
			return true
		end
		
		return tonumber(a.ETX) < tonumber(b.ETX)
	end
	
	table.sort(data.Routes, compare)
	
	ffluci.template.render("public_olsr/routes", {routes=data.Routes})
end

function action_topology()
	local data = fetch_txtinfo("topology")
	
	if not data or not data.Topology then
		ffluci.template.render("public_olsr/error_olsr")
		return nil
	end
	
	local function compare(a, b)
		return a["Destination IP"] < b["Destination IP"]
	end
	
	table.sort(data.Topology, compare)
	
	ffluci.template.render("public_olsr/topology", {routes=data.Topology})
end

function action_hna()
	local data = fetch_txtinfo("hna")
	
	if not data or not data.HNA then
		ffluci.template.render("public_olsr/error_olsr")
		return nil
	end
	
	local function compare(a, b)
		return a.Network < b.Network
	end
	
	table.sort(data.HNA, compare)
	
	ffluci.template.render("public_olsr/hna", {routes=data.HNA})
end

function action_mid()
	local data = fetch_txtinfo("mid")
	
	if not data or not data.MID then
		ffluci.template.render("public_olsr/error_olsr")
		return nil
	end
	
	local function compare(a, b)
		return a.IP < b.IP
	end
	
	table.sort(data.MID, compare)
	
	ffluci.template.render("public_olsr/mid", {mids=data.MID})
end


-- Internal
function fetch_txtinfo(table)
	table = table or ""
	local rawdata = ffluci.sys.httpget("http://127.0.0.1:2006/"..table)
	
	if #rawdata == 0 then
		return nil
	end
	
	local data = {}
	
	local tables = ffluci.util.split(ffluci.util.trim(rawdata), "\n\n")
	

	for i, tbl in ipairs(tables) do
		local lines = ffluci.util.split(tbl, "\n")
		local name  = table.remove(lines, 1):sub(8)
		local keys  = ffluci.util.split(table.remove(lines, 1), "\t")
		
		data[name] = {}
		
		for j, line in ipairs(lines) do
			local fields = ffluci.util.split(line, "\t")
			data[name][j] = {}
			for k, key in pairs(keys) do
				data[name][j][key] = fields[k] 
			end
		end
	end
	
	return data
end