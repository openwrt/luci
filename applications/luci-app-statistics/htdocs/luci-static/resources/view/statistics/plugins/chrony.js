'use strict';
'require baseclass';
'require form';

return baseclass.extend({
	title: _('Chrony Plugin Configuration'),
	description: _('The chrony plugin will monitor chrony NTP server statistics'),

	addFormOptions: function(s) {
		var o;

		o = s.option(form.Flag, 'enable', _('Enable this plugin'));

		o = s.option(form.Value, 'Host', _('Host running chrony'),
			_('Possibly bug in collectd. Only 127.0.0.1 and localhost work'));
		o.default = '127.0.0.1';
		o.datatype = 'or(hostname,ipaddr("nomask"))';
		o.depends('enable', '1');

		o = s.option(form.Value, 'Port', _('Port for chronyd'));
		o.default = '323';
		o.datatype = 'port';
		o.depends('enable', '1');

		o = s.option(form.Value, 'Timeout', _('Timeout for polling chrony'), _('Seconds'));
		o.default = '2';
		o.datatype = 'range(0, 255)';
		o.depends('enable', '1');
	},

	configSummary: function(section) {
		return _('Chrony monitoring enabled');
	}
});
