--[[

Luci statistics - conntrack plugin diagram definition
(c) 2011 Jo-Philipp Wich <xm@subsignal.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--

module("luci.statistics.rrdtool.definitions.conntrack",package.seeall)

function rrdargs( graph, plugin, plugin_instance, dtype )
	return {
		title = "%H: Conntrack entries",
		vlabel = "Count",
		number_format = "%5.0lf",
		data = {
			sources = {
				conntrack = { "entropy" }
			},
			options = {
				conntrack = { 
					color = "0000ff",
					title = "Tracked connections"
				}
			}
		}
	}
end
