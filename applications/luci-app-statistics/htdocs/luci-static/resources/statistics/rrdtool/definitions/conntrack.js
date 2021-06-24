/* Licensed to the public under the Apache License 2.0. */

'use strict';
'require baseclass';

return baseclass.extend({
	title: _('Conntrack'),

	rrdargs: function(graph, host, plugin, plugin_instance, dtype) {
		var entries = {
			title: "%H: Conntrack entries",
			vlabel: "Count",
			number_format: "%5.0lf",
			data: {
				/* collectd 5.5+: specify "" to exclude "max" instance */
				instances: {
					conntrack: [ "" ]
				},
				sources: {
					conntrack: [ "value" ]
				},
				options: {
					conntrack: {
						color: "0000ff",
						title: "Tracked connections"
					}
				}
			}
		};

		var percent = {
			title: "%H: Conntrack usage",
			vlabel: "Percent",
			number_format: "%5.1lf%%",
			y_min: "0",
			alt_autoscale_max: true,
			data: {
				instances: {
					percent: [ "used" ]
				},
				options: {
					percent_used: {
						color: "00ff00",
						title: "Used"
					}
				}
			}
		};

		return [ entries, percent ];
	}
});
