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
			title = "Category: %pi";

		var if_octets = {
			title: title,
			y_min: "0",
			alt_autoscale_max: true,
			vlabel: "Bytes/s",
			data: {
				instances: {
					if_octets: [ "3g_wwan", "eth1"]
				},
				sources: {
					if_octets: [ "tx", "rx" ],
					if_octets: [ "tx", "rx" ]
				},
				options: {
					if_octets_eth1_tx: {
						total: true,		/* report total amount of bytes */
						color: "0000ff",	/* eth1 is blue */
						title: "Viasat Bytes (TX)"
					},
					if_octets_eth1_rx: {
						flip : true,		/* flip rx line */
						total: true,		/* report total amount of bytes */
						color: "0000ff",	/* eth1 is blue */
						title: "Viasat Bytes (RX)"
					},

					if_octets_3g_wwan_tx: {
						total: true,		/* report total amount of bytes */
						color: "00ff00",	/* 3g_wwan is green */
						title: "TMobile LTEBytes (TX)"
					},
					if_octets_3g_wwan_rx: {
						flip : true,		/* flip rx line */
						total: true,		/* report total amount of bytes */
						color: "00ff00",	/* 3g_wwan is green */
						title: "TMobile LTEBytes (RX)"
					}
				}
			}
		};

		var types = graph.dataTypes(host, plugin, plugin_instance);

		for (var i = 0; i < types.length; i++)
			if (types[i] == 'cpu')
				p.push(cpu);
			else if (types[i] == 'if_octets')
				p.push(if_octets);

		return p;
	}
});
