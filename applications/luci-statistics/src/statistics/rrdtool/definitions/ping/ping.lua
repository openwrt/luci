module("ffluci.statistics.rrdtool.definitions.ping.ping", package.seeall)

function rrdargs( graph, host, plugin, plugin_instance, dtype )

	dtype_instances = graph.tree:data_instances( plugin, plugin_instance, dtype )

	opts = { }
	opts.sources	= { }
	opts.image	= graph:mkpngpath( host, plugin, plugin_instance, dtype )
	opts.title	= host .. ": Pingzeiten"
	opts.rrd 	= { "-v", "Millisekunden" }
	opts.colors     = { }

	for i, inst in ipairs(dtype_instances) do
		opts.sources[i] = {
			ds   = "ping",
			name = inst,
			rrd  = graph:mkrrdpath( host, plugin, plugin_instance, dtype, inst )
		}
	end

	return opts
end
