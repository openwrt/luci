module("luci.statistics.rrdtool.definitions.irq.irq", package.seeall)

function rrdargs( graph, plugin, plugin_instance, dtype )

	return {
		data = {
			types = { "irq" }
		}
	}
end
