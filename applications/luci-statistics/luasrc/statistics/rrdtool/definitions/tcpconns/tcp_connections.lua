module("luci.statistics.rrdtool.definitions.tcpconns.tcp_connections", package.seeall)

function rrdargs( graph, plugin, plugin_instance, dtype )

	return {
		title  = "TCP-Verbindungen auf Port " .. plugin_instance,
		vlabel = "Anzahl/s",

		data = {
			instances = {
				tcp_connections = {
			                "SYN_SENT", "SYN_RECV", "LISTEN", "ESTABLISHED",
					"LAST_ACK", "TIME_WAIT", "CLOSING", "CLOSE_WAIT",
					"CLOSED", "FIN_WAIT1", "FIN_WAIT2"
				}
			},

			options = {
				tcp_connections = {
					total = true
				}
			}
		}
	}
end
