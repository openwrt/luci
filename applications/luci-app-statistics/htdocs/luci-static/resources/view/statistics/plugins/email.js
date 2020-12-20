'use strict';
'require baseclass';
'require form';
'require tools.widgets as widgets';

return baseclass.extend({
	title: _('E-Mail Plugin Configuration'),
	description: _('The email plugin creates a unix socket which can be used to transmit email-statistics to a running collectd daemon. This plugin is primarily intended to be used in conjunction with Mail::SpamAssasin::Plugin::Collectd but can be used in other ways as well.'),

	addFormOptions: function(s) {
		var o;

		o = s.option(form.Flag, 'enable', _('Enable this plugin'));

		o = s.option(form.Value, 'SocketFile', _('Socket file'));
		o.default = '/var/run/collectd/email.sock';
		o.depends('enable', '1');

		o = s.option(widgets.GroupSelect, 'SocketGroup', _('Socket group'));
		o.default = 'nogroup';
		o.optional = true;
		o.depends('enable', '1');

		o = s.option(form.Value, 'SocketPerms', _('Socket permissions'));
		o.default = '0770';
		o.optional = true;
		o.depends('enable', '1');
		o.validate = function(section_id, v) {
			if (v == '')
				return true;

			if (!v.match(/^[0-7]{1,4}$/))
				return _('Expecting permssions in octal notation');

			return true;
		};

		o = s.option(form.Value, 'MaxConns', _('Maximum allowed connections'));
		o.datatype = 'range(1,16384)';
		o.default = '5';
		o.optional = true;
		o.depends('enable', '1');
	},

	configSummary: function(section) {
		if (section.SocketFile)
			return _('Awaiting email input at %s').format(section.SocketFile);
	}
});
