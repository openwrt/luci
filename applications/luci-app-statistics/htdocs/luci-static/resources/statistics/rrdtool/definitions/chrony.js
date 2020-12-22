/* Licensed to the public under the Apache License 2.0. */

'use strict';
'require baseclass';
'require uci';

return baseclass.extend({
	title: _('Chrony'),

	rrdargs: function(graph, host, plugin, plugin_instance, dtype) {
		var offset = {
			title: "%H: Chrony - time offset",
			vlabel: "Time offset (ms)",
			number_format: "%9.3lf ms",
			data: {
				types: [ "time_offset" ],
				options: {
					time_offset_chrony: {
						noarea: true,
						overlay: true,
						color: "ff0000",
						title: "%di",
						transform_rpn: "1000,*"
					},
					time_offset: {
						noarea: true,
						overlay: true,
						title: "%di",
						transform_rpn: "1000,*"
					}
				}
			}
		};

		var stratum = {
			title: "%H: Chrony - clock stratum",
			vlabel: "Clock stratum",
			number_format: "%3.1lf%S",
			data: {
				types: [ "clock_stratum" ],
				options: {
					clock_stratum_chrony: {
						noarea: true,
						overlay: true,
						color: "ff0000",
						title: "%di"
					},
					clock_stratum: {
						noarea: true,
						overlay: true,
						title: "%di"
					}
				}
			}
		};

		return [ offset, stratum ];

	}
});

