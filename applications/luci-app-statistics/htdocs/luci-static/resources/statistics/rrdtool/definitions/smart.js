/* Licensed to the public under the Apache License 2.0. */

'use strict';
'require baseclass';
'require uci';
'require statistics.pluginUtil as pluginUtil';

return baseclass.extend({
	title: _('S.M.A.R.T.'),

	getAttrsByDisk: function(disk) {
		var attrs = [], sources, sources_vals, res = [];

		// see types.db on how these values are named
		uci.sections('luci_statistics', 'statistics_smart_attrs', function(s) {
			if (s.disk === disk && Array.isArray(s.attr_ids)) {
				attrs.push(...s.attr_ids);
			}
		});

		for (let attr of attrs) {
			if (attr.startsWith("smart_attribute")) {
				sources_vals = [ "current", "worst", "threshold", "pretty" ];
			} else {
				sources_vals = [ "value" ];
			}
			// make it bit shorter as attributes have limit in length in call of rrdtool (within DEF/CDEF):
			let attr_cut = attr.replace(/^(smart_attribute-|nvme_)/, '');
			let options = {};
			for (let src of sources_vals) {
				options[`${attr_cut}__` + src] = {
					title: src,
					flip: false
				};
			}
			sources = {};
			sources[attr_cut] = sources_vals;
			res.push({
					title: "%H: S.M.A.R.T. on %pi: " + attr_cut,
					vlabel: attr_cut,
					number_format: "%5.1lf",
					detail: true,
					data: {
						types_orig: [ attr ],
						types: [ attr_cut ],
						sources: sources,
						options: options
					}
			});
		}
		return res;
	},

	rrdargs: async function(graph, host, plugin, plugin_instance) {
		
		var allowed_disks = await pluginUtil.selectedDisks(
				uci.get("luci_statistics", "collectd_smart", "Disks"),
				uci.get("luci_statistics", "collectd_smart", "IgnoreSelected"));
		
		// say, if old statistics remains in rrd, but disk was deselected after that:
		if (!allowed_disks.includes(plugin_instance)) {
			return [];
		}
		return this.getAttrsByDisk(plugin_instance);
	},

	hasInstanceDetails: true
});
