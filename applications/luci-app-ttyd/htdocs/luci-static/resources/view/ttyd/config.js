'use strict';
'require view';
'require form';
'require tools.widgets as widgets';

return view.extend({
	render: function() {
		var m, s, o;

		m = new form.Map('ttyd');

		s = m.section(form.TypedSection, 'ttyd', _('ttyd Instance'));
		s.anonymous   = true;
		s.addremove   = true;
		s.addbtntitle = _('Add instance');

		o = s.option(form.Flag, 'enable', _('Enable'));
		o.default = true;

		s.option(form.Flag, 'unix_sock', _('UNIX socket'), _('Bind to UNIX domain socket instead of IP port'));

		o = s.option(form.Value, 'port', _('Port'), _('Port to listen (default: 7681, use `0` for random port)'));
		o.depends('unix_sock', '0');
		o.datatype    = 'port';
		o.placeholder = 7681;

		o = s.option(widgets.DeviceSelect, 'interface', _('Interface'), _('Network interface to bind (eg: eth0)'));
		o.depends('unix_sock', '0');
		o.nocreate    = true;

		o = s.option(form.Value, '_unix_sock_path', _('UNIX socket path'), _('UNIX domain socket path (eg: /var/run/ttyd.sock)'));
		o.depends('unix_sock', '1');
		o.ucioption = 'interface';
		o.retain = true;

		o = s.option(form.Value, 'credential', _('Credential'), _('Credential for Basic Authentication'));
		o.placeholder = 'username:password';

		o = s.option(form.Value, 'uid', _('User ID'), _('User id to run with'));
		o.datatype = 'uinteger';

		o = s.option(form.Value, 'gid', _('Group ID'), _('Group id to run with'));
		o.datatype = 'uinteger';

		o = s.option(form.Value, 'signal', _('Signal'), _('Signal to send to the command when exit it (default: 1, SIGHUP)'));
		o.datatype = 'uinteger';

		s.option(form.Flag, 'url_arg', _('Allow URL args'), _('Allow client to send command line arguments in URL (eg: http://localhost:7681?arg=foo&arg=bar)'));

		s.option(form.Flag, 'readonly', _('Read-only'), _('Do not allow clients to write to the TTY'));

		o = s.option(form.DynamicList, 'client_option', _('Client option'), _('Send option to client'));
		o.placeholder = 'key=value';

		o = s.option(form.Value, 'terminal_type', _('Terminal type'), _('Terminal type to report (default: xterm-256color)'));
		o.placeholder = 'xterm-256color';

		s.option(form.Flag, 'check_origin', _('Check origin'), _('Do not allow websocket connection from different origin'));

		o = s.option(form.Value, 'max_clients', _('Max clients'), _('Maximum clients to support (default: 0, no limit)'));
		o.datatype = 'uinteger';
		o.placeholder = '0';

		s.option(form.Flag, 'once', _('Once'), _('Accept only one client and exit on disconnection'));

		s.option(form.Value, 'index', _('Index'), _('Custom index.html path'));

		s.option(form.Flag, 'ipv6', _('IPv6'), _('Enable IPv6 support'));

		s.option(form.Flag, 'ssl', _('SSL'), _('Enable SSL'));

		o = s.option(form.Value, 'ssl_cert', _('SSL cert'), _('SSL certificate file path'));
		o.depends('ssl', '1');

		o = s.option(form.Value, 'ssl_key', _('SSL key'), _('SSL key file path'));
		o.depends('ssl', '1');

		o = s.option(form.Value, 'ssl_ca', _('SSL ca'), _('SSL CA file path for client certificate verification'));
		o.depends('ssl', '1');

		o = s.option(form.ListValue, 'debug', _('Debug'), _('Set log level (default: 7)'));
		o.value('1', _('Error'));
		o.value('3', _('Warning'));
		o.value('7', _('Notice'));
		o.value('15', _('Info'));
		o.default = '7';

		s.option(form.Value, 'command', _('Command'));

		s.option(form.Value, 'url_override', _('URL override'),
			_('Override URL in Terminal tab. For use with reverse proxy.') + '<br />' +
			_('Note that reverse proxied pages is NOT protected by password like LuCI.') + '<br />' +
			_('Make sure to set up another authorization method.'));

		return m.render();
	}
});
