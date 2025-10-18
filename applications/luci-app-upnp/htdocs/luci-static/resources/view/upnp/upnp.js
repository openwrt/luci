'use strict';
'require view';
'require dom';
'require poll';
'require uci';
'require ui';
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
			_('The %s protocols / service enable allowed devices on the local network to autonomously set up port maps (forwards) on the router.',
				'The %s (%s = UPnP IGD & PCP/NAT-PMP) protocols / service enable allowed devices on the local network to autonomously set up port maps (forwards) on the router.')
				.format(protocols)
		);

		s = m.section(form.GridSection, '_active_rules');
		s.disable = uci.get('upnpd', 'settings', 'enabled') == '1' ? false : true;

		if (!uci.get('upnpd', 'settings', 'enabled')) {
			ui.addNotification(null, E('p', _('No suitable %s configuration found in %s. Please update both packages (LuCI app and daemon) and restart the service for migration.')
				.format('v2.0', '<code>/etc/config/upnpd</code>')), 'warning');
			return;
		}

		s.render = L.bind(function(view, section_id) {
			var table = E('table', { 'class': 'table cbi-section-table', 'id': 'upnp_status_table' }, [
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
					E('h3', _('Active Port Maps')), table ]);
		}, o, this);

		s = m.section(form.NamedSection, 'settings', 'upnpd', _('Service Settings'));
		s.addremove = false;
		s.tab('setup', _('Service Setup'));
		s.tab('advanced', _('Advanced Settings'));
		s.tab('igd', _('UPnP IGD Adjustments'));

		o = s.taboption('setup', form.Flag, 'enabled', _('Start service'),
			_('Start the autonomous port mapping service'));
		o.rmempty = false;

		o = s.taboption('setup', form.ListValue, 'enabled_protocols', _('Enabled protocols'));
		o.value('all', _('All protocols'));
		o.value('upnp-igd', _('UPnP IGD'));
		o.value('pcp+nat-pmp', _('PCP and NAT-PMP'));
		o.default = 'all';
		o.widget = 'radio';

		o = s.taboption('setup', form.ListValue, 'upnp_igd_compat', _('UPnP IGD compatibility mode'),
			_('Act/emulate as specific/different device to workaround/support/handle/bypass/assist/mitigate IGDv2-incompatible clients (alternative text welcome)'));
		o.value('igdv1', _('IGDv1 (IPv4 only)'));
		o.value('igdv2', _('IGDv2'));
		o.depends('enabled_protocols', 'upnp-igd');
		o.depends('enabled_protocols', 'all');
		o.retain = true;

		o = s.taboption('advanced', form.RichListValue, 'allow_cgnat_use', _('Allow %s/%s', 'Allow %s/%s (%s = CGNATs, %s = STUN)')
			.format('<a href="https://en.wikipedia.org/wiki/Carrier-grade_NAT" target="_blank" rel="noreferrer"><abbr title="Carrier-Grade NAT">CGNATs</abbr></a>',
				'<a href="https://en.wikipedia.org/wiki/STUN" target="_blank" rel="noreferrer"><abbr title="Session Traversal Utilities for NAT">STUN</abbr></a>'),
			_('Allow use of unrestricted endpoint-independent (1:1) CGNATs and detect the public IPv4'));
		o.value('', _('Disabled'), _('Allow private IP by override the external IPv4 address'));
		o.value('1', _('Enabled'), _('Filtering test currently requires an extra firewall rule'));
		o.value('allow-filtered', _('Enabled') + ' (' + _('allow filtered') + ')', _('Allow filtered IPv4 CGNAT test result'));
		o.optional = true;

		o = s.taboption('advanced', form.Value, 'stun_host', _('STUN server'));
		o.datatype = 'or(hostname,hostport,ip4addr("nomask"))';
		o.placeholder = 'stun.nextcloud.com';
		o.depends('allow_cgnat_use', '1');
		o.depends('allow_cgnat_use', 'allow-filtered');
		o.retain = true;

		o = s.taboption('advanced', form.Value, 'external_ip', _('Override external IPv4'),
			_('Report custom external/public (WAN) IPv4 address'));
		o.datatype = 'ip4addr("nomask")';
		o.placeholder = '(203.1.2.3)';
		o.depends('allow_cgnat_use', '');

		o = s.taboption('advanced', form.ListValue, 'allow_third_party_mapping', _('Allow third-party mapping'),
			_('Allow adding port maps for non-requesting IP addresses'));
		o.value('', _('Disabled'));
		o.value('1', _('Enabled'));
		o.value('upnp-igd', _('Enabled') + ' (' + _('UPnP IGD') + ')');
		o.value('pcp', _('Enabled') + ' (' + _('PCP') + ')');

		s.taboption('advanced', form.Flag, 'ipv6_disable', _('Disable IPv6 mapping'));

		o = s.taboption('advanced', form.Flag, 'system_uptime', _('Report system instead of service uptime'));
		o.default = '1';
		o.depends('to-disable-as-rarely-used', '1');
		o.retain = true;

		o = s.taboption('advanced', form.ListValue, 'log_output', _('Log output level'));
		o.value('default', _('Default'));
		o.value('info', _('Info'));
		o.value('debug', _('Debug'));
		o.default = 'default';
		o.widget = 'radio';

		o = s.taboption('advanced', form.Value, 'lease_file', _('Service lease file'));
		o.depends('to-disable-as-rarely-used', '1');
		o.retain = true;

		o = s.taboption('igd', form.Value, 'upnp_igd_download', _('Download speed'),
			_('Report maximum connection speed in kbit/s'));
		o.datatype = 'uinteger';
		o.placeholder = _('Default interface link speed');
		o.depends('enabled_protocols', 'upnp-igd');
		o.depends('enabled_protocols', 'all');
		o.retain = true;

		o = s.taboption('igd', form.Value, 'upnp_igd_upload', _('Upload speed'),
			_('Report maximum connection speed in kbit/s'));
		o.datatype = 'uinteger';
		o.placeholder = _('Default interface link speed');
		o.depends('enabled_protocols', 'upnp-igd');
		o.depends('enabled_protocols', 'all');
		o.retain = true;

		o = s.taboption('igd', form.Value, 'upnp_igd_friendly_name', _('Router/friendly name'));
		o.placeholder = 'OpenWrt router';
		o.depends('enabled_protocols', 'upnp-igd');
		o.depends('enabled_protocols', 'all');
		o.retain = true;

		o = s.taboption('igd', form.Value, 'model_number', _('Announced model number'));
		// o.depends('enabled_protocols', 'upnp-igd');
		// o.depends('enabled_protocols', 'all');
		o.depends('to-disable-as-rarely-used', '1');
		o.retain = true;

		o = s.taboption('igd', form.Value, 'serial_number', _('Announced serial number'));
		// o.depends('enabled_protocols', 'upnp-igd');
		// o.depends('enabled_protocols', 'all');
		o.depends('to-disable-as-rarely-used', '1');
		o.retain = true;

		o = s.taboption('igd', form.Value, 'presentation_url', _('Presentation URL'),
			_('Report custom router web interface (presentation) URL'));
		o.placeholder = 'http://192.168.1.1/';
		o.depends('enabled_protocols', 'upnp-igd');
		o.depends('enabled_protocols', 'all');
		o.retain = true;

		o = s.taboption('igd', form.Value, 'uuid', _('Device UUID'));
		// o.depends('enabled_protocols', 'upnp-igd');
		// o.depends('enabled_protocols', 'all');
		o.depends('to-disable-as-rarely-used', '1');
		o.retain = true;

		o = s.taboption('igd', form.Value, 'upnp_igd_http_port', _('SOAP/HTTP port'));
		o.datatype = 'port';
		o.placeholder = '5000';
		o.depends('enabled_protocols', 'upnp-igd');
		o.depends('enabled_protocols', 'all');
		o.retain = true;

		o = s.taboption('igd', form.Value, 'notify_interval', _('Notify interval'),
			_('A 900s interval sends %s notices with the minimum %s header', 'A 900s interval sends %s (%s = SSDP) notices with the minimum %s (%s = Cache-Control: max-age=1800) header')
				.format('<abbr title="Simple Service Discovery Protocol">SSDP</abbr>', '<code>Cache-Control: max-age=1800</code>'));
		o.datatype = 'min(900)';
		o.placeholder = '900';
		o.depends('enabled_protocols', 'upnp-igd');
		o.depends('enabled_protocols', 'all');
		o.retain = true;

		s = m.section(form.GridSection, 'internal_network', '<h5>' + _('Enabled Networks / Access Control') + '</h5>',
			_('Choose local/internal (LAN) networks for which you want to enable the service. Select an access control preset that defines which ports all devices on a network can map.') + ' ' +
			_('Alternatively or additionally, add client-specific custom ACL entries.') + ' ' +
			_('IPv6 is always accepted by the current service, unless its mapping is disabled. (alternative text welcome)'));
		s.anonymous = true;
		s.addremove = true;
		s.cloneable = true;
		s.sortable = true;
		s.nodescriptions = true;
		s.modaltitle = _('UPnP IGD & PCP') + ' - ' + _('Edit network access control');

		o = s.option(widgets.NetworkSelect, 'interface', _('Internal network'),
			_('Choose the local/internal (LAN) network to enable the service for'));
		o.default = 'lan';
		o.exclude = 'wan';
		o.nocreate = true;
		o.rmempty = false;
		o.editable = true;
		o.retain = true; // Otherwise removed with unmet dependencies, or if cloned

		o = s.option(form.ListValue, 'acl_preset', _('Access control preset'),
			_('Select a preset for all devices on this network, or/and add client-specific custom ACL entries'));
		o.value('', _('None (custom ACL / extra ports only)'));
		o.value('accept-high-ports', _('Accept ports >=1024'));
		o.value('accept-high-ports+web', _('Accept HTTP/HTTPS + ports >=1024'));
		o.value('accept-high-ports+web+dns', _('Accept HTTP/HTTPS/DNS + ports >=1024'));
		o.value('accept-all-ports', _('Accept all ports'));
		o.value('reject-all-ports', _('Reject all ports'));
		o.editable = true;
		o.retain = true; // Otherwise removed with unmet dependencies, or if cloned

		o = s.option(form.Value, 'acl_accept_ports', _('Accept extra ports'),
			_('Accept these ports or port ranges, and, if applicable, in addition to the custom ACL and preset'));
		o.depends('acl_preset', '');
		o.depends({ acl_preset: 'accept-high-ports', '!contains': true });
		o.retain = true; // Otherwise removed with unmet dependencies, or if cloned

		o = s.option(form.Value, 'acl_reject_ports', _('Reject extra ports'),
			_('By default, reject unsafe/insecure/risky FTP/Telnet/DCE/NetBIOS/SMB/RDP ports regardless of other settings'));
		o.placeholder = '21 23 135 137-139 445 3389';
		o.modalonly = true;
		o.depends({ acl_preset: 'reject-all-ports', '!reverse': true });
		o.retain = true; // Otherwise removed with unmet dependencies, or if cloned

		o = s.option(form.Flag, 'acl_custom_first', _('Custom ACL first'),
			_('Whether the custom ACL entries should additionally be checked first'));
		o.editable = true;
		o.depends({ acl_preset: 'accept', '!contains': true });
		o.retain = true; // Otherwise removed with unmet dependencies, or if cloned

		s = m.section(form.GridSection, 'perm_rule', '<h5>' + _('Custom ACL') + '</h5>',
			_('The ACL specifies which IP addresses and ports can be mapped. ACL entries are checked in order, and then rejected by default.') + ' ' +
			_('An empty list is reset to defaults when applied. (alternative text welcome)'));
		s.anonymous = true;
		s.addremove = true;
		s.cloneable = true;
		s.sortable = true;
		s.modaltitle = _('UPnP IGD & PCP') + ' - ' + _('Edit custom ACL entry');
		// Preferably, custom ACL in extra tab with depends for section, as immediately, and network section part of service setup tab
		let custom_acl = false;
		for (let ifnr = 0; uci.get('upnpd', `@internal_network[${ifnr}]`, 'interface'); ifnr++) {
			if (!uci.get('upnpd', `@internal_network[${ifnr}]`, 'acl_preset') ||
				uci.get('upnpd', `@internal_network[${ifnr}]`, 'acl_custom_first') == '1') {
				custom_acl = true;
			}
		}
		s.disable = custom_acl ? false : true;

		o = s.option(form.Value, 'comment', _('Comment'));
		o.default = _('unspecified');

		o = s.option(form.ListValue, 'action', _('Action'));
		o.value('accept', _('Accept'));
		o.value('reject', _('Reject'));
		o.value('disabled', _('Disabled'));
		o.editable = true;
		o.retain = true; // Otherwise removed if disabled

		o = s.option(form.Value, 'int_addr', _('IP address'));
		o.datatype = 'ip4addr';
		o.default = '0.0.0.0/0';
		o.editable = true;
		o.retain = true; // Otherwise removed if disabled

		o = s.option(form.Value, 'int_ports', _('Port'));
		o.datatype = 'portrange';
		o.placeholder = '1-65535 (' + _('any port') + ')';
		o.editable = true;
		o.retain = true; // Otherwise removed if disabled

		o = s.option(form.Value, 'ext_ports', _('External port'));
		o.datatype = 'portrange';
		o.placeholder = '1-65535 (' + _('any port') + ')';
		o.editable = true;
		o.retain = true; // Otherwise removed if disabled

		o = s.option(form.Value, 'desc_filter', _('Description filter'),
			_('A regular expression to check for a UPnP IGD IPv4 port map description'));
		o.placeholder = '.* (' + _('any description') + ')';
		o.modalonly = true;

		return m.render().then(L.bind(function(m, nodes) {
			if (uci.get('upnpd', 'settings', 'enabled') == '1') {
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
