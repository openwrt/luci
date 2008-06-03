module("luci.controller.luci_statistics.luci_statistics", package.seeall)

function index()

	require("luci.fs")
	require("luci.i18n")
	require("luci.statistics.datatree")

	-- load language file
	luci.i18n.load("statistics.en") -- XXX: temporary / replace with loadc()

	-- get rrd data tree
	local tree = luci.statistics.datatree.Instance()

	-- override entry(): check for existance <plugin>.so where <plugin> is derived from the called path
	function _entry( path, ... )
		local file = path[4] or path[3]
		if luci.fs.isfile( "/usr/lib/collectd/" .. file .. ".so" ) then
			entry( path, ... )
		end
	end

	-- override call(): call requested action function with supplied parameters
	function _call( func, tree, plugin )
		return function() getfenv()[func]( tree, plugin ) end
	end

	-- override i18n(): try to translate stat_<str> or fall back to <str>
	function _i18n( str )
		return luci.i18n.translate( "stat_" .. str, str )
	end


	entry({"admin", "statistics"},				call("statistics_index"),		_i18n("statistics"),	80).i18n = "statistics"
	entry({"admin", "statistics", "collectd"},		cbi("luci_statistics/collectd"),	_i18n("collectd"),	10)

	entry({"admin", "statistics", "output"},		call("statistics_outputplugins"),	_i18n("outputplugins"),	20)
	_entry({"admin", "statistics", "output", "rrdtool"},	cbi("luci_statistics/rrdtool"),		_i18n("rrdtool"),	10)
	_entry({"admin", "statistics", "output", "network"},	cbi("luci_statistics/network"),		_i18n("network"),	20)
	_entry({"admin", "statistics", "output", "unixsock"},	cbi("luci_statistics/unixsock"),	_i18n("unixsock"),	30)
	_entry({"admin", "statistics", "output", "csv"},	cbi("luci_statistics/csv"),		_i18n("csv"),		40)

	entry({"admin", "statistics", "system"},		call("statistics_systemplugins"),	_i18n("systemplugins"),	30)
	_entry({"admin", "statistics", "system", "exec"},	cbi("luci_statistics/exec"),		_i18n("exec"),		10)
	_entry({"admin", "statistics", "system", "email"},	cbi("luci_statistics/email"),		_i18n("email"),		20)
	_entry({"admin", "statistics", "system", "cpu"},	cbi("luci_statistics/cpu"),		_i18n("cpu"),		30)
	_entry({"admin", "statistics", "system", "df"},		cbi("luci_statistics/df"),		_i18n("df"),		40)
	_entry({"admin", "statistics", "system", "disk"},	cbi("luci_statistics/disk"),		_i18n("disk"),		50)
	_entry({"admin", "statistics", "system", "irq"},	cbi("luci_statistics/irq"),		_i18n("irq"),		60)
	_entry({"admin", "statistics", "system", "processes"},	cbi("luci_statistics/processes"),	_i18n("processes"),	70)

	entry({"admin", "statistics", "network"},		call("statistics_networkplugins"),	_i18n("networkplugins"),40)
	_entry({"admin", "statistics", "network", "interface"},	cbi("luci_statistics/interface"),	_i18n("interface"),	10)
	_entry({"admin", "statistics", "network", "netlink"},	cbi("luci_statistics/netlink"),		_i18n("netlink"),	20)
	_entry({"admin", "statistics", "network", "iptables"},	cbi("luci_statistics/iptables"),	_i18n("iptables"),	30)
	_entry({"admin", "statistics", "network", "tcpconns"},	cbi("luci_statistics/tcpconns"),	_i18n("tcpconns"),	40)
	_entry({"admin", "statistics", "network", "ping"},	cbi("luci_statistics/ping"),		_i18n("ping"),		50)
	_entry({"admin", "statistics", "network", "dns"},	cbi("luci_statistics/dns"),		_i18n("dns"),		60)
	_entry({"admin", "statistics", "network", "wireless"},	cbi("luci_statistics/wireless"),	_i18n("wireless"),	70)

	
	-- output views
	entry( { "admin", "statistics", "graph" }, call("statistics_index"), _i18n("graphs"), 80).i18n = "statistics"

	local vars = luci.http.formvalues()
	local span = vars.timespan or nil

	for i, plugin in ipairs( tree:plugins() ) do

		-- get plugin instances
		local instances = tree:plugin_instances( plugin )

		-- plugin menu entry
		entry(
			{ "admin", "statistics", "graph", plugin },
			call("statistics_render"), _i18n( plugin ), i
		).query = { timespan = span }

		-- if more then one instance is found then generate submenu
		if #instances > 1 then
			for j, inst in ipairs(instances) do
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


function statistics_render( tree )

	require("luci.statistics.rrdtool")
	require("luci.template")
	require("luci.model.uci")

	local vars  = luci.http.formvalues()
	local req   = luci.dispatcher.request 
	local uci   = luci.model.uci.Session()
	local spans = luci.util.split( uci:get( "luci_statistics", "collectd_rrdtool", "RRATimespans" ), "%s+", nil, true )
	local span  = vars.timespan or uci:get( "luci_statistics", "rrdtool", "default_timespan" ) or spans[1]
	local graph = luci.statistics.rrdtool.Graph( luci.util.parse_units( span ) )

	local plugin    = req[4]
	local instances = { req[5] }
	local images    = { }

	-- no instance requested, find all instances
	if #instances == 0 then

		instances = graph.tree:plugin_instances( plugin )

		-- more than one available instance
		if #instances > 1 then

			-- redirect to first instance and return
			local r = luci.dispatcher.request
			local i = instances[1]
			if i:len() == 0 then i = "-" end

			luci.http.redirect( luci.dispatcher.build_url(
				req[1], req[2], req[3], req[4], i
			) )

			return
		end

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
