'use strict';
'require view';
'require dom';
'require poll';
'require uci';
'require ui';
'require rpc';
'require form';

const callInitAction = rpc.declare({
	object: 'luci',
	method: 'setInitAction',
	params: ['name', 'action'],
	expect: { result: false }
});

const callUpnpGetStatus = rpc.declare({
	object: 'luci.upnp',
	method: 'get_status',
	expect: {}
});

const callUpnpDeleteRule = rpc.declare({
	object: 'luci.upnp',
	method: 'delete_rule',
	params: ['token'],
	expect: { result: 'OK' },
});

function handleDelRule(num, ev) {
	dom.parent(ev.currentTarget, '.tr').style.opacity = 0.5;
	ev.currentTarget.classList.add('spinning');
	ev.currentTarget.disabled = true;
	ev.currentTarget.blur();
	callUpnpDeleteRule(num);
}

return view.extend({
	load: function() {
		return Promise.all([
			callUpnpGetStatus(),
			uci.load('upnpd')
		]);
	},

	poll_status: function(nodes, data) {

		const rules = Array.isArray(data[0].rules) ? data[0].rules : [];

		const rows = rules.map(function(rule) {
			const padnum = (num, length) => num.toString().padStart(length, '0');
			const expires_sec = rule?.expires || 0;
			const hour = Math.floor(expires_sec / 3600);
			const minute = Math.floor((expires_sec % 3600) / 60);
			const second = Math.floor(expires_sec % 60);
			const expires_str =
				hour > 0 ? `${hour}h ${padnum(minute, 2)}m ${padnum(second, 2)}s` :
				minute > 0 ? `${minute}m ${padnum(second, 2)}s` :
				expires_sec > 0 ? `${second}s` :
				'';

			return [
				rule.host_hint || _('Unknown'),
				rule.intaddr,
				rule.intport,
				rule.extport,
				rule.proto,
				expires_str,
				rule.descr,
				E('button', {
					'class': 'btn cbi-button-remove',
					'click': L.bind(handleDelRule, this, rule.num),
					'title': _('Delete')
				}, [_('Delete')])
			];
		});

		cbi_update_table(nodes.querySelector('#upnp_status_table'), rows, E('em', _('There are no active port maps.')));
	},

	render: function(data) {

		let m, s, o;

		const protocols = _('%s & %s/%s', '%s & %s/%s (%s = UPnP IGD, %s = PCP, %s = NAT-PMP)').format(
			'<a href="https://en.wikipedia.org/wiki/Internet_Gateway_Device_Protocol" target="_blank" rel="noreferrer"><abbr title="UPnP Internet Gateway Device (Control Protocol)">UPnP IGD</abbr></a>',
			'<a href="https://en.wikipedia.org/wiki/Port_Control_Protocol" target="_blank" rel="noreferrer"><abbr title="Port Control Protocol">PCP</abbr></a>',
			'<a href="https://en.wikipedia.org/wiki/NAT_Port_Mapping_Protocol" target="_blank" rel="noreferrer"><abbr title="NAT Port Mapping Protocol">NAT-PMP</abbr></a>');
		m = new form.Map('upnpd', _('UPnP IGD & PCP/NAT-PMP Service'),
			_('The %s protocols allow clients on the local network to configure port maps/forwards on the router autonomously.',
				'The %s (%s = UPnP IGD & PCP/NAT-PMP) protocols allow clients on the local network to configure port maps/forwards on the router autonomously.')
			.format(protocols)
		);
		if (!uci.get('upnpd', 'config')) {
			ui.addNotification(null, E('div', '<h4>' + _('No suitable configuration was found!') + '</h4><p>' +
				_('No suitable (LuCI app %s) config found in %s. Related package update (daemon or LuCI app) may be missing.').format('v1.0', '<code>/etc/config/upnpd</code>') + '<br />' +
				_('Use the software package manager, update lists, and install the related update. Config is migrated on the daemon package update.') + '</p>' +
				'<a class="btn" href="/cgi-bin/luci/admin/system/package-manager?query=UPnP%20IGD%20&%20PCP/NAT-PMP">' + _('Go to package manager…') + '</a>'), 'warning');
			m.readonly = true;
		}

		s = m.section(form.GridSection, '_active_rules');

		s.render = L.bind(function(view, section_id) {
			const table = E('table', { 'class': 'table cbi-section-table', 'id': 'upnp_status_table' }, [
				E('tr', { 'class': 'tr table-titles' }, [
					E('th', { 'class': 'th' }, _('Hostname')),
					E('th', { 'class': 'th' }, _('IP address')),
					E('th', { 'class': 'th' }, _('Port')),
					E('th', { 'class': 'th' }, _('External port')),
					E('th', { 'class': 'th' }, _('Protocol')),
					E('th', { 'class': 'th right' }, _('Expires')),
					E('th', { 'class': 'th' }, _('Added via / description')),
					E('th', { 'class': 'th cbi-section-actions' }, '')
				])
			]);

			const rules = Array.isArray(data[0].rules) ? data[0].rules : [];

			const rows = rules.map(function(rule) {
				return [
					rule.host_hint || _('Unknown'),
					rule.intaddr,
					rule.intport,
					rule.extport,
					rule.proto,
					rule.descr,
					E('button', {
						'class': 'btn cbi-button-remove',
						'click': L.bind(handleDelRule, this, rule.num),
						'title': _('Delete')
					}, [_('Delete')])
				];
			});

			cbi_update_table(table, rows, E('em', _('There are no active port maps.')));

			return E('div', { 'class': 'cbi-section cbi-tblsection' }, [
				E('h3', _('Active Port Maps')), table
			]);
		}, o, this);

		s = m.section(form.NamedSection, 'config', 'upnpd', _('Service Settings'));
		s.addremove = false;
		s.tab('setup', _('Service Setup'));
		s.tab('advanced', _('Advanced Settings'));
		s.tab('igd', _('UPnP IGD Adjustments'));

		o = s.taboption('setup', form.Flag, 'enabled', _('Enable service'),
			_('Enable the autonomous port mapping service'));
		o.rmempty = false;

		o = s.taboption('setup', form.Flag, 'enable_upnp', _('Enable UPnP IGD protocol'));
		o.default = '1';

		o = s.taboption('setup', form.Flag, 'enable_natpmp', _('Enable PCP/NAT-PMP protocols'));
		o.default = '1';

		o = s.taboption('setup', form.Flag, 'igdv1', _('UPnP IGDv1 compatibility mode'),
			_('Advertise as IGDv1 (IPv4 only) device instead of IGDv2'));
		o.default = '1';
		o.rmempty = false;
		o.depends('enable_upnp', '1');
		o.retain = true;

		s.taboption('advanced', form.Flag, 'use_stun', _('Use %s', 'Use %s (%s = STUN)')
			.format('<a href="https://en.wikipedia.org/wiki/STUN" target="_blank" rel="noreferrer"><abbr title="Session Traversal Utilities for NAT">STUN</abbr></a>'),
			_('To detect the public IPv4 address for unrestricted full-cone/one-to-one NATs'));

		o = s.taboption('advanced', form.Value, 'stun_host', _('STUN host'));
		o.datatype = 'host';
		o.depends('use_stun', '1');
		o.retain = true;

		o = s.taboption('advanced', form.Value, 'stun_port', _('STUN port'));
		o.datatype = 'port';
		o.placeholder = '3478';
		o.depends('use_stun', '1');
		o.retain = true;

		o = s.taboption('advanced', form.Flag, 'secure_mode', _('Enable secure mode'),
			_('Allow adding port maps for requesting IP addresses only'));
		o.default = '1';
		o.depends('enable_upnp', '1');
		o.retain = true;

		s.taboption('advanced', form.Flag, 'ipv6_disable', _('Disable IPv6 mapping'));

		o = s.taboption('advanced', form.Flag, 'system_uptime', _('Report system instead of service uptime'));
		o.default = '1';
		o.depends('to-disable-as-rarely-used', '1');
		o.retain = true;

		s.taboption('advanced', form.Flag, 'log_output', _('Enable additional logging'),
			_('Puts extra debugging information into the system log'));

		o = s.taboption('advanced', form.Value, 'upnp_lease_file', _('Service lease file'));
		o.depends('to-disable-as-rarely-used', '1');
		o.retain = true;

		o = s.taboption('igd', form.Value, 'download', _('Download speed'),
			_('Report maximum download speed in kByte/s'));
		o.depends('enable_upnp', '1');
		o.retain = true;

		o = s.taboption('igd', form.Value, 'upload', _('Upload speed'),
			_('Report maximum upload speed in kByte/s'));
		o.depends('enable_upnp', '1');
		o.retain = true;

		o = s.taboption('igd', form.Value, 'model_number', _('Announced model number'));
		o.depends('enable_upnp', '1');
		o.retain = true;

		o = s.taboption('igd', form.Value, 'serial_number', _('Announced serial number'));
		o.depends('enable_upnp', '1');
		o.retain = true;

		o = s.taboption('igd', form.Value, 'presentation_url', _('Router/presentation URL'),
			_('Report custom router web interface URL'));
		o.placeholder = 'http://192.168.1.1/';
		o.depends('enable_upnp', '1');
		o.retain = true;

		o = s.taboption('igd', form.Value, 'uuid', _('Device UUID'));
		// o.depends('enable_upnp', '1');
		o.depends('to-disable-as-rarely-used', '1');
		o.retain = true;

		o = s.taboption('igd', form.Value, 'port', _('SOAP/HTTP port'));
		o.datatype = 'port';
		o.placeholder = '5000';
		o.depends('enable_upnp', '1');
		o.retain = true;

		o = s.taboption('igd', form.Value, 'notify_interval', _('Notify interval'),
			_('A 900 s interval sends %s announcements with the min. %s header',
				'A 900 s interval sends %s (%s = SSDP) announcements with the min. %s (%s = Cache-Control: max-age=1800) header')
			.format('<abbr title="Simple Service Discovery Protocol">SSDP</abbr>', '<code>Cache-Control: max-age=1800</code>'));
		o.datatype = 'min(900)';
		o.placeholder = '900';
		o.depends('enable_upnp', '1');
		o.retain = true;

		s = m.section(form.GridSection, 'perm_rule', _('Service Access Control List'),
			_('ACL specify which client addresses and ports can be mapped, IPv6 always allowed.'));
		s.anonymous = true;
		s.addremove = true;
		s.sortable = true;

		s.option(form.Value, 'comment', _('Comment'));

		o = s.option(form.Value, 'int_addr', _('IP address'));
		o.datatype = 'ip4addr';
		o.placeholder = '0.0.0.0/0';

		o = s.option(form.Value, 'int_ports', _('Port'));
		o.datatype = 'portrange';
		o.placeholder = '1-65535';

		o = s.option(form.Value, 'ext_ports', _('External port'));
		o.datatype = 'portrange';
		o.placeholder = '1-65535';

		o = s.option(form.ListValue, 'action', _('Action'));
		o.value('allow', _('Allow'));
		o.value('deny', _('Deny'));

		return m.render().then(L.bind(function(m, nodes) {
			poll.add(L.bind(function() {
				return Promise.all([
					callUpnpGetStatus()
				]).then(L.bind(this.poll_status, this, nodes));
			}, this), 5);
			return nodes;
		}, this, m));
	}
});
