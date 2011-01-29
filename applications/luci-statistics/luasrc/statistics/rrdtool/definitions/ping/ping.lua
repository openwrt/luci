--[[

Luci statistics - ping plugin diagram definition
(c) 2008 Freifunk Leipzig / Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--

module("luci.statistics.rrdtool.definitions.ping.ping", package.seeall)

function rrdargs( graph, plugin, plugin_instance, dtype )

	return {
		data = {
			sources = {
				ping = { "ping" }
			},

			options = {
				ping__ping = {
					overlay = true,
					noarea  = true
				}
			}
		}
	}
end
