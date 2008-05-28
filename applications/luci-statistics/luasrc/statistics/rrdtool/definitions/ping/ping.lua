module("luci.statistics.rrdtool.definitions.ping.ping", package.seeall)

function rrdargs( graph, plugin, plugin_instance, dtype )

	return {
		title  = "Pingzeiten",
		vlabel = "ms",

		data = {
			sources = {
				ping = { "ping" }
			}
		}
	}
end
