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
	expect: { result: "OK" },
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
				}, [_('Delete')])
			];
		});

		cbi_update_table(nodes.querySelector('#upnp_status_table'), rows, E('em', _('There are no active port maps.')));
	},

	render: function(data) {

		let m, s, o;

		let protocols = '%s & %s/%s'.format(
			'<a href="https://en.wikipedia.org/wiki/Internet_Gateway_Device_Protocol" target="_blank" rel="noreferrer"><abbr title="UPnP Internet Gateway Device (Control Protocol)">UPnP IGD</abbr></a>',
			'<a href="https://en.wikipedia.org/wiki/Port_Control_Protocol" target="_blank" rel="noreferrer"><abbr title="Port Control Protocol">PCP</abbr></a>',
			'<a href="https://en.wikipedia.org/wiki/NAT_Port_Mapping_Protocol" target="_blank" rel="noreferrer"><abbr title="NAT Port Mapping Protocol">NAT-PMP</abbr></a>');
		m = new form.Map('upnpd', _('UPnP IGD & PCP/NAT-PMP Service'),
			_('The %s protocols / service enable allowed devices on the local network to autonomously set up port maps (forwards) on the router.',
				'The %s (%s = UPnP IGD & PCP/NAT-PMP) protocols / service enable allowed devices on the local network to autonomously set up port maps (forwards) on the router.')
			.format(protocols)
		);
		if (!uci.get('upnpd', 'config')) {
			ui.addNotification(null, E('div', '<h4>' + _('No suitable configuration was found!') + '</h4><p>' +
				_('No suitable %s configuration was found in %s.').format('v1.0', '<code>/etc/config/upnpd</code>') + ' ' +
				_('Please update both packages (LuCI app and daemon). The updated daemon package will migrate the configuration on the restart.') + ' ' +
				_('If you are using the software package manager, first update the lists, and then install the missing update.') + '</p>' +
				'<a class="btn" href="/cgi-bin/luci/admin/system/package-manager?query=UPnP%20IGD%20&%20PCP/NAT-PMP">' + _('Go to package manager...') + '</a>'), 'warning');
			m.readonly = true;
		}

		s = m.section(form.GridSection, '_active_rules');
		s.disable = uci.get('upnpd', 'config', 'enabled') != '1';

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
					}, [_('Delete')])
				];
			});

			cbi_update_table(table, rows, E('em', _('There are no active port maps.')));

			return E('div', { 'class': 'cbi-section cbi-tblsection' }, [
					E('h3', _('Active Port Maps')), table]);
		}, o, this);

		s = m.section(form.NamedSection, 'config', 'upnpd', _('Service Settings'));
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
			_('Act/emulate as a specific/different device to workaround/support/handle/bypass/assist/mitigate IGDv2-incompatible clients (alternative text welcome)'));
		o.value('igdv1', _('IGDv1 (IPv4 only)'));
		o.value('igdv2', _('IGDv2'));
		o.depends('enabled_protocols', 'upnp-igd');
		o.depends('enabled_protocols', 'all');
		o.retain = true;

		o = s.taboption('advanced', form.RichListValue, 'allow_cgnat_use', _('Allow %s/%s', 'Allow %s/%s (%s = CGNATs, %s = STUN)')
			.format('<a href="https://en.wikipedia.org/wiki/Carrier-grade_NAT" target="_blank" rel="noreferrer"><abbr title="Carrier-Grade NAT">CGNATs</abbr></a>',
				'<a href="https://en.wikipedia.org/wiki/STUN" target="_blank" rel="noreferrer"><abbr title="Session Traversal Utilities for NAT">STUN</abbr></a>'),
			_('Allow use of unrestricted endpoint-independent (1:1) CGNATs and detect the public IPv4'));
		o.value('', _('Disabled'), _('Allow a private IP address by overriding the external IPv4'));
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

		s = m.section(form.GridSection, 'internal_network', _('Enabled Networks / Access Control'),
			_('Choose local/internal (LAN) networks for which you want to enable the service. Select an access control preset that defines which ports all devices on a network can map.') + ' ' +
			_('Alternatively, add client-specific permissions using the custom ACL, or decide if it should be checked first.') + ' ' +
			_('IPv6 is always accepted by the current service, unless its mapping is disabled.'));
		s.anonymous = true;
		s.addremove = true;
		s.cloneable = true;
		s.sortable = true;
		s.nodescriptions = true;
		s.modaltitle = _('UPnP IGD & PCP') + ' - ' + _('Edit network access control settings');

		o = s.option(widgets.NetworkSelect, 'interface', _('Internal network'),
			_('Select the local/internal (LAN) network interface to be enabled'));
		o.exclude = 'wan'; // wan6 should also be excluded
		o.nocreate = true;
		o.editable = true;
		o.retain = true; // Otherwise removed with unmet dependencies, or if cloned
		o.validate = function(section_id, value) {
			let netcount = 0;
			// Commented out as it causes issues with cloning
			//for (let ifnr = 0; uci.get('upnpd', `@internal_network[${ifnr}]`, 'interface'); ifnr++) {
			//	if (uci.get('upnpd', `@internal_network[${ifnr}]`, 'interface') == value) netcount++;
			//}
			return (netcount >= 2 || value == '' || value == 'wan' || value == 'wan6') ? '' : true;
		}

		o = s.option(form.ListValue, 'acl_preset', _('Access control preset'),
			_('Select a preset for all devices on the network'));
		o.value('accept-high-ports', _('Accept ports >=1024'));
		o.value('accept-high-ports+web', _('Accept HTTP/HTTPS + ports >=1024'));
		o.value('accept-high-ports+web+dns', _('Accept HTTP/HTTPS/DNS + ports >=1024'));
		o.value('accept-all-ports', _('Accept all ports'));
		o.value('accept-listed-ports', _('Only accept listed ports'));
		o.value('none', _('Only check custom ACL / listed ports'));
		o.editable = true;
		o.retain = true; // Otherwise removed with unmet dependencies, or if cloned

		o = s.option(form.Value, 'acl_accept_ports', _('Accept ports'),
			_('Accept these ports or port ranges on the network, or in addition'));
		o.depends('acl_preset', '');
		o.depends({ acl_preset: 'accept-high-ports', '!contains': true });
		o.depends('acl_preset', 'accept-listed-ports');
		o.depends('acl_preset', 'none');
		o.retain = true; // Otherwise removed with unmet dependencies, or if cloned
		o.validate = function(section_id, value) {
			return value.search(/^[0-9 -]*$/) != -1 ? true : '';
		}

		o = s.option(form.Value, 'acl_reject_ports', _('Reject ports'),
			_('By default, reject unsafe/insecure/risky FTP/Telnet/DCE/NetBIOS/SMB/RDP ports on the network, regardless of other settings'));
		o.placeholder = '21 23 135 137-139 445 3389';
		o.modalonly = true;
		o.retain = true; // Otherwise removed with unmet dependencies, or if cloned
		o.validate = function(section_id, value) {
			return value.search(/^[0-9 -]*$/) != -1 ? true : '';
		}

		o = s.option(form.Flag, 'acl_custom_first', _('Check custom ACL first'),
			_('Whether the custom ACL entries should be checked first, before the preset') + '<br>' +
			_('Checking order: 1. reject ports, 2. custom ACL entries if used, 3. preset, 4. accept ports'));
		o.editable = true;
		o.depends('acl_preset', '');
		o.depends({ acl_preset: 'accept-high-ports', '!contains': true });
		o.depends('acl_preset', 'accept-all-ports');
		// o.retain = true; To removed with unmet dependencies

		s = m.section(form.GridSection, 'acl_entry', _('Custom Access Control List'),
			_('The custom access control list (ACL) specifies which IP addresses and ports can be mapped. ACL entries are checked in order, and then rejected by default. (should be part of extra tab)'));
		s.anonymous = true;
		s.addremove = true;
		s.cloneable = true;
		s.sortable = true;
		s.modaltitle = _('UPnP IGD & PCP') + ' - ' + _('Edit custom ACL entry');
		// Preferably, custom ACL should be part of extra tab with depends for section, as immediately, and network section part of service setup tab
		let customaclused = false;
		for (let ifnr = 0; uci.get('upnpd', `@internal_network[${ifnr}]`, 'interface'); ifnr++) {
			if (uci.get('upnpd', `@internal_network[${ifnr}]`, 'acl_preset') == 'none' ||
				uci.get('upnpd', `@internal_network[${ifnr}]`, 'acl_custom_first') == '1') {
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
		o.retain = true; // Otherwise removed if disabled

		o = s.option(form.Value, 'int_port', _('Port'));
		o.datatype = 'portrange';
		o.placeholder = '1-65535 (' + _('any port') + ')';
		o.editable = true;
		o.retain = true; // Otherwise removed if disabled

		o = s.option(form.Value, 'ext_port', _('External port'));
		o.datatype = 'portrange';
		o.placeholder = '1-65535 (' + _('any port') + ')';
		o.editable = true;
		o.retain = true; // Otherwise removed if disabled

		o = s.option(form.Value, 'desc_filter', _('Description filter'),
			_('A regular expression to check for a UPnP IGD IPv4 port map description'));
		o.placeholder = '.* (' + _('any description') + ')';
		o.modalonly = true;

		o = s.option(form.ListValue, 'action', _('Action'));
		o.value('accept', _('Accept'));
		o.value('reject', _('Reject'));
		o.value('ignore', _('Ignore'));
		o.editable = true;
		o.retain = true; // Otherwise removed if disabled

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
