--[[

Luci statistics - load plugin diagram definition
(c) 2008 Freifunk Leipzig / Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--

module("luci.statistics.rrdtool.definitions.load.load", package.seeall)

function rrdargs( graph, plugin, plugin_instance, dtype )

	return {
		data = {
			sources = {
				load = { "shortterm", "midterm", "longterm" }
			},

			options = {
				load__shortterm = { color = "ff0000" },
				load__midterm   = { color = "ff6600" },
				load__longterm  = { color = "ffaa00" }
			}
		}
	}
end
