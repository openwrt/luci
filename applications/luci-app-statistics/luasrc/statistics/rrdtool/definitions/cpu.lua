-- Copyright 2008 Freifunk Leipzig / Jo-Philipp Wich <jow@openwrt.org>
-- Licensed to the public under the Apache License 2.0.

module("luci.statistics.rrdtool.definitions.cpu",package.seeall)

function rrdargs( graph, plugin, plugin_instance, dtype )

	return {
		title = "%H: Processor usage on core #%pi",
		y_min = "0",
		vlabel = "Percent",
		number_format = "%5.1lf%%",
		data = {
			instances = { 
				cpu = { "idle", "user", "system", "nice" }
			},

			options = {
				cpu_idle      = { color = "ffffff" },
				cpu_nice      = { color = "00e000" },
				cpu_user      = { color = "0000ff" },
				cpu_wait      = { color = "ffb000" },
				cpu_system    = { color = "ff0000" },
				cpu_softirq   = { color = "ff00ff" },
				cpu_interrupt = { color = "a000a0" },
				cpu_steal     = { color = "000000" }
			}
		}
	}
end
