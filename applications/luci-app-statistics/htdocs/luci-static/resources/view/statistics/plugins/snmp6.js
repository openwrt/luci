'use strict';
'require baseclass';
'require form';
'require tools.widgets as widgets';

return baseclass.extend({
	title: _('SNMP6 Plugin Configuration'),
	description: _('The snmp6 plugin collects IPv6 statistics for selected interfaces.'),

	addFormOptions: function(s) {
		var o;

		o = s.option(form.Flag, 'enable', _('Enable this plugin'));
		o.default = '0';

		o = s.option(widgets.DeviceSelect, 'Interfaces', _('Basic monitoring'));
		o.multiple = true;
		o.noaliases = true;
		o.depends('enable', '1');

		o = s.option(form.Flag, 'IgnoreSelected', _('Monitor all except specified'));
		o.depends('enable', '1');
	},

	configSummary: function(section) {
		var basic = L.toArray(section.Interfaces),
		    count = basic.length,
		    invert = section.IgnoreSelected == '1';

		if (invert && count == 0)
			return _('Monitoring all interfaces');
		else if (invert)
			return N_(count, 'Monitoring all but one interface', 'Monitoring all but %d interfaces').format(count);
		else if (count)
			return N_(count, 'Monitoring one interface', 'Monitoring %d interfaces').format(count);
	}
});
