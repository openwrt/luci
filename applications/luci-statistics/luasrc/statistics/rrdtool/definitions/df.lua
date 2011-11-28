--[[

Luci statistics - df plugin diagram definition
(c) 2008 Freifunk Leipzig / Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id: df.lua 2274 2008-06-03 23:15:16Z jow $

]]--

module("luci.statistics.rrdtool.definitions.df", package.seeall)

function rrdargs( graph, plugin, plugin_instance, dtype )

	return {
		title = "%H: Disk space usage on %di",
		vlabel = "Bytes",
		per_instance  = true,
		number_format = "%5.1lf%sB",

		data = {
			sources = {
				df = { "free", "used" }
			},

			options = {
				df__free = {
					color = "00ff00",
					overlay = false,
					title = "free"
				},

				df__used = {
					color = "ff0000",
					overlay = false,
					title = "used"
				}
			}
		}
	}
end
