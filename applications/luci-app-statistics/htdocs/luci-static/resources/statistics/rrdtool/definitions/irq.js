/* Licensed to the public under the Apache License 2.0. */

'use strict';
'require baseclass';

return baseclass.extend({
	title: _('Interrupts'),

	rrdargs: function(graph, host, plugin, plugin_instance, dtype) {
		return {
			title: "%H: Interrupts",
			vlabel: "Issues/s",
			number_format: "%5.0lf",
			data: {
				types: [ "irq" ],
				options: {
					irq: { title: "IRQ %di", noarea: true }
				}
			}
		};
	}
});
