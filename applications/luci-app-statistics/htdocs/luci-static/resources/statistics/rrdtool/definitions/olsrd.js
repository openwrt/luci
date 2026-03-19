/*
 * Copyright 2011 Manuel Munz <freifunk at somakoma dot de>
 * Licensed to the public under the Apache License 2.0.
 */

'use strict';
'require baseclass';

return baseclass.extend({
	title: _('OLSRd'),

	rrdargs(graph, host, plugin, plugin_instance, dtype) {
		const g = [];

		if (plugin_instance == "routes") {
			g.push({
				/* diagram data description */
				title: "%H: Total amount of OLSR routes",
				vlabel: "n",
				number_format: "%5.0lf",
				data: {
					types: [ "routes" ],
					options: {
						routes: {
							color: "ff0000",
							title: "Total number of routes"
						}
					}
				}
			}, {
				title: "%H: Average route ETX",
				vlabel: "ETX",
				detail: true,
				number_format: "%5.1lf",
				data: {
					instances: [ "average" ], /* falls es irgendwann mal welche pro ip gibt, wie bei links, dann werden die hier excludiert */
					types: [ "route_etx" ],
					options: {
						route_etx: {
							title: "Average route ETX"
						}
					}
				}
			}, {
				title: "%H: Average route metric",
				vlabel: "metric",
				detail: true,
				number_format: "%5.1lf",
				data: {
					instances: [ "average" ], /* falls es irgendwann mal welche pro ip gibt, wie bei links, dann werden die hier excludiert */
					types: [ "route_metric" ],
					options: {
						route_metric: {
							title: "Average route metric"
						}
					}
				}
			});
		}
		else if (plugin_instance == "links") {
			g.push({
				/* diagram data description */
				title: "%H: Total amount of OLSR neighbours",
				vlabel: "n",
				number_format: "%5.0lf",
				data: {
					instances: [ "" ],
					types: [ "links" ],
					options: {
						links: {
							color: "00ff00",
							title: "Number of neighbours"
						}
					}
				}
			});

			const instances = graph.dataInstances(host, plugin, plugin_instance, "signal_quality").sort();

			/* define one diagram per host, containing the rx and lq values */
			for (let i = 0; i < instances.length; i += 2) {
				const dsn1 = "signal_quality_%s_value".format(instances[i].replace(/\W+/g, '_'));
				const dsn2 = "signal_quality_%s_value".format(instances[i+1].replace(/\W+/g, '_'));
				let host = instances[i].match(/^[^-]+-([^-]+)-.+$/);
				host = host ? host[1] : 'avg';
				const opts = {};

				opts[dsn1] = { color: "00ff00", title: "LQ (%s)".format(host) };
				opts[dsn2] = { color: "0000ff", title: "NLQ (%s)".format(host), flip: true };

				g.push({
					title: "%%H: Signal Quality (%s)".format(host),
					vlabel: "ETX",
					number_format: "%5.2lf", detail: true,
					data: {
						types: [ "signal_quality" ],

						instances: {
							signal_quality: [ instances[i], instances[i+1] ],
						},

						options: opts
					}
				});
			}
		}
		else if (plugin_instance == "topology") {
			g.push({
				title: "%H: Total amount of OLSR links",
				vlabel: "n",
				number_format: "%5.0lf",
				data: {
					instances: [ "" ],
					types: [ "links" ],
					options: {
						links: {
							color: "0000ff",
							title: "Total number of links"
						}
					}
				}
			}, {
				title: "%H: Average signal quality",
				vlabel: "n",
				number_format: "%5.2lf",
				detail: true,
				data: {
					instances: [ "average" ], /* exclude possible per-ip stuff */
					types: [ "signal_quality" ],
					options: {
						signal_quality: {
							color: "0000ff",
							title: "Average signal quality"
						}
					}
				}
			});
		}

		return g;
	}
});
