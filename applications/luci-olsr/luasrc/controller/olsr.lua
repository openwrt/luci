module("luci.controller.olsr", package.seeall)

function index()
	if not luci.fs.access("/etc/config/olsrd") then
		return
	end

	require("luci.i18n").loadc("olsr")
	local i18n = luci.i18n.translate

	local page  = node("admin", "status", "olsr")
	page.target = call("action_index")
	page.title  = "OLSR"
	page.i18n   = "olsr"
	page.subindex = true

	local page  = node("admin", "status", "olsr", "routes")
	page.target = call("action_routes")
	page.title  = i18n("olsr_routes", "Routen")
	page.order  = 10

	local page  = node("admin", "status", "olsr", "topology")
	page.target = call("action_topology")
	page.title  = i18n("olsr_topology", "Topologie")
	page.order  = 20

	local page  = node("admin", "status", "olsr", "hna")
	page.target = call("action_hna")
	page.title  = "HNA"
	page.order  = 30

	local page  = node("admin", "status", "olsr", "mid")
	page.target = call("action_mid")
	page.title  = "MID"
	page.order  = 50

	local ol = entry(
		{"admin", "services", "olsrd"},
		cbi("olsr/olsrd"), "OLSR"
	)
	ol.i18n = "olsr"
	ol.subindex = true

	entry(
		{"admin", "services", "olsrd", "hna"},
		cbi("olsr/olsrdhna"), "HNA Announcements"
	)

	oplg = entry(
		{"admin", "services", "olsrd", "plugins"},
		cbi("olsr/olsrdplugins"), "Plugins"
	)
	oplg.i18n = "olsr"
	oplg.leaf = true
	oplg.subindex = true

	local uci = require("luci.model.uci").cursor()
	uci:foreach("olsrd", "LoadPlugin",
		function (section)
			local lib = section.library
			entry(
				{"admin", "services", "olsrd", "plugins", lib },
				cbi("olsr/olsrdplugins"),
				nil --'Plugin "%s"' % lib:gsub("^olsrd_",""):gsub("%.so.+$","")
			)
		end
	)
end

function action_index()
	local data = fetch_txtinfo("links")

	if not data or not data.Links then
		luci.template.render("status-olsr/error_olsr")
		return nil
	end

	local function compare(a, b)
		local c = tonumber(a.Cost)
		local d = tonumber(b.Cost)

		if not c or c == 0 then
			return false
		end

		if not d or d == 0 then
			return true
		end

		return c < d
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
		local c = tonumber(a.ETX)
		local d = tonumber(b.ETX)

		if not c or c == 0 then
			return false
		end

		if not d or d == 0 then
			return true
		end

		return c < d
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
		return a["Dest. IP"] < b["Dest. IP"]
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
		return a.Destination < b.Destination
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
		return a["IP address"] < b["IP address"]
	end

	table.sort(data.MID, compare)

	luci.template.render("status-olsr/mid", {mids=data.MID})
end


-- Internal
function fetch_txtinfo(otable)
	require("luci.sys")
	otable = otable or ""
	local rawdata = luci.sys.httpget("http://127.0.0.1:2006/"..otable)

	if #rawdata == 0 then
		if luci.fs.access("/proc/net/ipv6_route", "r") then
			rawdata = luci.sys.httpget("http://[::1]:2006/"..otable)
			if #rawdata == 0 then
				return nil
			end
		else
			return nil
		end
	end

	local data = {}

	local tables = luci.util.split(luci.util.trim(rawdata), "\r?\n\r?\n", nil, true)


	for i, tbl in ipairs(tables) do
		local lines = luci.util.split(tbl, "\r?\n", nil, true)
		local name  = table.remove(lines, 1):sub(8)
		local keys  = luci.util.split(table.remove(lines, 1), "\t")
		local split = #keys - 1

		data[name] = {}

		for j, line in ipairs(lines) do
			local fields = luci.util.split(line, "\t", split)
			data[name][j] = {}
			for k, key in pairs(keys) do
				data[name][j][key] = fields[k]
			end

			if data[name][j].Linkcost then
				data[name][j].LinkQuality,
				data[name][j].NLQ,
				data[name][j].ETX =
				data[name][j].Linkcost:match("([%w.]+)/([%w.]+)[%s]+([%w.]+)")
			end
		end
	end

	return data
end
