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

	require("nixio.fs")
	require("luci.util")
	require("luci.statistics.datatree")

	-- get rrd data tree
	local tree = luci.statistics.datatree.Instance()

	-- override entry(): check for existance <plugin>.so where <plugin> is derived from the called path
	function _entry( path, ... )
		local file = path[5] or path[4]
		if nixio.fs.access( "/usr/lib/collectd/" .. file .. ".so" ) then
			entry( path, ... )
		end
	end

	local labels = {
		s_output	= _("Output plugins"),
		s_system	= _("System plugins"),
		s_network	= _("Network plugins"),

		rrdtool		= _("RRDTool"),
		network		= _("Network"),
		unixsock	= _("UnixSock"),
		conntrack       = _("Conntrack"),
		csv			= _("CSV Output"),
		exec		= _("Exec"),
		email		= _("Email"),
		cpu			= _("Processor"),
		df			= _("Disk Space Usage"),
		disk		= _("Disk Usage"),
		irq			= _("Interrupts"),
		processes	= _("Processes"),
		load		= _("System Load"),
		interface	= _("Interfaces"),
		memory		= _("Memory"),
		netlink		= _("Netlink"),
		iptables	= _("Firewall"),
		tcpconns	= _("TCP Connections"),
		ping		= _("Ping"),
		dns			= _("DNS"),
		wireless	= _("Wireless"),
		olsrd		= _("OLSRd")
	}

	-- our collectd menu
	local collectd_menu = {
		output  = { "rrdtool", "network", "unixsock", "csv" },
		system  = { "exec", "email", "cpu", "df", "disk", "irq", "memory", "processes", "load" },
		network = { "interface", "netlink", "iptables", "conntrack", "tcpconns", "ping", "dns", "wireless", "olsrd" }
	}

	-- create toplevel menu nodes
	local st = entry({"admin", "statistics"}, call("statistics_index"), _("Statistics"), 80)
	st.i18n = "statistics"
	st.index = true
	
	entry({"admin", "statistics", "collectd"}, cbi("luci_statistics/collectd"), _("Collectd"), 10).subindex = true
	

	-- populate collectd plugin menu
	local index = 1
	for section, plugins in luci.util.kspairs( collectd_menu ) do
		local e = entry(
			{ "admin", "statistics", "collectd", section },
			call( "statistics_" .. section .. "plugins" ),
			labels["s_"..section], index * 10
		)

		e.index = true
		e.i18n  = "rrdtool"

		for j, plugin in luci.util.vspairs( plugins ) do
			_entry(
				{ "admin", "statistics", "collectd", section, plugin },
				cbi("luci_statistics/" .. plugin ),
				labels[plugin], j * 10
			)
		end

		index = index + 1
	end

	-- output views
	local page = entry( { "admin", "statistics", "graph" }, call("statistics_index"), _("Graphs"), 80)
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
			call("statistics_render"), labels[plugin], i
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
	local translate = luci.i18n.translate
	local plugins = {
		rrdtool		= translate("RRDTool"),
		network		= translate("Network"),
		unixsock	= translate("UnixSock"),
		csv			= translate("CSV Output")
	}

	luci.template.render("admin_statistics/outputplugins", {plugins=plugins})
end

function statistics_systemplugins()
	local translate = luci.i18n.translate
	local plugins = {
		exec		= translate("Exec"),
		email		= translate("Email"),
		cpu			= translate("Processor"),
		df			= translate("Disk Space Usage"),
		disk		= translate("Disk Usage"),
		irq			= translate("Interrupts"),
		processes	= translate("Processes"),
		load		= translate("System Load"),
	}

	luci.template.render("admin_statistics/systemplugins", {plugins=plugins})
end

function statistics_networkplugins()
	local translate = luci.i18n.translate
	local plugins = {
		interface	= translate("Interfaces"),
		netlink		= translate("Netlink"),
		iptables	= translate("Firewall"),
		tcpconns	= translate("TCP Connections"),
		ping		= translate("Ping"),
		dns			= translate("DNS"),
		wireless	= translate("Wireless"),
		olsrd		= translate("OLSRd")
	}

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

	local is_index = false

	-- deliver image
	if vars.img then
		local l12 = require "luci.ltn12"
		local png = io.open(graph.opts.imgpath .. "/" .. vars.img:gsub("%.+", "."), "r")
		if png then
			luci.http.prepare_content("image/png")
			l12.pump.all(l12.source.file(png), luci.http.write)
			png:close()
		end
		return
	end

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
		--instances = { graph.tree:plugin_instances( plugin )[1] }
		instances = graph.tree:plugin_instances( plugin )
		is_index = true

	-- index instance requested
	elseif instances[1] == "-" then
		instances[1] = ""
		is_index = true
	end


	-- render graphs
	for i, inst in ipairs( instances ) do
		for i, img in ipairs( graph:render( plugin, inst, is_index ) ) do
			table.insert( images, graph:strippngpath( img ) )
			images[images[#images]] = inst
		end
	end

	luci.template.render( "public_statistics/graph", {
		images           = images,
		plugin           = plugin,
		timespans        = spans,
		current_timespan = span,
		is_index         = is_index
	} )
end
