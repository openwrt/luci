/* Licensed to the public under the Apache License 2.0. */

'use strict';
'require baseclass';

return baseclass.extend({
	title: _('Wireless'),

	rrdargs: function(graph, host, plugin, plugin_instance, dtype) {
		/*
		 * signal/noise diagram
		 */
		var snr = {
			title: "%H: Signal and noise on %pi",
			detail: true,
			vlabel: "dBm",
			number_format: "%5.1lf dBm",
			data: {
				types: [ "signal_noise", "signal_power" ],
				options: {
					signal_power: {
						title  : "Signal",
						overlay: true,
						color  : "0000ff"
					},
					signal_noise: {
						title  : "Noise",
						overlay: true,
						color  : "ff0000"
					}
				}
			}
		};

		/*
		 * signal quality diagram
		 */
		var quality = {
			title: "%H: Signal quality on %pi",
			vlabel: "Quality",
			number_format: "%3.0lf",
			data: {
				types: [ "signal_quality" ],
				options: {
					signal_quality: {
						title : "Quality",
						noarea: true,
						color : "0000ff"
					}
				}
			}
		};

		/*
		 * phy rate diagram
		 */
		var bitrate = {
			title: "%H: Average phy rate on %pi",
			detail: true,
			vlabel: "Mbit/s",
			number_format: "%5.1lf%sbit/s",
			data: {
				types: [ "bitrate" ],
				options: {
					bitrate: {
						title: "Rate",
						color: "00ff00"
					}
				}
			}
		};

		/*
		 * associated stations
		 */
		var stations = {
			title: "%H: Associated stations on %pi",
			detail: true,
			vlabel: "Stations",
			y_min: "0",
			alt_autoscale_max: true,
			number_format: "%3.0lf",
			data: {
				types: [ "stations" ],
				options: {
					stations: {
						title: "Stations",
						color: "0000ff"
					}
				}
			}
		};

		return [ quality, snr, bitrate, stations ];
	}
});
