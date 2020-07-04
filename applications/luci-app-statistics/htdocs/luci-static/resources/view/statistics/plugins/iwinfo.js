'use strict';
'require baseclass';
'require form';
'require tools.widgets as widgets';

return baseclass.extend({
	title: _('Wireless iwinfo Plugin Configuration'),
	description: _('The iwinfo plugin collects statistics about wireless signal strength, noise and quality.'),

	addFormOptions: function(s) {
		var o;

		o = s.option(form.Flag, 'enable', _('Enable this plugin'));

		o = s.option(widgets.DeviceSelect, 'Interfaces', _('Monitor interfaces'), _('Leave unselected to automatically determine interfaces to monitor.'));
		o.multiple = true;
		o.noaliases = true;
		o.noinactive = true;
		o.depends('enable', '1');
		o.filter = function(section_id, name) {
			var dev = this.devices.filter(function(dev) { return dev.getName() == name })[0];
			return (dev && dev.getType() == 'wifi');
		};

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
