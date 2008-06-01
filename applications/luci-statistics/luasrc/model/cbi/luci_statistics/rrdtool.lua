--[[

Luci configuration model for statistics - collectd rrdtool plugin configuration
(c) 2008 Freifunk Leipzig / Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--

m = Map("luci_statistics")

-- collectd_rrdtool config section
s = m:section( NamedSection, "collectd_rrdtool", "luci_statistics" )

-- collectd_rrdtool.enable
enable = s:option( Flag, "enable" )
enable.default = 1

-- collectd_rrdtool.datadir (DataDir)
datadir = s:option( Value, "DataDir" )
datadir.default  = "/tmp"
datadir.rmempty  = true
datadir.optional = true
datadir:depends( "enable", 1 )

-- collectd_rrdtool.stepsize (StepSize)
stepsize = s:option( Value, "StepSize" )
stepsize.default   = 30
stepsize.isinteger = true
stepsize.rmempty   = true
stepsize.optional  = true
stepsize:depends( "enable", 1 )

-- collectd_rrdtool.heartbeat (HeartBeat)
heartbeat = s:option( Value, "HeartBeat" )
heartbeat.default   = 60
heartbeat.isinteger = true
heartbeat.rmempty   = true
heartbeat.optional  = true
heartbeat:depends( "enable", 1 )

-- collectd_rrdtool.rrasingle (RRASingle)
rrasingle = s:option( Flag, "RRASingle" )
rrasingle.default  = true
rrasingle.rmempty  = true
rrasingle.optional = true
rrasingle:depends( "enable", 1 )

-- collectd_rrdtool.rratimespans (RRATimespan)
rratimespans = s:option( Value, "RRATimespans" )
rratimespans.default  = "600 86400 604800 2678400 31622400"
rratimespans.rmempty  = true
rratimespans.optional = true
rratimespans:depends( "enable", 1 )

-- collectd_rrdtool.rrarows (RRARows)
rrarows = s:option( Value, "RRARows" )
rrarows.isinteger = true
rrarows.default   = 100
rrarows.rmempty   = true
rrarows.optional  = true
rrarows:depends( "enable", 1 )

-- collectd_rrdtool.xff (XFF)
xff = s:option( Value, "XFF" )
xff.default  = 0.1
xff.isnumber = true
xff.rmempty  = true
xff.optional = true
xff:depends( "enable", 1 )

-- collectd_rrdtool.cachetimeout (CacheTimeout)
cachetimeout = s:option( Value, "CacheTimeout" )
cachetimeout.isinteger = true
cachetimeout.default   = 100
cachetimeout.rmempty   = true
cachetimeout.optional  = true
cachetimeout:depends( "enable", 1 )

-- collectd_rrdtool.cacheflush (CacheFlush)
cacheflush = s:option( Value, "CacheFlush" )
cacheflush.isinteger = true
cacheflush.default   = 100
cacheflush.rmempty   = true
cacheflush.optional  = true
cacheflush:depends( "enable", 1 )

return m
