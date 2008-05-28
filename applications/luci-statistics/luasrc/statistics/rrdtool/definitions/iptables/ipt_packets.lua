module("luci.statistics.rrdtool.definitions.iptables.ipt_packets", package.seeall)

function rrdargs( graph, plugin, plugin_instance, dtype )

	return {
		data = { 
			options = {
				ipt_packets = { total = true }
			}
		}
	}
end
