/*
 * Copyright  2011 Manuel Munz <freifunk at somakoma dot de>
 * Licensed to the public under the Apache License 2.0.
 */

'use strict';
'require baseclass';

return baseclass.extend({
	title: _('Memory'),

	rrdargs: function(graph, host, plugin, plugin_instance, dtype) {
		var p = [];

		var memory = {
			title: "%H: Memory usage",
			vlabel: "MB",
			number_format: "%5.1lf%s",
			y_min: "0",
			alt_autoscale_max: true,
			data: {
				instances: {
					memory: [
						"free",
						"buffered",
						"cached",
						"used"
					]
				},

				options: {
					memory_buffered: {
						color: "0000ff",
						title: "Buffered"
					},
					memory_cached: {
						color: "ff00ff",
						title: "Cached"
					},
					memory_used: {
						color: "ff0000",
						title: "Used"
					},
					memory_free: {
						color: "00ff00",
						title: "Free"
					}
				}
			}
		};

		var percent = {
			title: "%H: Memory usage",
			vlabel: "Percent",
			number_format: "%5.1lf%%",
			y_min: "0",
			alt_autoscale_max: true,
			data: {
				instances: {
					percent: [
						"free",
						"buffered",
						"cached",
						"used"
					]
				},
				options: {
					percent_buffered: {
						color: "0000ff",
						title: "Buffered"
					},
					percent_cached: {
						color: "ff00ff",
						title: "Cached"
					},
					percent_used: {
						color: "ff0000",
						title: "Used"
					},
					percent_free: {
						color: "00ff00",
						title: "Free"
					}
				}
			}
		};

		var types = graph.dataTypes(host, plugin, plugin_instance);

		for (var i = 0; i < types.length; i++)
			if (types[i] == 'percent')
				p.push(percent);
			else if (types[i] == 'memory')
				p.push(memory);

		return p;
	}
});
