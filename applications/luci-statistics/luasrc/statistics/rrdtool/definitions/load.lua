--[[

Luci statistics - load plugin diagram definition
(c) 2008 Freifunk Leipzig / Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id: load.lua 2329 2008-06-08 21:51:55Z jow $

]]--

module("luci.statistics.rrdtool.definitions.load", package.seeall)

function rrdargs( graph, plugin, plugin_instance, dtype )

	return {
		title = "%H: Load", vlabel = "Load",
		y_min = "0",
		units_exponent = "0",
		number_format = "%5.2lf", data = {
			sources = {
				load = { "shortterm", "midterm", "longterm" }
			},

			options = {
				load__shortterm = { color = "ff0000", title = "1 minute", noarea = true },
				load__midterm   = { color = "ff6600", title = "5 minutes", noarea = true },
				load__longterm  = { color = "ffaa00", title = "15 minutes", noarea = true }
			}
		}
	}
end
