'use strict';
'require baseclass';
'require form';

return baseclass.extend({
	title: _('APCUPS Plugin Configuration'),
	description: _('The APCUPS plugin collects statistics about the APC UPS.'),

	addFormOptions: function(s) {
		var o;

		o = s.option(form.Flag, 'enable', _('Enable this plugin'));

		o = s.option(form.Value, 'Host', _('Monitor host'));
		o.default = 'localhost';
		o.datatype = 'host';
		o.depends('enable', '1');

		o = s.option(form.Value, 'Port', _('Port for apcupsd communication'));
		o.default = '3551';
		o.datatype = 'port';
		o.depends('enable', '1');
	},

	configSummary: function(section) {
		return _('Monitoring APC UPS at host %s, port %d').format(section.Host || 'localhost', section.Port || 3551);
	}
});
