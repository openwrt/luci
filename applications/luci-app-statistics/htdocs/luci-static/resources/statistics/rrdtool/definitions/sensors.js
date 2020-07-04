/* Licensed to the public under the Apache License 2.0. */

'use strict';
'require baseclass';

return baseclass.extend({
	title: _('Sensors'),

	rrdargs: function(graph, host, plugin, plugin_instance, dtype) {
		return {
			per_instance: true,
			title: "%H: %pi - %di",
			vlabel: "\xb0C",
			number_format: "%4.1lf\xb0C",
			data: {
				types: [ "temperature" ],
				options: {
					temperature__value: {
						color: "ff0000",
						title: "Temperature"
					}
				}
			}
		};
	}
});
