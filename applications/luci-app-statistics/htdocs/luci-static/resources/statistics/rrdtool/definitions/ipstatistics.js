/* Licensed to the public under the Apache License 2.0. */

'use strict';
'require baseclass';

return baseclass.extend({
	title: _('IP-Statistics'),

	rrdargs: function(graph, host, plugin, plugin_instance, dtype) {

		var traffic = {
			title: "%H: IPv4 and IPv6 Comparison",
			vlabel: "Bytes/s",
			number_format: "%5.1lf%sB/s",
			totals_format: "%5.1lf%sB",

			data: {
				sources: {
					ip_stats_octets: [ "ip4rx", "ip4tx", "ip6rx", "ip6tx" ]
				},

				options: {
					ip_stats_octets__ip4rx: {
						title: "IPv4 Bytes (RX)",
						total: true,
						color: "00ff00"
					},

					ip_stats_octets__ip4tx: {
						title: "IPv4 Bytes (TX)",
						flip : true,
						total: true,
						color: "0000ff"
					},

					ip_stats_octets__ip6rx: {
						title: "IPv6 Bytes (RX)",
						total: true,
						color: "ffff00"
					},

					ip_stats_octets__ip6tx: {
						title: "IPv6 Bytes (TX)",
						flip : true,
						total: true,
						color: "ff00ff"
					}
				}
			}
		};
		
		return [ traffic ]
	}
});
