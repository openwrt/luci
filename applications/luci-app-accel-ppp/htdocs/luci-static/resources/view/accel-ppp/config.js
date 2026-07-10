'use strict';
'require view';
'require rpc';
'require fs';
'require poll';
'require ui';

var confPath = '/etc/accel-ppp/accel-ppp.conf';
var accelCmdPath = '/usr/bin/accel-cmd';
var activeSessionArgs = [
	'-p', '2001', 'show', 'sessions',
	'ifname,username,calling-sid,sid,ip,uptime,tx-bytes,rx-bytes'
];
var activeSessionFallbackArgs = [ '-p', '2001', 'show', 'sessions' ];
var activeSessionPollInterval = 5;
var serviceName = 'accel-ppp';
var isReadonlyView = !L.hasViewPermission() || null;

function linesOf(text) {
	return String(text || '').replace(/\r\n/g, '\n').split('\n');
}

function textOf(lines) {
	return lines.join('\n').replace(/\n*$/, '\n');
}

function findSection(lines, name) {
	var start = -1, end = lines.length;

	for (var i = 0; i < lines.length; i++) {
		var m = lines[i].match(/^\s*\[([^\]]+)\]\s*$/);

		if (m && m[1] == name) {
			start = i;
			break;
		}
	}

	if (start < 0)
		return null;

	for (var j = start + 1; j < lines.length; j++) {
		if (lines[j].match(/^\s*\[[^\]]+\]\s*$/)) {
			end = j;
			break;
		}
	}

	return { start: start, end: end };
}

function ensureSection(lines, name) {
	var range = findSection(lines, name);

	if (range)
		return range;

	if (lines.length && lines[lines.length - 1].trim() != '')
		lines.push('');

	lines.push('[' + name + ']');
	return findSection(lines, name);
}

function escapeRegExp(s) {
	return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findKeyLine(lines, section, key, includeCommented) {
	var range = findSection(lines, section);
	var active = null, commented = null;
	var re = new RegExp('^\\s*(#?)\\s*' + escapeRegExp(key) + '\\s*=\\s*(.*)$');

	if (!range)
		return null;

	for (var i = range.start + 1; i < range.end; i++) {
		var m = lines[i].match(re);

		if (!m)
			continue;

		if (m[1] == '')
			active = { index: i, value: m[2].trim(), commented: false };
		else if (commented == null)
			commented = { index: i, value: m[2].trim(), commented: true };

		if (active)
			break;
	}

	return active || (includeCommented ? commented : null);
}

function getValue(lines, section, key, fallback) {
	var line = findKeyLine(lines, section, key, false);
	return line ? line.value : (fallback || '');
}

function getAnyValue(lines, section, key, fallback) {
	var line = findKeyLine(lines, section, key, true);
	return line ? line.value : (fallback || '');
}

function setKey(lines, section, key, value) {
	var range = ensureSection(lines, section);
	var line = findKeyLine(lines, section, key, true);
	var str = value == null ? '' : String(value).trim();

	if (str == '') {
		if (line)
			lines[line.index] = '#' + key + '=' + line.value;
		return;
	}

	if (line) {
		lines[line.index] = key + '=' + str;
		return;
	}

	var insertAt = range.end;

	while (insertAt > range.start + 1 && lines[insertAt - 1].trim() == '')
		insertAt--;

	lines.splice(insertAt, 0, key + '=' + str);
}

function findModuleLine(lines, name) {
	var range = findSection(lines, 'modules');
	var re = new RegExp('^\\s*(#?)\\s*' + escapeRegExp(name) + '\\s*$');

	if (!range)
		return null;

	for (var i = range.start + 1; i < range.end; i++) {
		var m = lines[i].match(re);

		if (m)
			return { index: i, enabled: m[1] == '' };
	}

	return null;
}

function getModule(lines, name) {
	var line = findModuleLine(lines, name);
	return line ? line.enabled : false;
}

function setModule(lines, name, enabled) {
	var range = ensureSection(lines, 'modules');
	var line = findModuleLine(lines, name);
	var value = enabled ? name : '#' + name;

	if (line) {
		lines[line.index] = value;
		return;
	}

	var insertAt = range.end;

	while (insertAt > range.start + 1 && lines[insertAt - 1].trim() == '')
		insertAt--;

	lines.splice(insertAt, 0, value);
}

function parseCommaOptions(value) {
	var parts = String(value || '').split(',');
	var opts = {};

	opts._head = (parts.shift() || '').trim();
	opts._secret = (parts.shift() || '').trim();

	for (var i = 0; i < parts.length; i++) {
		var p = parts[i].trim();
		var eq = p.indexOf('=');

		if (eq > -1)
			opts[p.slice(0, eq)] = p.slice(eq + 1);
	}

	return opts;
}

function buildCommaOptions(head, secret, keys, values) {
	var parts = [];

	if (head)
		parts.push(head);
	if (secret)
		parts.push(secret);

	for (var i = 0; i < keys.length; i++) {
		var key = keys[i];
		var val = values[key];

		if (val != null && String(val).trim() != '')
			parts.push(key + '=' + String(val).trim());
	}

	return parts.join(',');
}

function field(name) {
	return document.querySelector('[data-field="' + name + '"]');
}

function fieldValue(name) {
	var el = field(name);
	return el ? String(el.value || '').trim() : '';
}

function fieldChecked(name) {
	var el = field(name);
	return !!(el && el.checked);
}

function errorText(e) {
	return e && e.message ? e.message : String(e);
}

function splitSessionLine(line) {
	var parts = String(line || '').split('|').map(function(part) {
		return part.trim();
	});

	while (parts.length && parts[0] == '')
		parts.shift();

	while (parts.length && parts[parts.length - 1] == '')
		parts.pop();

	return parts;
}

function parseActiveSessions(output) {
	var sessions = [];
	var lines = String(output || '').split(/\r?\n/);
	var headers = null;

	for (var i = 0; i < lines.length; i++) {
		if (lines[i].indexOf('|') < 0)
			continue;

		var parts = splitSessionLine(lines[i]);

		if (parts.length == 0)
			continue;

		var first = parts[0].toLowerCase();
		var joined = parts.join(' ').toLowerCase();

		if (first == 'ifname' || (joined.indexOf('username') > -1 && joined.indexOf('calling') > -1)) {
			headers = parts.map(function(part) { return part.toLowerCase(); });
			continue;
		}

		if (/^-+$/.test(parts[0]))
			continue;

		if (!headers)
			continue;

		var row = {};

		for (var j = 0; j < headers.length && j < parts.length; j++)
			row[headers[j]] = parts[j];

		var ifname = row.ifname || '';
		var username = row.username || '';
		var sid = row.sid || '';
		var pppUnit = ifname.match(/^ppp([0-9]+)$/);
		var displayName = pppUnit && username ? 'pppoe%s-%s'.format(pppUnit[1], username).toLowerCase() : username;
		var shortSid = String(sid || '').replace(/^0+/, '') || '0';

		sessions.push({
			ifname: ifname,
			username: displayName,
			callingSid: row['calling-sid'] || '',
			sid: shortSid,
			ip: row.ip || '',
			uptime: row.uptime || '',
			download: row['tx-bytes'] || '',
			upload: row['rx-bytes'] || ''
		});
	}

	return sessions;
}

function activeSessionOutput(result) {
	if (typeof result == 'string')
		return result;

	return result && result.stdout ? result.stdout : '';
}

function activeSessionError(result) {
	if (!result || result.code == 0)
		return '';

	return result.stderr || result.stdout || _('Command failed');
}

function showApplyModal(message) {
	ui.showModal(_('Applying changes'), [
		E('p', { 'class': 'spinning' }, message)
	]);
}

function inputEl(name, value, placeholder, type) {
	return E('input', {
		'id': 'accel_' + name,
		'data-field': name,
		'class': 'cbi-input-text',
		'type': type || 'text',
		'value': value || '',
		'placeholder': placeholder || '',
		'disabled': isReadonlyView
	});
}

function checkboxEl(name, checked) {
	var attrs = {
		'id': 'accel_' + name,
		'data-field': name,
		'type': 'checkbox',
		'disabled': isReadonlyView
	};

	if (checked)
		attrs.checked = 'checked';

	return E('input', attrs);
}

function selectEl(name, value, choices) {
	var children = [];

	for (var i = 0; i < choices.length; i++) {
		var opt = choices[i];
		var attrs = { 'value': opt[0] };

		if (String(value || '') == String(opt[0]))
			attrs.selected = 'selected';

		children.push(E('option', attrs, opt[1]));
	}

	return E('select', {
		'id': 'accel_' + name,
		'data-field': name,
		'class': 'cbi-input-select',
		'disabled': isReadonlyView
	}, children);
}

function row(name, title, control, description) {
	return E('div', { 'class': 'cbi-value' }, [
		E('label', { 'class': 'cbi-value-title', 'for': 'accel_' + name }, title),
		E('div', { 'class': 'cbi-value-field' }, [
			control,
			description ? E('div', { 'class': 'cbi-value-description' }, description) : ''
		])
	]);
}

function valueRow(lines, section, key, name, title, description, type) {
	return row(
		name,
		title,
		inputEl(name, getValue(lines, section, key), getAnyValue(lines, section, key), type),
		description
	);
}

function flagRow(lines, section, key, name, title, description) {
	return row(name, title, checkboxEl(name, getValue(lines, section, key) == '1'), description);
}

function moduleRow(lines, name, title, description) {
	return row('module_' + name, title, checkboxEl('module_' + name, getModule(lines, name)), description);
}

function selectRow(lines, section, key, name, title, choices, description) {
	return row(name, title, selectEl(name, getValue(lines, section, key), choices), description);
}

function deviceLabel(name, dev) {
	var parts = [ name ];

	if (dev) {
		if (dev.devtype)
			parts.push(dev.devtype);
		else if (dev.bridge)
			parts.push('bridge');

		if (dev.up === true)
			parts.push(_('up'));
		else if (dev.up === false)
			parts.push(_('down'));
	}

	return parts.join(' - ');
}

function deviceChoices(devices, current) {
	var names = Object.keys(devices || {}).sort(L.naturalCompare);
	var choices = [[ '', _('Unspecified') ]];
	var seen = {};

	if (current && names.indexOf(current) == -1) {
		choices.push([ current, current + ' (' + _('current') + ')' ]);
		seen[current] = true;
	}

	for (var i = 0; i < names.length; i++) {
		var name = names[i];

		if (seen[name])
			continue;

		choices.push([ name, deviceLabel(name, devices[name]) ]);
	}

	return choices;
}

function deviceSelectRow(lines, section, key, name, title, devices, description) {
	var current = getValue(lines, section, key);
	return row(name, title, selectEl(name, current, deviceChoices(devices, current)), description);
}

var verboseChoices = [
	[ '0', _('Disabled') ],
	[ '1', _('Enabled') ]
];

var requireChoices = [
	[ '', _('Unspecified') ],
	[ 'deny', _('Deny') ],
	[ 'allow', _('Allow') ],
	[ 'require', _('Require') ]
];

var logLevelChoices = [
	[ '0', _('Emergency') ],
	[ '1', _('Alert') ],
	[ '2', _('Critical') ],
	[ '3', _('Error') ],
	[ '4', _('Warning') ],
	[ '5', _('Notice') ],
	[ '6', _('Info') ],
	[ '7', _('Debug') ]
];

var dataSeqChoices = [
	[ '', _('Unspecified') ],
	[ 'deny', _('Deny') ],
	[ 'allow', _('Allow') ],
	[ 'require', _('Require') ]
];

return view.extend({
	callRcList: rpc.declare({
		object: 'rc',
		method: 'list',
		params: [ 'name' ],
		expect: { '': {} }
	}),

	callRcInit: rpc.declare({
		object: 'rc',
		method: 'init',
		params: [ 'name', 'action' ]
	}),

	callNetworkDevices: rpc.declare({
		object: 'luci-rpc',
		method: 'getNetworkDevices',
		expect: { '': {} }
	}),

	load: function() {
		return Promise.all([
			L.resolveDefault(fs.read(confPath), ''),
			L.resolveDefault(this.callRcList(serviceName), {}),
			L.resolveDefault(this.callNetworkDevices(), {}),
			this.loadActiveSessions()
		]);
	},

	loadActiveSessions: function() {
		return L.resolveDefault(fs.exec(accelCmdPath, activeSessionArgs), null).then(function(result) {
			if (result && result.code == 0)
				return result;

			return L.resolveDefault(fs.exec(accelCmdPath, activeSessionFallbackArgs), result || { code: 1 });
		});
	},

	handleServiceAction: function(action, ev) {
		return this.callRcInit(serviceName, action).then(function(ret) {
			if (ret)
				throw _('Command failed');

			ui.addNotification(null, E('p', _('Accel-PPP %s command completed.').format(action)), 'info');
			window.setTimeout(function() { window.location.reload(); }, 700);
		}).catch(function(e) {
			ui.addNotification(null, E('p', _('Unable to run Accel-PPP %s: %s').format(action, e)));
		});
	},

	handleSave: function(ev) {
		var oldValue = this.sourceText || '';
		var lines = linesOf(oldValue);
		var radiusServer = {};
		var daeServer = {};
		var stage = 'save';

		[
			'log_file', 'log_syslog', 'log_tcp', 'log_pgsql',
			'pptp', 'l2tp', 'pppoe', 'ipoe',
			'auth_mschap_v2', 'auth_mschap_v1', 'auth_chap_md5', 'auth_pap',
			'radius', 'chap-secrets'
		].forEach(function(name) {
			setModule(lines, name, fieldChecked('module_' + name));
		});

		setKey(lines, 'ppp', 'verbose', fieldValue('ppp_verbose'));
		setKey(lines, 'ppp', 'min-mtu', fieldValue('ppp_min_mtu'));
		setKey(lines, 'ppp', 'mtu', fieldValue('ppp_mtu'));
		setKey(lines, 'ppp', 'mru', fieldValue('ppp_mru'));
		setKey(lines, 'ppp', 'ipv4', fieldValue('ppp_ipv4'));
		setKey(lines, 'ppp', 'ipv6', fieldValue('ppp_ipv6'));
		setKey(lines, 'ppp', 'mppe', fieldValue('ppp_mppe'));
		setKey(lines, 'ppp', 'lcp-echo-interval', fieldValue('ppp_lcp_echo_interval'));
		setKey(lines, 'ppp', 'lcp-echo-timeout', fieldValue('ppp_lcp_echo_timeout'));
		setKey(lines, 'ppp', 'lcp-echo-failure', fieldValue('ppp_lcp_echo_failure'));
		setKey(lines, 'ppp', 'unit-cache', fieldValue('ppp_unit_cache'));

		setKey(lines, 'pppoe', 'verbose', fieldValue('pppoe_verbose'));
		setKey(lines, 'pppoe', 'interface', fieldValue('pppoe_interface'));
		setKey(lines, 'pppoe', 'ac-name', fieldValue('pppoe_ac_name'));
		setKey(lines, 'pppoe', 'service-name', fieldValue('pppoe_service_name'));
		setKey(lines, 'pppoe', 'called-sid', fieldValue('pppoe_called_sid'));
		setKey(lines, 'pppoe', 'pado-delay', fieldValue('pppoe_pado_delay'));
		setKey(lines, 'pppoe', 'padi-limit', fieldValue('pppoe_padi_limit'));
		setKey(lines, 'pppoe', 'ip-pool', fieldValue('pppoe_ip_pool'));
		setKey(lines, 'pppoe', 'vlan-mon', fieldValue('pppoe_vlan_mon'));
		setKey(lines, 'pppoe', 'vlan-timeout', fieldValue('pppoe_vlan_timeout'));
		setKey(lines, 'pppoe', 'vlan-name', fieldValue('pppoe_vlan_name'));
		setKey(lines, 'pppoe', 'tr101', fieldChecked('pppoe_tr101') ? '1' : '');
		setKey(lines, 'pppoe', 'sid-uppercase', fieldChecked('pppoe_sid_uppercase') ? '1' : '');

		setKey(lines, 'l2tp', 'verbose', fieldValue('l2tp_verbose'));
		setKey(lines, 'l2tp', 'dictionary', fieldValue('l2tp_dictionary'));
		setKey(lines, 'l2tp', 'host-name', fieldValue('l2tp_host_name'));
		setKey(lines, 'l2tp', 'secret', fieldValue('l2tp_secret'));
		setKey(lines, 'l2tp', 'hello-interval', fieldValue('l2tp_hello_interval'));
		setKey(lines, 'l2tp', 'timeout', fieldValue('l2tp_timeout'));
		setKey(lines, 'l2tp', 'rtimeout', fieldValue('l2tp_rtimeout'));
		setKey(lines, 'l2tp', 'rtimeout-cap', fieldValue('l2tp_rtimeout_cap'));
		setKey(lines, 'l2tp', 'retransmit', fieldValue('l2tp_retransmit'));
		setKey(lines, 'l2tp', 'recv-window', fieldValue('l2tp_recv_window'));
		setKey(lines, 'l2tp', 'dataseq', fieldValue('l2tp_dataseq'));
		setKey(lines, 'l2tp', 'reorder-timeout', fieldValue('l2tp_reorder_timeout'));
		setKey(lines, 'l2tp', 'ip-pool', fieldValue('l2tp_ip_pool'));
		setKey(lines, 'l2tp', 'dir300_quirk', fieldChecked('l2tp_dir300_quirk') ? '1' : '');

		setKey(lines, 'radius', 'nas-identifier', fieldValue('radius_nas_identifier'));
		setKey(lines, 'radius', 'nas-ip-address', fieldValue('radius_nas_ip_address'));
		setKey(lines, 'radius', 'gw-ip-address', fieldValue('radius_gw_ip_address'));
		setKey(lines, 'radius', 'verbose', fieldValue('radius_verbose'));
		setKey(lines, 'radius', 'timeout', fieldValue('radius_timeout'));
		setKey(lines, 'radius', 'max-try', fieldValue('radius_max_try'));
		setKey(lines, 'radius', 'acct-timeout', fieldValue('radius_acct_timeout'));
		setKey(lines, 'radius', 'acct-delay-time', fieldValue('radius_acct_delay_time'));
		setKey(lines, 'radius', 'acct-on', fieldChecked('radius_acct_on') ? '1' : '');

		radiusServer['auth-port'] = fieldValue('radius_auth_port');
		radiusServer['acct-port'] = fieldValue('radius_acct_port');
		radiusServer['req-limit'] = fieldValue('radius_req_limit');
		radiusServer['fail-timeout'] = fieldValue('radius_fail_timeout');
		radiusServer['max-fail'] = fieldValue('radius_max_fail');
		radiusServer['weight'] = fieldValue('radius_weight');
		setKey(lines, 'radius', 'server', buildCommaOptions(fieldValue('radius_server'), fieldValue('radius_secret'), [
			'auth-port', 'acct-port', 'req-limit', 'fail-timeout', 'max-fail', 'weight'
		], radiusServer));

		daeServer = buildCommaOptions(fieldValue('radius_dae_server'), fieldValue('radius_dae_secret'), [], {});
		setKey(lines, 'radius', 'dae-server', daeServer);

		setKey(lines, 'log', 'log-file', fieldValue('log_file_path'));
		setKey(lines, 'log', 'log-emerg', fieldValue('log_emerg_path'));
		setKey(lines, 'log', 'log-fail-file', fieldValue('log_fail_path'));
		setKey(lines, 'log', 'log-debug', fieldValue('log_debug_path'));
		setKey(lines, 'log', 'syslog', fieldValue('log_syslog_target'));
		setKey(lines, 'log', 'log-tcp', fieldValue('log_tcp_target'));
		setKey(lines, 'log', 'copy', fieldChecked('log_copy') ? '1' : '0');
		setKey(lines, 'log', 'color', fieldChecked('log_color') ? '1' : '');
		setKey(lines, 'log', 'level', fieldValue('log_level'));

		var newValue = textOf(lines);

		if (newValue == oldValue) {
			ui.addNotification(null, E('p', _('No configuration changes to apply.')), 'info');
			return Promise.resolve();
		}

		showApplyModal(_('Saving configuration...'));

		return fs.write(confPath, newValue).then(L.bind(function() {
			this.sourceText = newValue;
			stage = 'restart';
			showApplyModal(_('Restarting Accel-PPP...'));
			return this.callRcInit(serviceName, 'restart');
		}, this)).then(function(ret) {
			if (ret)
				throw _('Command failed');

			ui.hideModal();
			ui.addNotification(null, E('p', _('Configuration saved and Accel-PPP restarted.')), 'info');
		}).catch(function(e) {
			ui.hideModal();

			if (stage == 'restart')
				ui.addNotification(null, E('p', _('Configuration saved, but Accel-PPP restart failed: %s').format(errorText(e))), 'danger');
			else
				ui.addNotification(null, E('p', _('Unable to save configuration: %s').format(errorText(e))), 'danger');
		});
	},

	renderStatus: function(serviceInfo) {
		var info = serviceInfo && serviceInfo[serviceName] ? serviceInfo[serviceName] : {};
		var running = info.running ? _('Running') : _('Stopped');
		var enabled = info.enabled ? _('Enabled') : _('Disabled');

		return E('div', { 'class': 'cbi-section' }, [
			E('h3', _('Service')),
			E('div', { 'class': 'table' }, [
				E('div', { 'class': 'tr' }, [
					E('div', { 'class': 'td left', 'width': '33%' }, _('Status')),
					E('div', { 'class': 'td left' }, running)
				]),
				E('div', { 'class': 'tr' }, [
					E('div', { 'class': 'td left', 'width': '33%' }, _('Startup')),
					E('div', { 'class': 'td left' }, enabled)
				])
			]),
			E('div', { 'class': 'cbi-page-actions' }, [
				E('button', {
					'class': 'btn cbi-button-action',
					'click': ui.createHandlerFn(this, 'handleServiceAction', 'start'),
					'disabled': isReadonlyView
				}, _('Start')),
				' ',
				E('button', {
					'class': 'btn cbi-button-action',
					'click': ui.createHandlerFn(this, 'handleServiceAction', 'restart'),
					'disabled': isReadonlyView
				}, _('Restart')),
				' ',
				E('button', {
					'class': 'btn cbi-button-negative',
					'click': ui.createHandlerFn(this, 'handleServiceAction', 'stop'),
					'disabled': isReadonlyView
				}, _('Stop')),
				' ',
				E('button', {
					'class': 'btn cbi-button-positive',
					'click': ui.createHandlerFn(this, 'handleServiceAction', info.enabled ? 'disable' : 'enable'),
					'disabled': isReadonlyView
				}, info.enabled ? _('Disable') : _('Enable'))
			])
		]);
	},

	renderActiveSessionsTable: function(sessionsOutput) {
		var sessions = parseActiveSessions(activeSessionOutput(sessionsOutput));
		var readError = activeSessionError(sessionsOutput);
		var rows = [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th' }, _('Session')),
				E('th', { 'class': 'th' }, _('Interface')),
				E('th', { 'class': 'th' }, _('Calling-Station-Id')),
				E('th', { 'class': 'th' }, _('SID')),
				E('th', { 'class': 'th' }, _('IP address')),
				E('th', { 'class': 'th' }, _('Uptime')),
				E('th', { 'class': 'th' }, _('Download')),
				E('th', { 'class': 'th' }, _('Upload'))
			])
		];

		if (readError) {
			rows.push(E('tr', { 'class': 'tr placeholder' }, [
				E('td', { 'class': 'td', 'colspan': '8' }, E('em', _('Session data unavailable')))
			]));
		}
		else if (sessions.length == 0) {
			rows.push(E('tr', { 'class': 'tr placeholder' }, [
				E('td', { 'class': 'td', 'colspan': '8' }, E('em', _('No active sessions')))
			]));
		}
		else {
			for (var i = 0; i < sessions.length; i++) {
				var session = sessions[i];

				rows.push(E('tr', { 'class': 'tr cbi-section-table-row cbi-rowstyle-' + ((i % 2) + 1) }, [
					E('td', { 'class': 'td' }, session.username),
					E('td', { 'class': 'td' }, session.ifname),
					E('td', { 'class': 'td' }, session.callingSid),
					E('td', { 'class': 'td' }, session.sid),
					E('td', { 'class': 'td' }, session.ip),
					E('td', { 'class': 'td' }, session.uptime),
					E('td', { 'class': 'td' }, session.download),
					E('td', { 'class': 'td' }, session.upload)
				]));
			}
		}

		return E('table', { 'id': 'accel-ppp-active-sessions', 'class': 'table cbi-section-table' }, rows);
	},

	renderActiveError: function(sessionsOutput) {
		var readError = activeSessionError(sessionsOutput);

		return E('div', {
			'id': 'accel-ppp-active-error',
			'class': 'alert-message warning',
			'style': readError ? '' : 'display:none'
		}, readError ? [ _('Unable to read active sessions'), ': ', readError ] : []);
	},

	refreshActiveSessions: function() {
		var table = document.getElementById('accel-ppp-active-sessions');
		var error = document.getElementById('accel-ppp-active-error');

		if (!table)
			return Promise.resolve();

		return this.loadActiveSessions().then(L.bind(function(result) {
			var nextTable = this.renderActiveSessionsTable(result);
			var readError = activeSessionError(result);

			table.parentNode.replaceChild(nextTable, table);

			if (error) {
				if (readError) {
					error.style.display = '';
					error.textContent = '%s: %s'.format(_('Unable to read active sessions'), readError);
				}
				else {
					error.style.display = 'none';
					error.textContent = '';
				}
			}
		}, this));
	},

	renderActiveTab: function(sessionsOutput) {
		return E('div', { 'data-tab': 'active', 'data-tab-title': _('Active') }, [
			E('div', { 'class': 'cbi-section cbi-tblsection' }, [
				E('h3', _('Active sessions')),
				this.renderActiveError(sessionsOutput),
				this.renderActiveSessionsTable(sessionsOutput),
				E('div', { 'class': 'cbi-page-actions' }, [
					E('button', {
						'class': 'btn cbi-button cbi-button-reload',
						'click': ui.createHandlerFn(this, 'refreshActiveSessions')
					}, _('Refresh'))
				])
			])
		]);
	},

	renderModulesTab: function(lines) {
		return E('div', { 'data-tab': 'modules', 'data-tab-title': _('Modules') }, [
			E('div', { 'class': 'cbi-section' }, [
				E('h3', _('Access services')),
				moduleRow(lines, 'pppoe', 'PPPoE', _('Enable PPP over Ethernet access.')),
				moduleRow(lines, 'l2tp', 'L2TP', _('Enable L2TP access.')),
				moduleRow(lines, 'pptp', 'PPTP', _('Enable PPTP access.')),
				moduleRow(lines, 'ipoe', 'IPoE', _('Enable IPoE access.'))
			]),
			E('div', { 'class': 'cbi-section' }, [
				E('h3', _('Authentication')),
				moduleRow(lines, 'auth_mschap_v2', 'MS-CHAP v2', _('Allow MS-CHAP v2 authentication.')),
				moduleRow(lines, 'auth_mschap_v1', 'MS-CHAP v1', _('Allow MS-CHAP v1 authentication.')),
				moduleRow(lines, 'auth_chap_md5', 'CHAP MD5', _('Allow CHAP MD5 authentication.')),
				moduleRow(lines, 'auth_pap', 'PAP', _('Allow PAP authentication.')),
				moduleRow(lines, 'radius', 'RADIUS', _('Use RADIUS for authentication and accounting.')),
				moduleRow(lines, 'chap-secrets', 'chap-secrets', _('Use the local chap-secrets file.'))
			])
		]);
	},

	renderPppTab: function(lines) {
		return E('div', { 'data-tab': 'ppp', 'data-tab-title': _('PPP') }, [
			E('div', { 'class': 'cbi-section' }, [
				E('h3', _('General PPP settings')),
				selectRow(lines, 'ppp', 'verbose', 'ppp_verbose', _('Verbose logging'), verboseChoices),
				valueRow(lines, 'ppp', 'min-mtu', 'ppp_min_mtu', _('Minimum MTU'), _('Lowest MTU accepted from clients.'), 'number'),
				valueRow(lines, 'ppp', 'mtu', 'ppp_mtu', _('MTU'), _('Server MTU advertised to clients.'), 'number'),
				valueRow(lines, 'ppp', 'mru', 'ppp_mru', _('MRU'), _('Server MRU advertised to clients.'), 'number'),
				selectRow(lines, 'ppp', 'ipv4', 'ppp_ipv4', _('IPv4'), requireChoices),
				selectRow(lines, 'ppp', 'ipv6', 'ppp_ipv6', _('IPv6'), requireChoices),
				selectRow(lines, 'ppp', 'mppe', 'ppp_mppe', _('MPPE'), requireChoices),
				valueRow(lines, 'ppp', 'lcp-echo-interval', 'ppp_lcp_echo_interval', _('LCP echo interval'), _('Seconds between LCP echo requests.'), 'number'),
				valueRow(lines, 'ppp', 'lcp-echo-timeout', 'ppp_lcp_echo_timeout', _('LCP echo timeout'), _('Seconds before considering the peer silent.'), 'number'),
				valueRow(lines, 'ppp', 'lcp-echo-failure', 'ppp_lcp_echo_failure', _('LCP echo failure'), _('Number of failed echoes before disconnect, if configured.'), 'number'),
				valueRow(lines, 'ppp', 'unit-cache', 'ppp_unit_cache', _('Unit cache'), _('Number of PPP units to keep cached.'), 'number')
			])
		]);
	},

	renderPppoeTab: function(lines, devices) {
		return E('div', { 'data-tab': 'pppoe', 'data-tab-title': _('PPPoE') }, [
			E('div', { 'class': 'cbi-section' }, [
				E('h3', _('PPPoE server')),
				selectRow(lines, 'pppoe', 'verbose', 'pppoe_verbose', _('Verbose logging'), verboseChoices),
				deviceSelectRow(lines, 'pppoe', 'interface', 'pppoe_interface', _('Listen interface'), devices, _('Interface or bridge used by the PPPoE access concentrator.')),
				valueRow(lines, 'pppoe', 'ac-name', 'pppoe_ac_name', _('AC name'), _('Optional access concentrator name.')),
				valueRow(lines, 'pppoe', 'service-name', 'pppoe_service_name', _('Service name'), _('Optional PPPoE service name.')),
				valueRow(lines, 'pppoe', 'called-sid', 'pppoe_called_sid', _('Called-Station-Id'), _('Value source for Called-Station-Id, commonly mac.')),
				valueRow(lines, 'pppoe', 'pado-delay', 'pppoe_pado_delay', _('PADO delay'), _('Delay policy for PADO replies.')),
				valueRow(lines, 'pppoe', 'padi-limit', 'pppoe_padi_limit', _('PADI limit'), _('Limit discovery requests per interface.'), 'number'),
				valueRow(lines, 'pppoe', 'ip-pool', 'pppoe_ip_pool', _('IP pool'), _('Pool name used for PPPoE clients.')),
				valueRow(lines, 'pppoe', 'vlan-mon', 'pppoe_vlan_mon', _('VLAN monitor'), _('Interface and VLAN range, for example eth0,10-200.')),
				valueRow(lines, 'pppoe', 'vlan-timeout', 'pppoe_vlan_timeout', _('VLAN timeout'), _('Seconds before removing inactive dynamic VLAN interfaces.'), 'number'),
				valueRow(lines, 'pppoe', 'vlan-name', 'pppoe_vlan_name', _('VLAN name'), _('Dynamic VLAN interface naming pattern.')),
				flagRow(lines, 'pppoe', 'tr101', 'pppoe_tr101', _('TR-101'), _('Enable PPPoE Intermediate Agent support.')),
				flagRow(lines, 'pppoe', 'sid-uppercase', 'pppoe_sid_uppercase', _('Uppercase session ID'), _('Use uppercase session identifiers.'))
			])
		]);
	},

	renderL2tpTab: function(lines) {
		return E('div', { 'data-tab': 'l2tp', 'data-tab-title': _('L2TP') }, [
			E('div', { 'class': 'cbi-section' }, [
				E('h3', _('L2TP server')),
				selectRow(lines, 'l2tp', 'verbose', 'l2tp_verbose', _('Verbose logging'), verboseChoices),
				valueRow(lines, 'l2tp', 'host-name', 'l2tp_host_name', _('Host name'), _('L2TP host name sent to peers.')),
				valueRow(lines, 'l2tp', 'secret', 'l2tp_secret', _('Tunnel secret'), _('Optional shared L2TP tunnel secret.')),
				valueRow(lines, 'l2tp', 'dictionary', 'l2tp_dictionary', _('Dictionary path'), _('Optional L2TP dictionary path.')),
				valueRow(lines, 'l2tp', 'hello-interval', 'l2tp_hello_interval', _('Hello interval'), _('Seconds between L2TP hello packets.'), 'number'),
				valueRow(lines, 'l2tp', 'timeout', 'l2tp_timeout', _('Timeout'), _('L2TP control timeout in seconds.'), 'number'),
				valueRow(lines, 'l2tp', 'rtimeout', 'l2tp_rtimeout', _('Retransmit timeout'), _('Initial retransmit timeout in seconds.'), 'number'),
				valueRow(lines, 'l2tp', 'rtimeout-cap', 'l2tp_rtimeout_cap', _('Retransmit timeout cap'), _('Maximum retransmit timeout in seconds.'), 'number'),
				valueRow(lines, 'l2tp', 'retransmit', 'l2tp_retransmit', _('Retransmits'), _('Maximum retransmit attempts.'), 'number'),
				valueRow(lines, 'l2tp', 'recv-window', 'l2tp_recv_window', _('Receive window'), _('L2TP control receive window.'), 'number'),
				selectRow(lines, 'l2tp', 'dataseq', 'l2tp_dataseq', _('Data sequencing'), dataSeqChoices),
				valueRow(lines, 'l2tp', 'reorder-timeout', 'l2tp_reorder_timeout', _('Reorder timeout'), _('Packet reorder timeout in seconds.'), 'number'),
				valueRow(lines, 'l2tp', 'ip-pool', 'l2tp_ip_pool', _('IP pool'), _('Pool name used for L2TP clients.')),
				flagRow(lines, 'l2tp', 'dir300_quirk', 'l2tp_dir300_quirk', _('DIR-300 quirk'), _('Enable compatibility workaround for affected clients.'))
			])
		]);
	},

	renderRadiusTab: function(lines) {
		var server = parseCommaOptions(getValue(lines, 'radius', 'server'));
		var serverExample = parseCommaOptions(getAnyValue(lines, 'radius', 'server'));
		var dae = parseCommaOptions(getValue(lines, 'radius', 'dae-server'));
		var daeExample = parseCommaOptions(getAnyValue(lines, 'radius', 'dae-server'));

		return E('div', { 'data-tab': 'radius', 'data-tab-title': _('RADIUS') }, [
			E('div', { 'class': 'cbi-section' }, [
				E('h3', _('RADIUS client')),
				valueRow(lines, 'radius', 'nas-identifier', 'radius_nas_identifier', _('NAS identifier'), _('Identifier sent to the RADIUS server.')),
				valueRow(lines, 'radius', 'nas-ip-address', 'radius_nas_ip_address', _('NAS IP address'), _('Source NAS IP address used in RADIUS attributes.')),
				valueRow(lines, 'radius', 'gw-ip-address', 'radius_gw_ip_address', _('Gateway IP address'), _('Gateway address assigned to client sessions.')),
				selectRow(lines, 'radius', 'verbose', 'radius_verbose', _('Verbose logging'), verboseChoices),
				row('radius_server', _('Server'), inputEl('radius_server', server._head, serverExample._head || '127.0.0.1'), _('RADIUS server address.')),
				row('radius_secret', _('Shared secret'), inputEl('radius_secret', server._secret, serverExample._secret || 'testing123', 'password')),
				row('radius_auth_port', _('Auth port'), inputEl('radius_auth_port', server['auth-port'], serverExample['auth-port'] || '1812', 'number')),
				row('radius_acct_port', _('Accounting port'), inputEl('radius_acct_port', server['acct-port'], serverExample['acct-port'] || '1813', 'number')),
				row('radius_req_limit', _('Request limit'), inputEl('radius_req_limit', server['req-limit'], serverExample['req-limit'] || '50', 'number')),
				row('radius_fail_timeout', _('Fail timeout'), inputEl('radius_fail_timeout', server['fail-timeout'], serverExample['fail-timeout'] || '0', 'number')),
				row('radius_max_fail', _('Max failures'), inputEl('radius_max_fail', server['max-fail'], serverExample['max-fail'] || '10', 'number')),
				row('radius_weight', _('Weight'), inputEl('radius_weight', server.weight, serverExample.weight || '1', 'number')),
				row('radius_dae_server', _('DAE server'), inputEl('radius_dae_server', dae._head, daeExample._head || '127.0.0.1:3799'), _('Dynamic Authorization Extension listen address.')),
				row('radius_dae_secret', _('DAE secret'), inputEl('radius_dae_secret', dae._secret, daeExample._secret || 'testing123', 'password')),
				valueRow(lines, 'radius', 'timeout', 'radius_timeout', _('Timeout'), _('RADIUS request timeout in seconds.'), 'number'),
				valueRow(lines, 'radius', 'max-try', 'radius_max_try', _('Max tries'), _('Maximum RADIUS retry attempts.'), 'number'),
				valueRow(lines, 'radius', 'acct-timeout', 'radius_acct_timeout', _('Accounting timeout'), _('Accounting request timeout.'), 'number'),
				valueRow(lines, 'radius', 'acct-delay-time', 'radius_acct_delay_time', _('Accounting delay time'), _('Acct-Delay-Time value.'), 'number'),
				flagRow(lines, 'radius', 'acct-on', 'radius_acct_on', _('Accounting on'), _('Send Accounting-On on startup.'))
			])
		]);
	},

	renderLogTab: function(lines) {
		return E('div', { 'data-tab': 'log', 'data-tab-title': _('Log') }, [
			E('div', { 'class': 'cbi-section' }, [
				E('h3', _('Log modules')),
				moduleRow(lines, 'log_file', _('File log'), _('Write logs to local files.')),
				moduleRow(lines, 'log_syslog', _('Syslog'), _('Send logs to syslog.')),
				moduleRow(lines, 'log_tcp', _('TCP log'), _('Send logs to a TCP collector.')),
				moduleRow(lines, 'log_pgsql', _('PostgreSQL log'), _('Write logs to PostgreSQL.'))
			]),
			E('div', { 'class': 'cbi-section' }, [
				E('h3', _('Log settings')),
				valueRow(lines, 'log', 'log-file', 'log_file_path', _('Main log file'), _('Main Accel-PPP log file path.')),
				valueRow(lines, 'log', 'log-emerg', 'log_emerg_path', _('Emergency log file'), _('Emergency log file path.')),
				valueRow(lines, 'log', 'log-fail-file', 'log_fail_path', _('Authentication failure log'), _('Authentication failure log file path.')),
				valueRow(lines, 'log', 'log-debug', 'log_debug_path', _('Debug log'), _('Optional debug log output.')),
				valueRow(lines, 'log', 'syslog', 'log_syslog_target', _('Syslog target'), _('Syslog identity and facility, for example accel-pppd,daemon.')),
				valueRow(lines, 'log', 'log-tcp', 'log_tcp_target', _('TCP target'), _('TCP log target, for example 127.0.0.1:3000.')),
				flagRow(lines, 'log', 'copy', 'log_copy', _('Copy log'), _('Duplicate messages to the configured outputs.')),
				flagRow(lines, 'log', 'color', 'log_color', _('Color output'), _('Enable ANSI colors where supported.')),
				selectRow(lines, 'log', 'level', 'log_level', _('Log level'), logLevelChoices)
			])
		]);
	},

	render: function(data) {
		var config = data[0] || '';
		var serviceInfo = data[1] || {};
		var devices = data[2] || {};
		var sessionsOutput = data[3] || '';
		var lines = linesOf(config);
		var tabs = E('div', { 'class': 'cbi-section-node-tabbed' }, [
			this.renderActiveTab(sessionsOutput),
			this.renderModulesTab(lines),
			this.renderPppTab(lines),
			this.renderPppoeTab(lines, devices),
			this.renderL2tpTab(lines),
			this.renderRadiusTab(lines),
			this.renderLogTab(lines)
		]);
		var viewNode = E('div', { 'class': 'cbi-map' }, [
			E('h2', _('Accel-PPP')),
			this.renderStatus(serviceInfo),
			tabs
		]);

		this.sourceText = config;
		ui.tabs.initTabGroup(tabs.childNodes);
		poll.add(L.bind(this.refreshActiveSessions, this), activeSessionPollInterval);

		return viewNode;
	},

	handleSaveApply: null,
	handleReset: null
});
