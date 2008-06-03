--[[

Luci statistics - wireless plugin diagram definition
(c) 2008 Freifunk Leipzig / Jo-Philipp Wich <xm@leipzig.freifunk.net>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--

module("luci.statistics.rrdtool.definitions.wireless", package.seeall)

function rrdargs( graph, host, plugin, plugin_instance )

	--
	-- signal/noise diagram
	--
	local snr = {

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
