/* Licensed to the public under the Apache License 2.0. */

'use strict';
'require baseclass';

return baseclass.extend({
	title: _('SNMP6'),

	rrdargs: function(graph, host, plugin, plugin_instance, dtype) {

		var traffic = {
			title: "%H: IPv6 on %pi",
			vlabel: "Bytes/s",

			data: {
				sources: {
					if_octets: [ "tx", "rx" ]
				},

				options: {
					if_octets__tx: {
						title: "Bytes (TX)",
						total: true,
						color: "00ff00"
					},

					if_octets__rx: {
						title: "Bytes (RX)",
						flip : true,
						total: true,
						color: "0000ff"
					}
				}
			}
		};

		var mcast_traffic = {
			title: "%H: IPv6 Multicast-Traffic on %pi",
			vlabel: "Bytes/s",

			data: {
				sources: {
					if_octets_mcast: [ "tx", "rx" ]
				},

				options: {
					if_octets_mcast__tx: {
						title: "Bytes (TX)",
						total: true,
						color: "00ff00"
					},

					if_octets_mcast__rx: {
						title: "Bytes (RX)",
						flip : true,
						total: true,
						color: "0000ff"
					}
				}
			}
		};


		var bcast_traffic = {
			title: "%H: IPv6 Broadcast-Traffic on %pi",
			vlabel: "Bytes/s",

			data: {
				sources: {
					if_octets_bcast: [ "tx", "rx" ]
				},

				options: {
					if_octets_bcast__tx: {
						title: "Bytes (TX)",
						total: true,
						color: "00ff00"
					},

					if_octets_bcast__rx: {
						title: "Bytes (RX)",
						flip : true,
						total: true,
						color: "0000ff"
					}
				}
			}
		};
		
		return [ traffic, mcast_traffic, bcast_traffic ]
	}
});
