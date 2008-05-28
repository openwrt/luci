module("luci.statistics.rrdtool.definitions.tcpconns.tcp_connections", package.seeall)

function rrdargs( graph, plugin, plugin_instance, dtype )

	return {
		data = {
			instances = {
				tcp_connections = {
			                "SYN_SENT", "SYN_RECV", "LISTEN", "ESTABLISHED",
					"LAST_ACK", "TIME_WAIT", "CLOSING", "CLOSE_WAIT",
					"CLOSED", "FIN_WAIT1", "FIN_WAIT2"
				}
			}
		}
	}
end
