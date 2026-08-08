/*
 * dashboard.js - Merged dashboard (Status/Network/Usage/About) for HH4xModem
 * Copyright (C) 2026 HH4xModem
 * Licensed under the Apache License, Version 2.0.
 */

'use strict';
'require rpc';
'require view';
'require ui';
'require poll';
'require uci';

if (!document.querySelector('link[href*="hh4xmodem.css"]')) {
	document.querySelector('head').appendChild(E('link', {
		'rel': 'stylesheet',
		'type': 'text/css',
		'href': L.resource('view/hh4xmodem/hh4xmodem.css') + '?_=' + Date.now()
	}));
}

const callAllFull = rpc.declare({
	object: 'hh4xmodem',
	method: 'get_all_full'
});

const callAll = rpc.declare({
	object: 'hh4xmodem',
	method: 'get_all'
});

const callSetMode = rpc.declare({
	object: 'hh4xmodem',
	method: 'set_network_mode',
	params: { mode: null },
	reject: true
});

const callConnect = rpc.declare({
	object: 'hh4xmodem',
	method: 'send_connect',
	reject: true
});

const callReboot = rpc.declare({
	object: 'hh4xmodem',
	method: 'reboot_modem',
	reject: true
});

const callUnlockSim = rpc.declare({
	object: 'hh4xmodem',
	method: 'unlock_sim',
	params: { code: '', lock_state: 0 },
	reject: true
});

const callDisconnect = rpc.declare({
	object: 'hh4xmodem',
	method: 'disconnect_modem',
	reject: true
});

const callUnlockPin = rpc.declare({
	object: 'hh4xmodem',
	method: 'unlock_pin',
	params: { pin: '' },
	reject: true
});

const callUnlockPuk = rpc.declare({
	object: 'hh4xmodem',
	method: 'unlock_puk',
	params: { puk: '', new_pin: '' },
	reject: true
});

const callChangePin = rpc.declare({
	object: 'hh4xmodem',
	method: 'change_pin',
	params: { old_pin: '', new_pin: '' },
	reject: true
});

const callChangePinState = rpc.declare({
	object: 'hh4xmodem',
	method: 'change_pin_state',
	params: { pin: '', enable: true },
	reject: true
});

const callClearUsage = rpc.declare({
	object: 'hh4xmodem',
	method: 'clear_usage',
	reject: true
});

const callSetUsageSettings = rpc.declare({
	object: 'hh4xmodem',
	method: 'set_usage_settings',
	params: { settings: {} },
	reject: true
});

const callResetModem = rpc.declare({
	object: 'hh4xmodem',
	method: 'reset_modem',
	reject: true
});

const callSetConnectionSettings = rpc.declare({
	object: 'hh4xmodem',
	method: 'set_connection_settings',
	params: { settings: {} },
	reject: true
});

const callEditProfile = rpc.declare({
	object: 'hh4xmodem',
	method: 'edit_profile',
	params: { profile: {} },
	reject: true
});

const callDeleteProfile = rpc.declare({
	object: 'hh4xmodem',
	method: 'delete_profile',
	params: { profile_id: 0 },
	reject: true
});

const callSetDefaultProfile = rpc.declare({
	object: 'hh4xmodem',
	method: 'set_default_profile',
	params: { profile_id: 0 },
	reject: true
});

function formatBytes(bytes) {
	if (bytes == null || bytes == 0) return '0 B';
	const units = ['B', 'KB', 'MB', 'GB', 'TB'];
	const k = 1024;
	const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1);
	return (bytes / Math.pow(k, i)).toFixed(i > 0 ? 1 : 0) + ' ' + units[i];
}

function formatSpeed(bps) {
	if (bps == null || bps == 0) return '--';
	const bpsNum = parseInt(bps);
	if (bpsNum >= 125000) return (bpsNum / 125000).toFixed(1) + ' Mbps';
	if (bpsNum >= 125) return (bpsNum / 125).toFixed(0) + ' Kbps';
	return bpsNum + ' Bps';
}

function formatDuration(seconds) {
	if (seconds == null) return '--';
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = Math.floor(seconds % 60);
	if (h > 0) return h + 'h ' + m + 'm ' + s + 's';
	if (m > 0) return m + 'm ' + s + 's';
	return s + 's';
}

function signalQualityClass(value, type) {
	if (value == null) return 'signal-unknown';
	if (type === 'rsrp') {
		if (value > -95) return 'signal-good';
		if (value > -110) return 'signal-fair';
		return 'signal-poor';
	}
	if (type === 'rsrq') {
		if (value >= -10) return 'signal-good';
		if (value >= -15) return 'signal-fair';
		return 'signal-poor';
	}
	if (type === 'sinr') {
		if (value >= 20) return 'signal-good';
		if (value >= 13) return 'signal-fair';
		return 'signal-poor';
	}
	if (type === 'ecio') {
		if (value >= -8) return 'signal-good';
		if (value >= -13) return 'signal-fair';
		return 'signal-poor';
	}
	if (type === 'rssi') {
		if (value >= -75) return 'signal-good';
		if (value >= -85) return 'signal-fair';
		return 'signal-poor';
	}
	return 'signal-unknown';
}

function networkTypeLabel(netType) {
	const types = {
		0: 'Unknown', 1: 'GSM', 2: 'GPRS', 3: 'EDGE',
		4: 'WCDMA', 5: 'HSDPA', 6: 'HSUPA', 7: 'HSPA',
		8: 'LTE', 9: 'NR/5G'
	};
	return types[netType] || 'Unknown (' + netType + ')';
}

function simStateLabel(state) {
	switch (state) {
		case 0: return _('No SIM');
		case 1: return _('Detected');
		case 2: return _('PIN required');
		case 3: return _('PUK required');
		case 4: return _('SIM locked (NCK required)');
		case 5: return _('PUK blocked');
		case 6: return _('Invalid');
		case 7: return _('Ready');
		case 11: return _('Initializing');
		default: return _('Unknown') + ' (' + (state != null ? state : '--') + ')';
	}
}

function createCard(title, content, icon) {
	icon = icon || '';
	return E('div', { 'class': 'cbi-section hh4x-card' }, [
		E('div', { 'class': 'hh4x-card-header' }, (function() {
			var c = [];
			if (icon) c.push(E('span', { 'class': 'hh4x-card-icon' }, [icon]));
			c.push(E('h3', { 'class': 'hh4x-card-title' }, [title]));
			return c;
		})()),
		E('div', { 'class': 'hh4x-card-body' }, content)
	]);
}

function createInfoRow(label, value, className) {
	return E('div', { 'class': 'hh4x-info-row' + (className ? ' ' + className : '') }, [
		E('span', { 'class': 'hh4x-info-label' }, [label]),
		E('span', { 'class': 'hh4x-info-value' }, [value != null ? String(value) : '--'])
	]);
}

function getSignalMetrics(signal) {
	var netType = parseInt(signal.NetworkType) || 0;
	if (netType === 8 || netType === 9) {
		return [
			{ label: 'RSRP', field: 'RSRP', unit: 'dBm', type: 'rsrp' },
			{ label: 'RSSI', field: 'RSSI', unit: 'dBm', type: 'rssi' },
			{ label: 'RSRQ', field: 'RSRQ', unit: 'dB', type: 'rsrq' },
			{ label: 'SINR', field: 'SINR', unit: 'dB', type: 'sinr' }
		];
	}
	if (netType >= 4 && netType <= 7) {
		return [
			{ label: 'RSCP', field: 'RSCP', unit: 'dBm', type: 'rsrp' },
			{ label: 'RSSI', field: 'RSSI', unit: 'dBm', type: 'rssi' },
			{ label: 'RSRQ', field: 'RSRQ', unit: 'dB', type: 'rsrq' },
			{ label: 'Ec/Io', field: 'EcIo', unit: 'dB', type: 'ecio' }
		];
	}
	return [
		{ label: 'RSSI', field: 'RSSI', unit: 'dBm', type: 'rssi' },
		{ label: 'RSCP', field: 'RSCP', unit: 'dBm', type: 'rsrp' },
		{ label: 'RSRQ', field: 'RSRQ', unit: 'dB', type: 'rsrq' },
		{ label: 'Ec/Io', field: 'EcIo', unit: 'dB', type: 'ecio' }
	];
}

function createSignalIndicator(label, value, unit, type) {
	if (value == null)
		return createInfoRow(label, '--');

	let cls = signalQualityClass(parseInt(value) || 0, type);
	let pct = 0;
	let numVal = parseInt(value) || 0;

	if (type === 'rsrp') pct = Math.min(100, Math.max(0, (numVal + 140) * 100 / 60));
	else if (type === 'rssi') pct = Math.min(100, Math.max(0, (numVal + 120) * 100 / 60));
	else if (type === 'rsrq') pct = Math.min(100, Math.max(0, (numVal + 20) * 100 / 25));
	else if (type === 'sinr') pct = Math.min(100, Math.max(0, numVal * 100 / 30));
	else if (type === 'ecio') pct = Math.min(100, Math.max(0, (numVal + 25) * 100 / 25));

	let labelMap = { rsrp: 'RSRP', rssi: 'RSSI', rsrq: 'RSRQ', sinr: 'SINR', ecio: 'Ec/Io' };

	return E('div', { 'class': 'hh4x-signal-row' }, [
		E('span', { 'class': 'hh4x-signal-label' }, [labelMap[type] || label]),
		E('div', { 'class': 'hh4x-signal-bar-bg' }, [
			E('div', {
				'class': 'hh4x-signal-bar ' + cls,
				'style': 'width: ' + pct.toFixed(0) + '%'
			})
		]),
		E('span', { 'class': 'hh4x-signal-value ' + cls }, [
			value + (unit ? ' ' + unit : '')
		])
	]);
}

function createBar(value, max, label, colorClass) {
	let pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
	return E('div', { 'class': 'hh4x-usage-bar-group' }, [
		E('div', { 'class': 'hh4x-usage-bar-row' }, [
			E('span', { 'class': 'hh4x-usage-bar-label' }, [label]),
			E('span', { 'class': 'hh4x-usage-bar-pct' }, [pct.toFixed(1) + '%'])
		]),
		E('div', { 'class': 'hh4x-usage-bar-bg' }, [
			E('div', {
				'class': 'hh4x-usage-bar ' + (colorClass || ''),
				'style': 'width: ' + pct.toFixed(0) + '%'
			})
		])
	]);
}

function updateSignalValue(el, value, unit, type) {
	if (!el) return;
	var num = parseInt(value) || 0;
	var cls = signalQualityClass(num, type);
	el.textContent = value != null ? value + unit : '--';
	el.className = 'hh4x-signal-value ' + cls;
}

function updateSignalBar(el, value, type) {
	if (!el) return;
	var num = parseInt(value) || 0;
	var pct = 0;
	if (type === 'rsrp') pct = Math.min(100, Math.max(0, (num + 140) * 100 / 60));
	else if (type === 'rssi') pct = Math.min(100, Math.max(0, (num + 120) * 100 / 60));
	else if (type === 'rsrq') pct = Math.min(100, Math.max(0, (num + 20) * 100 / 25));
	else if (type === 'sinr') pct = Math.min(100, Math.max(0, num * 100 / 30));
	else if (type === 'ecio') pct = Math.min(100, Math.max(0, (num + 25) * 100 / 25));
	el.style.width = pct.toFixed(0) + '%';
	el.className = 'hh4x-signal-bar ' + signalQualityClass(num, type);
}

function updateInfoValue(row, value) {
	if (!row) return;
	var valEl = row.querySelector('.hh4x-info-value');
	if (valEl) valEl.textContent = value != null ? String(value) : '--';
}

function startPolling(interval) {
	poll.add(function() {
		return callAll().then(function(d) {
			var signal = d.GetNetworkInfo || {};
			var conn = d.GetConnectionState || {};
			var grid = document.querySelector('.hh4x-signal-grid');
			if (!grid) return;
			var rows = Array.from(grid.children);
			var metrics = getSignalMetrics(signal);
			for (var i = 0; i < Math.min(rows.length, metrics.length); i++) {
				var m = metrics[i];
				var val = signal[m.field];
				var isValid = val != null && parseFloat(val) !== 0;
				var row = rows[i];
				if (isValid && row.classList.contains('hh4x-signal-row')) {
					updateSignalValue(row.querySelector('.hh4x-signal-value'), val, ' ' + m.unit, m.type);
					updateSignalBar(row.querySelector('.hh4x-signal-bar'), val, m.type);
				} else if (isValid) {
					var newRow = createSignalIndicator(m.label, val, m.unit, m.type);
					row.parentNode.replaceChild(newRow, row);
				} else if (row.classList.contains('hh4x-signal-row')) {
					var vEl = row.querySelector('.hh4x-signal-value');
					if (vEl) { vEl.textContent = '--'; vEl.className = 'hh4x-signal-value signal-unknown'; }
					var bEl = row.querySelector('.hh4x-signal-bar');
					if (bEl) { bEl.style.width = '0%'; bEl.className = 'hh4x-signal-bar signal-unknown'; }
				}
			}
			var body = grid.closest('.hh4x-card-body') || grid.parentNode;
			if (body) {
				var infoRows = body.querySelectorAll('hr.hh4x-divider ~ .hh4x-info-row');
				var sv = [
					signal.SignalStrength != null ? signal.SignalStrength + '/5' : '--',
					signal.Band ? 'Band ' + signal.Band : '--',
					signal.CellId || '--',
					signal.eNBID || '--',
					signal.PLMN || '--',
					signal.mcc && signal.mnc ? signal.mcc + '/' + signal.mnc : '--',
					signal.CGI || '--'
				];
				infoRows.forEach(function(row, i) {
					if (i < sv.length) updateInfoValue(row, sv[i]);
				});
			}
			var cards = document.querySelectorAll('.hh4x-card');
			for (var ci = 0; ci < cards.length; ci++) {
				var t = cards[ci].querySelector('.hh4x-card-title');
				if (t && t.textContent === 'Connection') {
					var r = cards[ci].querySelectorAll('.hh4x-info-row');
					if (r.length >= 6) {
						updateInfoValue(r[3], formatSpeed(conn.Speed_Dl));
						updateInfoValue(r[4], formatSpeed(conn.Speed_Ul));
					}
					break;
				}
			}
		}).catch(function() {
			/* Modem temporarily unreachable — swallow silently.
			   LuCI's poll.step already catches rejections, but we
			   handle explicitly for clarity and future notifications. */
		});
	}, interval);
}

// Wait until the modem's actual connection state matches the target
// (true = connected/ConnectionStatus==2, false = disconnected) before
// reloading the page. The Connect/Disconnect RPC returns as soon as the
// modem *accepts* the request, but establishing/tearing down the data
// connection takes several seconds longer; reloading too early shows the
// stale state.
function waitForConnection(targetConnected, done) {
	var deadline = Date.now() + 40000;
	function check() {
		callAll().then(function (d) {
			var cs = (d.GetConnectionState || {}).ConnectionStatus;
			var connected = cs == 2;
			if (connected === targetConnected) { done(); return; }
			if (Date.now() > deadline) { done(); return; }
			setTimeout(check, 2000);
		}).catch(function () {
			if (Date.now() > deadline) { done(); return; }
			setTimeout(check, 2000);
		});
	}
	check();
}

const networkModes = [
	{ value: 0, label: '2G Only (GSM)' },
	{ value: 1, label: '3G Only (WCDMA)' },
	{ value: 2, label: '2G/3G Auto' },
	{ value: 3, label: '4G/LTE Only' },
	{ value: 4, label: '2G/3G Auto (fallback from 4G)' },
	{ value: 5, label: '3G/4G Auto' },
	{ value: 6, label: '2G/3G/4G Auto (recommended)' }
];

function authTypeLabel(authType) {
	const types = { 0: 'None', 1: 'PAP', 2: 'CHAP', 3: 'PAP & CHAP' };
	return types[authType] || 'Unknown (' + authType + ')';
}

function pdpTypeLabel(pdpType) {
	const types = { 0: 'IPv4', 2: 'IPv6', 3: 'IPv4v6' };
	return types[pdpType] || 'Unknown (' + pdpType + ')';
}

function showProfileModal(mode, profileData, profileList) {
	var overlay = document.getElementById('hh4x-apn-modal');
	if (!overlay) {
		overlay = E('div', { 'class': 'hh4x-modal-overlay', 'id': 'hh4x-apn-modal' });
		var modal = E('div', { 'class': 'hh4x-modal' }, [
			E('div', { 'class': 'hh4x-modal-header' }, [
				E('span', { 'class': 'hh4x-modal-title', 'id': 'apn-modal-title' }),
				E('button', {
					'class': 'hh4x-modal-close cbi-button',
					'click': function () { overlay.style.display = 'none'; }
				}, [_('Cancel')])
			]),
			E('div', { 'class': 'hh4x-modal-body', 'id': 'apn-modal-body' })
		]);
		overlay.appendChild(modal);
		overlay.addEventListener('click', function (e) {
			if (e.target === overlay) overlay.style.display = 'none';
		});
		document.body.appendChild(overlay);
	}

	var isEdit = (mode === 'edit');
	var p = isEdit ? profileData : { ProfileName: '', APN: '', UserName: '', Password: '', AuthType: 0, DailNumber: '*' };

	overlay.querySelector('#apn-modal-title').textContent = isEdit ? _('Edit Profile') : _('Add Profile');

	var body = overlay.querySelector('#apn-modal-body');
	body.innerHTML = '';

	body.appendChild(E('div', { 'class': 'hh4x-form-group' }, [
		E('label', { 'class': 'hh4x-form-label' }, [_('Profile Name:')]),
		E('input', { 'type': 'text', 'class': 'cbi-input-text', 'id': 'apn-form-name',
			'value': p.ProfileName, 'placeholder': _('Profile name'), 'style': 'width:100%;' })
	]));
	body.appendChild(E('div', { 'class': 'hh4x-form-group' }, [
		E('label', { 'class': 'hh4x-form-label' }, [_('APN:')]),
		E('input', { 'type': 'text', 'class': 'cbi-input-text', 'id': 'apn-form-apn',
			'value': p.APN, 'placeholder': _('e.g. internet'), 'style': 'width:100%;' })
	]));
	body.appendChild(E('div', { 'class': 'hh4x-form-group' }, [
		E('label', { 'class': 'hh4x-form-label' }, [_('Username:')]),
		E('input', { 'type': 'text', 'class': 'cbi-input-text', 'id': 'apn-form-user',
			'value': p.UserName, 'placeholder': _('Optional'), 'style': 'width:100%;' })
	]));
	body.appendChild(E('div', { 'class': 'hh4x-form-group' }, [
		E('label', { 'class': 'hh4x-form-label' }, [_('Password:')]),
		E('input', { 'type': 'password', 'class': 'cbi-input-text', 'id': 'apn-form-pass',
			'value': p.Password, 'placeholder': _('Optional'), 'style': 'width:100%;' })
	]));
	body.appendChild(E('div', { 'class': 'hh4x-form-group' }, [
		E('label', { 'class': 'hh4x-form-label' }, [_('Auth Type:')]),
		E('select', { 'class': 'cbi-input-select', 'id': 'apn-form-auth' }, [
			E('option', { value: 0, selected: p.AuthType == 0 ? true : undefined }, ['None']),
			E('option', { value: 1, selected: p.AuthType == 1 ? true : undefined }, ['PAP']),
			E('option', { value: 2, selected: p.AuthType == 2 ? true : undefined }, ['CHAP']),
			E('option', { value: 3, selected: p.AuthType == 3 ? true : undefined }, ['PAP & CHAP'])
		])
	]));
	body.appendChild(E('div', { 'class': 'hh4x-form-group' }, [
		E('label', { 'class': 'hh4x-form-label' }, [_('Dial Number:')]),
		E('input', { 'type': 'text', 'class': 'cbi-input-text', 'id': 'apn-form-dial',
			'value': p.DailNumber, 'placeholder': _('e.g. *99#'), 'style': 'width:100%;' })
	]));
	body.appendChild(E('div', { 'style': 'font-size:0.8em;color:var(--text-color-medium);margin-top:8px;' },
		[_('The new settings take effect after reconnecting the modem (Disconnect then Connect).')]));

	body.appendChild(E('div', { 'class': 'hh4x-modal-actions' }, [
		E('button', {
			'class': 'cbi-button cbi-button-neutral',
			'click': function () { overlay.style.display = 'none'; }
		}, [_('Cancel')]),
		E('button', {
			'class': 'cbi-button cbi-button-apply',
			'id': 'apn-save-btn',
			'click': function () {
				var formData = {
					ProfileName: document.getElementById('apn-form-name').value.trim(),
					APN: document.getElementById('apn-form-apn').value.trim(),
					UserName: document.getElementById('apn-form-user').value.trim(),
					Password: document.getElementById('apn-form-pass').value,
					AuthType: parseInt(document.getElementById('apn-form-auth').value),
					DailNumber: document.getElementById('apn-form-dial').value.trim()
				};
				if (!formData.ProfileName) { ui.addNotification(null, E('p', [_('Profile name is required.')]), 'info'); return; }
				if (!formData.APN) { ui.addNotification(null, E('p', [_('APN is required.')]), 'info'); return; }
				if (isEdit) formData.ProfileID = profileData.ProfileID;
				var btn = document.getElementById('apn-save-btn');
				btn.disabled = true;
				btn.textContent = _('Saving...');
				callEditProfile({ profile: formData }).then(function (r) {
					if (r && r.error == null) {
						btn.textContent = _('✓ Saved');
						setTimeout(function () { window.location.reload(); }, 1500);
					} else {
						ui.addNotification(null, E('p', [_('Save failed: ') + (r?.error || _('Unknown error'))]), 'error');
						btn.disabled = false;
						btn.textContent = _('Save');
					}
				}).catch(function (err) {
					ui.addNotification(null, E('p', [_('Error: ') + String(err)]), 'error');
					btn.disabled = false;
					btn.textContent = _('Save');
				});
			}
		}, [_('Save')])
	]));

	overlay.style.display = '';
}

function parseContext(modemData) {
	var signal  = modemData.GetNetworkInfo || {};
	var status  = modemData.GetSystemStatus || {};
	var conn    = modemData.GetConnectionState || {};
	var usage   = modemData.GetUsageRecord || {};
	var network = modemData.GetNetworkSettings || {};
	var reg     = modemData.GetNetworkRegisterState || {};
	var profiles = modemData.GetProfileList || {};
	var curProfile = modemData.getCurrentProfile || {};
	var sysinfo  = modemData.GetSystemInfo || {};
	var sim      = modemData.GetSimStatus || {};
	var simPinLocked = (sim.SIMState == 2);
	var simReady = (sim.SIMState == 7);
	var simPinSet = (sim.PinState == 1 || sim.PinState == 2);
	var smsSet  = modemData.GetSMSSettings || {};
	var smsSto  = modemData.GetSMSStorageState || {};
	var lan     = modemData.GetLanSettings || {};
	var upnp    = modemData.GetUpnpSettings || {};
	var lang    = modemData.GetCurrentLanguage || {};
	var connSet = modemData.GetConnectionSettings || {};

	return {
		signal: signal, status: status, conn: conn, usage: usage,
		network: network, reg: reg, profiles: profiles, curProfile: curProfile,
		sysinfo: sysinfo, sim: sim, simPinLocked: simPinLocked,
		simReady: simReady, simPinSet: simPinSet, smsSet: smsSet,
		smsSto: smsSto, lan: lan, upnp: upnp, lang: lang, connSet: connSet
	};
}

function renderStatusTab(ctx) {
	var signal = ctx.signal, status = ctx.status, conn = ctx.conn;

	var connState = conn.ConnectionStatus != null ? conn.ConnectionStatus : status.ConnectionStatus;
	var isConnected = connState == 2;

	return E('div', {
		'data-tab': 'status',
		'data-tab-title': _('Status'),
		'data-tab-active': 'true'
	}, [
		E('div', { 'class': 'hh4x-row hh4x-row-2col' }, [
			createCard('Connection', [
				E('div', { 'class': 'hh4x-status-indicator ' + (isConnected ? 'status-connected' : 'status-disconnected') }, [
					E('span', { 'class': 'hh4x-status-dot' }, [isConnected ? '●' : '○']),
					E('span', { 'class': 'hh4x-status-text' }, [
						isConnected ? _('Connected') : _('Disconnected')
					]),
					isConnected
						? E('button', {
							'class': 'cbi-button cbi-button-negative hh4x-connect-btn',
							'style': 'margin-left:8px;padding:2px 8px;font-size:12px;vertical-align:middle;',
							'click': function (e) {
								e.stopPropagation();
								var btn = e.target;
								btn.disabled = true;
								btn.textContent = _('Disconnecting...');
								callDisconnect().then(function (r) {
									if (r && r.error == null) {
										btn.textContent = _('Disconnecting...');
										waitForConnection(false, function () { window.location.reload(); });
									} else {
										ui.addNotification(null, E('p', [_('Disconnect failed: ') + (r?.error || _('Unknown error'))]), 'error');
										btn.disabled = false;
										btn.textContent = _('Disconnect');
									}
								}).catch(function (err) {
									ui.addNotification(null, E('p', [_('Disconnect error: ') + String(err)]), 'error');
									btn.disabled = false;
									btn.textContent = _('Disconnect');
								});
							}
						}, [_('Disconnect')])
						: E('button', {
							'class': 'cbi-button cbi-button-apply hh4x-connect-btn',
							'style': 'margin-left:8px;padding:2px 8px;font-size:12px;vertical-align:middle;',
							'click': function (e) {
								e.stopPropagation();
								var btn = e.target;
								btn.disabled = true;
								btn.textContent = _('Connecting...');
								callConnect().then(function (r) {
									if (r && r.error == null) {
										btn.textContent = _('Connecting...');
										waitForConnection(true, function () { window.location.reload(); });
									} else {
										ui.addNotification(null, E('p', [_('Connect failed: ') + (r?.error || _('Unknown error'))]), 'error');
										btn.disabled = false;
										btn.textContent = _('Connect');
									}
								}).catch(function (err) {
									ui.addNotification(null, E('p', [_('Connect error: ') + String(err)]), 'error');
									btn.disabled = false;
									btn.textContent = _('Connect');
								});
							}
						}, [_('Connect')])
				]),
				createInfoRow('Network', networkTypeLabel(status.NetworkType || signal.NetworkType)),
				createInfoRow('Network Name', status.NetworkName || signal.NetworkName || '--'),
				createInfoRow('IP Address', conn.IPv4Adrress || '--'),
				createInfoRow('Download Speed', formatSpeed(conn.Speed_Dl)),
				createInfoRow('Upload Speed', formatSpeed(conn.Speed_Ul)),
				createInfoRow('Connection Time', formatDuration(conn.ConnectionTime)),
				createInfoRow('Roaming', conn.Domestic_Roaming == 1 ? _('Yes') : _('No'))
			]),
			createCard('Signal Quality', [
				E('div', { 'class': 'hh4x-signal-grid' }, (function() {
					var sigMetrics = getSignalMetrics(signal);
					return sigMetrics.map(function(m) {
						var val = signal[m.field];
						if (val == null || val === 'reserved' || val === '' || parseFloat(val) === 0)
							return createInfoRow(m.label, '--');
						return createSignalIndicator(m.label, val, m.unit, m.type);
					});
				})()),
				E('hr', { 'class': 'hh4x-divider' }),
				createInfoRow('Signal Level', signal.SignalStrength != null ? signal.SignalStrength + '/5' : '--'),
				createInfoRow('Band', signal.Band ? 'Band ' + signal.Band : '--'),
				createInfoRow('Cell ID', signal.CellId || '--'),
				createInfoRow('eNB ID', signal.eNBID || '--'),
				createInfoRow('PLMN', signal.PLMN || '--'),
				createInfoRow('MCC/MNC', signal.mcc && signal.mnc ? signal.mcc + '/' + signal.mnc : '--'),
				createInfoRow('CGI', signal.CGI || '--')
			])
		])
	]);
}

function renderNetworkTab(ctx) {
	var network = ctx.network, signal = ctx.signal, reg = ctx.reg,
		curProfile = ctx.curProfile, connSet = ctx.connSet, profiles = ctx.profiles;

	var currentMode = network.NetworkMode;
	var currentLabel = 'Unknown';
	for (var m of networkModes) {
		if (m.value === currentMode) {
			currentLabel = m.label;
			break;
		}
	}

	return E('div', {
		'data-tab': 'network',
		'data-tab-title': _('Network')
	}, [
		E('div', { 'class': 'hh4x-row hh4x-row-2col' }, [
			createCard('Current Network Mode', [
				E('div', { 'class': 'hh4x-current-mode' }, [
					E('span', { 'class': 'hh4x-mode-badge' }, [String(currentMode)]),
					E('span', { 'class': 'hh4x-mode-label' }, [currentLabel])
				]),
				E('hr', { 'class': 'hh4x-divider' }),
				createInfoRow('Band Selection', network.NetselectionMode === 1 ? _('Automatic') : _('Manual')),
				createInfoRow('Network Band', network.NetworkBand == null || network.NetworkBand == 255 ? _('All') : network.NetworkBand),
				createInfoRow('Roaming', network.DomesticRoam == 1 || network.NetworkRoaming == 1 ? _('Enabled') : _('Disabled'))
			]),
			createCard('Change Network Mode', [
				E('div', { 'class': 'hh4x-warning' }, [
					E('span', { 'class': 'hh4x-warning-icon' }, ['⚠']),
					E('span', {}, [_('Changing the network mode will temporarily disconnect the data connection.')])
				]),
				E('br'),
				E('div', { 'class': 'hh4x-form-group' }, [
					E('label', { 'class': 'hh4x-form-label' }, [_('Select network mode:')]),
					E('select', { 'id': 'netmode-select', 'class': 'cbi-input-select' },
						networkModes.map(function (m) {
							var attrs = { value: m.value };
							if (m.value === currentMode)
								attrs.selected = true;
							return E('option', attrs, [m.label]);
						})
					)
				]),
				E('br'),
				E('button', {
					'id': 'apply-mode-btn',
					'class': 'cbi-button cbi-button-apply',
					'click': function (ev) {
						ev.preventDefault();
						var select = document.getElementById('netmode-select');
						var mode = parseInt(select.value);
						var btn = document.getElementById('apply-mode-btn');
						btn.disabled = true;
						btn.textContent = _('Applying...');
						callSetMode({ mode: mode }).then(function (result) {
							if (result && typeof result === 'object' && result.error == null) {
								btn.textContent = _('✓ Applied');
								setTimeout(function () {
									btn.disabled = false;
									btn.textContent = _('Apply');
									window.location.reload();
								}, 3000);
							} else {
								btn.textContent = result?.error || _('Failed');
								setTimeout(function () {
									btn.disabled = false;
									btn.textContent = _('Apply');
								}, 3000);
							}
						}).catch(function (err) {
							btn.textContent = _('Error: ') + String(err);
							setTimeout(function () {
								btn.disabled = false;
								btn.textContent = _('Apply');
							}, 5000);
						});
					}
				}, [_('Apply')])
			])
		]),
		E('div', { 'class': 'hh4x-row hh4x-row-2col' }, [
			createCard('Registration', [
				createInfoRow('Registration State', reg.regist_state >= 1 || reg.RegisterState >= 1 ? _('Registered') : _('Not Registered')),
				createInfoRow('Network Operator', reg.NetworkFullName || signal.NetworkName || signal.PLMN_name || reg.PLMN || '--'),
				E('hr', { 'class': 'hh4x-divider' }),
				createInfoRow('Current APN', curProfile.APN ? String(curProfile.APN) : _('Auto (Network Provided)')),
				createInfoRow('Connection Mode', connSet.ConnectMode == 1 ? _('Automatic') : _('Manual')),
				createInfoRow('PDP Type', connSet.PdpType != null ? pdpTypeLabel(connSet.PdpType) : '--')
			]),
			createCard('Connection Mode', [
				E('div', { 'class': 'hh4x-form-group' }, [
					E('label', { 'class': 'hh4x-form-label' }, [_('Connection mode:')]),
					E('select', { 'id': 'conn-mode-select', 'class': 'cbi-input-select' }, [
						E('option', { value: 1, selected: connSet.ConnectMode == 1 ? true : undefined }, [_('Automatic')]),
						E('option', { value: 0, selected: (connSet.ConnectMode == 0 || connSet.ConnectMode == null) ? true : undefined }, [_('Manual')])
					])
				]),
				E('div', { 'class': 'hh4x-form-group' }, [
					E('label', { 'class': 'hh4x-form-label' }, [_('PDP Type:')]),
					E('select', { 'id': 'pdp-type-select', 'class': 'cbi-input-select' }, [
						E('option', { value: 0, selected: (connSet.PdpType == 0 || connSet.PdpType == null) ? true : undefined }, ['IPv4']),
						E('option', { value: 2, selected: connSet.PdpType == 2 ? true : undefined }, ['IPv6']),
						E('option', { value: 3, selected: connSet.PdpType == 3 ? true : undefined }, ['IPv4v6'])
					])
				]),
				E('div', { 'class': 'hh4x-form-group' }, [
					E('label', { 'style': 'display:flex;align-items:center;gap:8px;' }, [
						E('input', { 'type': 'checkbox', 'id': 'roaming-connect', 'checked': (connSet.RoamingConnect == 1) ? true : undefined }),
						_('Roaming Connect')
					])
				]),
				E('hr', { 'class': 'hh4x-divider' }),
				E('button', {
					'class': 'cbi-button cbi-button-apply',
					'id': 'apply-conn-mode-btn',
					'click': function (e) {
						e.preventDefault();
						var connectMode = parseInt(document.getElementById('conn-mode-select').value);
						var pdpType = parseInt(document.getElementById('pdp-type-select').value);
						var roaming = document.getElementById('roaming-connect').checked ? 1 : 0;
						var btn = e.target;
						btn.disabled = true;
						btn.textContent = _('Saving...');
						callSetConnectionSettings({ settings: {
							ConnectMode: connectMode,
							PdpType: pdpType,
							RoamingConnect: roaming,
							IdleTime: connSet.IdleTime || 600
						}}).then(function (r) {
							if (r && r.error == null) {
								btn.textContent = _('✓ Saved');
								setTimeout(function () { window.location.reload(); }, 2000);
							} else {
								ui.addNotification(null, E('p', [_('Save failed: ') + (r?.error || _('Unknown error'))]), 'error');
								btn.disabled = false;
								btn.textContent = _('Apply');
							}
						}).catch(function (err) {
							ui.addNotification(null, E('p', [_('Error: ') + String(err)]), 'error');
							btn.disabled = false;
							btn.textContent = _('Apply');
						});
					}
				}, [_('Apply')])
			])
		]),
		E('div', { 'class': 'hh4x-row' }, [
			createCard('APN Profiles', function () {
				var items = [];
				items.push(createInfoRow(_('Current Profile'), curProfile.ProfileName || '--'));
				items.push(createInfoRow(_('Active APN'), curProfile.APN ? String(curProfile.APN) : _('Auto (Network Provided)')));
				items.push(E('hr', { 'class': 'hh4x-divider' }));
				var list = profiles.ProfileList || [];
				if (list.length === 0) {
					items.push(E('div', { 'style': 'padding:0.5em 0;color:var(--text-color-medium);' }, [_('No profiles available.')]));
				} else {
					list.forEach(function (p) {
						var actions = [];
						if (!p.IsPredefine) {
							actions.push(E('button', {
								'class': 'cbi-button cbi-button-action',
								'style': 'font-size:0.8em;padding:2px 8px;',
								'click': function (e) { e.preventDefault(); showProfileModal('edit', p, profiles.ProfileList); }
							}, [_('Edit')]));
							actions.push(E('button', {
								'class': 'cbi-button cbi-button-negative',
								'style': 'font-size:0.8em;padding:2px 8px;',
								'click': function (e) {
									e.preventDefault();
									if (!confirm(_('Delete profile %s?').format(p.ProfileName))) return;
									var btn = e.target;
									btn.disabled = true;
									btn.textContent = _('Deleting...');
									callDeleteProfile({ profile_id: p.ProfileID }).then(function (r) {
										if (r && r.error == null) {
											setTimeout(function () { window.location.reload(); }, 1500);
										} else {
											ui.addNotification(null, E('p', [_('Delete failed: ') + (r?.error || _('Unknown error'))]), 'error');
											btn.disabled = false;
											btn.textContent = _('Delete');
										}
									}).catch(function (err) {
										ui.addNotification(null, E('p', [_('Error: ') + String(err)]), 'error');
										btn.disabled = false;
										btn.textContent = _('Delete');
									});
								}
							}, [_('Delete')]));
						}
						if (!p.Default) {
							actions.push(E('button', {
								'class': 'cbi-button cbi-button-apply',
								'style': 'font-size:0.8em;padding:2px 8px;',
								'click': function (e) {
									e.preventDefault();
									if (!confirm(_('Set profile %s as default? Connection will be disconnected.').format(p.ProfileName))) return;
									var btn = e.target;
									btn.disabled = true;
									btn.textContent = _('Setting...');
									callSetDefaultProfile({ profile_id: p.ProfileID }).then(function (r) {
										if (r && r.error == null) {
											setTimeout(function () { window.location.reload(); }, 2000);
										} else {
											ui.addNotification(null, E('p', [_('Set failed: ') + (r?.error || _('Unknown error'))]), 'error');
											btn.disabled = false;
											btn.textContent = _('Set Default');
										}
									}).catch(function (err) {
										ui.addNotification(null, E('p', [_('Error: ') + String(err)]), 'error');
										btn.disabled = false;
										btn.textContent = _('Set Default');
									});
								}
							}, [_('Set Default')]));
						}
						var defaultBadge = p.Default ? E('span', { 'class': 'hh4x-mode-badge', 'style': 'width:auto;height:auto;padding:1px 6px;border-radius:3px;font-size:0.75em;' }, ['Default']) : null;
						var predefinedBadge = p.IsPredefine ? E('span', { 'style': 'font-size:0.75em;color:var(--text-color-medium);margin-left:4px;' }, ['(Predefined)']) : null;
						items.push(E('div', { 'class': 'hh4x-info-row', 'style': 'flex-wrap:wrap;gap:4px;' }, [
							E('span', { 'class': 'hh4x-info-label', 'style': 'flex:0 0 auto;font-weight:600;' }, [p.ProfileName]),
							E('span', { 'style': 'flex:1;text-align:left;color:var(--text-color-medium);font-size:0.9em;' }, ['APN: ' + (p.APN || '--')]),
							E('span', { 'style': 'font-size:0.85em;color:var(--text-color-dim);' }, ['Auth: ' + authTypeLabel(p.AuthType)]),
							defaultBadge,
							predefinedBadge,
							E('span', { 'style': 'display:flex;gap:4px;margin-left:auto;' }, actions)
						]));
					});
				}
				items.push(E('hr', { 'class': 'hh4x-divider' }));
				items.push(E('button', {
					'class': 'cbi-button cbi-button-action',
					'id': 'add-profile-btn',
					'click': function (e) {
						e.preventDefault();
						showProfileModal('add', null, profiles.ProfileList);
					}
				}, [_('Add New Profile')]));
				return items;
			}())
		])
	]);
}

function renderUsageTab(ctx) {
	var usage = ctx.usage, conn = ctx.conn;
	var usedBytes = usage.HUseData || 0;
	var monthlyPlan = usage.MonthlyPlan || 0;
	var dlBytes = conn.DlBytes || 0;
	var ulBytes = conn.UlBytes || 0;
	var connTime = conn.ConnectionTime || 0;
	var totalDL = usage.HCurrUseDL || 0;
	var totalUL = usage.HCurrUseUL || 0;
	var roamData = usage.RoamUseData || 0;
	var billingDay = conn.BillingDay || 1;

	var usagePercent = monthlyPlan > 0 ? (usedBytes / monthlyPlan) * 100 : 0;
	var usageColor = usagePercent < 50 ? 'usage-good' : (usagePercent < 80 ? 'usage-warn' : 'usage-critical');

	var usageCardChildren = [
		E('div', { 'class': 'hh4x-usage-main' }, [
			E('div', { 'class': 'hh4x-usage-big-number' }, [
				formatBytes(usedBytes)
			]),
			E('div', { 'class': 'hh4x-usage-sub' }, [
				monthlyPlan > 0
					? _('of %s monthly plan').format(formatBytes(monthlyPlan))
					: _('No monthly plan set')
			])
		])
	];

	if (monthlyPlan > 0) {
		usageCardChildren.push(createBar(usedBytes, monthlyPlan, _('Plan Usage'), usageColor));
	}

	usageCardChildren.push(
		E('hr', { 'class': 'hh4x-divider' }),
		createInfoRow(_('All Time Download'), formatBytes(totalDL)),
		createInfoRow(_('All Time Upload'), formatBytes(totalUL)),
		createInfoRow(_('Roaming Data'), formatBytes(roamData))
	);

	return E('div', {
		'data-tab': 'usage',
		'data-tab-title': _('Data Usage')
	}, [
		E('div', { 'class': 'hh4x-row hh4x-row-2col' }, [
			createCard(_('Data Consumption'), usageCardChildren.concat([
				E('hr', { 'class': 'hh4x-divider' }),
				E('div', { 'class': 'hh4x-form-group' }, [
					E('label', { 'class': 'hh4x-form-label' }, [_('Plan Settings')]),
					E('div', { 'style': 'display:flex;gap:4px;flex-direction:column;' }, [
						E('label', {}, [_('Monthly Limit (GB):')]),
						E('input', {
							'type': 'number',
							'class': 'cbi-input-text',
							'id': 'plan-limit-input',
							'value': monthlyPlan > 0 ? (monthlyPlan / 1073741824).toFixed(1) : '',
							'placeholder': 'e.g. 10',
							'style': 'width:100%;'
						}),
						E('label', {}, [_('Billing Day:')]),
						E('input', {
							'type': 'number',
							'class': 'cbi-input-text',
							'id': 'plan-day-input',
							'value': billingDay,
							'min': 1,
							'max': 31,
							'style': 'width:100%;'
						})
					]),
					E('button', {
						'class': 'cbi-button cbi-button-apply',
						'style': 'margin-top:4px;',
						'click': function (e) {
							e.preventDefault();
							var limitGB = parseFloat(document.getElementById('plan-limit-input').value) || 0;
							var day = parseInt(document.getElementById('plan-day-input').value) || 1;
							if (day < 1 || day > 31) { ui.addNotification(null, E('p', [_('Billing day must be 1-31.')]), 'info'); return; }
							var btn = e.target;
							btn.disabled = true;
							btn.textContent = _('Saving...');
							callSetUsageSettings({ settings: {
								MonthlyPlan: Math.round(limitGB * 1073741824),
								BillingDay: day
							}}).then(function (r) {
								if (r && r.error == null) {
									btn.textContent = _('✓ Saved');
									setTimeout(function () { window.location.reload(); }, 2000);
								} else {
									ui.addNotification(null, E('p', [_('Save failed: ') + (r?.error || _('Unknown error'))]), 'error');
									btn.disabled = false;
									btn.textContent = _('Save');
								}
							}).catch(function (err) {
								ui.addNotification(null, E('p', [_('Error: ') + String(err)]), 'error');
								btn.disabled = false;
								btn.textContent = _('Save');
							});
						}
					}, [_('Save')])
				])
			])),
			createCard(_('Current Session'), [
				createInfoRow(_('Connection Time'), formatDuration(connTime)),
				createInfoRow(_('Session Download'), formatBytes(dlBytes)),
				createInfoRow(_('Session Upload'), formatBytes(ulBytes)),
				createInfoRow(_('Total'), formatBytes(dlBytes + ulBytes)),
				createInfoRow(_('Download Speed'), formatSpeed(conn.Speed_Dl)),
				createInfoRow(_('Upload Speed'), formatSpeed(conn.Speed_Ul))
			])
		]),
		E('div', { 'class': 'hh4x-row' }, [
			createCard(_('Connection History'), [
				createInfoRow(_('Total Connections'), usage.TConnTimes != null ? usage.TConnTimes.toLocaleString() : '--'),
				createInfoRow(_('Monthly Connections'), usage.CurrConnTimes != null ? usage.CurrConnTimes.toLocaleString() : '--'),
				createInfoRow(_('Monthly Plan'), monthlyPlan > 0 ? formatBytes(monthlyPlan) : _('Not set')),
				createInfoRow(_('Billing Day'), billingDay),
				E('hr', { 'class': 'hh4x-divider' }),
				E('button', {
					'class': 'cbi-button cbi-button-negative',
					'id': 'clear-usage-btn',
					'click': function (e) {
						e.preventDefault();
						if (!confirm(_('Clear all data usage statistics? This cannot be undone.'))) return;
						var btn = e.target;
						btn.disabled = true;
						btn.textContent = _('Clearing...');
						callClearUsage().then(function (r) {
							if (r && r.error == null) {
								btn.textContent = _('✓ Cleared');
								setTimeout(function () { window.location.reload(); }, 2000);
							} else {
								ui.addNotification(null, E('p', [_('Clear failed: ') + (r?.error || _('Unknown error'))]), 'error');
								btn.disabled = false;
								btn.textContent = _('Clear Data');
							}
						}).catch(function (err) {
							ui.addNotification(null, E('p', [_('Error: ') + String(err)]), 'error');
							btn.disabled = false;
							btn.textContent = _('Clear Data');
						});
					}
				}, [_('Clear Data')])
			])
		])
	]);
}

function renderInfoTab(ctx) {
	var status = ctx.status, network = ctx.network, sim = ctx.sim,
		sysinfo = ctx.sysinfo, simPinLocked = ctx.simPinLocked,
		simReady = ctx.simReady, simPinSet = ctx.simPinSet,
		lan = ctx.lan, upnp = ctx.upnp, lang = ctx.lang;

	var infoTab = E('div', {
		'data-tab': 'info',
		'data-tab-title': _('Info')
	}, [
		E('div', { 'class': 'hh4x-row hh4x-row-2col' }, [
			createCard(_('Modem'), [
				createInfoRow(_('Device Name'), sysinfo.DeviceName),
				createInfoRow(_('Hardware Version'), sysinfo.HwVersion),
				createInfoRow(_('Software Version'), (sysinfo.SwVersion || '').replace(/\n/g, '') || '--'),
				createInfoRow(_('WebUI Version'), (sysinfo.WebUiVersion || '').replace(/\n/g, '') || '--'),
				createInfoRow(_('IMEI'), sysinfo.IMEI || '--'),
				createInfoRow(_('ICCID'), sysinfo.ICCID || '--'),
				createInfoRow(_('Band'), sysinfo.band || '--'),
				createInfoRow(_('Connection Status'), status.ConnectionStatus == 2 ? _('Connected') : _('Disconnected'))
			]),
			createCard(_('SIM Card'), [
				createInfoRow(_('SIM State'), simStateLabel(sim.SIMState)),
				createInfoRow(_('Provider'), sim.SPN || '--'),
				createInfoRow(_('PLMN'), sim.PLMN || '--'),
				createInfoRow(_('IMSI'), sysinfo.IMSI ? sysinfo.IMSI.replace(/(\d{4})\d{6}(\d{4})/, '$1******$2') : '--'),
				createInfoRow(_('PIN State'), simPinLocked ? _('Required / Locked') : (simPinSet ? _('Enabled') : _('Not required'))),
				createInfoRow(_('SIM Lock State'), sim.SIMState == 4 ? _('Locked (network/SIM lock)') : _('Unlocked')),
				createInfoRow(
					sim.SIMState == 3 ? _('PUK attempts left') : _('PIN attempts left'),
					(sim.SIMState == 3
						? (sim.PukRemainingTimes != null ? sim.PukRemainingTimes : '--')
						: (sim.PinRemainingTimes != null ? sim.PinRemainingTimes : '--'))
				)
			]),
			sim.SIMState == 4 ? createCard(_('Unlock SIM'), [
				E('div', { 'class': 'hh4x-warning' }, [
					E('span', { 'class': 'hh4x-warning-icon' }, ['⚠']),
					E('span', {}, [_('The SIM card is network-locked. Enter the unlock code (NCK) below.')])
				]),
				E('br'),
				E('div', { 'class': 'hh4x-form-group' }, [
					E('label', { 'class': 'hh4x-form-label' }, [_('Unlock Code:')]),
					E('input', {
						'type': 'text',
						'class': 'cbi-input-text',
						'id': 'unlock-code-input',
						'placeholder': _('Enter NCK unlock code'),
						'style': 'width:100%;'
					})
				]),
				E('br'),
				E('button', {
					'class': 'cbi-button cbi-button-apply',
					'id': 'unlock-btn',
					'click': function (e) {
						e.preventDefault();
						var code = document.getElementById('unlock-code-input').value.trim();
						if (!code) { ui.addNotification(null, E('p', [_('Please enter the unlock code.')]), 'info'); return; }
						var btn = document.getElementById('unlock-btn');
						btn.disabled = true;
						btn.textContent = _('Unlocking...');
						callUnlockSim({ code: code, lock_state: sim.SIMLockState || 0 }).then(function (r) {
							if (r && r.error == null) {
								btn.textContent = _('✓ Unlock command sent');
								ui.addNotification(null, E('p', [_('Unlock command sent successfully. The modem may restart.')]), 'info');
								setTimeout(function () { window.location.reload(); }, 3000);
							} else {
								btn.textContent = _('Unlock command sent (verifying...)');
								btn.disabled = false;
								ui.addNotification(null, E('p', [_('Unlock reported an error: %s. Re-checking SIM state...').format((r && r.error) || _('Unknown error'))]), 'warning');
								setTimeout(function () { window.location.reload(); }, 3000);
							}
						}).catch(function (err) {
							ui.addNotification(null, E('p', [_('Unlock error: ') + String(err)]), 'error');
							btn.disabled = false;
							btn.textContent = _('Unlock');
						});
					}
				}, [_('Unlock')])
			]) : null,
			sim.SIMState == 3 ? createCard(_('Unlock PUK'), [
				E('div', { 'class': 'hh4x-warning' }, [
					E('span', { 'class': 'hh4x-warning-icon' }, ['⚠']),
					E('span', {}, [_('The SIM is PUK-locked. Enter the PUK code and a new PIN (4-8 digits) to unlock. Unlocking erases all SIM data.')])
				]),
				E('br'),
				E('div', { 'class': 'hh4x-form-group', 'style': 'margin-bottom:12px;' }, [
					E('label', { 'class': 'hh4x-form-label' }, [_('PUK code:')]),
					E('input', {
						'type': 'password',
						'class': 'cbi-input-text',
						'id': 'puk-unlock-input',
						'placeholder': _('Enter PUK code'),
						'style': 'width:100%;'
					})
				]),
				E('div', { 'class': 'hh4x-form-group' }, [
					E('label', { 'class': 'hh4x-form-label' }, [_('New PIN (required, 4-8 digits):')]),
					E('input', {
						'type': 'password',
						'class': 'cbi-input-text',
						'id': 'puk-newpin-input',
						'placeholder': _('New PIN (4-8 digits)'),
						'style': 'width:100%;'
					})
				]),
				E('br'),
				E('button', {
					'class': 'cbi-button cbi-button-apply',
					'id': 'puk-unlock-btn',
					'click': function (e) {
						e.preventDefault();
						var puk = document.getElementById('puk-unlock-input').value.trim();
						if (!puk) { ui.addNotification(null, E('p', [_('Please enter the PUK code.')]), 'info'); return; }
						var newPin = document.getElementById('puk-newpin-input').value.trim();
						if (!newPin) { ui.addNotification(null, E('p', [_('A new PIN is required to unlock a PUK-locked SIM (4-8 digits).')]), 'info'); return; }
						var btn = document.getElementById('puk-unlock-btn');
						btn.disabled = true;
						btn.textContent = _('Unlocking...');
						callUnlockPuk({ puk: puk, new_pin: newPin }).then(function (r) {
							if (r && r.error == null) {
								btn.textContent = _('✓ Unlocked');
								setTimeout(function () { window.location.reload(); }, 2000);
							} else {
								ui.addNotification(null, E('p', [_('Unlock failed: ') + (r?.error || _('Unknown error'))]), 'error');
								btn.disabled = false;
								btn.textContent = _('Unlock');
							}
						}).catch(function (err) {
							ui.addNotification(null, E('p', [_('Error: ') + String(err)]), 'error');
							btn.disabled = false;
							btn.textContent = _('Unlock');
						});
					}
				}, [_('Unlock')])
			]) : null,
			(simPinLocked || simReady) ? createCard(_('SIM PIN'), [
				simPinLocked ? E('div', { 'class': 'hh4x-form-group', 'style': 'margin-bottom:12px;' }, [
					E('label', { 'class': 'hh4x-form-label' }, [_('Enter PIN to unlock:')]),
					E('input', {
						'type': 'password',
						'class': 'cbi-input-text',
						'id': 'pin-unlock-input',
						'placeholder': _('Current PIN'),
						'style': 'width:100%;'
					}),
					E('button', {
						'class': 'cbi-button cbi-button-apply',
						'style': 'margin-top:4px;',
						'click': function (e) {
							e.preventDefault();
							var pin = document.getElementById('pin-unlock-input').value.trim();
							if (!pin) { ui.addNotification(null, E('p', [_('Please enter the PIN.')]), 'info'); return; }
							var btn = e.target;
							btn.disabled = true;
							btn.textContent = _('Unlocking...');
							callUnlockPin({ pin: pin }).then(function (r) {
								if (r && r.error == null) {
									btn.textContent = _('✓ Unlocked');
									setTimeout(function () { window.location.reload(); }, 2000);
								} else {
									ui.addNotification(null, E('p', [_('Unlock failed: ') + (r?.error || _('Unknown error'))]), 'error');
									btn.disabled = false;
									btn.textContent = _('Unlock');
								}
							}).catch(function (err) {
								ui.addNotification(null, E('p', [_('Error: ') + String(err)]), 'error');
								btn.disabled = false;
								btn.textContent = _('Unlock');
							});
						}
					}, [_('Unlock')])
				]) : null,
				simReady ? E('div', { 'class': 'hh4x-form-group', 'style': 'margin-bottom:12px;' }, [
					E('label', { 'class': 'hh4x-form-label' }, [
						simPinSet ? _('Disable PIN protection:') : _('Enable PIN protection:')
					]),
					E('input', {
						'type': 'password',
						'class': 'cbi-input-text',
						'id': 'pin-toggle-input',
						'placeholder': _('Current/default SIM PIN (e.g. 0000)'),
						'style': 'width:100%;'
					}),
					E('button', {
						'class': 'cbi-button cbi-button-apply',
						'style': 'margin-top:4px;',
						'click': function (e) {
							e.preventDefault();
							var pin = document.getElementById('pin-toggle-input').value.trim();
							if (!pin) { ui.addNotification(null, E('p', [_('Please enter the SIM\'s current PIN.')]), 'info'); return; }
							var enable = !simPinSet;
							var btn = e.target;
							btn.disabled = true;
							btn.textContent = _('Setting...');
							callChangePinState({ pin: pin, enable: enable }).then(function (r) {
								if (r && r.error == null) {
									btn.textContent = _('✓ Done');
									setTimeout(function () { window.location.reload(); }, 2000);
								} else {
									ui.addNotification(null, E('p', [_('Failed: ') + (r && r.error != null ? r.error : JSON.stringify(r || 'null'))]), 'error');
									btn.disabled = false;
									btn.textContent = _('Apply');
								}
							}).catch(function (err) {
								ui.addNotification(null, E('p', [_('Error: ') + String(err)]), 'error');
								btn.disabled = false;
								btn.textContent = _('Apply');
							});
						}
					}, [simPinSet ? _('Disable') : _('Enable')])
				]) : null,
				simPinSet ? E('div', {}, [
					E('hr', { 'class': 'hh4x-divider' }),
					E('div', { 'class': 'hh4x-form-group' }, [
						E('label', { 'class': 'hh4x-form-label' }, [_('Change PIN:')]),
						E('div', { 'style': 'display:flex;gap:4px;flex-direction:column;' }, [
							E('input', {
								'type': 'password',
								'class': 'cbi-input-text',
								'id': 'pin-old-input',
								'placeholder': _('Current PIN'),
								'style': 'width:100%;'
							}),
							E('input', {
								'type': 'password',
								'class': 'cbi-input-text',
								'id': 'pin-new-input',
								'placeholder': _('New PIN (4-8 digits)'),
								'style': 'width:100%;'
							})
						]),
						E('button', {
							'class': 'cbi-button cbi-button-action',
							'style': 'margin-top:4px;',
							'click': function (e) {
								e.preventDefault();
								var oldPin = document.getElementById('pin-old-input').value.trim();
								var newPin = document.getElementById('pin-new-input').value.trim();
								if (!oldPin || !newPin) { ui.addNotification(null, E('p', [_('Please fill all fields.')]), 'info'); return; }
								var btn = e.target;
								btn.disabled = true;
								btn.textContent = _('Changing...');
								callChangePin({ old_pin: oldPin, new_pin: newPin }).then(function (r) {
									if (r && r.error == null) {
										btn.textContent = _('✓ Changed');
										ui.addNotification(null, E('p', [_('PIN changed successfully.')]), 'info');
										setTimeout(function () { window.location.reload(); }, 2000);
									} else {
										ui.addNotification(null, E('p', [_('Failed: ') + (r?.error || _('Unknown error'))]), 'error');
										btn.disabled = false;
										btn.textContent = _('Change');
									}
								}).catch(function (err) {
									ui.addNotification(null, E('p', [_('Error: ') + String(err)]), 'error');
									btn.disabled = false;
									btn.textContent = _('Change');
								});
							}
						}, [_('Change')])
					])
				]) : null
			].filter(Boolean)) : null
		].filter(Boolean)),
		E('div', { 'class': 'hh4x-row hh4x-row-2col' }, [
			createCard(_('LAN / Router'), [
				createInfoRow(_('LAN IP'), lan.LanIp || lan.IPv4IPAddress || '--'),
				createInfoRow(_('Subnet Mask'), lan.SubnetMask || '--'),
				createInfoRow(_('DHCP'), lan.DHCPServerStatus == 1 ? _('Enabled') : _('Disabled')),
				createInfoRow(_('DHCP Start'), lan.StartIPAddress || '--'),
				createInfoRow(_('DHCP End'), lan.EndIPAddress || '--'),
				createInfoRow(_('DNS'), lan.IPv4IPAddress || '--'),
				E('hr', { 'class': 'hh4x-divider' }),
				createInfoRow(_('UI Language'), lang.Language || '--'),
				createInfoRow(_('UPnP'), upnp.upnp_switch == 1 ? _('Enabled') : _('Disabled'))
			])
		]),
		E('div', { 'class': 'hh4x-row' }, [
			createCard(_('Device Control'), [
				E('div', { 'class': 'hh4x-warning' }, [
					E('span', { 'class': 'hh4x-warning-icon' }, ['⚠']),
					E('span', {}, [_('Rebooting the modem will also reboot the entire router. All connections will be lost temporarily.')])
				]),
				E('br'),
				E('button', {
					'class': 'cbi-button cbi-button-negative',
					'id': 'reboot-btn',
					'click': function (e) {
						e.preventDefault();
						if (!confirm(_('Are you sure you want to reboot the modem? The router will restart and all connections will be lost.'))) return;
						var btn = document.getElementById('reboot-btn');
						btn.disabled = true;
						btn.textContent = _('Rebooting...');
						callReboot().then(function (r) {
							if (r && r.error == null) {
								btn.textContent = _('✓ Reboot command sent');
							} else {
								ui.addNotification(null, E('p', [_('Reboot failed: ') + (r?.error || _('Unknown error'))]), 'error');
								btn.disabled = false;
								btn.textContent = _('Reboot Modem');
							}
						}).catch(function (err) {
							ui.addNotification(null, E('p', [_('Reboot error: ') + String(err)]), 'error');
							btn.disabled = false;
							btn.textContent = _('Reboot Modem');
						});
					}
				}, [_('Reboot Modem')]),
				E('br'),
				E('button', {
					'class': 'cbi-button cbi-button-negative',
					'id': 'reset-btn',
					'style': 'margin-top:8px;',
					'click': function (e) {
						e.preventDefault();
						if (!confirm(_('Factory reset will erase all modem settings and return to defaults. Continue?'))) return;
						if (!confirm(_('This cannot be undone. Are you absolutely sure?'))) return;
						var btn = document.getElementById('reset-btn');
						btn.disabled = true;
						btn.textContent = _('Resetting...');
						callResetModem().then(function (r) {
							if (r && r.error == null) {
								btn.textContent = _('✓ Reset command sent');
							} else {
								ui.addNotification(null, E('p', [_('Reset failed: ') + (r?.error || _('Unknown error'))]), 'error');
								btn.disabled = false;
								btn.textContent = _('Factory Reset');
							}
						}).catch(function (err) {
							ui.addNotification(null, E('p', [_('Reset error: ') + String(err)]), 'error');
							btn.disabled = false;
							btn.textContent = _('Factory Reset');
						});
					}
				}, [_('Factory Reset')])
			])
		])
	]);
	return infoTab;
}

return view.extend({
	handleSave: null,
	handleSaveApply: null,
	handleReset: null,

	load: function () {
		return Promise.all([
			callAllFull(),
			uci.load('hh4xmodem').then(function () {
				return uci.get('hh4xmodem', 'settings', 'refresh_interval');
			})
		]);
	},

	render: function (data) {
		var modemData = data[0];
		var refreshInterval = parseInt(data[1]) || 3;
		var ctx = parseContext(modemData);

		// ========== Build Tabs ==========
		var statusTab  = renderStatusTab(ctx);
		var networkTab = renderNetworkTab(ctx);
		var usageTab   = renderUsageTab(ctx);
		var infoTab    = renderInfoTab(ctx);

		var paneContainer = E('div', { 'class': 'hh4x-tab-panes' }, [
			statusTab, networkTab, usageTab, infoTab
		]);

		setTimeout(function () {
			try {
				ui.tabs.initTabGroup(paneContainer.childNodes);
			} catch (e) {}
			startPolling(refreshInterval);
		}, 200);

		return E('div', { 'class': 'hh4x-page' }, [ paneContainer ]);
	}
});

