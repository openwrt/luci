module("luci.statistics.rrdtool.definitions.cpu.cpu",package.seeall)

function rrdargs( graph, host, plugin, plugin_instance, dtype )

	dtype_instances = { "idle", "nice", "system", "user" }

	opts = { }
	opts.sources	= { }
	opts.image	= graph:mkpngpath( host, plugin, plugin_instance, dtype )
	opts.title	= host .. ": Prozessorauslastung"
	opts.rrd 	= { "-v", "Percent" }
	opts.colors	= {
		idle      = 'ffffff',
		nice      = '00e000',
		user      = '0000ff',
		wait      = 'ffb000',
		system    = 'ff0000',
		softirq   = 'ff00ff',
		interrupt = 'a000a0',
		steal     = '000000'
	}

	for i, inst in ipairs(dtype_instances) do
		opts.sources[i] = {
			name = inst,
			rrd  = graph:mkrrdpath( host, plugin, plugin_instance, dtype, inst )
		}
	end

	return opts
end
