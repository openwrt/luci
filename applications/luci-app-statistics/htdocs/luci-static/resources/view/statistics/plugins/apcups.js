'use strict';
'require form';

return L.Class.extend({
	title: _('APCUPS Plugin Configuration'),
	description: _('The APCUPS plugin collects statistics about the APC UPS.'),

	addFormOptions: function(s) {
		var o;

		o = s.option(form.Flag, 'enable', _('Enable this plugin'));
		o.default = '0';

		o = s.option(form.DynamicList, 'Host', _('Monitor host'));
		o.default = 'localhost';
		o.datatype = 'host';
		o.depends('enable', '1');

		o = s.option(form.Value, 'Port', _('Port for apcupsd communication'));
		o.default = '3551';
		o.datatype = 'port';
		o.depends('enable', '1');
	},

	configSummary: function(section) {
		var hosts = L.toArray(section.Host);
		if (hosts.length)
			return N_(hosts.length,
				'Monitoring APC UPS at host %s, port %d',
				'Monitoring APC UPS at hosts %s, port %d'
			).format(hosts.join(', '), section.Port || 3551);
	}
});
