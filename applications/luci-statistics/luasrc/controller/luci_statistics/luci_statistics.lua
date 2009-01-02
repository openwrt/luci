--[[

Luci statistics - statistics controller module
(c) 2008 Freifunk Leipzig / Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--

module("luci.controller.luci_statistics.luci_statistics", package.seeall)

function index()

	require("luci.fs")
	require("luci.util")
	require("luci.i18n")
	require("luci.statistics.datatree")

	-- load language files
	luci.i18n.loadc("rrdtool")
	luci.i18n.loadc("statistics")

	-- get rrd data tree
	local tree = luci.statistics.datatree.Instance()

	-- override entry(): check for existance <plugin>.so where <plugin> is derived from the called path
	function _entry( path, ... )
		local file = path[5] or path[4]
		if luci.fs.access( "/usr/lib/collectd/" .. file .. ".so" ) then
			entry( path, ... )
		end
	end

	-- override i18n(): try to translate stat_<str> or fall back to <str>
	function _i18n( str )
		return luci.i18n.translate( "stat_" .. str, str )
	end

	-- our collectd menu
	local collectd_menu = {
		output  = { "rrdtool", "network", "unixsock", "csv" },
		system  = { "exec", "email", "cpu", "df", "disk", "irq", "processes", "load" },
		network = { "interface", "netlink", "iptables", "tcpconns", "ping", "dns", "wireless" }
	}

	-- create toplevel menu nodes
	local st = entry({"admin", "statistics"},             call("statistics_index"),        _i18n("statistics"), 80)
	st.i18n = "statistics"
	st.index = true
	
	entry({"admin", "statistics", "collectd"}, cbi("luci_statistics/collectd"), _i18n("collectd"),   10).subindex = true
	

	-- populate collectd plugin menu
	local index = 1
	for section, plugins in luci.util.kspairs( collectd_menu ) do
		entry(
			{ "admin", "statistics", "collectd", section },
			call( "statistics_" .. section .. "plugins" ),
			_i18n( section .. "plugins" ),
			index * 10
		).index = true

		for j, plugin in luci.util.vspairs( plugins ) do
			_entry(
				{ "admin", "statistics", "collectd", section, plugin },
				cbi("luci_statistics/" .. plugin ),
				_i18n( plugin ),
				j * 10
			)
		end

		index = index + 1
	end

	-- output views
	local page = entry( { "admin", "statistics", "graph" }, call("statistics_index"), _i18n("graphs"), 80)
	      page.i18n     = "statistics"
	      page.setuser  = "nobody"
	      page.setgroup = "nogroup"

	local vars = luci.http.formvalue(nil, true)
	local span = vars.timespan or nil

	for i, plugin in luci.util.vspairs( tree:plugins() ) do

		-- get plugin instances
		local instances = tree:plugin_instances( plugin )

		-- plugin menu entry
		entry(
			{ "admin", "statistics", "graph", plugin },
			call("statistics_render"), _i18n( plugin ), i
		).query = { timespan = span }

		-- if more then one instance is found then generate submenu
		if #instances > 1 then
			for j, inst in luci.util.vspairs(instances) do
				-- instance menu entry
				entry(
					{ "admin", "statistics", "graph", plugin, inst },
					call("statistics_render"), inst, j
				).query = { timespan = span }
			end
		end
	end
end

function statistics_index()
	luci.template.render("admin_statistics/index")
end

function statistics_outputplugins()
	local plugins = { }

	for i, p in ipairs({ "rrdtool", "network", "unixsock", "csv" }) do
		plugins[p] = luci.i18n.translate( "stat_" .. p, p )
	end

	luci.template.render("admin_statistics/outputplugins", {plugins=plugins})
end

function statistics_systemplugins()
	local plugins = { }

	for i, p in ipairs({ "exec", "email", "df", "disk", "irq", "processes", "cpu" }) do
		plugins[p] = luci.i18n.translate( "stat_" .. p, p )
	end

	luci.template.render("admin_statistics/systemplugins", {plugins=plugins})
end

function statistics_networkplugins()
	local plugins = { }

	for i, p in ipairs({ "interface", "netlink", "iptables", "tcpconns", "ping", "dns", "wireless" }) do
		plugins[p] = luci.i18n.translate( "stat_" .. p, p )
	end

	luci.template.render("admin_statistics/networkplugins", {plugins=plugins})
end


function statistics_render()

	require("luci.statistics.rrdtool")
	require("luci.template")
	require("luci.model.uci")

	local vars  = luci.http.formvalue()
	local req   = luci.dispatcher.context.request
	local path  = luci.dispatcher.context.path
	local uci   = luci.model.uci.cursor()
	local spans = luci.util.split( uci:get( "luci_statistics", "collectd_rrdtool", "RRATimespans" ), "%s+", nil, true )
	local span  = vars.timespan or uci:get( "luci_statistics", "rrdtool", "default_timespan" ) or spans[1]
	local graph = luci.statistics.rrdtool.Graph( luci.util.parse_units( span ) )

	local plugin, instances
	local images = { }

	-- find requested plugin and instance
        for i, p in ipairs( luci.dispatcher.context.path ) do
                if luci.dispatcher.context.path[i] == "graph" then
                        plugin    = luci.dispatcher.context.path[i+1]
                        instances = { luci.dispatcher.context.path[i+2] }
                end
        end

	-- no instance requested, find all instances
	if #instances == 0 then
		instances = { graph.tree:plugin_instances( plugin )[1] }

	-- index instance requested
	elseif instances[1] == "-" then
		instances[1] = ""
	end


	-- render graphs
	for i, inst in ipairs( instances ) do
		for i, img in ipairs( graph:render( plugin, inst ) ) do
			table.insert( images, graph:strippngpath( img ) )
		end
	end

	luci.template.render( "public_statistics/graph", {
		images           = images,
		plugin           = plugin,
		timespans        = spans,
		current_timespan = span
	} )
end
