module("luci.controller.admin.status_olsr", package.seeall)
require("luci.sys")

function index()
	local page  = node("admin", "status", "olsr")
	page.target = call("action_index")
	page.title  = "OLSR"
	
	local page  = node("admin", "status", "olsr", "routes")
	page.target = call("action_routes")
	page.title  = "Routen"
	page.order  = 10
	
	local page  = node("admin", "status", "olsr", "topology")
	page.target = call("action_topology")
	page.title  = "Topologie"
	page.order  = 20
	
	local page  = node("admin", "status", "olsr", "hna")
	page.target = call("action_hna")
	page.title  = "HNA"
	page.order  = 30
	
	local page  = node("admin", "status", "olsr", "mid")
	page.target = call("action_mid")
	page.title  = "MID"
	page.order  = 50
end

function action_index()
	local data = fetch_txtinfo("links")
	
	if not data or not data.Links then
		luci.template.render("status-olsr/error_olsr")
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
	
	luci.template.render("status-olsr/index", {links=data.Links})
end

function action_routes()
	local data = fetch_txtinfo("routes")
	
	if not data or not data.Routes then
		luci.template.render("status-olsr/error_olsr")
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
	
	luci.template.render("status-olsr/routes", {routes=data.Routes})
end

function action_topology()
	local data = fetch_txtinfo("topology")
	
	if not data or not data.Topology then
		luci.template.render("status-olsr/error_olsr")
		return nil
	end
	
	local function compare(a, b)
		return a["Destination IP"] < b["Destination IP"]
	end
	
	table.sort(data.Topology, compare)
	
	luci.template.render("status-olsr/topology", {routes=data.Topology})
end

function action_hna()
	local data = fetch_txtinfo("hna")
	
	if not data or not data.HNA then
		luci.template.render("status-olsr/error_olsr")
		return nil
	end
	
	local function compare(a, b)
		return a.Network < b.Network
	end
	
	table.sort(data.HNA, compare)
	
	luci.template.render("status-olsr/hna", {routes=data.HNA})
end

function action_mid()
	local data = fetch_txtinfo("mid")
	
	if not data or not data.MID then
		luci.template.render("status-olsr/error_olsr")
		return nil
	end
	
	local function compare(a, b)
		return a.IP < b.IP
	end
	
	table.sort(data.MID, compare)
	
	luci.template.render("status-olsr/mid", {mids=data.MID})
end


-- Internal
function fetch_txtinfo(otable)
	otable = otable or ""
	local rawdata = luci.sys.httpget("http://127.0.0.1:2006/"..otable)
	
	if #rawdata == 0 then
		return nil
	end
	
	local data = {}
	
	local tables = luci.util.split(luci.util.trim(rawdata), "\n\n")
	

	for i, tbl in ipairs(tables) do
		local lines = luci.util.split(tbl, "\n")
		local name  = table.remove(lines, 1):sub(8)
		local keys  = luci.util.split(table.remove(lines, 1), "\t")
		
		data[name] = {}
		
		for j, line in ipairs(lines) do
			local fields = luci.util.split(line, "\t")
			data[name][j] = {}
			for k, key in pairs(keys) do
				data[name][j][key] = fields[k] 
			end
		end
	end
	
	return data
end