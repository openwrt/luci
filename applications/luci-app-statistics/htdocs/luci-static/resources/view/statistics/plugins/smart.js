'use strict';
'require baseclass';
'require form';
'require uci';
'require statistics.pluginUtil as pluginUtil';
'require fs';

function getLabels(keys) {
  return keys.reduce((acc, key) => {
    acc[key] = key;
    return acc;
  }, {});
}

function selectedDisks(s, fromUI) {
	var disks, ignore;
	if (fromUI) {
		disks = s.formvalue(s.section, 'Disks');
		ignore = s.formvalue(s.section, 'IgnoreSelected');
	} else {
		// neither formvalue nor cfgValue works here
		disks = uci.get("luci_statistics", "collectd_smart", "Disks");
		ignore = uci.get("luci_statistics", "collectd_smart", "IgnoreSelected")
	}

	return pluginUtil.selectedDisks(disks, ignore);
}

// a bit chicken-egg: i got attributes from statistics that supposed to be already formed.
// Could be done against this plugin but with no attributes configured first.
// will not run smartctl instead as it might not installed at all...
async function getDiskAttributes(disk, s) {
	if (!disk) {
		return [];
	}
	var host = uci.get("luci_statistics", "collectd", "Hostname") ||
	 	await fs.trimmed('/proc/sys/kernel/hostname');
	var rrd_path = uci.get("luci_statistics", "collectd_rrdtool", "DataDir") || "/tmp/rrd";
	rrd_path = rrd_path + '/' + host + '/smart-' + disk;
	var list = await L.resolveDefault(fs.list(rrd_path), []);
	return list.map(entry => entry.name.replace(/\.[^/.]+$/, '')).sort();
};

return baseclass.extend({
	title: _('S.M.A.R.T. Plugin Configuration'),
	description: _('Get S.M.A.R.T. attributes of disks.'),

	addFormOptions: function(s) {
		var o;
		var diskChild;
		var refreshChildren = async function(ev, section_id, value) {

			if (!diskChild || !diskChild.data) {
				return;
			}
			var sel_disks = await selectedDisks(s, true);

			// populated in cfgvalue - the only way to get proper UI sections
			for (const section in diskChild.data) {
				var uiElement = diskChild.getUIElement(section);
				if (!uiElement) {
					continue;
				}
				uiElement.clearChoices();
				uiElement.addChoices(sel_disks);
			}
		};

		s.tab('general', _('General Settings'));

		pluginUtil.addCommonTabOptions(s, 'general');

		o = s.taboption('general', form.DynamicList, 'Disks', _('Disks to monitor'),
			_('When none selected, all disks will be monitored.'));
		o.depends('enable', '1');
		o.load = async function(section_id) {
			const list = await pluginUtil.loadDisks();
			this.keylist = list;
			this.vallist = getLabels(list);
			return this.super('load', [section_id]);
		};
		o.onchange = refreshChildren;

		o = s.taboption('general', form.Flag, 'IgnoreSelected', _('Monitor all except specified'));
		o.onchange = refreshChildren;
		o.depends('enable', '1');

		o = s.taboption('general', form.Flag, 'IgnoreSleepMode', _('Monitor in sleep mode'), _('If false then do not monitor such disks which are in sleep mode'));
		o.depends('enable', '1');
		// attributes
		s.tab('attr', _('Render attributes'));
		o = s.taboption('attr', form.SectionValue, '__disk_attrs__', form.TableSection, 'statistics_smart_attrs',
			_('Configure which S.M.A.R.T. attributes to render for each disk'));
		o.depends('luci_statistics.collectd_smart.enable', '1');

		var ss = o.subsection;
		// i'd like to set anonymous=false and map section name right to 'disk' field
		// but have no idea how to do this:
		ss.anonymous = true;
		ss.addremove = true;
		// ListValue with appropriate ui.Select would be even better
		// if latter supported clearChoices/addChoices stuff...
		o = ss.option(form.RichListValue, 'disk', _('Disk'));
		diskChild = o;
		o.rmempty = false;
		o.optional = false;
		o.load = async function(section_id) {
			const disks = await selectedDisks(s, false);
			this.keylist = disks;
			this.vallist = getLabels(disks);
			return this.super('load', [section_id]);
		};

		o.onchange = async function(ev, section_id, value) {
			// Find the attr_ids field in the same section and trigger its re-render
			var attrField = this.section.children.filter(function(child) {
				return child.option === 'attr_ids';
			})[0];

			if (!attrField) {
				return;
			}
			
			var uiElement = attrField.getUIElement(section_id);
			
			if (!uiElement) {
				return;
			}
			uiElement.clearChoices();
			
			var newValues = await getDiskAttributes(value, s);
			uiElement.addChoices(newValues);
		};

		// Column 2: S.M.A.R.T. Attribute IDs (depends on selected disk)
		o = ss.option(form.DynamicList, 'attr_ids', _('S.M.A.R.T. Attribute IDs'));
		// cannot use load unlike previous two components as 
		// it depends on another component 'diskChild' that should be already populated at
		// least on config level:
		o.render = async function(option_index, section_id, in_table) {
			// Due to subsequenrt call of CB for each record 
			// seems all editors are populated only with last record values, therefore 
			// overriding all previous records.
			// No idea what to do instead. Let user suffer :( unless he 
			// came up with woekaround to change 1st column twice.
			if (!diskChild || !diskChild.data) {
				this.keylist = [];
				this.vallist = getLabels([]);
				return this.super('render', [option_index, section_id, in_table]);
			}
			var disk = diskChild.cfgvalue(section_id);
			// Clear existing values
			const attrs = await getDiskAttributes(disk, s);
			this.keylist = attrs;
			this.vallist = getLabels(attrs);
			return this.super('render', [option_index, section_id, in_table]);
		};
		
		o.rmempty = true;
	},

	configSummary: function(section) {
		var disks = L.toArray(section.Disks),
			invert = section.IgnoreSelected == '1';

		if (disks.length == 0)
			return _('Monitoring all disks');
		else if (invert)
			return N_(disks.length, 'Monitoring all but one disk', 'Monitoring all but %d disks').format(disks.length);
		else
			return N_(disks.length, 'Monitoring one disk', 'Monitoring %d disks').format(disks.length);
	}
});
