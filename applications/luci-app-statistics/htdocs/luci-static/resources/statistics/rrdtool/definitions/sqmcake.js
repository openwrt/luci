/* Licensed to the public under the Apache License 2.0. */

'use strict';
'require baseclass';

return baseclass.extend({
	title: _('SQM-Cake'),

	rrdargs: function(graph, host, plugin, plugin_instance, dtype) {
		var tindrops = {
			per_instance: true,
			title: "%H: CAKE %pi %di Drops/s & Backlog",
			vlabel: "Bytes & Drops/s",
			rrdopts: [ "--logarithmic" ],
			number_format: "%5.0lf",
			data: {
				types: [ "qdisct_backlog", "qdisct_drops" ],
				sources: { qdisct_drops: [ "ack", "drops", "ecn" ] },
				options: {
					qdisct_backlog: { title: "Backlog:", overlay: true, color: "0000ff" },
					qdisct_drops__ack: { title: "Ack:", overlay: true, noarea: true, color: "ff00ff" },
					qdisct_drops__drops: { title: "Drops:", overlay: true, noarea: true, color: "00ffff" },
					qdisct_drops__ecn: { title: "Ecn:", overlay: true, noarea: true, color: "00ff00" }
				}
			}
		};

		var tinlatency = {
			per_instance: true,
			title: "%H: CAKE %pi %di Latency",
			vlabel: "ms",
			number_format: "%4.3lf",
			data: {
				types: [ "qdisct_latencyus" ],
				sources: { qdisct_latencyus: [ "tg", "pk", "av", "sp" ] },
				options: {
					qdisct_latencyus__tg: { title: "Target:", overlay: true, noarea: true, color: "000000", transform_rpn: "1000,/" },
					qdisct_latencyus__pk: { title: "Peak:", overlay: true, noarea: true, color: "ff0000", transform_rpn: "1000,/" },
					qdisct_latencyus__av: { title: "Avg:", overlay: true, noarea: true, color: "00ff00", transform_rpn: "1000,/" },
					qdisct_latencyus__sp: { title: "Sparse:", overlay: true, noarea: true, color: "0000ff", transform_rpn: "1000,/" }
				}
			}
		};

		var tinflows = {
			per_instance: true,
			title: "%H: CAKE %pi %di Flow Counts",
			vlabel: "Flows",
			number_format: "%4.0lf",
			data: {
				types: [ "qdisct_flows" ],
				sources: { qdisct_flows: [ "sp", "bu", "un" ] },
				options: {
					qdisct_flows__sp: { title: "Sparse:", overlay: true, noarea: true, color: "00ff00" },
					qdisct_flows__bu: { title: "Bulk:", overlay: true, noarea: true, color: "0000ff" },
					qdisct_flows__un: { title: "Unresponsive:", overlay: true, noarea: true, color: "ff0000" }
				}
			}
		};

		var tinbytes = {
			per_instance: true,
			title: "%H: CAKE %pi %di Traffic",
			vlabel: "Kb/s",
			number_format: "%5.0lf",
			rrdopts: [ "--logarithmic" ],
			data: {
				types: [ "qdisct_bytes", "qdisct_thres" ],
				options: {
					qdisct_bytes: { title: "Kb/s:", noarea: false, color: "0000ff", transform_rpn: "125,/" },
					qdisct_thres: { title: "Thres:", overlay: true, noarea: true, color: "000000", transform_rpn: "125,/" }
				}
			}
		};

		return [ tinbytes, tinlatency, tindrops, tinflows ];
	}
});
