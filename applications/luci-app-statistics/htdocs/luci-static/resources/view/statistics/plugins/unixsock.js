'use strict';
'require baseclass';
'require form';
'require tools.widgets as widgets';

return baseclass.extend({
	title: _('Unixsock Plugin Configuration'),
	description: _('The unixsock plugin creates a unix socket which can be used to read collected data from a running collectd instance.'),

	addFormOptions: function(s) {
		var o;

		o = s.option(form.Flag, 'enable', _('Enable this plugin'));

		o = s.option(form.Value, 'SocketFile', _('Socket path'));
		o.default = '/var/run/collectd/query.sock';
		o.depends('enable', '1');

		o = s.option(widgets.GroupSelect, 'SocketGroup', _('Socket group'), _('Change the ownership of the socket file to the specified group.'));
		o.placeholder = 'nogroup';
		o.optional = true;
		o.rmempty = true;
		o.depends('enable', '1');

		o = s.option(form.Value, 'SocketPerms', _('Socket permissions'));
		o.placeholder = '0770';
		o.optional = true;
		o.rmempty = true;
		o.depends('enable', '1');
	},

	configSummary: function(section) {
		if (section.SocketFile)
			return _('Socket %s active').format(section.SocketFile);
	}
});
