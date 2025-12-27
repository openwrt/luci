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

		const protocols = '%s & %s/%s'.format(
			'<a href="https://en.wikipedia.org/wiki/Internet_Gateway_Device_Protocol" target="_blank" rel="noreferrer"><abbr title="UPnP Internet Gateway Device (Control Protocol)">UPnP IGD</abbr></a>',
			'<a href="https://en.wikipedia.org/wiki/Port_Control_Protocol" target="_blank" rel="noreferrer"><abbr title="Port Control Protocol">PCP</abbr></a>',
			'<a href="https://en.wikipedia.org/wiki/NAT_Port_Mapping_Protocol" target="_blank" rel="noreferrer"><abbr title="NAT Port Mapping Protocol">NAT-PMP</abbr></a>');
		m = new form.Map('upnpd', _('UPnP IGD & PCP/NAT-PMP Service'),
			_('The %s protocols/service enable allowed devices on local networks to autonomously set up port maps (forwards) on this router.',
				'The %s (%s = UPnP IGD & PCP/NAT-PMP) protocols/service enable allowed devices on local networks to autonomously set up port maps (forwards) on this router.')
			.format(protocols)
		);
		if (!uci.get('upnpd', 'settings')) {
			ui.addNotification(null, E('div', '<h4>' + _('No suitable configuration was found!') + '</h4><p>' +
				_('No suitable (LuCI app %s) config found in %s. Related package update (daemon or LuCI app) may be missing.').format('v2.0', '<code>/etc/config/upnpd</code>') + '<br>' +
				_('Use the software package manager, update lists, and install the related update. Config is migrated on the daemon package update.') + '</p>' +
				'<a class="btn" href="/cgi-bin/luci/admin/system/package-manager?query=UPnP%20IGD%20&%20PCP/NAT-PMP">' + _('Go to package manager…') + '</a>'), 'warning');
			m.readonly = true;
		}

		s = m.section(form.GridSection, '_active_rules');
		s.disable = uci.get('upnpd', 'settings', 'enabled') == '0';

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
			_('Report a specific device to workaround IGDv2-incompatible clients (or) Act/emulate as a specific/different device to workaround/support/handle/bypass/assist/mitigate IGDv2-incompatible clients (alternative text welcome)'));
		o.value('igdv1', _('IGDv1 (IPv4 only)'));
		o.value('igdv2', _('IGDv2 (with workarounds)'));
		o.depends('enabled_protocols', 'upnp-igd');
		o.depends('enabled_protocols', 'all');
		o.retain = true;

		o = s.taboption('advanced', form.RichListValue, 'allow_cgnat', _('Allow %s/%s', 'Allow %s/%s (%s = CGNAT, %s = STUN)')
			.format('<a href="https://en.wikipedia.org/wiki/Carrier-grade_NAT" target="_blank" rel="noreferrer"><abbr title="Carrier-grade NAT">CGNAT</abbr></a>',
				'<a href="https://en.wikipedia.org/wiki/STUN" target="_blank" rel="noreferrer"><abbr title="Session Traversal Utilities for NAT">STUN</abbr></a>'),
			_('Allow use of unrestricted endpoint-independent (1:1) CGNATs and detect the public IPv4'));
		o.value('', _('Disabled'), _('Override public/external IPv4 address to prevent a private'));
		o.value('1', _('Enabled'), _('Filtering test currently requires an extra firewall rule'));
		o.value('allow-filtered', _('Enabled') + ' (' + _('allow filtered') + ')', _('Allow filtered IPv4 CGNAT test result'));
		o.value('allow-private-ext-ipv4', _('Enabled') + ' (' + _('avoid, allow private external IPv4') + ')', _('No STUN public IPv4 address detection; issues with multiple clients'));
		o.optional = true;

		o = s.taboption('advanced', form.Value, 'stun_host', _('STUN server'));
		o.datatype = 'or(hostname,hostport,ip4addr("nomask"))';
		o.placeholder = 'stun.nextcloud.com';
		o.depends('allow_cgnat', '1');
		o.depends('allow_cgnat', 'allow-filtered');
		o.retain = true;

		o = s.taboption('advanced', form.Value, 'external_ip', _('Override external IPv4'),
			_('Report custom public/external (WAN) IPv4 address'));
		o.datatype = 'ip4addr("nomask")';
		o.placeholder = '(203.1.2.3)';
		o.depends('allow_cgnat', '');

		o = s.taboption('advanced', form.ListValue, 'allow_third_party_mapping', _('Allow third-party mapping'),
			_('Allow adding port maps for non-requesting IP addresses'));
		o.value('', _('Disabled'));
		o.value('1', _('Enabled'));
		o.value('upnp-igd', _('Enabled') + ' (' + _('UPnP IGD only') + ')');
		o.value('pcp', _('Enabled') + ' (' + _('PCP only') + ')');

		s.taboption('advanced', form.Flag, 'ipv6_disable', _('Disable IPv6 mapping'));

		o = s.taboption('advanced', form.Flag, 'system_uptime', _('Report system instead of service uptime'));
		o.default = '1';
		o.depends('to-disable-as-rarely-used', '1');
		o.retain = true;

		o = s.taboption('advanced', form.ListValue, 'log_output', _('Log level'));
		o.value('default', _('Default'));
		o.value('info', _('Info'));
		o.value('debug', _('Debug'));
		o.default = 'default';
		o.widget = 'radio';

		o = s.taboption('advanced', form.Value, 'lease_file', _('Service lease file'));
		o.depends('to-disable-as-rarely-used', '1');
		o.retain = true;

		o = s.taboption('igd', form.Value, 'download_kbps', _('Download speed'),
			_('Report maximum connection speed in kbit/s'));
		o.datatype = 'uinteger';
		o.placeholder = _('Default interface link speed');
		o.depends('enabled_protocols', 'upnp-igd');
		o.depends('enabled_protocols', 'all');
		o.retain = true;

		o = s.taboption('igd', form.Value, 'upload_kbps', _('Upload speed'),
			_('Report maximum connection speed in kbit/s'));
		o.datatype = 'uinteger';
		o.placeholder = _('Default interface link speed');
		o.depends('enabled_protocols', 'upnp-igd');
		o.depends('enabled_protocols', 'all');
		o.retain = true;

		o = s.taboption('igd', form.Value, 'friendly_name', _('Router/friendly name'));
		o.placeholder = 'OpenWrt UPnP IGD & PCP';
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

		o = s.taboption('igd', form.Value, 'presentation_url', _('Router/presentation URL'),
			_('Report custom router web interface URL'));
		o.placeholder = 'http://192.168.1.1/';
		o.depends('enabled_protocols', 'upnp-igd');
		o.depends('enabled_protocols', 'all');
		o.retain = true;

		o = s.taboption('igd', form.Value, 'uuid', _('Device UUID'));
		// o.depends('enabled_protocols', 'upnp-igd');
		// o.depends('enabled_protocols', 'all');
		o.depends('to-disable-as-rarely-used', '1');
		o.retain = true;

		o = s.taboption('igd', form.Value, 'http_port', _('SOAP/HTTP port'));
		o.datatype = 'port';
		o.placeholder = '5000';
		o.depends('enabled_protocols', 'upnp-igd');
		o.depends('enabled_protocols', 'all');
		o.retain = true;

		o = s.taboption('igd', form.Value, 'notify_interval', _('Notify interval'),
			_('A 900 s interval sends %s announcements with the min. %s header',
				'A 900 s interval sends %s (%s = SSDP) announcements with the min. %s (%s = Cache-Control: max-age=1800) header')
			.format('<abbr title="Simple Service Discovery Protocol">SSDP</abbr>', '<code>Cache-Control: max-age=1800</code>'));
		o.datatype = 'min(900)';
		o.placeholder = '900';
		o.depends('enabled_protocols', 'upnp-igd');
		o.depends('enabled_protocols', 'all');
		o.retain = true;

		s = m.section(form.GridSection, 'internal_network', _('Enabled Networks / Access Control'),
			_('Choose the local/internal (LAN) networks for which you want to enable the service.') + ' ' +
			_('Select an access control preset that defines which ports all devices on a network can map.') + ' ' +
			_('Alternatively, add client-specific permissions using the custom ACL, or decide if these should be checked before the preset.') + ' ' +
			_('IPv6 is currently always accepted unless disabled. (alternative text welcome)'));
		s.anonymous = true;
		s.addremove = true;
		s.cloneable = true;
		s.sortable = true;
		s.nodescriptions = true;
		s.modaltitle = _('UPnP IGD & PCP') + ' - ' + _('Edit network access control settings');

		o = s.option(widgets.NetworkSelect, 'interface', _('Internal network'),
			_('Select the local/internal (LAN) network interface to enable the service for'));
		o.exclude = 'wan'; // wan6 should also be excluded
		o.nocreate = true;
		o.editable = true;
		o.retain = true;
		o.validate = function(section_id, value) {
			let netcount = 0;
			// Commented out, as it causes issues with cloning
			//for (let ifnr = 0; uci.get('upnpd', `@internal_network[${ifnr}]`, 'interface'); ifnr++) {
			//	if (uci.get('upnpd', `@internal_network[${ifnr}]`, 'interface') == value) netcount++;
			//};
			return (netcount >= 2 || value == '' || value == 'wan' || value == 'wan6') ? '' : true;
		};

		o = s.option(form.ListValue, 'access_preset', _('Access control preset'),
			_('Select a preset for all devices on this network'));
		o.value('accept-high-ports', _('Accept ports >=1024'));
		o.value('accept-high-ports+web', _('Accept HTTP/HTTPS + ports >=1024'));
		o.value('accept-high-ports+web+dns', _('Accept HTTP/HTTPS/DNS + ports >=1024'));
		o.value('accept-all-ports', _('Accept all ports'));
		o.value('none', _('None'));
		o.editable = true;
		o.retain = true;

		o = s.option(form.Flag, 'custom_acl_before', _('Check custom ACL before'),
			_('Whether the custom ACL entries should be checked before the preset; can extend/override the preset') + '<br>' +
			_('Checking order: 1. Reject ports, 2. Custom ACL entries if used, 3. Preset ports, 4. Accept ports'));
		o.editable = true;
		o.retain = true;

		o = s.option(form.Value, 'accept_ports', _('Accept extra ports'),
			_('Accept these ports or port ranges on this network'));
		o.depends({ access_preset: 'accept-all-ports', '!reverse': true });
		o.retain = true;
		o.validate = function(section_id, value) {
			return value.search(/^[0-9 -]*$/) != -1 ? true : '';
		};

		o = s.option(form.Value, 'reject_ports', _('Reject extra ports'),
			_('Reject unsafe/insecure/risky FTP/Telnet/DCE/NetBIOS/SMB/RDP ports on this network by default, before other settings'));
		o.placeholder = '21 23 135 137-139 445 3389';
		o.modalonly = true;
		o.retain = true;
		o.validate = function(section_id, value) {
			return value.search(/^[0-9 -]*$/) != -1 ? true : '';
		};

		s = m.section(form.GridSection, 'acl_entry', _('Custom Access Control List'),
			_('The access control list (ACL) specifies which IP addresses and ports can be mapped.') + ' ' +
			_('ACL entries are checked in order and, if used alone, are rejected by default. (should be part of extra tab)'));
		s.anonymous = true;
		s.addremove = true;
		s.cloneable = true;
		s.sortable = true;
		s.modaltitle = _('UPnP IGD & PCP') + ' - ' + _('Edit custom ACL entry');
		// Preferably: Custom ACL part of extra tab with depends for section as immediately, and network section part of service setup tab. Nice to have: Add button (+input) calls function and opens modal pre-filled
		let customaclused = false;
		for (let ifnr = 0; uci.get('upnpd', `@internal_network[${ifnr}]`, 'interface'); ifnr++) {
			if (uci.get('upnpd', `@internal_network[${ifnr}]`, 'custom_acl_before') == '1') {
				customaclused = true;
			}
		}
		s.disable = !customaclused;

		o = s.option(form.Value, 'comment', _('Comment'));
		o.default = _('unspecified');

		o = s.option(form.Value, 'int_addr', _('IP address'));
		o.datatype = 'ip4addr';
		o.default = '0.0.0.0/0';
		o.editable = true;
		o.retain = true;

		o = s.option(form.Value, 'int_port', _('Port'));
		o.datatype = 'portrange';
		o.placeholder = '1-65535 (' + _('any port') + ')';
		o.editable = true;
		o.retain = true;

		o = s.option(form.Value, 'ext_port', _('External port'));
		o.datatype = 'portrange';
		o.placeholder = '1-65535 (' + _('any port') + ')';
		o.editable = true;
		o.retain = true;

		o = s.option(form.Value, 'descr_filter', _('Description filter'),
			_('A regular expression to check for a UPnP IGD IPv4 port map description'));
		o.placeholder = '^.*$ (' + _('any description') + ')';
		o.modalonly = true;

		o = s.option(form.ListValue, 'action', _('Action'));
		o.value('accept', _('Accept'));
		o.value('reject', _('Reject'));
		o.value('ignore', _('Ignore'));
		o.editable = true;
		o.retain = true;

		return m.render().then(L.bind(function(m, nodes) {
			if (uci.get('upnpd', 'settings', 'enabled') != '0') {
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
