'use strict';
'require baseclass';
'require form';

return baseclass.extend({
	title: _('Processes Plugin Configuration'),
	description: _('The processes plugin collects information like cpu time, page faults and memory usage of selected processes.'),

	addFormOptions: function(s) {
		var o;

		o = s.option(form.Flag, 'enable', _('Enable this plugin'));

		o = s.option(form.DynamicList, 'Processes', _('Monitor processes'));
		o.default = 'uhttpd dropbear dnsmasq';
		o.depends('enable', '1');
	},

	configSummary: function(section) {
		var processes = L.toArray(section.Processes);

		if (processes.length)
			return N_(processes.length, 'Monitoring one process', 'Monitoring %d processes').format(processes.length);
		else
			return _('Basic process monitoring enabled');
	}
});
