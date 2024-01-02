'use strict';
'require form';
'require view';

return view.extend({
	render: function () {
		var m, s, o;

		m = new form.Map('udpxy', _('udpxy'),
			_('udpxy is a UDP-to-HTTP multicast traffic relay daemon, here you can configure the settings.'));

		s = m.section(form.TypedSection, 'udpxy');
		s.anonymous = true;
		s.addremove = true;

		o = s.option(form.Flag, 'disabled', _('Enabled'));
		o.enabled = '0';
		o.disabled = '1';
		o.default = o.disabled;
		o.rmempty = false;

		o = s.option(form.Flag, 'respawn', _('Respawn'));
		o.default = o.disabled;

		o = s.option(form.Flag, 'verbose', _('Verbose'));
		o.default = o.disabled;

		o = s.option(form.Flag, 'status', _('Status'));

		o = s.option(form.Value, 'bind', _('Bind IP/Interface'));
		o.datatype = 'or(ipaddr, network)';

		o = s.option(form.Value, 'port', _('Port'));
		o.datatype = 'port';

		o = s.option(form.Value, 'source', _('Source IP/Interface'));
		o.datatype = 'or(ipaddr, network)';

		o = s.option(form.Value, 'max_clients', _('Max clients'));
		o.datatype = 'range(1, 5000)';

		o = s.option(form.Value, 'log_file', _('Log file'));

		o = s.option(form.Value, 'buffer_size', _('Buffer size'));
		o.datatype = 'range(4096, 2097152)';

		o = s.option(form.Value, 'buffer_messages', _('Buffer messages'));
		o.datatype = 'or(-1, and(min(1),uinteger))';

		o = s.option(form.Value, 'buffer_time', _('Buffer time'));
		o.datatype = 'or(-1, and(min(1),uinteger))';

		o = s.option(form.Value, 'nice_increment', _('Nice increment'));
		o.datatype = 'or(and(max(-1),uinteger), and(min(1),uinteger))';

		o = s.option(form.Value, 'mcsub_renew', _('Multicast subscription renew'));
		o.datatype = 'or(0, range(30, 64000))';

		return m.render();
	}
});
