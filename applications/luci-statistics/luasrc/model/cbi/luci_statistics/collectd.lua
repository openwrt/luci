--[[

Luci configuration model for statistics - general collectd configuration
(c) 2008 Freifunk Leipzig / Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	http://www.apache.org/licenses/LICENSE-2.0 

$Id$

]]--

require("luci.sys")


--[[
m = Map("luci_statistics", "Collector Daemon",
Collectd ist ein kleiner und flexibler Dienst zum Sammeln und Abfragen von Daten
aus verschieden Quellen. Zur weiteren Verarbeitung werden die Daten in RRD Datenbanken
gespeichert oder per Multicast Relaying über das Netzwerk versendet.)
]]--
m = Map("luci_statistics")

-- general config section
s = m:section( NamedSection, "collectd", "luci_statistics" )

-- general.hostname (Hostname)
hostname = s:option( Value, "Hostname" )
hostname.default  = luci.sys.hostname()
hostname.optional = true

-- general.basedir (BaseDir)
basedir = s:option( Value, "BaseDir" )
basedir.default = "/var/run/collectd"

-- general.include (Include)
include = s:option( Value, "Include" )
include.default = "/etc/collectd/conf.d/*.conf"

-- general.plugindir (PluginDir)
plugindir = s:option( Value, "PluginDir" )
plugindir.default = "/usr/lib/collectd/"

-- general.pidfile (PIDFile)
pidfile = s:option( Value, "PIDFile" )
pidfile.default = "/var/run/collectd.pid"

-- general.typesdb (TypesDB)
typesdb = s:option( Value, "TypesDB" )
typesdb.default = "/etc/collectd/types.db"

-- general.interval (Interval)
interval = s:option( Value, "Interval" )
interval.default  = 60
interval.isnumber = true

-- general.readthreads (ReadThreads)
readthreads = s:option( Value, "ReadThreads" )
readthreads.default  = 5
readthreads.isnumber = true

-- general.fqdnlookup (FQDNLookup)
fqdnlookup = s:option( Flag, "FQDNLookup" )
fqdnlookup.enabled  = "true"
fqdnlookup.disabled = "false"
fqdnlookup.default  = "false"
fqdnlookup.optional = true
fqdnlookup:depends( "Hostname", "" )


return m
