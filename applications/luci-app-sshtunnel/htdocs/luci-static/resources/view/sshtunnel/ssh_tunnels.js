'use strict';
'require form';
'require fs';
'require uci';
'require ui';
'require view';

return view.extend({
	load: function () {
		return Promise.all([
			uci.load('sshtunnel'),
		]);
	},

	render: function (data) {
		var m, s, o;

		m = new form.Map('sshtunnel', _('SSH Tunnels'),
			_('This configures <a %s>SSH Tunnels</a>.')
				.format('href="https://openwrt.org/docs/guide-user/services/ssh/sshtunnel"')
		);

		s = m.section(form.GridSection, 'tunnelR', _('Remote Tunnels'),
			_('Forward a port on the remote host to a service on the local host.')
		);
		s.anonymous = true;
		s.addremove = true;
		s.nodescriptions = true;

		o = s.option(form.Flag, 'enabled', _('Enabled'));
		o.default = '1';

		o = _addServerOption(s);

		o = s.option(form.Value, 'remoteaddress', _('Remote address'),
			_('Bind IP address e.g. <code>192.168.1.1</code> or hostname e.g. <code>localhost</code>.') + '<br/>' +
			_('<code>*</code> means to listen all interfaces <b>including public</b>.')
		);
		o.datatype = 'or(host, "*")';
		o.default = '*';
		o.rmempty = false;

		o = s.option(form.Value, 'remoteport', _('Remote port'));
		o.placeholder = '80';
		o.datatype = 'port';
		o.rmempty = false;

		o = s.option(form.Value, 'localaddress', _('Local address'),
			_('Bind IP address e.g. <code>192.168.1.1</code> or hostname e.g. <code>localhost</code>.')
		);
		o.datatype = 'host';
		o.default = 'localhost';
		o.rmempty = false;

		o = s.option(form.Value, 'localport', _('Local port'));
		o.datatype = 'port';
		o.placeholder = '80';
		o.rmempty = false;


		s = m.section(form.GridSection, 'tunnelL', _('Local Tunnels'),
			_('Forward a port on the local host to a service on the remote host.')
		);
		s.anonymous = true;
		s.addremove = true;
		s.nodescriptions = true;

		o = s.option(form.Flag, 'enabled', _('Enabled'));
		o.default = '1';

		o = _addServerOption(s);

		o = s.option(form.Value, 'localaddress', _('Local address'),
			_('Bind IP address e.g. <code>192.168.1.1</code> or hostname e.g. <code>localhost</code>.') + '<br/>' +
			_('<code>*</code> means to listen all interfaces <b>including public</b>.')
		);
		o.datatype = 'or(host, "*")';
		o.placeholder = '192.168.1.1'; // not the default * public iface because a user must explicitly configure it
		o.rmempty = false;

		o = s.option(form.Value, 'localport', _('Local port'));
		o.datatype = 'port';
		o.placeholder = '80';
		o.rmempty = false;

		o = s.option(form.Value, 'remoteaddress', _('Remote address'),
			_('Bind IP address e.g. <code>192.168.1.1</code> or hostname e.g. <code>localhost</code>.')
		);
		o.datatype = 'host';
		o.default = 'localhost';
		o.rmempty = false;

		o = s.option(form.Value, 'remoteport', _('Remote port'));
		o.datatype = 'port';
		o.default = '80';
		o.rmempty = false;


		s = m.section(form.GridSection, 'tunnelD', _('Dynamic Tunnels'),
			_('SOCKS proxy via remote host.')
		);
		s.anonymous = true;
		s.addremove = true;
		s.nodescriptions = true;

		o = s.option(form.Flag, 'enabled', _('Enabled'));
		o.default = '1';

		o = _addServerOption(s);

		o = s.option(form.Value, 'localaddress', _('Local address'),
			_('Bind IP address e.g. <code>192.168.1.1</code> or hostname e.g. <code>localhost</code>.') + '<br/>' +
			_('<code>*</code> means to listen all interfaces <b>including public</b>.')
		);
		o.datatype = 'or(host, "*")';
		o.placeholder = '192.168.1.1'; // not the default * public iface because a user must explicitly configure it
		o.rmempty = false;

		o = s.option(form.Value, 'localport', _('Local port'));
		o.datatype = 'port';
		o.default = '1080';
		o.rmempty = false;


		s = m.section(form.GridSection, 'tunnelW', _('VPN Tunnels'),
			_('Configure TUN/TAP devices for VPN tunnels.')
		);
		s.anonymous = true;
		s.addremove = true;
		s.nodescriptions = true;

		o = s.option(form.Flag, 'enabled', _('Enabled'));
		o.default = '1';

		o = _addServerOption(s);

		o = s.option(form.ListValue, 'vpntype', _('VPN type'));
		o.value('point-to-point', 'TUN (point-to-point)');
		o.value('ethernet', 'TAP (ethernet)');
		o.default = 'point-to-point';

		o = s.option(form.Value, 'localdev', _('Local dev'));
		o.default = 'any';
		o.datatype = 'or("any", min(0))';
		o.rmempty = false;

		o = s.option(form.Value, 'remotedev', _('Remote dev'));
		o.default = 'any';
		o.datatype = 'or("any", min(0))';
		o.rmempty = false;

		return m.render();
	},
});

function _addServerOption(s) {
	var o = s.option(form.ListValue, 'server', _('Server'));
	o.datatype = 'uciname';
	o.rmempty = false;
	uci.sections('sshtunnel', 'server', function (s, sectionName) {
		o.value(sectionName, s.hostname ? '%s (%s)'.format(sectionName, s.hostname) : sectionName);
	});
	return o;
}
