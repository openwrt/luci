/*
 * Copyright 2015 Hannu Nyman <hannu.nyman@iki.fi>
 * Licensed to the public under the Apache License 2.0
 */

'use strict';
'require baseclass';

return baseclass.extend({
	title: _('Entropy'),

	rrdargs: function(graph, host, plugin, plugin_instance, dtype) {
		return {
			title: "%H: Available entropy",
			vlabel: "bits",
			number_format: "%4.0lf",
			data: {
				types: [ "entropy" ],
				options: { entropy: { title: "Entropy %di" } }
			}
		};
	}
});
