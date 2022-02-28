/* Licensed to the public under the Apache License 2.0. */

'use strict';
'require baseclass';

return baseclass.extend({
	title: _('Application Category'),

	rrdargs: function(graph, host, plugin, plugin_instance, dtype) {
		/*
		 * traffic diagram
		 */
		var traffic = {

			/* draw this diagram for each plugin instance */
			per_instance: true,
			title: "%H: Transfer on %pi",
			vlabel: "Bytes/s",

			/* diagram data description */
			data: {
				/* defined sources for data types, if omitted assume a single DS named "value" (optional) */
				sources: {
					if_octets: [ "tx", "rx" ]
				},

				/* special options for single data lines */
				options: {
					if_octets__tx: {
						total: true,		/* report total amount of bytes */
						color: "00ff00",	/* tx is green */
						title: "Bytes (TX)"
					},

					if_octets__rx: {
						flip : true,		/* flip rx line */
						total: true,		/* report total amount of bytes */
						color: "0000ff",	/* rx is blue */
						title: "Bytes (RX)"
					}
				}
			}
		};

		return [ traffic ];
	}
});
