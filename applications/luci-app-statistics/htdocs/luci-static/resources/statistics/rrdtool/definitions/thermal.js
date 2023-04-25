/* Licensed to the public under the Apache License 2.0. */

'use strict';
'require baseclass';

return baseclass.extend({
	title: _('Thermal'),

	rrdargs: function(graph, host, plugin, plugin_instance, dtype) {
		return {
			title: "%H: Temperature of %pi",
			alt_autoscale: true,
			vlabel: "Celsius",
			number_format: "%3.1lf%s",
			data: {
				types: [ "temperature" ],
				options: {
					temperature: {
						color: "ff0000",
						title: "Temperature",
						noarea: true
					}
				}
			}
		};
	}
});
