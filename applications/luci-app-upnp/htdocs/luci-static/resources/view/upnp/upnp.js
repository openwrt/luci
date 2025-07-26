'use strict';
'require view';
'require dom';
'require poll';
'require uci';
'require rpc';
'require form';
'require tools.widgets as widgets';

const callInitAction = rpc.declare({
	object: 'luci',
	method: 'setInitAction',
	params: [ 'name', 'action' ],
	expect: { result: false }
});

const callUpnpGetStatus = rpc.declare({
	object: 'luci.upnp',
	method: 'get_status',
	expect: {  }
});

const callUpnpDeleteRule = rpc.declare({
	object: 'luci.upnp',
	method: 'delete_rule',
	params: [ 'token' ],
	expect: { result : "OK" },
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

		var rules = Array.isArray(data[0].rules) ? data[0].rules : [];

		var rows = rules.map(function(rule) {
			const padnum = (num, length) => num.toString().padStart(length, "0");
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
				}, [ _('Delete') ])
			];
		});

		cbi_update_table(nodes.querySelector('#upnp_status_table'), rows, E('em', _('There are no active port maps.')));
	},

	render: function(data) {

		let m, s, o;

		var protocols = '%s & %s/%s'.format(
			'<a href="https://en.wikipedia.org/wiki/Internet_Gateway_Device_Protocol" target="_blank" rel="noreferrer"><abbr title="UPnP Internet Gateway Device (Control Protocol)">UPnP IGD</abbr></a>',
			'<a href="https://en.wikipedia.org/wiki/Port_Control_Protocol" target="_blank" rel="noreferrer"><abbr title="Port Control Protocol">PCP</abbr></a>',
			'<a href="https://en.wikipedia.org/wiki/NAT_Port_Mapping_Protocol" target="_blank" rel="noreferrer"><abbr title="NAT Port Mapping Protocol">NAT-PMP</abbr></a>');
		m = new form.Map('upnpd', [_('UPnP IGD & PCP/NAT-PMP Service')],
			_('The %s protocols enable clients on the local network to autonomously configure port maps/forwards on the router.',
				'The %s (%s = UPnP IGD & PCP/NAT-PMP) protocols enable clients on the local network to autonomously configure port maps/forwards on the router.')
				.format(protocols)
		);

		s = m.section(form.GridSection, '_active_rules');
		s.disable = uci.get('upnpd', 'config', 'enabled') == '1' ? false : true;

		s.render = L.bind(function(view, section_id) {
			var table = E('table', { 'class': 'table cbi-section-table', 'id': 'upnp_status_table' }, [
				E('tr', { 'class': 'tr table-titles' }, [
					E('th', { 'class': 'th' }, _('Client Name')),
					E('th', { 'class': 'th' }, _('Client Address')),
					E('th', { 'class': 'th' }, _('Client Port')),
					E('th', { 'class': 'th' }, _('External Port')),
					E('th', { 'class': 'th' }, _('Protocol')),
					E('th', { 'class': 'th right' }, _('Expires')),
					E('th', { 'class': 'th' }, _('Used Protocol') + ' / ' + _('Description')),
					E('th', { 'class': 'th cbi-section-actions' }, '')
				])
			]);

			var rules = Array.isArray(data[0].rules) ? data[0].rules : [];

			var rows = rules.map(function(rule) {
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
					}, [ _('Delete') ])
				];
			});

			cbi_update_table(table, rows, E('em', _('There are no active port maps.')));

			return E('div', { 'class': 'cbi-section cbi-tblsection' }, [
					E('h3', _('Active Service Port Maps')), table ]);
		}, o, this);

		s = m.section(form.NamedSection, 'config', 'upnpd', _('Service Settings'));
		s.addremove = false;
		s.tab('setup', _('Service Setup'));
		s.tab('advanced', _('Advanced Settings'));
		s.tab('igd', _('UPnP IGD Adjustments'));

		o = s.taboption('setup', form.Flag, 'enabled', _('Start service'),
			_('Start autonomous port mapping service'));
		o.rmempty = false;

		o = s.taboption('setup', form.Flag, 'enable_upnp_igd', _('Enable UPnP IGD protocol'));
		o.default = '1';

		o = s.taboption('setup', form.Flag, 'enable_pcp_natpmp', _('Enable PCP/NAT-PMP protocols'));
		o.default = '1';

		o = s.taboption('setup', form.ListValue, 'upnp_igd_compat', _('UPnP IGD compatibility mode'),
			_('Act/emulate as specific/different device to workaround/support/handle/bypass/assist/mitigate IGDv2 incompatible clients'));
		o.value('igdv1', _('IGDv1 (IPv4 only)'));
		o.value('igdv2', _('IGDv2'));
		o.default = 'igdv1';
		o.depends('enable_upnp_igd', '1');
		o.retain = true;

		o = s.taboption('advanced', form.RichListValue, 'use_stun', _('Enable CGNAT / Use %s', 'Enable CGNAT / Use %s (%s = STUN)')
			.format('<a href="https://en.wikipedia.org/wiki/STUN" target="_blank" rel="noreferrer"><abbr title="Session Traversal Utilities for NAT">STUN</abbr></a>'),
			_('Enables unrestricted endpoint-independent (1:1) CGNAT use and detects public IPv4'));
		o.value('0', _('Disabled'), _('Override public IPv4 to allow private IPv4 on WAN'));
		o.value('1', _('Enabled'), _('CGNAT test currently requires an extra firewall rule'));
		o.value('allow-filtered', _('Enabled (allow filtered)'), _('Allow filtered CGNAT test result'));
		o.default = '0';

		o = s.taboption('advanced', form.Value, 'stun_host', _('STUN server'));
		o.datatype = 'or(hostname,hostport,ip4addr("nomask"))';
		o.placeholder = 'stun.nextcloud.com';
		o.depends('use_stun', '1');
		o.depends('use_stun', 'allow-filtered');
		o.retain = true;

		o = s.taboption('advanced', form.Value, 'external_ip', _('Override public IPv4'),
			_('Report custom public/external (WAN) IPv4 address'));
		o.datatype = 'ip4addr("nomask")';
		o.depends('use_stun', '0');

		s.taboption('advanced', form.Flag, 'allow_third_party_mapping', _('Allow third-party mapping'),
			_('Allow adding port maps for non-requesting IP addresses'));

		s.taboption('advanced', form.Flag, 'ipv6_disable', _('Disable IPv6 mapping'));

		o = s.taboption('advanced', form.Flag, 'system_uptime', _('Report system instead of service uptime'));
		o.default = '1';
		o.depends('to-disable-as-rarely-used', '1');
		o.retain = true;

		s.taboption('advanced', form.Flag, 'log_output', _('Enable additional logging'),
			_('Puts extra debugging information into the system log'));

		o = s.taboption('advanced', form.Value, 'lease_file', _('Service lease file'));
		o.depends('to-disable-as-rarely-used', '1');
		o.retain = true;

		o = s.taboption('igd', form.Value, 'port', _('SOAP/HTTP port'));
		o.datatype = 'port';
		o.placeholder = '5000';
		o.depends('enable_upnp_igd', '1');
		o.retain = true;

		o = s.taboption('igd', form.Value, 'notify_interval', _('Notify interval'),
			_('A 900s interval sends %s notices with the minimum cache-control max-age header of 1800', 'A 900s interval sends %s (%s = SSDP) notices with the minimum cache-control max-age header of 1800')
				.format('<abbr title="Simple Service Discovery Protocol">SSDP</abbr>'));
		o.datatype = 'min(900)';
		o.placeholder = '900';
		o.depends('enable_upnp_igd', '1');
		o.retain = true;

		o = s.taboption('igd', form.Value, 'upnp_igd_download', _('Download speed'),
			_('Report maximum link speed in kbit/s'));
		o.datatype = 'uinteger';
		o.placeholder = _('Default interface link speed');
		o.depends('enable_upnp_igd', '1');
		o.retain = true;

		o = s.taboption('igd', form.Value, 'upnp_igd_upload', _('Upload speed'),
			_('Report maximum link speed in kbit/s'));
		o.datatype = 'uinteger';
		o.placeholder = _('Default interface link speed');
		o.depends('enable_upnp_igd', '1');
		o.retain = true;

		o = s.taboption('igd', form.Value, 'upnp_igd_friendly_name', _('Router/friendly name'));
		o.placeholder = 'OpenWrt router';
		o.depends('enable_upnp_igd', '1');
		o.retain = true;

		o = s.taboption('igd', form.Value, 'model_number', _('Announced model number'));
		// o.depends('enable_upnp_igd', '1');
		o.depends('to-disable-as-rarely-used', '1');
		o.retain = true;

		o = s.taboption('igd', form.Value, 'serial_number', _('Announced serial number'));
		// o.depends('enable_upnp_igd', '1');
		o.depends('to-disable-as-rarely-used', '1');
		o.retain = true;

		o = s.taboption('igd', form.Value, 'presentation_url', _('Presentation URL'),
			_('Report custom router web interface (presentation) URL'));
		o.placeholder = 'http://192.168.1.1/';
		o.depends('enable_upnp_igd', '1');
		o.retain = true;

		o = s.taboption('igd', form.Value, 'uuid', _('Device UUID'));
		// o.depends('enable_upnp_igd', '1');
		o.depends('to-disable-as-rarely-used', '1');
		o.retain = true;

		s = m.section(form.GridSection, 'internal_network', _('Enabled Networks') + ' / ' + _('Access Control List'),
			_('Select the local/internal networks for which the service should be enabled. The ACL specifies which client addresses and ports can be mapped.') + ' ' +
			_('IPv6 is currently always accepted unless disabled.'));
		s.anonymous = true;
		s.addremove = true;
		s.nodescriptions = true;
		s.modaltitle = _('Edit internal network');

		o = s.option(widgets.NetworkSelect, 'interface');
		o.default = 'lan';
		o.exclude = 'wan';
		o.nocreate = true;
		o.rmempty = false;
		o.editable = true;

		o = s.option(form.ListValue, 'acl_preset', '',
			_('Select an ACL preset for all clients, or set up client-specific permissions using a custom ACL for security reasons'));
		o.value('accept-high-ports', _('Accept ports >=1024 (default)'));
		o.value('accept-high-ports+web', _('Accept HTTP/HTTPS + ports >=1024'));
		o.value('accept-high-ports+web+dns', _('Accept HTTP/HTTPS/DNS + ports >=1024'));
		o.value('accept-all-ports', _('Accept all ports'));
		o.value('custom', _('Custom/client-specific ACL only'));
		o.default = 'accept-high-ports';
		o.editable = true;

		o = s.option(form.ListValue, 'check_custom_acl', '',
			_('Whether the custom ACL should also be checked/processed'));
		o.value('', _('Not checking custom ACL'));
		o.value('last', _('Check custom ACL last'));
		o.editable = true;
		o.depends('acl_preset', 'accept-high-ports');
		o.depends('acl_preset', 'accept-high-ports+web');
		o.depends('acl_preset', 'accept-high-ports+web+dns');

		s = m.section(form.NamedSection, 'config', 'upnpd');
		o = s.option(form.Value, 'acl_reject_unsafe_ports', _('Reject unsafe/insecure/risky ports'),
			_('By default, reject FTP/Telnet/DCE/NetBIOS/SMB/RDP client ports being mapped before the ACL'));
		o.placeholder = '21 23 135 137-139 445 3389';

		s = m.section(form.GridSection, 'perm_rule', '<h5>' + _('Custom ACL') + '</h5>',
			_('ACL entries are checked in order and then rejected by default. An empty list is reset to defaults when applied.'));
		s.anonymous = true;
		s.sortable = true;
		s.addremove = true;
		s.cloneable = true;
		s.modaltitle = _('Edit ACL entry');
		// Depends for section would be preferable as they work instantly, however, they do not seem to exist
		s.disable = (uci.get('upnpd', '@internal_network[0]', 'acl_preset') == 'custom' || uci.get('upnpd', '@internal_network[0]', 'check_custom_acl') == 'last') ? false : true;

		o = s.option(form.Value, 'comment', _('Comment'));
		o.default = '-';

		o = s.option(form.ListValue, 'action', _('Action'));
		o.value('allow', _('Accept'));
		o.value('deny', _('Reject'));
		o.editable = true;
		o.retain = true; // Otherwise will be removed if disabled

		o = s.option(form.Value, 'int_addr', _('Client Address'));
		o.datatype = 'ip4addr';
		o.default = '0.0.0.0/0';

		o = s.option(form.Value, 'int_ports', _('Client Port'));
		o.datatype = 'portrange';
		o.default = '1-65535';

		o = s.option(form.Value, 'ext_ports', _('External Port'));
		o.datatype = 'portrange';
		o.default = '1-65535';

		return m.render().then(L.bind(function(m, nodes) {
			if (uci.get('upnpd', 'config', 'enabled') == '1') {
				poll.add(L.bind(function() {
					return Promise.all([
						callUpnpGetStatus()
					]).then(L.bind(this.poll_status, this, nodes));
				}, this), 5);
			}
			return nodes;
		}, this, m));
	}
});
