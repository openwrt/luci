-- Copyright 2008 Freifunk Leipzig / Jo-Philipp Wich <jow@openwrt.org>
-- Licensed to the public under the Apache License 2.0.

module("luci.statistics.rrdtool.definitions.ping", package.seeall)

function rrdargs( graph, plugin, plugin_instance, dtype )
	return {
		-- Ping roundtrip time
		{ title = "%H: ICMP Round Trip Time", vlabel = "ms",
		  number_format = "%5.1lf ms", data = {
			sources = { ping = { "value" } },
			options = { ping__value = { noarea = true, title = "%di" } }
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
