'use strict';
'require form';
'require view';

return view.extend({
	render: function () {
		var m, s, o;

		m = new form.Map('udpxy', _('udpxy'),
			_('udpxy is an IPTV stream relay, a UDP-to-HTTP multicast traffic relay daemon which forwards multicast UDP streams to HTTP clients.'));

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

		o = s.option(form.Flag, 'verbose', _('Verbose logging'));
		o.default = o.disabled;

		o = s.option(form.Flag, 'status', _('Client statistics'));

		o = s.option(form.Value, 'bind', _('HTTP Listen interface'));
		o.datatype = 'or(ipaddr, network)';
		o.placeholder = '0.0.0.0 || lan1';

		o = s.option(form.Value, 'port', _('Port'), _('Default') + ' : ' + '%s'.format('4022'));
		o.datatype = 'port';
		o.placeholder = '4022';

		o = s.option(form.Value, 'source', _('Multicast subscribe source interface'), _('Default') + ' : ' + '%s'.format('0.0.0.0'));
		o.datatype = 'or(ipaddr, network)';
		o.placeholder = '0.0.0.0 || br-lan';


		o = s.option(form.Value, 'max_clients', _('Client amount upper limit'));
		o.datatype = 'range(1, 5000)';

		o = s.option(form.Value, 'log_file', _('Log file'), _('Default') + ' : <code>/var/log/udpxy</code>');
		o.placeholder = '/var/log/udpxy';

		o = s.option(form.Value, 'buffer_size', _('Ingress buffer size'), _('Unit: bytes, Kb, Mb; Max 2097152 bytes'));
		o.placeholder = '4Kb';

		o = s.option(form.Value, 'buffer_messages', _('Buffer message amount'), _('-1 is all.'));
		o.datatype = 'or(-1, and(min(1),uinteger))';
		o.placeholder = '1';

		o = s.option(form.Value, 'buffer_time', _('Buffer time limit'), _('-1 is unlimited.'));
		o.datatype = 'or(-1, and(min(1),uinteger))';
		o.placeholder = '1';

		o = s.option(form.Value, 'nice_increment', _('Nice increment'));
		o.datatype = 'or(and(max(-1),uinteger), and(min(1),uinteger))';
		o.placeholder = '0';

		o = s.option(form.Value, 'mcsub_renew', _('Renew multicast subscription periodicity'), _('Unit: seconds; 0 is skip.'));
		o.datatype = 'or(0, range(30, 64000))';
		o.placeholder = '0';

		return m.render();
	}
});
