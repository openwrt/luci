module("luci.statistics.rrdtool.definitions.tcpconns.tcp_connections", package.seeall)

function rrdargs( graph, host, plugin, plugin_instance, dtype )

	dtype_instances = {
		"SYN_SENT", "SYN_RECV", "LISTEN", "ESTABLISHED", "LAST_ACK", "TIME_WAIT",
		"CLOSING", "CLOSE_WAIT", "CLOSED", "FIN_WAIT1", "FIN_WAIT2"
	}

	opts = { }
	opts.sources	= { }
	opts.image	= graph:mkpngpath( host, plugin, plugin_instance, dtype )
	opts.title	= host .. ": TCP-Verbindungen - Port " .. plugin_instance
	opts.rrd 	= { "-v", "Anzahl" }
	opts.colors     = { 

	}

	for i, inst in ipairs(dtype_instances) do
		opts.sources[i] = {
			name = inst,
			rrd  = graph:mkrrdpath( host, plugin, plugin_instance, dtype, inst )
		}
	end

	return opts
end
