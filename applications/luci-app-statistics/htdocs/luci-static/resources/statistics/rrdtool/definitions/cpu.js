/* Licensed to the public under the Apache License 2.0. */

'use strict';
'require baseclass';
'require uci';

return baseclass.extend({
	title: _('Processor'),

	rrdargs: function(graph, host, plugin, plugin_instance, dtype) {
		var p = [];

		var title = "%H: Processor usage";

		if (plugin_instance != '')
			title = "%H: Processor usage on core #%pi";

		var show_idle = uci.get("luci_statistics", "collectd_cpu", "ShowIdle") == "1" ? true : false;

		if (uci.get("luci_statistics", "collectd_cpu", "ReportByState") == "1") {
			var cpu = {
				title: title,
				y_min: "0",
				alt_autoscale_max: true,
				vlabel: "Jiffies",
				number_format: "%5.1lf",
				data: {
					instances: {
						cpu: [
							...(show_idle ? ["idle"] : []),
							"interrupt",
							"nice",
							"softirq",
							"steal",
							"system",
							"user",
							"wait"
						]
					},
					options: {
						cpu_idle: {
							color: "ffffff",
							title: "Idle"
						},
						cpu_interrupt: {
							color: "a000a0",
							title: "Interrupt"
						},
						cpu_nice: {
							color: "00e000",
							title: "Nice"
						},
						cpu_softirq: {
							color: "ff00ff",
							title: "Softirq"
						},
						cpu_steal: {
							color: "000000",
							title: "Steal"
						},
						cpu_system: {
							color: "ff0000",
							title: "System"
						},
						cpu_user: {
							color: "0000ff",
							title: "User"
						},
						cpu_wait: {
							color: "ffb000",
							title: "Wait"
						}
					}
				}
			};

			var percent = {
				title: title,
				y_min: "0",
				alt_autoscale_max: true,
				vlabel: "Percent",
				number_format: "%5.1lf%%",
				data: {
					instances: {
						percent: [
							...(show_idle ? ["idle"] : []),
							"interrupt",
							"nice",
							"softirq",
							"steal",
							"system",
							"user",
							"wait"
						]
					},
					options: {
						percent_idle: {
							color: "ffffff",
							title: "Idle"
						},
						percent_interrupt: {
							color: "a000a0",
							title: "Interrupt"
						},
						percent_nice: {
							color: "00e000",
							title: "Nice"
						},
						percent_softirq: {
							color: "ff00ff",
							title: "Softirq"
						},
						percent_steal: {
							color: "000000",
							title: "Steal"
						},
						percent_system: {
							color: "ff0000",
							title: "System"
						},
						percent_user: {
							color: "0000ff",
							title: "User"
						},
						percent_wait: {
							color: "ffb000",
							title: "Wait"
						}
					}
				}
			};

			var types = graph.dataTypes(host, plugin, plugin_instance);

			for (var i = 0; i < types.length; i++)
				if (types[i] == 'cpu')
					p.push(cpu);
				else if (types[i] == 'percent')
					p.push(percent);
		}
		else {
			p = {
				title: title,
				y_min: "0",
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

		return p;
	}
});
