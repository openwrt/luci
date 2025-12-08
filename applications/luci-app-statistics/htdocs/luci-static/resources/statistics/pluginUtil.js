'use strict';
'require baseclass';
'require form';
'require uci';
'require fs';

/**
 * Shared utilities for statistics plugin form generation
 */
return baseclass.extend({
	fillIntervalOption: function(o) {
			o.default = uci.get("luci_statistics", "collectd", "Interval");
			o.rmempty = true;
			o.optional = true;
			o.placeholder = '<number>y/mon/w/d/h/min/m/s';
			o.validate = function(section_id, value) {
				if (value == '')
					return true;
				if (value.match(/^[0-9]+(?:y|m|w|d|h|min|years?|months?|weeks?|days?|hours?)?$/))
					return true;
				return _('Expecting valid time range');
			};
			o.depends('enable', '1');
	},
	/**
	 * Add common options for plugins
	 * @param {Object} section - The form section
	 */
	addCommonOptions: function(section, omitInterval) {
		var o;
		o = section.option(form.Flag, 'enable', _('Enable this plugin'));

		if (!omitInterval) {
			o = section.option(form.Value, 'Interval', _('Interval'), _('Seconds if number. Defaults to overall interval'));
			this.fillIntervalOption(o);
		}

		return section;
	},

	addCommonTabOptions: function(section, tn, omitInterval) {
		var o;
		o = section.taboption(tn, form.Flag, 'enable', _('Enable this plugin'));

		if (!omitInterval) {
			o = section.taboption(tn, form.Value, 'Interval', _('Interval'), _('Seconds if number. Defaults to overall interval'));
			this.fillIntervalOption(o);
		}

		return section;
	},

	loadDisks: async function() {
    	return fs.list('/sys/block/').then(function(diskList) {
    	    res = [];
			for (var i = 0; i < diskList.length; i++) {
				var diskName = diskList[i].name;
				var m = diskName.match(/^(sd|hd|nvme|mmc|vd).*/) || diskName.match(/^cciss/);
				if (m)
					res.push(m[0]);
			}
			return res;
		});
	},

	selectedDisks: async function (sel_disks, reverted) {
		// unlike for children section of attributes, for general works simply via s.section:
		sel_disks = sel_disks || [];

		const selected = Array.isArray(sel_disks) ? sel_disks : [ sel_disks ];

		if (!reverted || (reverted == '0'))
			return selected;

		var allDisks = await loadDisks();
		return allDisks.filter(function(d) {return selected.indexOf(d) === -1;}).sort();
	}
});
