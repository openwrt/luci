/* Licensed to the public under the Apache License 2.0. */

'use strict';
'require baseclass';

return baseclass.extend({
	title: _('OpenVPN'),

	rrdargs: function(graph, host, plugin, plugin_instance, dtype) {
		var inst = plugin_instance.replace(/^openvpn\.(.+)\.status$/, '$1');
		const types = graph.dataTypes(host, plugin, plugin_instance);
		const rv = [];
		let instances;
		const typeinstances = graph.dataInstances(host, plugin, plugin_instance, "if_octets").sort();

		function find_instances(dtype, wanted) {
			const matching = graph.dataInstances(host, plugin, plugin_instance, dtype).filter(function(instance) {
				return wanted.indexOf(instance) > -1;
			});
			return matching.length ? { [dtype]: matching } : null;
		}

		if ((instances = find_instances('if_octets', ['overhead', 'traffic'])) !== null) {
			rv.push({
				title: "%%H: OpenVPN \"%s\" - Traffic".format(inst),
				vlabel: "Bytes/s",
				data: {
					instances: {
						if_octets: [ "traffic", "overhead" ]
					},
					sources: {
						if_octets: [ "tx", "rx" ]
					},
					options: {
						if_octets_traffic_tx : { weight: 0, title: "Bytes    (TX)", total: true, color: "00ff00" },
						if_octets_overhead_tx: { weight: 1, title: "Overhead (TX)", total: true, color: "ff9900" },
						if_octets_overhead_rx: { weight: 2, title: "Overhead (RX)", total: true, flip: true, color: "ff00ff" },
						if_octets_traffic_rx : { weight: 3, title: "Bytes    (RX)", total: true, flip: true, color: "0000ff" }
					}
				}
			});
		} else {
			for (const tinstance of typeinstances) {
				const rx = "if_octets_%s_rx".format(tinstance);
				const tx = "if_octets_%s_tx".format(tinstance);
				const opts = {};
				opts[tx] = { weight: 0, title: "Bytes " + tinstance + "   (TX)", total: true, color: "00ff00" };
				opts[rx] = { weight: 1, title: "Bytes " + tinstance + "   (RX)", total: true, flip: true, color: "0000ff" };

				rv.push({
					title: "%%H: OpenVPN Server \"%s\" - User Traffic - ".format(inst) + tinstance,
					vlabel: "Bytes/s",
					data: {
						instances: {
							if_octets: [ tinstance ]
						},
						sources: {
							if_octets: [ "tx", "rx" ]
						},
						options: opts
					}
				});
			}
		}

		if (types.indexOf('users') > -1) {
			let optionUsers = `users_${plugin_instance}`;
			let optsUsers = {};
			optsUsers[optionUsers] = { title: "Total users connected", color: "00ff00" };
			let userInstances = graph.dataInstances(host, plugin, plugin_instance, 'users');
			if (userInstances.length > 0) {
				rv.push({
					title: `%H: OpenVPN Server "${inst}" - Connected Users`,
					vlabel: "Users",
					y_min: "0",
					alt_autoscale_max: true,
					number_format: "%3.0lf",
					data: {
						instances: {
							users: userInstances
						},
						options: optsUsers
					}
				});
			} else {
				console.error('Source "value" not found in any user instances:', sources);
			}
		}

		if (types.indexOf('compression') > -1) {
		    rv.push({
				title: "%%H: OpenVPN \"%s\" - Compression".format(inst),
				vlabel: "Bytes/s",
				data: {
					instances: {
						compression: [ "data_out", "data_in" ]
					},
					sources: {
						compression: [ "uncompressed", "compressed" ]
					},
					options: {
						compression_data_out_uncompressed: { weight: 0, title: "Uncompressed (TX)", total: true, color: "00ff00" },
						compression_data_out_compressed  : { weight: 1, title: "Compressed   (TX)", total: true, color: "008800" },
						compression_data_in_compressed   : { weight: 2, title: "Compressed   (RX)", total: true, flip: true, color: "000088" },
						compression_data_in_uncompressed : { weight: 3, title: "Uncompressed (RX)", total: true, flip: true, color: "0000ff" }
					}
				}
			});
		}
		return rv;
	}
});
