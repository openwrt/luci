/* Licensed to the public under the Apache License 2.0. */

'use strict';
'require baseclass';

return baseclass.extend({
	title: _('Disk Space Usage'),

	rrdargs: function(graph, host, plugin, plugin_instance, dtype) {
		var df_complex = {
			title: "%H: Disk space usage on %pi",
			vlabel: "Bytes",
			number_format: "%5.1lf%sB",

			data: {
				instances: {
					df_complex: [ "free", "used", "reserved" ]
				},

				options: {
					df_complex_free: {
						color: "00ff00",
						overlay: false,
						title: "free"
					},

					df_complex_used: {
						color: "ff0000",
						overlay: false,
						title: "used"
					},

					df_complex_reserved: {
						color: "0000ff",
						overlay: false,
						title: "reserved"
					}
				}
			}
		};

		var percent_bytes = {
			title: "%H: Disk space usage on %pi",
			vlabel: "Percent",
			number_format: "%5.2lf %%",

			data: {
				instances: {
					percent_bytes: [ "free", "used", "reserved" ]
				},

				options: {
					percent_bytes_free: {
						color: "00ff00",
						overlay: false,
						title: "free"
					},

					percent_bytes_used: {
						color: "ff0000",
						overlay: false,
						title: "used"
					},

					percent_bytes_reserved: {
						color: "0000ff",
						overlay: false,
						title: "reserved"
					}
				}
			}
		};

		var types = graph.dataTypes(host, plugin, plugin_instance);
		var p = [];

		for (var i = 0; i < types.length; i++)
			if (types[i] == 'percent_bytes')
				p.push(percent_bytes);
			else if (types[i] == 'df_complex')
				p.push(df_complex);

		return p;
	}
});
