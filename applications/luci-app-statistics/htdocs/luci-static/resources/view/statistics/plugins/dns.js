'use strict';
'require baseclass';
'require form';
'require tools.widgets as widgets';

return baseclass.extend({
	title: _('DNS Plugin Configuration'),
	description: _('The dns plugin collects detailed statistics about dns related traffic on selected interfaces.'),

	addFormOptions: function(s) {
		var o;

		o = s.option(form.Flag, 'enable', _('Enable this plugin'));

		o = s.option(widgets.DeviceSelect, 'Interfaces', _('Monitor interfaces'),
			_('When none selected, all interfaces will be monitored.'));
		o.multiple = true;
		o.noaliases = true;
		o.default = 'br-lan';
		o.depends('enable', '1');

		o = s.option(form.DynamicList, 'IgnoreSources', _('Ignore source addresses'));
		o.datatype = 'ipaddr("nomask")';
		o.default = '127.0.0.1';
		o.depends('enable', '1');
	},

	configSummary: function(section) {
		var ifaces = L.toArray(section.Interfaces);

		if (ifaces.length == 0)
			return _('Monitoring DNS queries on all interfaces');
		else
			return N_(ifaces.length, 'Monitoring DNS queries on one interface', 'Monitoring DNS queries on %d interfaces').format(ifaces.length);
	}
});
