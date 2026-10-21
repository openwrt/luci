'use strict';
'require form';
'require uci';
'require view';
'require strongswan-swanctl.ikev1 as ikev1';
'require strongswan-swanctl.service as service';
'require tools.widgets as widgets';

function addLogLevel(o) {
	o.value('', _('Use daemon default'));
	o.value('-1', '%s: %s'.format('-1', _('Absolutely silent')));
	o.value('0', '%s: %s'.format('0', _('Very basic auditing logs')));
	o.value('1', '%s: %s'.format('1', _('Generic control flow with errors (default)')));
	o.value('2', '%s: %s'.format('2', _('More detailed debugging control flow')));
	o.value('3', '%s: %s'.format('3', _('Including RAW data dumps in hex')));
	o.value('4', '%s: %s'.format('4', _('Also include sensitive material in dumps, e.g. keys')));
	o.default = '';
}

function addLogSubsystems(s) {
	const subsystems = [
		[ 'app', _('Applications other than daemons') ],
		[ 'asn', _('Low-level encoding/decoding (ASN.1, X.509 etc.)') ],
		[ 'cfg', _('Configuration management and plugins') ],
		[ 'chd', _('CHILD_SA/IPsec_SA') ],
		[ 'dmn', _('Main daemon setup/cleanup/signal handling') ],
		[ 'enc', _('Packet encoding/decoding encryption/decryption operations') ],
		[ 'esp', '%s (%s)'.format(_('Library messages'), 'libipsec') ],
		[ 'ike', _('IKE_SA / ISAKMP SA') ],
		[ 'imc', _('Integrity Measurement Collector') ],
		[ 'imv', _('Integrity Measurement Verifier') ],
		[ 'job', _('Jobs queuing/processing and thread pool management') ],
		[ 'wch', _('File descriptor watcher') ],
		[ 'knl', _('IPsec/Networking kernel interface') ],
		[ 'lib', '%s (%s)'.format(_('Library messages'), 'libstrongswan') ],
		[ 'mgr', _('IKE_SA manager, handling synchronization for IKE_SA access') ],
		[ 'net', _('IKE network communication') ],
		[ 'pts', _('Platform Trust Service') ],
		[ 'tls', '%s (%s)'.format(_('Library messages'), 'libtls') ],
		[ 'tnc', _('Trusted Network Connect') ]
	];

	subsystems.forEach(function (subsys) {
		const o = s.option(form.ListValue, subsys[0], subsys[0], subsys[1]);
		addLogLevel(o);
	});
}

return view.extend({
	load: function () {
		return uci.load('ipsec').then(function () {
			let save = false;
			if (uci.get('ipsec', 'globals') == null) {
				uci.add('ipsec', 'globals', 'globals');
				save = true;
			}

			if (uci.get('ipsec', 'syslog') == null) {
				uci.add('ipsec', 'syslog', 'syslog');
				save = true;
			}

			if (uci.get('ipsec', 'netlink') == null) {
				uci.add('ipsec', 'netlink', 'netlink');
				save = true;
			}

			if (save)
				uci.save();
		});
	},
	render: function (result) {
		let m, s, o;

		m = new form.Map('ipsec', _('Service configuration'),
			_('On this page, you can configure the IPsec service.'));
		m.tabbed = true;

		// general settings
		s = m.section(form.NamedSection, 'globals', 'globals', _('General Settings'),
			_('Configure global service parameters.'));

		o = s.option(form.Flag, 'enabled', _('Enabled'),
			_('Start the IPsec service.'));
		o.default = '1';
		o.rmempty = false;

		o = s.option(widgets.NetworkSelect, 'interface', _('Listening Interfaces'),
			_('Interfaces that accept VPN traffic.') + '<br /> ' +
			_('Select an interface or leave empty for all interfaces.'));
		o.multiple = true;
		o.nocreate = true;
		o.optional = true;

		// syslog plugin settings
		s = m.section(form.NamedSection, 'syslog', 'syslog', _('Syslog Settings'),
			_('Configure how strongswan logs events, errors, and debug information.'));

		addLogSubsystems(s);

		// kernel-netlink plugin settings
		s = m.section(form.NamedSection, 'netlink', 'netlink', _('Netlink Settings'),
			_('Configure the kernel-netlink plugin options.'));

		o = s.option(form.Flag, 'install_routes_xfrmi', _('Install routes via XFRM interfaces'),
			_('When this is enabled, the routes for all XFRM interfaces are set automatically.'));
		o.default = '0';

		return m.render().then(function (node) {
			return service.prepend(node,
				_('Changes take effect once the IPsec service is enabled.'));
		}).then(function (node) {
			return ikev1.prepend(node);
		});
	}
});
