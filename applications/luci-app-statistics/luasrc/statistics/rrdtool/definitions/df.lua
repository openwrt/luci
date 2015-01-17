-- Copyright 2008 Freifunk Leipzig / Jo-Philipp Wich <jow@openwrt.org>
-- Licensed to the public under the Apache License 2.0.

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
