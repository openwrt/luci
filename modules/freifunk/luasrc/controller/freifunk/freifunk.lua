--[[
LuCI - Lua Configuration Interface

Copyright 2008 Steven Barth <steven@midlink.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0

$Id$
]]--
module("luci.controller.freifunk.freifunk", package.seeall)

function index()
	local i18n = luci.i18n.translate
	local uci = require "luci.model.uci".cursor()

	-- Frontend
	local page  = node()
	page.lock   = true
	page.target = alias("freifunk")
	page.subindex = true
	page.index = false

	local page    = node("freifunk")
	page.title    = "Freifunk"
	page.target   = alias("freifunk", "index")
	page.order    = 5
	page.setuser  = "nobody"
	page.setgroup = "nogroup"
	page.i18n     = "freifunk"
	page.index    = true

	local page  = node("freifunk", "index")
	page.target = template("freifunk/index")
	page.title  = "Übersicht"
	page.order  = 10
	page.indexignore = true

	local page  = node("freifunk", "index", "contact")
	page.target = template("freifunk/contact")
	page.title  = "Kontakt"
	page.order    = 10

	local page  = node("freifunk", "status")
	page.target = template("freifunk/public_status")
	page.title  = i18n("Status")
	page.order  = 20
	page.i18n   = "base"
	page.setuser  = false
        page.setgroup = false

	entry({"freifunk", "status.json"}, call("jsonstatus"))
	entry({"freifunk", "status", "zeroes"}, call("zeroes"), "Testdownload")
	entry({"freifunk", "status", "public_status_json"}, call("public_status_json")).leaf = true

	assign({"freifunk", "olsr"}, {"admin", "status", "olsr"}, "OLSR", 30)

	if nixio.fs.access("/etc/config/luci_statistics") then
		assign({"freifunk", "graph"}, {"admin", "statistics", "graph"}, i18n("Statistics"), 40)
	end

	-- backend
	assign({"mini", "freifunk"}, {"admin", "freifunk"}, "Freifunk", 5)
	entry({"admin", "freifunk"}, alias("admin", "freifunk", "index"), "Freifunk", 5)

	local page  = node("admin", "freifunk")
	page.target = template("freifunk/adminindex")
	page.title  = "Freifunk"
	page.order  = 5

	local page  = node("admin", "freifunk", "basics")
	page.target = cbi("freifunk/basics")
	page.title  = "Grundeinstellungen"
	page.order  = 5
	
	local page  = node("admin", "freifunk", "basics", "profile")
	page.target = cbi("freifunk/profile")
	page.title  = "Profile"
	page.order  = 10

	local page  = node("admin", "freifunk", "basics", "profile_expert")
	page.target = cbi("freifunk/profile_expert")
	page.title  = "Profile (Expert)"
	page.order  = 20

	local page  = node("admin", "freifunk", "Index-Page")
	page.target = cbi("freifunk/user_index")
	page.title  = "Index-Page"
	page.order  = 50

	local page  = node("admin", "freifunk", "contact")
	page.target = cbi("freifunk/contact")
	page.title  = "Kontakt"
	page.order  = 15

	entry({"freifunk", "map"}, template("freifunk-map/frame"), i18n("Karte"), 50)
	entry({"freifunk", "map", "content"}, template("freifunk-map/map"), nil, 51)

	uci:foreach("olsrd", "LoadPlugin", function(s)
		if s.library == "olsrd_nameservice.so.0.3" then
			has_serv = true
		end
	end)
	if has_serv then
		entry({"freifunk", "services"}, template("freifunk-services/services"), i18n("Services"), 60)
	end
end

local function fetch_olsrd()
	local sys = require "luci.sys"
	local util = require "luci.util"
	local table = require "table"
	local rawdata = sys.httpget("http://127.0.0.1:2006/")

	if #rawdata == 0 then
		if nixio.fs.access("/proc/net/ipv6_route", "r") then
			rawdata = sys.httpget("http://[::1]:2006/")
			if #rawdata == 0 then
				return nil
			end
		else
			return nil
		end
	end

	local data = {}

	local tables = util.split(util.trim(rawdata), "\r?\n\r?\n", nil, true)


	for i, tbl in ipairs(tables) do
		local lines = util.split(tbl, "\r?\n", nil, true)
		local name  = table.remove(lines, 1):sub(8)
		local keys  = util.split(table.remove(lines, 1), "\t")
		local split = #keys - 1

		data[name] = {}

		for j, line in ipairs(lines) do
			local fields = util.split(line, "\t", split)
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

function zeroes()
	local string = require "string"
	local http = require "luci.http"
	local zeroes = string.rep(string.char(0), 8192)
	local cnt = 0
	local lim = 1024 * 1024 * 1024
	
	http.prepare_content("application/x-many-zeroes")

	while cnt < lim do
		http.write(zeroes)
		cnt = cnt + #zeroes
	end
end

function jsonstatus()
	local root = {}
	local sys = require "luci.sys"
	local uci = require "luci.model.uci"
	local util = require "luci.util"
	local http = require "luci.http"
	local json = require "luci.json"
	local ltn12 = require "luci.ltn12"
	local version = require "luci.version"
	local webadmin = require "luci.tools.webadmin"

	local cursor = uci.cursor_state()

	local ffzone = webadmin.firewall_find_zone("freifunk")
	local ffznet = ffzone and cursor:get("firewall", ffzone, "network")
	local ffwifs = ffznet and util.split(ffznet, " ") or {}


	root.protocol = 1

	root.system = {
		uptime = {sys.uptime()},
		loadavg = {sys.loadavg()},
		sysinfo = {sys.sysinfo()},
		hostname = sys.hostname()
	}

	root.firmware = {
		luciname=version.luciname,
		luciversion=version.luciversion,
		distname=version.distname,
		distversion=version.distversion
	}

	root.freifunk = {}
	cursor:foreach("freifunk", "public", function(s)
		root.freifunk[s[".name"]] = s
	end)

	cursor:foreach("system", "system", function(s)
		root.geo = {
			latitude = s.latitude,
			longitude = s.longitude
		}
	end)

	root.network = {}
	root.wireless = {devices = {}, interfaces = {}, status = {}}
	local wifs = root.wireless.interfaces
	local wifidata = luci.sys.wifi.getiwconfig() or {}
	local netdata = luci.sys.net.deviceinfo() or {}

	for _, vif in ipairs(ffwifs) do
		root.network[vif] = cursor:get_all("network", vif)
		root.wireless.devices[vif] = cursor:get_all("wireless", vif)
		cursor:foreach("wireless", "wifi-iface", function(s)
			if s.device == vif and s.network == vif then
				wifs[#wifs+1] = s
				if s.ifname then
					root.wireless.status[s.ifname] = wifidata[s.ifname]
				end
			end
		end)
	end

	root.olsrd = fetch_olsrd()

	http.prepare_content("application/json")
	ltn12.pump.all(json.Encoder(root):source(), http.write)
end

function public_status_json()
	local twa	= require "luci.tools.webadmin"
	local sys	= require "luci.sys"
	local i18n	= require "luci.i18n"
	local path	= luci.dispatcher.context.requestpath
	local rv 	= { }

	local dev
	for dev in path[#path]:gmatch("[%w%.%-]+") do
		local j = { id = dev }
		local iw = luci.sys.wifi.getiwinfo(dev)
		if iw then
			local f
			for _, f in ipairs({
				"channel", "txpower", "bitrate", "signal", "noise",
				"quality", "quality_max", "mode", "ssid", "bssid", "encryption", "ifname"
			}) do
				j[f] = iw[f]
			end
		end
		rv[#rv+1] = j
	end

	local load1, load5, load15 = sys.loadavg()

	local  _, _, memtotal, memcached, membuffers, memfree = sys.sysinfo()
	local mem = string.format("%.2f MB (%.2f %s, %.2f %s, %.2f %s, %.2f %s)",
	tonumber(memtotal) / 1024,
	tonumber(memtotal - memfree) / 1024,
	tostring(i18n.translate("used")),
	memfree / 1024,
	tostring(i18n.translate("free")),
	memcached / 1024,
	tostring(i18n.translate("cached")),
	membuffers / 1024,
	tostring(i18n.translate("buffered"))
	)

	local dr4 = sys.net.defaultroute()
	local dr6 = sys.net.defaultroute6()
	
	if dr6 then
		def6 = { 
		gateway = dr6.nexthop:string(),
		dest = dr6.dest:string(),
		dev = dr6.device,
		metr = dr6.metric }
	end   

	if dr4 then
		def4 = { 
		gateway = dr4.gateway:string(),
		dest = dr4.dest:string(),
		dev = dr4.device,
		metr = dr4.metric }
	end
	
	rv[#rv+1] = {
		time = os.date("%c"),
		uptime = twa.date_format(tonumber(sys.uptime())),
		load = string.format("%.2f, %.2f, %.2f", load1, load5, load15),
		mem = mem,
		defroutev4 = def4,
		defroutev6 = def6
	}

	luci.http.prepare_content("application/json")
	luci.http.write_json(rv)
	return
end
