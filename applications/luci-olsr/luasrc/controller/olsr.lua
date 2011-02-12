module("luci.controller.olsr", package.seeall)

function index()
	if not nixio.fs.access("/etc/config/olsrd") then
		return
	end

	require("luci.i18n").loadc("olsr")
	local i18n = luci.i18n.translate

	local page  = node("admin", "status", "olsr")
	page.target = template("status-olsr/overview")
	page.title  = i18n("OLSR")
	page.i18n   = "olsr"
	page.subindex = true

	local page  = node("admin", "status", "olsr", "neighbors")
	page.target = call("action_neigh")
	page.title  = i18n("Neighbours")
	page.subindex = true
	page.order  = 5

	local page  = node("admin", "status", "olsr", "routes")
	page.target = call("action_routes")
	page.title  = i18n("Routes")
	page.order  = 10

	local page  = node("admin", "status", "olsr", "topology")
	page.target = call("action_topology")
	page.title  = i18n("Topology")
	page.order  = 20

	local page  = node("admin", "status", "olsr", "hna")
	page.target = call("action_hna")
	page.title  = i18n("HNA")
	page.order  = 30

	local page  = node("admin", "status", "olsr", "mid")
	page.target = call("action_mid")
	page.title  = i18n("MID")
	page.order  = 50

	local page  = node("admin", "status", "olsr", "smartgw")
	page.target = call("action_smartgw")
	page.title  = i18n("SmartGW")
	page.order  = 60

	local page  = node("admin", "status", "olsr", "interfaces")
        page.target = call("action_interfaces")
        page.title  = i18n("Interfaces")
        page.order  = 70

	local ol = entry(
		{"admin", "services", "olsrd"},
		cbi("olsr/olsrd"), "OLSR"
	)
	ol.i18n = "olsr"
	ol.subindex = true

	entry(
		{"admin", "services", "olsrd", "iface"},
		cbi("olsr/olsrdiface")
	).leaf = true

	entry(
		{"admin", "services", "olsrd", "hna"},
		cbi("olsr/olsrdhna"), i18n("HNA Announcements")
	)

	oplg = entry(
		{"admin", "services", "olsrd", "plugins"},
		cbi("olsr/olsrdplugins"), i18n("Plugins")
	)

	odsp = entry(
		{"admin", "services", "olsrd", "display"},
		cbi("olsr/olsrddisplay"), i18n("Display")
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

function action_neigh()
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

	luci.template.render("status-olsr/neighbors", {links=data.Links})
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

function action_smartgw()
        local data = fetch_txtinfo("gateways")

        if not data or not data.Gateways then
                luci.template.render("status-olsr/error_olsr")
                return nil
        end

        local function compare(a, b)
                return a["ETX"] < b["ETX"]
        end

        table.sort(data.Gateways, compare)

        luci.template.render("status-olsr/smartgw", {gws=data.Gateways})
end

function action_interfaces()
        local data = fetch_txtinfo("interfaces")

        if not data or not data.Interfaces then
                luci.template.render("status-olsr/error_olsr")
                return nil
        end

        luci.template.render("status-olsr/interfaces", {iface=data.Interfaces})
end

-- Internal
function fetch_txtinfo(otable)
	require("luci.sys")
	local uci = require "luci.model.uci".cursor_state()
	local resolve = uci:get("luci_olsr", "general", "resolve")
	otable = otable or ""
 	local rawdata = luci.sys.httpget("http://127.0.0.1:2006/"..otable)
 	local rawdatav6 = luci.sys.httpget("http://[::1]:2006/"..otable)
	local data = {}
	local dataindex = 0
	local name = ""
	local defaultgw

	if #rawdata ~= 0 then
		local tables = luci.util.split(luci.util.trim(rawdata), "\r?\n\r?\n", nil, true)

		if otable == "links" then
			local route = {}
			luci.sys.net.routes(function(r) if r.dest:prefix() == 0 then defaultgw = r.gateway:string() end end)
		end

		for i, tbl in ipairs(tables) do
			local lines = luci.util.split(tbl, "\r?\n", nil, true)
			name  = table.remove(lines, 1):sub(8)
			local keys  = luci.util.split(table.remove(lines, 1), "\t")
			local split = #keys - 1
			if not data[name] then
				data[name] = {}
			end

			for j, line in ipairs(lines) do
				dataindex = ( dataindex + 1 )
				di = dataindex
				local fields = luci.util.split(line, "\t", split)
				data[name][di] = {}
				for k, key in pairs(keys) do
					if key == "Remote IP" or key == "Dest. IP" or key == "Gateway IP" or key == "Gateway" then
						data[name][di][key] = fields[k]
						if resolve == "1" then
							hostname = nixio.getnameinfo(fields[k], "inet")
							if hostname then
								data[name][di]["Hostname"] = hostname
							end
						end
						if key == "Remote IP" and defaultgw then
							if defaultgw == fields[k] then
								data[name][di]["defaultgw"] = 1
							end
						end
					elseif key == "Local IP" then
						data[name][di][key] = fields[k]
						data[name][di]['Local Device'] = fields[k]
						uci:foreach("network", "interface",
							function(s)
								localip = string.gsub(fields[k], '	', '')
								if s.ipaddr == localip then
									data[name][di]['Local Device'] = s['.name'] or interface
								end
							end)
					elseif key == "Interface" then
						data[name][di][key] = fields[k]
						uci:foreach("network", "interface",
						function(s)
							interface = string.gsub(fields[k], '	', '')
							if s.ifname == interface then
								data[name][di][key] = s['.name'] or interface
							end
						end)
					else
					    data[name][di][key] = fields[k]
			        end
				end
				if data[name][di].Linkcost then
					data[name][di].LinkQuality,
					data[name][di].NLQ,
					data[name][di].ETX =
					data[name][di].Linkcost:match("([%w.]+)/([%w.]+)[%s]+([%w.]+)")
				end
			end
		end
	end

	if #rawdatav6 ~= 0 then
		local tables = luci.util.split(luci.util.trim(rawdatav6), "\r?\n\r?\n", nil, true)
		for i, tbl in ipairs(tables) do
			local lines = luci.util.split(tbl, "\r?\n", nil, true)
			name  = table.remove(lines, 1):sub(8)
			local keys  = luci.util.split(table.remove(lines, 1), "\t")
			local split = #keys - 1
			if not data[name] then
				data[name] = {}
			end
			for j, line in ipairs(lines) do
				dataindex = ( dataindex + 1 )
				di = dataindex
				local fields = luci.util.split(line, "\t", split)
				data[name][di] = {}
				for k, key in pairs(keys) do
					if key == "Remote IP" then
						data[name][di][key] = "[" .. fields[k] .. "]"
						if resolve == "1" then
							hostname = nixio.getnameinfo(fields[k], "inet6")
							if hostname then
								data[name][di]["Hostname"] = hostname
							end
						end
					elseif key == "Local IP" then
						data[name][di][key] = fields[k]
						data[name][di]['Local Device'] = fields[k]
						uci:foreach("network", "interface",
						function(s)
							local localip = string.gsub(fields[k], '	', '')
							if s.ip6addr then
								local ip6addr = string.gsub(s.ip6addr, '\/.*', '')
								if ip6addr == localip then
									data[name][di]['Local Device'] = s['.name'] or s.interface
								end
							end
						end)
					elseif key == "Dest. IP" then
						data[name][di][key] = "[" .. fields[k] .. "]"
					elseif key == "Last hop IP" then
						data[name][di][key] = "[" .. fields[k] .. "]"
					elseif key == "IP address" then
						data[name][di][key] = "[" .. fields[k] .. "]"
					elseif key == "Gateway" then
						data[name][di][key] = "[" .. fields[k] .. "]"
					else
						data[name][di][key] = fields[k]
					end
				end

				if data[name][di].Linkcost then
					data[name][di].LinkQuality,
					data[name][di].NLQ,
					data[name][di].ETX =
					data[name][di].Linkcost:match("([%w.]+)/([%w.]+)[%s]+([%w.]+)")
				end
			end
		end
	end


	if data then
	    return data
	end
end
