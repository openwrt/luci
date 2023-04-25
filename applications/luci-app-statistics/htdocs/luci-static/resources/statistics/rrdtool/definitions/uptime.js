/*
Copyright 2013 Thomas Endt <tmo26@gmx.de>

Licensed under the Apache License, Version 2.0 (the License).
You may not use this file except in compliance with the License.
You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0
*/

'use strict';
'require baseclass';

return baseclass.extend({
	title: _('Uptime'),

	rrdargs: function(graph, host, plugin, plugin_instance, dtype) {
		return {
			title: "%H: Uptime",
			vlabel: "seconds",
			number_format: "%5.0lf%s",
			data: {
				types: [ "uptime" ],
				options: {
					uptime: {
						title: "Uptime %di",
						noarea: true
					}
				}
			}
		};
	}
});
