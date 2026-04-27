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

		const protocols = _('%s & %s/%s', '%s & %s/%s (%s = UPnP IGD, %s = PCP, %s = NAT-PMP)').format(
			'<a href="https://en.wikipedia.org/wiki/Internet_Gateway_Device_Protocol" target="_blank" rel="noreferrer"><abbr title="UPnP Internet Gateway Device (Control Protocol)">UPnP IGD</abbr></a>',
			'<a href="https://en.wikipedia.org/wiki/Port_Control_Protocol" target="_blank" rel="noreferrer"><abbr title="Port Control Protocol">PCP</abbr></a>',
			'<a href="https://en.wikipedia.org/wiki/NAT_Port_Mapping_Protocol" target="_blank" rel="noreferrer"><abbr title="NAT Port Mapping Protocol">NAT-PMP</abbr></a>');
		m = new form.Map('upnpd', _('UPnP IGD & PCP/NAT-PMP Service'),
			_('The %s protocols/service enable permitted devices on local networks to autonomously set up IPv4/IPv6 port maps (forwards) on this router.',
				'The %s (%s = UPnP IGD & PCP/NAT-PMP) protocols/service enable permitted devices on local networks to autonomously set up IPv4/IPv6 port maps (forwards) on this router.')
			.format(protocols)
		);
		if (!uci.get('upnpd', 'settings')) {
			ui.addNotification(null, E('div', '<h4>' + _('No suitable configuration was found!') + '</h4><p>' +
				_('No suitable config (LuCI app %s) found in %s. A related package update (daemon or LuCI app) may be missing.').format('v2.0', '<code>/etc/config/upnpd</code>') + '<br />' +
				_('Use the software package manager, update lists, and install the related update. Config is migrated with the daemon package update.') + '</p>' +
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
		s.tab('access_control', _('Access Control'), '<h5>' + _('Access Control Defaults') + '</h5>' +
			_('Set defaults for ports that all devices can map.') + ' ' +
			_('Client-specific permissions using the access control list (ACL) can extend/override the defaults.') + ' ' +
			_('IPv6 is currently always accepted unless disabled. (alternative text welcome)'));
		s.tab('advanced', _('Advanced Settings'));
		s.tab('igd', _('UPnP IGD Adjustments'));

		o = s.taboption('setup', form.Flag, 'enabled', _('Enable service'),
			_('Enable the autonomous port mapping service'));
		o.rmempty = false;

		o = s.taboption('setup', form.ListValue, 'enable_protocols', _('Enable protocols'));
		o.value('all', _('All protocols'));
		o.value('upnp-igd', _('UPnP IGD'));
		o.value('pcp+nat-pmp', _('PCP and NAT-PMP'));
		o.default = 'all';
		o.widget = 'radio';

		o = s.taboption('setup', widgets.NetworkSelect, 'internal_iface', _('Enable networks'),
			_('Select local/internal (LAN) network interfaces to enable the service for'));
		o.exclude = 'wan'; // wan6 should also be excluded
		o.nocreate = true;
		o.editable = true;
		o.multiple = true;
		o.rmempty = false;
		o.retain = true;
		o.validate = function(section_id, value) {
			return (value == '' || value == 'wan' || value == 'wan6') ? _('Expecting: %s').format(_('internal network interfaces')) : true;
		};
		o.write = function(section_id, formvalue) {
			uci.set('upnpd', section_id, 'internal_iface', formvalue.join(' '));
		};

		o = s.taboption('setup', form.ListValue, 'upnp_igd_compat', _('UPnP IGD compatibility'),
			_('Set compatibility mode (act as device) to workaround IGDv2-incompatible clients; %s are known to only work with %s (or) <br />Emulate/report a specific/different device to workaround/support/handle/bypass/assist/mitigate... (alternative text welcome)').format('Sony PS, Activision CoD…', 'IGDv1'));
		o.value('igdv1', _('IGDv1 (IPv4 only)'));
		o.value('igdv2', _('IGDv2 (with workarounds)'));
		o.depends('enable_protocols', 'upnp-igd');
		o.depends('enable_protocols', 'all');
		o.retain = true;

		o = s.taboption('access_control', form.ListValue, 'access_preset', _('Access preset'));
		o.value('', _('None / accept listed ports only'));
		o.value('accept-high-ports', _('Accept ports >= 1024'));
		o.value('accept-web+high-ports', _('Accept HTTP/HTTPS + ports >= 1024'));
		o.value('accept-web-ports', _('Accept HTTP/HTTPS ports only'));
		o.value('accept-all-ports', _('Accept all ports'));
		o.editable = true;
		o.retain = true;

		o = s.taboption('access_control', form.Value, 'accept_ports', _('Accept ports'));
		o.retain = true;
		o.validate = function(section_id, value) {
			return value.replace(/\d+-\d+ ?|\d+ ?/g, '') == '' ? true : _('Expecting: %s').format(_('valid port or port range (port1-port2)'));
		};

		o = s.taboption('access_control', form.Value, 'reject_ports', _('Reject ports'),
			_('Reject unsafe/insecure/risky FTP/Telnet/DCE/NetBIOS/SMB/RDP ports by default; overrides other settings; use space for none'));
		o.placeholder = '21 23 135 137-139 445 3389';
		o.modalonly = true;
		o.retain = true;
		o.validate = function(section_id, value) {
			return value.replace(/\d+-\d+ ?|\d+ ?| /g, '') == '' ? true : _('Expecting: %s').format(_('valid port or port range (port1-port2)'));
		};

		o = s.taboption('access_control', form.Flag, 'check_acl', _('Check ACL'),
			_('Check the ACL entries first; these extend/override the defaults') + '<br />' +
			_('Sequence: 1. Reject ports, 2. ACL entries (if checked), 3. Preset ports, 4. Accept ports'));
		o.default = '1';
		o.editable = true;
		o.rmempty = false;
		o.onchange = function(ev, section_id, value) {
			let acl = document.getElementById("cbi-upnpd-acl_entry");
			value == 0 ? acl.style.display = 'none' : acl.style.display = 'block';
		};

		s.taboption('access_control', form.Flag, 'ipv6_disable', _('Disable IPv6 mapping'));

		o = s.taboption('advanced', form.RichListValue, 'allow_cgnat', _('Allow %s/%s', 'Allow %s/%s (%s = CGNAT, %s = STUN)')
			.format('<a href="https://en.wikipedia.org/wiki/Carrier-grade_NAT" target="_blank" rel="noreferrer"><abbr title="Carrier-grade NAT">CGNAT</abbr></a>',
				'<a href="https://en.wikipedia.org/wiki/STUN" target="_blank" rel="noreferrer"><abbr title="Session Traversal Utilities for NAT">STUN</abbr></a>'),
			_('Allow use of unrestricted endpoint-independent (1:1) CGNATs and detect the public IPv4'));
		o.value('', _('Disabled'), _('Manually override external IPv4 with public IP'));
		o.value('1', _('Enabled'), _('Filtering test currently requires an extra firewall rule'));
		o.value('allow-filtered', _('Enabled') + ' (' + _('allow filtered') + ')', _('Workaround filtered IPv4 CGNAT test result'));
		o.value('report-private-ipv4', _('Disabled (report private IPv4, avoid)'), _('No STUN public IPv4 detection; client issues'));
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
		o.depends('allow_cgnat', '');
		o.depends('allow_cgnat', 'report-private-ipv4');

		o = s.taboption('advanced', form.ListValue, 'allow_third_party_mapping', _('Allow third-party mapping'),
			_('Allow adding port maps for non-requesting IP addresses; use with care'));
		o.value('', _('Disabled') + ' (' + _('recommended') + ')');
		o.value('1', _('Enabled'));
		o.value('upnp-igd', _('Enabled') + ' (' + _('UPnP IGD only') + ')');
		o.value('pcp', _('Enabled') + ' (' + _('PCP only') + ')');

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
		o.depends('enable_protocols', 'upnp-igd');
		o.depends('enable_protocols', 'all');
		o.retain = true;

		o = s.taboption('igd', form.Value, 'upload_kbps', _('Upload speed'),
			_('Report maximum connection speed in kbit/s'));
		o.datatype = 'uinteger';
		o.placeholder = _('Default interface link speed');
		o.depends('enable_protocols', 'upnp-igd');
		o.depends('enable_protocols', 'all');
		o.retain = true;

		o = s.taboption('igd', form.Value, 'friendly_name', _('Router/friendly name'));
		o.placeholder = 'OpenWrt UPnP IGD & PCP';
		o.depends('enable_protocols', 'upnp-igd');
		o.depends('enable_protocols', 'all');
		o.retain = true;

		o = s.taboption('igd', form.Value, 'model_number', _('Announced model number'));
		// o.depends('enable_protocols', 'upnp-igd');
		// o.depends('enable_protocols', 'all');
		o.depends('to-disable-as-rarely-used', '1');
		o.retain = true;

		o = s.taboption('igd', form.Value, 'serial_number', _('Announced serial number'));
		// o.depends('enable_protocols', 'upnp-igd');
		// o.depends('enable_protocols', 'all');
		o.depends('to-disable-as-rarely-used', '1');
		o.retain = true;

		o = s.taboption('igd', form.Value, 'presentation_url', _('Router/presentation URL'),
			_('Report custom router web interface URL'));
		o.placeholder = 'http://192.168.1.1/';
		o.depends('enable_protocols', 'upnp-igd');
		o.depends('enable_protocols', 'all');
		o.retain = true;

		o = s.taboption('igd', form.Value, 'uuid', _('Device UUID'));
		// o.depends('enable_protocols', 'upnp-igd');
		// o.depends('enable_protocols', 'all');
		o.depends('to-disable-as-rarely-used', '1');
		o.retain = true;

		o = s.taboption('igd', form.Value, 'http_port', _('SOAP/HTTP port'));
		o.datatype = 'port';
		o.placeholder = '5000';
		o.depends('enable_protocols', 'upnp-igd');
		o.depends('enable_protocols', 'all');
		o.retain = true;

		o = s.taboption('igd', form.Value, 'notify_interval', _('Notify interval'),
			_('A 900 s interval sends %s announcements with the minimum %s header',
				'A 900 s interval sends %s (%s = SSDP) announcements with the minimum %s (%s = Cache-Control: max-age=1800) header')
			.format('<abbr title="Simple Service Discovery Protocol">SSDP</abbr>', '<code>Cache-Control: max-age=1800</code>'));
		o.datatype = 'min(900)';
		o.placeholder = '900';
		o.depends('enable_protocols', 'upnp-igd');
		o.depends('enable_protocols', 'all');
		o.retain = true;

		s = m.section(form.GridSection, 'acl_entry', '<h5>' + _('Access Control List') + '</h5>',
			_('The access control list (ACL) specifies which IP addresses and ports can be mapped.') + ' ' +
			_('ACL entries are checked in order and, by default, rejected with no preset. (should be part of access control tab)'));
		s.anonymous = true;
		s.addremove = true;
		s.cloneable = true;
		s.sortable = true;
		s.modaltitle = _('UPnP IGD & PCP') + ' - ' + _('Edit ACL Entry');
		// Preferably: ACL part of access control tab with depends for section as immediately. Nice to have: Add button (+input) calls function and opens modal pre-filled
		let acl_used = false;
		for (let ifnr = 0; uci.get('upnpd', `@internal_network[${ifnr}]`, 'interface'); ifnr++) {
			if (uci.get('upnpd', `@internal_network[${ifnr}]`, 'check_acl') != '0') {
				acl_used = true;
				break;
			}
		}
		s.disable = uci.get('upnpd', 'settings', 'check_acl') == '0';

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
