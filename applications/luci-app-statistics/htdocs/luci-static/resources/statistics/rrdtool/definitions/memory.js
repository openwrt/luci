/*
 * Copyright  2011 Manuel Munz <freifunk at somakoma dot de>
 * Licensed to the public under the Apache License 2.0.
 */

'use strict';
'require baseclass';

return baseclass.extend({
	title: _('Memory'),

	rrdargs: function(graph, host, plugin, plugin_instance, dtype) {
		var definitions = [];
		var instances;

		function find_instances(dtype, wanted) {
			var matching = graph.dataInstances(host, plugin, plugin_instance, dtype).filter(function(instance) {
				return wanted.indexOf(instance) > -1;
			});

			return matching.length ? { [dtype]: matching } : null;
		}

		if ((instances = find_instances('memory', [ 'free', 'buffered', 'cached', 'used', 'active', 'cache', 'inactive', 'wired' ])) != null) {
			definitions.push({
				title: "%H: Memory usage",
				vlabel: "MB",
				number_format: "%5.1lf%s",
				y_min: "0",
				alt_autoscale_max: true,
				data: {
					instances: instances,
					options: {
						memory_free: { color: "00ff00", title: "Free" },
						memory_buffered: { color: "0000ff", title: "Buffered" },
						memory_cached: { color: "ff00ff", title: "Cached" },
						memory_used: { color: "ff0000", title: "Used" },
						memory_active: { color: "e00000", title: "Active" },
						memory_cache: { color: "ff00ff", title: "Cache" },
						memory_inactive: { color: "0000ff", title: "Inactive" },
						memory_wired: { color: "ff0000", title: "Wired" }
					}
				}
			});
		}

		if ((instances = find_instances('percent', [ 'free', 'buffered', 'cached', 'used', 'active', 'cache', 'inactive', 'wired' ])) != null) {
			definitions.push({
				title: "%H: Memory usage",
				vlabel: "MB",
				number_format: "%5.1lf%s",
				y_min: "0",
				alt_autoscale_max: true,
				data: {
					instances: instances,
					options: {
						percent_free: { color: "00ff00", title: "Free" },
						percent_buffered: { color: "0000ff", title: "Buffered" },
						percent_cached: { color: "ff00ff", title: "Cached" },
						percent_used: { color: "ff0000", title: "Used" },
						percent_active: { color: "e00000", title: "Active" },
						percent_cache: { color: "ff00ff", title: "Cache" },
						percent_inactive: { color: "0000ff", title: "Inactive" },
						percent_wired: { color: "ff0000", title: "Wired" }
					}
				}
			});
		}

		return definitions;
	}
});
