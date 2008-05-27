module("luci.statistics.rrdtool.definitions.processes.ps_state", package.seeall)

function rrdargs( graph, host, plugin, plugin_instance, dtype )

	dtype_instances = {
		"sleeping", "running", "paging", "blocked", "stopped", "zombies"
	}

	opts = { }
	opts.sources	= { }
	opts.image	= graph:mkpngpath( host, plugin, plugin_instance, dtype )
	opts.title	= host .. ": Prozesse"
	opts.rrd 	= { "-v", "Anzahl" }
	opts.colors     = { 
		sleeping = "008080",
		running  = "008000",
		paging   = "ffff00",
		blocked  = "ff5000",
		stopped  = "555555",
		zombies  = "ff0000"
	}

	for i, inst in ipairs(dtype_instances) do
		opts.sources[i] = {
			name = inst,
			rrd  = graph:mkrrdpath( host, plugin, plugin_instance, "ps_state", inst )
		}
	end

	return opts
end
