/* Licensed to the public under the Apache License 2.0. */

'use strict';
'require baseclass';

return baseclass.extend({
	title: _('Context Switches'),

	rrdargs: function(graph, host, plugin, plugin_instance, dtype) {
		return {
			title: "%H: Context switches",
			alt_autoscale: true,
			vlabel: "Switches/s",
			number_format: "%5.0lf",
			data: {
				types: [ "contextswitch" ],
				sources: {
					contextswitch: [ "value" ]
				},
				options: {
					contextswitch: { color: "0000ff", title: "Context switches", noarea: true, overlay: true }
				}
			}
		};
	}
});
