'use strict';
'require baseclass';
'require form';
'require tools.widgets as widgets';

return baseclass.extend({
	title: _('Interface Plugin Configuration'),
	description: _('The interface plugin collects traffic statistics on selected interfaces.'),

	addFormOptions: function(s) {
		var o;

		o = s.option(form.Flag, 'enable', _('Enable this plugin'));

		o = s.option(widgets.DeviceSelect, 'Interfaces', _('Monitor interfaces'));
		o.multiple = true;
		o.noaliases = true;
		o.default = 'br-lan';
		o.depends('enable', '1');

		o = s.option(form.Flag, 'IgnoreSelected', _('Monitor all except specified'));
		o.depends('enable', '1');
	},

	configSummary: function(section) {
		var ifaces = L.toArray(section.Interfaces),
		    invert = section.IgnoreSelected == '1';

		if (ifaces.length == 0)
			return _('Monitoring all interfaces');
		else if (invert)
			return N_(ifaces.length, 'Monitoring all but one interface', 'Monitoring all but %d interfaces').format(ifaces.length);
		else
			return N_(ifaces.length, 'Monitoring one interface', 'Monitoring %d interfaces').format(ifaces.length);
	}
});
