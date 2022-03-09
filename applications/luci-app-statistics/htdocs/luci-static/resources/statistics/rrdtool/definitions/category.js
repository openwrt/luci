/* Licensed to the public under the Apache License 2.0. */

'use strict';
'require baseclass';
'require uci';

return baseclass.extend({
	title: _('Application Category'),

	rrdargs: function(graph, host, plugin, plugin_instance, dtype) {
		var p = [];

		var title = "%H: Traffic usage";

		if (plugin_instance != '')
			title = "Category=%pi traffic";

		var show_idle = uci.get("luci_statistics", "collectd_category", "ShowIdle") == "1" ? true : false;

		var total_bytes = {
			title: title,
			y_min: "0",
			alt_autoscale_max: true,
			vlabel: "Total Bytes",
			number_format: "%5.1lf%%",
			data: {
				instances: {
					total_bytes: [
						"3g_wwan",
						"eth1"
					]
				},
				options: {
					total_bytes_3g_wwan: {
						color: "ffffff",
						title: "TMobile LTE"
					},
					total_bytes_eth1: {
						color: "a000a0",
						title: "Viasat"
					}
				}
			}
		};

		var types = graph.dataTypes(host, plugin, plugin_instance);

		for (var i = 0; i < types.length; i++)
			if (types[i] == 'cpu')
				p.push(cpu);
			else if (types[i] == 'total_bytes')
				p.push(total_bytes);

		return p;
	}
});
