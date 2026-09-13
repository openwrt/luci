/* Licensed to the public under the Apache License 2.0. */

'use strict';
'require baseclass';
'require uci';

return baseclass.extend({
	title: _('CPU Frequency'),

	rrdargs(graph, host, plugin, plugin_instance, dtype) {
		const cpufreq = {
			title: "%H: Processor frequency - core %pi",
			alt_autoscale: true,
			vlabel: "Frequency (Hz)",
			number_format: "%3.2lf%s",
			data: {
				types: [ "cpufreq" ],
				options: {
					cpufreq: { color: "ff0000", title: "Frequency" },
				}
			}
		};

	    if (uci.get("luci_statistics", "collectd_cpufreq", "ExtraItems")) {
			const transitions = {
				detail: true,
				title: "%H: Frequency transitions - core %pi",
				alt_autoscale: true,
				y_min: "0",
				y_max: "2",
				vlabel: "Transitions",
				number_format: "%3.2lf%s",
				data: {
					types: [ "transitions" ],
					options: {
						transitions: { color: "0000ff", title: "Transitions", noarea: true },
					}
				}
			};

			const percentage = {
				detail: true,
				title: "%H: Frequency distribution - core %pi",
				alt_autoscale: true,
				vlabel: "Percent",
				number_format: "%5.2lf%%",
				ordercolor: true,
				data: {
					types: [ "percent" ],
					options: {
						percent: { title: "%di kHz", negweight: true },
					}
				}
			};

			return [ cpufreq, percentage, transitions ];
	    }
	    else {
			return [ cpufreq ];
	    }
	}
});
