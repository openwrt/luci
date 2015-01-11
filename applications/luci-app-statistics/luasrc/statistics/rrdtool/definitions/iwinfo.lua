--[[

Luci statistics - wireless plugin diagram definition
(c) 2011 Jo-Philipp Wich <xm@subsignal.org>

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

$Id$

]]--

module("luci.statistics.rrdtool.definitions.iwinfo", package.seeall)

function rrdargs( graph, plugin, plugin_instance )

	--
	-- signal/noise diagram
	--
	local snr = {
		title = "%H: Signal and noise on %pi",
		vlabel = "dBm",
		number_format = "%5.1lf dBm",
		data = {
			types = { "signal_noise", "signal_power" },
			options = {
				signal_power = {
					title  = "Signal",
					overlay = true,
					color   = "0000ff"
				},
				signal_noise = {
					title   = "Noise",
					overlay = true,
					color   = "ff0000"
				}
			}
		}
	}


	--
	-- signal quality diagram
	--
	local quality = {
		title = "%H: Signal quality on %pi",
		vlabel = "Quality",
		number_format = "%3.0lf",
		data = {
			types = { "signal_quality" },
			options = {
				signal_quality = {
					title  = "Quality",
					noarea = true,
					color  = "0000ff"
				}
			}
		}
	}


	--
	-- phy rate diagram
	--
	local bitrate = {
		title = "%H: Average phy rate on %pi",
		vlabel = "MBit/s",
		number_format = "%5.1lf%sBit/s",
		data = {
			types = { "bitrate" },
			options = {
				bitrate = {
					title = "Rate",
					color = "00ff00"
				}
			}
		}
	}

	--
	-- associated stations
	--
	local stations = {
		title = "%H: Associated stations on %pi",
		vlabel = "Stations",
		number_format = "%3.0lf",
		data = {
			types = { "stations" },
			options = {
				stations = {
					title = "Stations",
					color = "0000ff"
				}
			}
		}
	}

	return { snr, quality, bitrate, stations }
end
