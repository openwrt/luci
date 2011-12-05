--[[

Luci statistics - ping plugin diagram definition
(c) 2008 Freifunk Leipzig / Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id: ping.lua 6810 2011-01-29 03:33:48Z jow $

]]--

module("luci.statistics.rrdtool.definitions.ping", package.seeall)

function rrdargs( graph, plugin, plugin_instance, dtype )
	return {
		-- Ping roundtrip time
		{ title = "%H: ICMP Round Trip Time", vlabel = "ms",
		  number_format = "%5.1lf ms", data = {
			sources = { ping = { "ping" } },
			options = { ping__ping = { noarea = true, title = "%di" } }
		} },

		-- Ping droprate
		{ title = "%H: ICMP Drop Rate", vlabel = "%",
		  number_format = "%5.2lf %%", data = {
			types   = { "ping_droprate" },
			options = { ping_droprate = { title = "%di" } }
		} },

		-- Ping standard deviation
		{ title = "%H: ICMP Standard Deviation", vlabel = "ms",
		  number_format = "%5.2lf ms", data = {
			types   = { "ping_stddev" },
			options = { ping_stddev = { title = "%di" } }
		} },
	}
end
