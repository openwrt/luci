'use strict';
'require baseclass';
'require fs';
'require form';

return baseclass.extend({
	title: _('Thermal Plugin Configuration'),
	description: _('The thermal plugin will monitor temperature of the system. Data is typically read from /sys/class/thermal/*/temp ( \'*\' denotes the thermal device to be read, e.g. thermal_zone1 )'),

	addFormOptions: function(s) {
		var o;

		o = s.option(form.Flag, 'enable', _('Enable this plugin'));

		o = s.option(form.DynamicList, 'Device', _('Monitor device(s) / thermal zone(s)'), _('Empty value = monitor all'));
		o.load = function(section_id) {
			return Promise.all([
				L.resolveDefault(fs.list('/sys/class/thermal'), []),
				L.resolveDefault(fs.list('/proc/acpi/thermal_zone'), [])
			]).then(L.bind(function(res) {
				var entries = res[0].concat(res[1]);

				for (var i = 0; i < entries.length; i++)
					if (entries[i].type == 'directory' && !entries[i].name.match(/^cooling_device/))
						o.value(entries[i].name);

				return this.super('load', [ section_id ]);
			}, this));
		};

		o.optional = true;
		o.depends('enable', '1');

		o = s.option(form.Flag, 'IgnoreSelected', _('Monitor all except specified'));
		o.default = '0';
		o.optional = true;
		o.depends('enable', '1');
	},

	configSummary: function(section) {
		var zones = L.toArray(section.Device),
		    invert = section.IgnoreSelected == '1';

		if (zones.length)
			return (invert
				? _('Monitoring all thermal zones except %s')
				: _('Monitoring thermal zones %s')
			).format(zones.join(', '));
		else
			return _('Monitoring all thermal zones');
	}
});
