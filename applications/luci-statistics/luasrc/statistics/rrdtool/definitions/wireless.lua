module("luci.statistics.rrdtool.definitions.wireless", package.seeall)

function rrdargs( graph, host, plugin, plugin_instance )

	--
	-- signal/noise diagram
	--
	local snr = {

		-- diagram title
		title	= "Signal / Noise",

		-- vertical label
		vlabel  = "dBm",

		-- draw this diagram for each data instance
		per_instance = true,

		-- diagram data description
		data = {
			types = { "signal_noise", "signal_power" },

			-- special options for single data lines
			options = {
				signal_power = {
					overlay = true,		-- don't summarize
					color   = "0000ff"	-- power is blue
				},

				signal_noise = {
					overlay = true,		-- don't summarize
					color   = "ff0000"	-- noise is red
				}
			}
		}
	}


	--
	-- signal quality diagram
	--
	local quality = {

		-- diagram title
		title	= "Signalqualitaet",

		-- vertical label
		vlabel  = "n/5",

		-- draw this diagram for each data instance
		per_instance = true,

		-- diagram data description
		data = {
			types = { "signal_quality" },

			-- special options for single data lines
			options = {
				signal_quality = {
					noarea = true,		-- don't draw area
					color  = "0000ff"	-- quality is blue
				}
			}
		}
	}

	return { snr, quality }
end
