module("ffluci.statistics.rrdtool.definitions.wireless", package.seeall)

function rrdargs( graph, host, plugin, plugin_instance )

	dtypes = { "signal_power", "signal_noise" }

	opts = { }
	opts.sources	= { }
	opts.image	= graph:mkpngpath( host, plugin, plugin_instance, "wireless" )
	opts.title	= host .. ": WLAN Signal"
	opts.rrd 	= { "-v", "dBm" }
	opts.colors	= {
		signal_power = '0000ff',
		signal_noise = 'ff0000'
	}

	for i, dtype in ipairs(dtypes) do
		opts.sources[i] = {
			name = dtype,
			rrd  = graph:mkrrdpath( host, plugin, plugin_instance, dtype )
		}
	end

	return opts
end
