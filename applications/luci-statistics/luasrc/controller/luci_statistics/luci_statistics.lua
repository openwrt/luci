module("luci.controller.luci_statistics.luci_statistics", package.seeall)

local fs   = require("luci.fs")
local i18n = require("luci.i18n")
local tpl  = require("luci.template")
local rrd  = require("luci.statistics.rrdtool")
local data = require("luci.statistics.datatree").Instance()

function index()

	-- XXX: fixme
	i18n.load("statistics.en")

	function _entry( path, ... )
		local file = path[4] or path[3]
		if fs.isfile( "/usr/lib/collectd/" .. file .. ".so" ) then
			entry( path, ... )
		end
	end

	function _i18n( str )
		return i18n.translate( "stat_" .. str, str )
	end

	entry({"admin", "statistics"},				call("statistics_index"),		"Statistiken",		80)
	entry({"admin", "statistics", "collectd"},		cbi("luci_statistics/collectd"),	"Collectd",		10)

	entry({"admin", "statistics", "output"},		call("statistics_outputplugins"),	"Ausgabeplugins",	20)
	_entry({"admin", "statistics", "output", "rrdtool"},	cbi("luci_statistics/rrdtool"),		"RRDTool",		10)
	_entry({"admin", "statistics", "output", "network"},	cbi("luci_statistics/network"),		"Netzwerk",		20)
	_entry({"admin", "statistics", "output", "unixsock"},	cbi("luci_statistics/unixsock"),	"Unix Socket",		30)
	_entry({"admin", "statistics", "output", "csv"},	cbi("luci_statistics/csv"),		"CSV",			40)

	entry({"admin", "statistics", "system"},		call("statistics_systemplugins"),	"Systemplugins",	30)
	_entry({"admin", "statistics", "system", "exec"},	cbi("luci_statistics/exec"),		"Exec",			10)
	_entry({"admin", "statistics", "system", "email"},	cbi("luci_statistics/email"),		"E-Mail",		20)
	_entry({"admin", "statistics", "system", "cpu"},	cbi("luci_statistics/cpu"),		"Prozessor",		30)
	_entry({"admin", "statistics", "system", "df"},		cbi("luci_statistics/df"),		"Speicherplatz",	40)
	_entry({"admin", "statistics", "system", "disk"},	cbi("luci_statistics/disk"),		"Datenträger",		50)
	_entry({"admin", "statistics", "system", "irq"},	cbi("luci_statistics/irq"),		"Interrupts",		60)
	_entry({"admin", "statistics", "system", "processes"},	cbi("luci_statistics/processes"),	"Prozesse",		70)

	entry({"admin", "statistics", "network"},		call("statistics_networkplugins"),	"Netzwerkplugins",	40)
	_entry({"admin", "statistics", "network", "interface"},	cbi("luci_statistics/interface"),	"Schnittstellen",	10)
	_entry({"admin", "statistics", "network", "netlink"},	cbi("luci_statistics/netlink"),		"Netlink",		20)
	_entry({"admin", "statistics", "network", "iptables"},	cbi("luci_statistics/iptables"),	"Firewall",		30)
	_entry({"admin", "statistics", "network", "tcpconns"},	cbi("luci_statistics/tcpconns"),	"Verbindungen",		40)
	_entry({"admin", "statistics", "network", "ping"},	cbi("luci_statistics/ping"),		"Ping",			50)
	_entry({"admin", "statistics", "network", "dns"},	cbi("luci_statistics/dns"),		"DNS",			60)

	
	-- public views
	entry({"freifunk", "statistics"},			call("statistics_index"),		"Statistiken",		80).i18n = "statistics"
	
	for i, plugin in ipairs( data:plugins() ) do

		-- get plugin instances
		local instances = data:plugin_instances( plugin )

		-- plugin menu entry
		_entry( { "freifunk", "statistics", plugin }, call("statistics_render"), _i18n( plugin ), i )

		-- if more then one instance is found then generate submenu
		if #instances > 1 then
			for j, inst in ipairs(instances) do
				-- instance menu entry
				entry( { "freifunk", "statistics", plugin, inst }, call("statistics_render"), inst, j )
			end
		end			
	end
end


function statistics_index()
	tpl.render("admin_statistics/index")
end

function statistics_outputplugins()
	plugins = {
		rrdtool="RRDTool",
		network="Netzwerk",
		unixsock="Unix Socket",
		csv="CSV"
	}

	tpl.render("admin_statistics/outputplugins", {plugins=plugins})
end

function statistics_systemplugins()
	plugins = {
		exec="Exec",
		email="E-Mail",
		disk="Datenträger",
		irq="Interrupts",
		processes="Prozesse"
	}

	tpl.render("admin_statistics/systemplugins", {plugins=plugins})
end

function statistics_networkplugins()
	plugins = {
		interface="Schnittstellen",
		netlink="Netlink",
		iptables="Firewall",
		tcpconns="Verbindungen",
		ping="Ping",
		dns="DNS"
	}

	tpl.render("admin_statistics/networkplugins", {plugins=plugins})
end


function statistics_render()
	local plugin    = luci.dispatcher.request[3]
	local instances = { luci.dispatcher.request[4] }
	local images    = { }

	-- no instance requested, find all instances
	if #instances == 0 then

		instances = data:plugin_instances( plugin )

		-- more than one available instance
		if #instances > 1 then

			-- redirect to first instance and return
			local r = luci.dispatcher.request

			luci.http.redirect( luci.dispatcher.build_url( {
				r[1], r[2], r[3], instances[1]
			} ) )

			return
		end
	end

	-- render graphs
	for i, inst in ipairs( instances ) do
		local graph = rrd.Graph()
		for i, img in ipairs( graph:render( plugin, inst ) ) do
			table.insert( images, img )
		end
	end

	tpl.render("public_statistics/graph", { images=images, plugin=plugin } )
end
