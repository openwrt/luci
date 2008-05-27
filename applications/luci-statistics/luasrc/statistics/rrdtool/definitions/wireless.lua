module("luci.statistics.rrdtool.definitions.wireless", package.seeall)

function rrdargs( graph, host, plugin, plugin_instance )

	dtypes = { "signal_noise", "signal_power" }

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
			name    = dtype,
			rrd     = graph:mkrrdpath( host, plugin, plugin_instance, dtype ),
			overlay	= true  -- don't summarize values
		}
	end

	return opts
end
