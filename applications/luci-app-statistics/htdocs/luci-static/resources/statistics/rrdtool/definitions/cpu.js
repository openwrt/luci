/* Licensed to the public under the Apache License 2.0. */

'use strict';
'require baseclass';
'require uci';

return baseclass.extend({
	title: _('Processor'),

	rrdargs: function(graph, host, plugin, plugin_instance, dtype) {
		var definitions = [];
		var instances;

		var title = "%H: Processor usage";

		if (plugin_instance != '')
			title = "%H: Processor usage on core #%pi";

		var show_idle = uci.get("luci_statistics", "collectd_cpu", "ShowIdle") == "1" ? true : false;

		function find_instances(dtype, wanted) {
			var matching = graph.dataInstances(host, plugin, plugin_instance, dtype).filter(function(instance) {
				return wanted.indexOf(instance) > -1;
			});
			
			return matching.length ? { [dtype]: matching } : null;
		}
		
		if (uci.get("luci_statistics", "collectd_cpu", "ReportByState") == "1") {
			if ((instances = find_instances('cpu', [...(show_idle ? ['idle'] : []), 'nice', 'user', 'wait', 'system', 'softirq', 'interrupt', 'steal'])) != null) {
				definitions.push({
					title: title,
					y_min: "0",
					alt_autoscale_max: true,
					vlabel: "Jiffies",
					number_format: "%5.1lf",
					data: {
						instances: instances,
						options: {
							cpu_idle: { color: "ffffff", title: "Idle"},
							cpu_nice: { color: "00e000", title: "Nice"},
							cpu_user: { color: "0000ff", title: "User"},
							cpu_wait: { color: "ffb000", title: "Wait I/O"},
							cpu_system: { color: "ff0000", title: "System"},
							cpu_softirq: { color: "ff00ff", title: "Softirq"},
							cpu_interrupt: { color: "a000a0", title: "Interrupt"},
							cpu_steal: { color: "000000", title: "Steal"}
						}
					}
				});
			}
			
			if ((instances = find_instances('percent', [...(show_idle ? ['idle'] : []), 'nice', 'user', 'wait', 'system', 'softirq', 'interrupt', 'steal'])) != null) {
				definitions.push({
					title: title,
                                        y_min: "0",
                                        alt_autoscale_max: true,
                                        vlabel: "Percent",
                                        number_format: "%5.1lf%%",
                                        data: {
                                                instances: instances,
                                                options: {
                                                        percent_idle: { color: "ffffff", title: "Idle"},
                                                        percent_nice: { color: "00e000", title: "Nice"},
                                                        percent_user: { color: "0000ff", title: "User"},
                                                        percent_wait: { color: "ffb000", title: "Wait I/O"},
                                                        percent_system: { color: "ff0000", title: "System"},
                                                        percent_softirq: { color: "ff00ff", title: "Softirq"},
                                                        percent_interrupt: { color: "a000a0", title: "Interrupt"},
                                                        percent_steal: { color: "000000", title: "Steal"}
                                                }
                                        }
                                });
                        }
		}
		else {
			definitions = {
				title: title,
				y_min: "0",
				y_max: "2",
				alt_autoscale_max: true,
				vlabel: "Percent",
				number_format: "%5.1lf%%",
				data: {
					instances: {
						percent: [
							"active",
						]
					},
					options: {
						percent_active: {
							color: "00e000",
							title: "Active"
						}
					}
				}
			};
		}

		return definitions;
	}
});
