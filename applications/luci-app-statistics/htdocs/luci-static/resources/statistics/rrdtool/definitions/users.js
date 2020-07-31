/* Licensed to the public under the Apache License 2.0. */

'use strict';
'require baseclass';

return baseclass.extend({
	title: _('Users'),

	rrdargs: function(graph, host, plugin, plugin_instance, dtype) {
		return {
			title: "%H: Users (console logins)",
			vlabel: "count",
			data: {
				types: [ "users" ],
				options: {
					users: {
						title: "Users %di",
					}
				}
			}
		};
	}
});
