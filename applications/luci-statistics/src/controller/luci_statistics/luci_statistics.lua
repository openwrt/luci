--[[

    Luci controller for statistics
    Copyright 2008 Jo-Philipp Wich <xm@leipzig.freifunk.net>
    
    $Id$

]]--

module("ffluci.controller.luci_statistics.luci_statistics", package.seeall)

fs  = require("ffluci.fs")
tpl = require("ffluci.template")

function _entry( path, ... )
	if fs.isfile( "/usr/lib/collectd/" .. path[4] .. ".so" ) then
		entry( path, ... )
	end
end


function index()
	entry({"admin", "statistics"},				statistics_index,			"Statistiken",		80)
	entry({"admin", "statistics", "collectd"},		cbi("luci_statistics/collectd"),	"Collectd",		10)

	entry({"admin", "statistics", "output"},		statistics_outputplugins,		"Ausgabeplugins",	20)
	_entry({"admin", "statistics", "output", "rrdtool"},	cbi("luci_statistics/rrdtool"),		"RRDTool",		10)
	_entry({"admin", "statistics", "output", "network"},	cbi("luci_statistics/network"),		"Netzwerk",		20)
	_entry({"admin", "statistics", "output", "unixsock"},	cbi("luci_statistics/unixsock"),	"Unix Socket",		30)
	_entry({"admin", "statistics", "output", "csv"},	cbi("luci_statistics/csv"),		"CSV",			40)

	entry({"admin", "statistics", "system"},		statistics_systemplugins,		"Systemplugins",	30)
	_entry({"admin", "statistics", "system", "exec"},	cbi("luci_statistics/exec"),		"Exec",			10)
	_entry({"admin", "statistics", "system", "email"},	cbi("luci_statistics/email"),		"E-Mail",		20)
	_entry({"admin", "statistics", "system", "df"},		cbi("luci_statistics/df"),		"Speicherplatz",	30)
	_entry({"admin", "statistics", "system", "disk"},	cbi("luci_statistics/disk"),		"Datenträger",		40)
	_entry({"admin", "statistics", "system", "irq"},	cbi("luci_statistics/irq"),		"Interrupts",		50)
	_entry({"admin", "statistics", "system", "processes"},	cbi("luci_statistics/processes"),	"Prozesse",		60)

	entry({"admin", "statistics", "network"},		statistics_networkplugins,		"Netzwerkplugins",	40)
	_entry({"admin", "statistics", "network", "interface"},	cbi("luci_statistics/interface"),	"Schnittstellen",	10)
	_entry({"admin", "statistics", "network", "netlink"},	cbi("luci_statistics/netlink"),		"Netlink",		20)
	_entry({"admin", "statistics", "network", "iptables"},	cbi("luci_statistics/iptables"),	"Firewall",		30)
	_entry({"admin", "statistics", "network", "tcpconns"},	cbi("luci_statistics/tcpconns"),	"Verbindungen",		40)
	_entry({"admin", "statistics", "network", "ping"},	cbi("luci_statistics/ping"),		"Ping",			50)
	_entry({"admin", "statistics", "network", "dns"},	cbi("luci_statistics/dns"),		"DNS",			60)
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
