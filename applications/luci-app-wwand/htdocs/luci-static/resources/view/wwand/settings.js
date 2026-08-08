'use strict';
'require view';
'require rpc';
'require ui';
'require uci';
'require dom';
'require wwand.bands as bands';

// wwand modem settings editor. All values go through the daemon's now
// protocol-neutral ubus methods (QMI NAS, MBIM QMI-over-MBIM passthrough, or an
// AT fallback on NCM); band preferences travel as band-number lists (u64 masks
// would lose precision in JS numbers).

var callStatus = rpc.declare({ object: 'wwand', method: 'status', expect: { modems: {} } });
var callGet  = rpc.declare({ object: 'wwand', method: 'modem_get_settings', params: [ 'modem' ], expect: {} });
var callSet  = rpc.declare({ object: 'wwand', method: 'modem_set_settings', params: [ 'modem', 'settings' ], expect: {} });
var callPlmn = rpc.declare({ object: 'wwand', method: 'modem_plmn_lists', params: [ 'modem' ], expect: {} });
var callSlots = rpc.declare({ object: 'wwand', method: 'modem_sim_slots', params: [ 'modem' ], expect: {} });
var callSwitchSlot = rpc.declare({ object: 'wwand', method: 'modem_sim_switch_slot', params: [ 'modem', 'slot' ], expect: {} });
var callPinLock = rpc.declare({ object: 'wwand', method: 'modem_sim_pin_lock', params: [ 'modem', 'pin', 'enable' ], expect: {} });
var callScan = rpc.declare({ object: 'wwand', method: 'modem_scan', params: [ 'modem' ], expect: {} });
var callScanStart = rpc.declare({ object: 'wwand', method: 'modem_scan_start', params: [ 'modem' ], expect: {} });
var callScanStatus = rpc.declare({ object: 'wwand', method: 'modem_scan_status', params: [ 'modem' ], expect: {} });
var callSmsList   = rpc.declare({ object: 'wwand', method: 'modem_sms_list', params: [ 'modem', 'storage' ], expect: {} });
var callSmsDelete = rpc.declare({ object: 'wwand', method: 'modem_sms_delete', params: [ 'modem', 'storage', 'index' ], expect: {} });
var callSetSelection = rpc.declare({ object: 'wwand', method: 'modem_set_network_selection',
	params: [ 'modem', 'mode', 'mcc', 'mnc' ], expect: {} });
var callModemReset = rpc.declare({ object: 'wwand', method: 'modem_reset',
	params: [ 'modem' ], expect: {} });

// Some modems (e.g. MeiG SLM7xx) apply selection/band changes only after a
// modem reboot: the daemon flags such results `deferred`. Inform the user and
// offer the reset — auto interfaces come back up on their own afterwards.
function notifyDeferred(modem) {
	ui.addNotification(null, E('div', {}, [
		E('p', {}, _('Saved — but this modem applies the change only after a modem restart.')),
		E('button', {
			'class': 'btn cbi-button cbi-button-negative',
			'click': function(ev) {
				ev.target.disabled = true;
				callModemReset(modem).then(function(r) {
					if (r && r.ok === false)
						ui.addNotification(null, E('p', _('Modem reset failed: %s').format(r.error || '?')), 'error');
					else
						ui.addNotification(null, E('p',
							_('Modem is restarting — the connection resumes automatically once it re-registers.')), 'info');
				});
			},
		}, _('Restart modem now')),
	]), 'warning');
}
var callEsim = rpc.declare({ object: 'wwand', method: 'modem_esim',
	params: [ 'modem', 'op', 'slot', 'iccid', 'activation_code', 'confirmation_code', 'auto_notify' ], expect: {} });

var MODE_BITS = [
	[ 0x04, 'GSM' ],
	[ 0x08, 'UMTS' ],
	[ 0x10, 'LTE' ],
	[ 0x40, 'NR5G' ],
];

// reset-to-defaults preset: everything the modem supports (it clamps unknown
// band bits itself), data-centric, roaming allowed
var DEFAULTS = {
	mode_preference: 0x50,
	usage_preference: 2,
	roaming_preference: 255,
	lte_bands: [], nr5g_sa_bands: [], nr5g_nsa_bands: [],
};

for (var b = 1; b <= 63; b++) DEFAULTS.lte_bands.push(b);
for (var n = 1; n <= 79; n++) { DEFAULTS.nr5g_sa_bands.push(n); DEFAULTS.nr5g_nsa_bands.push(n); }

function parseBandList(text) {
	var out = [];
	(text || '').split(/[,\s]+/).forEach(function(tok) {
		var n = parseInt(tok, 10);
		if (!isNaN(n) && n > 0 && n <= 512 && out.indexOf(n) < 0)
			out.push(n);
	});
	return out.sort(function(a, b) { return a - b });
}

// Band multi-select built from the shared wwand.bands tables. `known` is a list
// of { num, label }; `selected` is the band-number list currently set. Known
// bands become checkboxes; any selected band the table does not cover survives
// in a raw comma-separated fallback input (so exotic bands are never dropped).
// The returned node carries a _collect() that yields the merged band list.
function bandPicker(known, selected) {
	selected = selected || [];
	var boxes = [], knownNums = {};
	known.forEach(function(b) { knownNums[b.num] = true; });

	var labels = known.map(function(b) {
		var cb = E('input', { 'type': 'checkbox', 'data-band': b.num,
			'checked': (selected.indexOf(b.num) >= 0) ? '' : null });
		boxes.push(cb);
		return E('label', { 'style': 'display:inline-block;min-width:4.5em;margin:1px 10px 1px 0;font-weight:normal' },
			[ cb, ' ' + b.label ]);
	});

	/* Fallback for bands the checkbox table does not cover (exotic / future
	   bands are never silently dropped). Hidden when empty — with the tables
	   complete that is the normal case — behind a small "+ other band" link, so
	   an empty text box does not sit under the checkboxes and confuse. */
	var extra = selected.filter(function(n) { return !knownNums[n]; });
	var rawIn = E('input', { 'type': 'text', 'class': 'cbi-input-text',
		'style': 'width:100%;margin-top:5px' + (extra.length ? '' : ';display:none'),
		'placeholder': _('additional (non-listed) band numbers, comma/space separated'),
		'value': extra.join(',') });
	var moreLink = E('a', { 'href': '#',
		'style': 'font-size:90%;margin-top:4px;display:' + (extra.length ? 'none' : 'inline-block'),
		'click': function(ev) {
			ev.preventDefault();
			rawIn.style.display = '';
			rawIn.focus();
			this.style.display = 'none';
		} }, _('+ add a non-listed band'));

	var node = E('div', {}, [ E('div', {}, labels), rawIn, moreLink ]);
	node._collect = function() {
		var out = [];
		boxes.forEach(function(cb) { if (cb.checked) out.push(+cb.getAttribute('data-band')); });
		parseBandList(rawIn.value).forEach(function(n) { if (out.indexOf(n) < 0) out.push(n); });
		return out.sort(function(a, b) { return a - b });
	};
	return node;
}

function lteKnownBands() {
	return bands.LTE_BANDS.map(function(b) { return { num: b[0], label: 'B' + b[0] }; });
}
function nrKnownBands() {
	return bands.NR_BANDS.map(function(b) {
		return { num: parseInt(('' + b[0]).replace(/^n/, ''), 10), label: b[0] };
	});
}

var WARN_CSS = '' +
'.wwcw{display:flex;gap:9px;align-items:flex-start;padding:9px 13px;border-radius:6px;margin:6px 0;font-size:.95em}' +
'.wwcw .ic{font-size:1.15em;line-height:1.2;flex:none}' +
'.wwcw.warn{background:rgba(192,57,43,.12);color:#b3271a}' +
'.wwcw.info{background:rgba(11,111,194,.11);color:#0b6fc2}' +
'.wwcw-d{opacity:.85;font-size:.9em;margin-top:2px}';

// Render status().config_warnings for a modem (a sibling daemon change adds
// these). Absent/empty → returns null so the caller renders nothing.
function renderWarnings(warns) {
	if (!warns || !warns.length)
		return null;
	var items = warns.map(function(w) {
		var sev = (w.severity == 'warn') ? 'warn' : 'info';
		var det = [];
		if (w.expected != null) det.push(_('expected') + ': ' + w.expected);
		if (w.actual != null)   det.push(_('actual') + ': ' + w.actual);
		return E('div', { 'class': 'wwcw ' + sev }, [
			E('span', { 'class': 'ic' }, sev == 'warn' ? '⚠' : 'ℹ'),
			E('div', {}, [
				E('div', {}, [ w.check ? E('strong', {}, w.check + ': ') : '', w.message || '' ]),
				det.length ? E('div', { 'class': 'wwcw-d' }, det.join(' · ')) : '',
			]),
		]);
	});
	return E('div', {}, [ E('style', {}, WARN_CSS),
		E('h3', {}, _('Configuration warnings')) ].concat(items));
}

function plmnTable(title, list, absentHint) {
	if (list == null)
		return E('p', {}, [ E('em', {}, title + ': ' + _('not present on this SIM') +
			(absentHint ? ' — ' + absentHint : '')) ]);

	var rows = list.map(function(e) {
		var rats = [ 'gsm', 'utran', 'eutran', 'ngran' ]
			.filter(function(k) { return e[k] })
			.map(function(k) { return k.toUpperCase() }).join(' ');
		return E('tr', { 'class': 'tr' }, [
			E('td', { 'class': 'td' }, e.mcc + '/' + e.mnc),
			E('td', { 'class': 'td' }, rats),
		]);
	});

	return E('div', {}, [
		E('h4', {}, title + ' (' + list.length + ')'),
		E('table', { 'class': 'table' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th' }, 'PLMN'),
				E('th', { 'class': 'th' }, _('Access technologies')),
			]),
		].concat(rows)),
	]);
}

// lpac emits terse ES10/ES9+ step tokens on its progress lines; map them to the
// download stages a human recognises (order = the SGP.22 download sequence).
var DL_STEPS = [
	[ 'es10b_get_euicc_challenge_and_info', _('eUICC challenge') ],
	[ 'es9p_initiate_authentication',       _('Contacting SM-DP+') ],
	[ 'es10b_authenticate_server',          _('Verifying server') ],
	[ 'es9p_authenticate_client',           _('Authenticating') ],
	[ 'es10b_prepare_download',             _('Preparing download') ],
	[ 'es9p_get_bound_profile_package',     _('Fetching profile') ],
	[ 'es10b_load_bound_profile_package',   _('Installing profile') ],
];

// parse the live bridge log (progress:/result:/data: lines) into a status
function parseActivity(log) {
	var seen = {}, order = [], cancelled = false, msg = null, code = null, m;
	(log || '').split('\n').forEach(function(l) {
		l = l.trim();
		if ((m = l.match(/^progress:\s*(\S+)/))) {
			if (/cancel_session/.test(m[1])) cancelled = true;
			else if (!seen[m[1]]) { seen[m[1]] = true; order.push(m[1]); }
		} else if ((m = l.match(/^result:\s*code=(-?\d+)\s*(.*)$/))) {
			code = parseInt(m[1], 10);
			if (m[2] && m[2].trim() && m[2].trim() != 'success') msg = m[2].trim();
		} else if ((m = l.match(/^data:\s*(.+)$/))) {
			var d = m[1].trim();
			if (d.length && d[0] != '{') msg = d;   // human message, not the chip JSON blob
		}
	});
	return { seen: seen, order: order, cancelled: cancelled, msg: msg, code: code };
}

var ESIM_CSS = '' +
'.wwe-panel{margin-top:.6em;border:1px solid rgba(128,128,128,.28);border-radius:7px;padding:14px 16px;background:rgba(128,128,128,.06)}' +
'.wwe-steps{list-style:none;margin:.2em 0 0;padding:0}' +
'.wwe-step{display:flex;align-items:center;gap:9px;padding:3px 0;color:#8a8a8a;font-size:.95em}' +
'.wwe-step .ic{width:1.35em;text-align:center;font-weight:700}' +
'.wwe-step.done{color:#2c8a2c}.wwe-step.cur{color:#0b6fc2;font-weight:600}' +
'.wwe-bar{height:8px;border-radius:5px;background:rgba(128,128,128,.25);overflow:hidden;margin:11px 0 4px}' +
'.wwe-bar>span{display:block;height:100%;background:#0b6fc2;transition:width .45s ease}' +
'.wwe-bar.ok>span{background:#2c8a2c}.wwe-bar.err>span{background:#c0392b}' +
'.wwe-banner{display:flex;align-items:center;gap:9px;padding:9px 13px;border-radius:6px;margin-top:11px;font-weight:600}' +
'.wwe-banner.run{background:rgba(11,111,194,.12);color:#0b6fc2}' +
'.wwe-banner.ok{background:rgba(44,138,44,.14);color:#1e6b1e}' +
'.wwe-banner.err{background:rgba(192,57,43,.13);color:#b3271a}' +
'.wwe-log{max-height:15em;overflow:auto;background:#1e1e1e;color:#dcdcdc;padding:9px 11px;margin-top:9px;' +
'font:12px/1.55 ui-monospace,Menlo,Consolas,monospace;border-radius:5px;white-space:pre-wrap;word-break:break-all}' +
'.wwe-det{margin-top:9px;font-size:.9em}.wwe-det>summary{cursor:pointer;color:#0b6fc2}' +
'.wwe-spin{display:inline-block;width:1.05em;height:1.05em;border:2px solid rgba(11,111,194,.3);' +
'border-top-color:#0b6fc2;border-radius:50%;animation:wwe-rot .9s linear infinite;flex:none}' +
'@keyframes wwe-rot{to{transform:rotate(360deg)}}';

return view.extend({
	handleSaveApply: null,
	handleSave: null,
	handleReset: null,

	load: function() {
		return Promise.all([ callStatus(), uci.load('network') ]).then(function(r) {
			var names = Object.keys(r[0] || {});

			if (!names.length)
				return { modem: null };

			return Promise.all([
				callGet(names[0]),
				callPlmn(names[0]),
				L.resolveDefault(callSlots(names[0]), {}),
				L.resolveDefault(callEsim(names[0], 'profiles', 0, '', '', ''), {}),
				L.resolveDefault(callEsim(names[0], 'backend', 0, '', '', ''), {}),
			]).then(function(res) {
				var esim = res[3] || {};
				esim.backend = (res[4] || {}).backend;
				return { modem: names[0], info: (r[0] || {})[names[0]] || {},
				         settings: res[0], plmn: res[1],
				         slots: (res[2] || {}).slots || [], esim: esim };
			});
		});
	},

	// the interface section carrying wwand's per-interface config (SIM slot,
	// cell lock, …). Old-style configs put it on the first wwand interface
	// (proto 'wwand', or the historical 'qmi' alias).
	targetIface: function() {
		var target = null;
		uci.sections('network', 'interface', function(s) {
			if (!target && (s.proto == 'wwand' || s.proto == 'qmi'))
				target = s['.name'];
		});
		return target;
	},

	// network-native model: SIM slot + cell lock live on the interface's
	// wwand_modem section. modemSid() resolves it (null until it exists — reads
	// then fall back to the interface for legacy inline configs); ensureModemSid()
	// creates it + `option modem` on first write, converting to new-style.
	modemSid: function() {
		var iface = this.targetIface();
		if (!iface) return null;
		var ref = uci.get('network', iface, 'modem');
		return (ref && uci.get('network', ref) != null) ? ref : null;
	},

	ensureModemSid: function() {
		var iface = this.targetIface();
		if (!iface) return null;
		var sid = this.modemSid();
		if (sid) return sid;
		var base = 'wwmodem_' + iface, name = base, i = 0;
		while (uci.get('network', name) != null) name = base + (++i);
		uci.add('network', 'wwand_modem', name);
		uci.set('network', iface, 'modem', name);
		return name;
	},

	simSlotUci: function(slot) {
		var sid = this.ensureModemSid();
		if (!sid)
			return Promise.reject(new Error('no qmi interface'));
		uci.set('network', sid, 'sim_slot', String(slot));
		uci.unset('network', this.targetIface(), 'sim_slot');   // drop legacy inline
		return uci.save().then(function() { return uci.apply() });
	},

	renderSim: function(data) {
		var self = this;
		var esimOk = data.esim && data.esim.ok !== false && data.esim.profiles;
		var out = [ E('h3', {}, _('SIM')) ];

		var slotRows = (data.slots || []).map(function(sl) {
			var line = [
				E('strong', {}, _('Slot %d').format(sl.physical) +
					(sl.is_euicc ? ' (eSIM)' : '') + (sl.active ? ' ✓' : '')),
				' — ' + sl.card + (sl.iccid ? (', ICCID ' + sl.iccid) : '') +
					(sl.eid ? (', EID ' + sl.eid) : ''), ' '
			];
			line.push(E('button', { 'class': 'btn cbi-button', 'style': 'margin-left:8px',
				'click': ui.createHandlerFn(self, function() {
					return self.simSlotUci(sl.physical).then(function() {
						ui.addNotification(null, E('p', _('Primary SIM set to slot %d (persisted).').format(sl.physical)), 'info');
					});
				}) }, _('Set as primary')));
			if (!sl.active && sl.card == 'present')
				line.push(E('button', { 'class': 'btn cbi-button cbi-button-apply', 'style': 'margin-left:4px',
					'click': ui.createHandlerFn(self, function() {
						if (!confirm(_('Switch to SIM slot %d now? The connection will drop.').format(sl.physical)))
							return;
						return callSwitchSlot(data.modem, sl.physical);
					}) }, _('Switch now')));
			return E('div', { 'style': 'margin-bottom:4px' }, line);
		});

		out.push(E('div', { 'class': 'cbi-section' },
			slotRows.length ? slotRows : [ E('em', {}, _('No slot information available.')) ]));

		/* --- SIM PIN lock: enable / disable the PIN query, with the current PIN --- */
		var minfo = data.info || {};
		var pinState = (minfo.state == 'SIM_BLOCKED') ? _('blocked — PUK required')
			: (minfo.pin1 && minfo.pin1.enabled === false) ? _('disabled (SIM boots without PIN)')
			: (minfo.pin1 && minfo.pin1.enabled === true) ? _('enabled')
			: _('unknown');
		var pinIn = E('input', { 'type': 'password', 'class': 'cbi-input-password',
			'style': 'width:12em', 'placeholder': _('current PIN') });
		var pinAct = function(enable) {
			var pin = (pinIn.value || '').trim();
			if (!pin) {
				ui.addNotification(null, E('p', _('Enter the current SIM PIN first.')), 'warning');
				return;
			}
			return callPinLock(data.modem, pin, enable).then(function(r) {
				if (r && r.ok === false)
					ui.addNotification(null, E('p', _('PIN change failed: %s').format(r.error || '?')), 'error');
				else
					ui.addNotification(null, E('p', enable ? _('SIM PIN query enabled.') : _('SIM PIN query disabled.')), 'info');
			});
		};

		out.push(E('h4', {}, _('SIM PIN')));
		out.push(E('div', { 'class': 'cbi-section' }, [
			E('p', {}, [ _('PIN query: '), E('strong', {}, pinState) ]),
			E('div', { 'style': 'margin-bottom:4px' }, [
				pinIn, ' ',
				E('button', { 'class': 'btn cbi-button cbi-button-apply', 'style': 'margin-left:8px',
					'click': ui.createHandlerFn(self, function() { return pinAct(true); }) }, _('Enable PIN')),
				E('button', { 'class': 'btn cbi-button cbi-button-remove', 'style': 'margin-left:4px',
					'click': ui.createHandlerFn(self, function() { return pinAct(false); }) }, _('Disable PIN'))
			]),
			E('p', { 'style': 'color:#666;font-size:90%' },
				_('Enabling or disabling the PIN query needs the current PIN. Disabling lets the SIM boot without a PIN.'))
		]));

		/* per-SIM overrides (config wwand_sim) are edited on the dedicated
		   Network → Modems page (shared wwand.simlist) — single source, no
		   duplicate list here. */
		out.push(E('h4', {}, _('SIM overrides')));
		out.push(E('p', {}, [
			_('Per-card PIN/APN overrides (matched by ICCID) are managed on '),
			E('a', { 'href': L.url('admin/network/wwand-modems') }, _('Network → Modems')),
			'.'
		]));

		if (!esimOk) {
			if (data.esim && data.esim.error == 'esim_not_installed')
				out.push(E('p', {}, E('em', {}, _('eSIM management: package wwand-esim is not installed.'))));
			else if (data.esim && data.esim.detail && data.esim.detail.error == 'es10_refused') {
				out.push(E('h4', {}, _('eSIM')));
				out.push(E('div', { 'class': 'wwe-banner run' },
					_('eUICC detected, but the card refuses local eSIM management (ES10 rejected, SW %s).')
						.format(data.esim.detail.sw || '6985')));
				out.push(E('p', {}, _('This is the normal behaviour of M2M eUICCs (SGP.02) and of vendor-locked cards: profiles are managed over-the-air by the SIM provider (SM-SR), so downloading or switching profiles from this router is not possible. Use the provider’s portal to manage the card — the router only needs to keep the active profile registered and online.')));
			}
			return out;
		}

		var profRows = (data.esim.profiles || []).map(function(p) {
			var acts = [];
			if (p.state != 'enabled')
				acts.push(E('button', { 'class': 'btn cbi-button cbi-button-apply',
					'click': ui.createHandlerFn(self, function() {
						if (!confirm(_('Enable profile %s? The connection will re-establish.').format(p.iccid)))
							return;
						return callEsim(data.modem, 'enable', 0, p.iccid, '', '').then(function() { window.location.reload() });
					}) }, _('Enable')));
			else
				acts.push(E('button', { 'class': 'btn cbi-button',
					'click': ui.createHandlerFn(self, function() {
						if (!confirm(_('Disable the active profile %s?').format(p.iccid)))
							return;
						return callEsim(data.modem, 'disable', 0, p.iccid, '', '').then(function() { window.location.reload() });
					}) }, _('Disable')));
			acts.push(E('button', { 'class': 'btn cbi-button cbi-button-remove', 'style': 'margin-left:4px',
				'click': ui.createHandlerFn(self, function() {
					if (!confirm(_('Permanently DELETE profile %s from the eUICC?').format(p.iccid)))
						return;
					return callEsim(data.modem, 'delete', 0, p.iccid, '', '').then(function() { window.location.reload() });
				}) }, _('Delete')));
			return E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td' }, p.iccid),
				E('td', { 'class': 'td' }, p.provider || p.name || p.nickname || ''),
				E('td', { 'class': 'td' }, p.state),
				E('td', { 'class': 'td' }, acts),
			]);
		});

		out.push(E('h4', {}, _('eSIM profiles')));
		out.push(E('table', { 'class': 'table' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th' }, 'ICCID'),
				E('th', { 'class': 'th' }, _('Provider')),
				E('th', { 'class': 'th' }, _('State')),
				E('th', { 'class': 'th' }, ''),
			]),
		].concat(profRows.length ? profRows : [
			E('tr', { 'class': 'tr' }, [ E('td', { 'class': 'td', 'colspan': 4 }, E('em', {}, _('no profiles'))) ]) ])));

		out.push(E('style', {}, ESIM_CSS));

		// shared activity panel: live progress for downloads / notifications
		var panel = E('div', { 'class': 'wwe-panel', 'style': 'display:none' });

		var mkBanner = function(kind, icon, text) {
			return E('div', { 'class': 'wwe-banner ' + kind }, [
				(kind == 'run') ? E('span', { 'class': 'wwe-spin' }) : E('span', {}, icon),
				E('span', {}, text),
			]);
		};

		var renderPanel = function(st, mode) {
			panel.style.display = '';
			var a = parseActivity(st.log);
			var running = (st.state == 'running');
			var kids = [];

			if (mode == 'download') {
				var doneN = 0;
				var lastSeen = a.order.length ? a.order[a.order.length - 1] : null;
				var items = DL_STEPS.map(function(s) {
					var isDone = !!a.seen[s[0]];
					if (isDone) doneN++;
					var isCur = running && !a.cancelled && a.code === null && s[0] == lastSeen;
					var cls = isDone ? (isCur ? 'wwe-step cur' : 'wwe-step done') : 'wwe-step';
					return E('li', { 'class': cls }, [
						E('span', { 'class': 'ic' }, isDone ? (isCur ? '⟳' : '✓') : '○'),
						E('span', {}, s[1]),
					]);
				});
				// install acknowledgement to the operator (auto_notify) — its
				// state comes from the daemon phase, not an lpac progress token
				var ackDone = (st.notified === true);
				var ackCur = running && st.phase == 'notify';
				items.push(E('li', { 'class': ackDone ? 'wwe-step done' : (ackCur ? 'wwe-step cur' : 'wwe-step') }, [
					E('span', { 'class': 'ic' }, ackDone ? '✓' : (ackCur ? '⟳' : '○')),
					E('span', {}, _('Confirm install to operator')),
				]));

				var pct = Math.round(doneN / DL_STEPS.length * 100);
				var barcls = 'wwe-bar' + (a.code === 0 ? ' ok'
					: (!running && (a.code !== null || a.cancelled)) ? ' err' : '');
				kids.push(E('ul', { 'class': 'wwe-steps' }, items));
				kids.push(E('div', { 'class': barcls }, E('span', { 'style': 'width:' + pct + '%' })));
			}

			if (running)
				kids.push(mkBanner('run', '', mode == 'download' ? _('Downloading profile…') : _('Contacting operator…')));
			else if (a.code === 0 && !a.cancelled)
				kids.push(mkBanner('ok', '✓', mode != 'download' ? _('Done.')
					: (st.notified === false
						? _('Profile downloaded (install not yet confirmed to the operator).')
						: _('Profile downloaded and confirmed — the eUICC will re-initialise.'))));
			else
				kids.push(mkBanner('err', '✕', a.msg || _('The operation failed.')));

			if (st.log)
				kids.push(E('details', { 'class': 'wwe-det' }, [
					E('summary', {}, _('Show raw lpac log')),
					E('pre', { 'class': 'wwe-log' }, st.log),
				]));

			dom.content(panel, kids);
		};

		var pollStatus = function(mode) {
			callEsim(data.modem, 'download_status', 0, '', '', '').then(function(st) {
				renderPanel(st, mode);
				if (st.state == 'running')
					window.setTimeout(function() { pollStatus(mode) }, 1200);
				else if (mode == 'download' && parseActivity(st.log).code === 0)
					window.setTimeout(function() { window.location.reload() }, 3000);
			});
		};

		var startBusy = function(text) {
			panel.style.display = '';
			dom.content(panel, mkBanner('run', '', text));
		};

		var dlHint = (data.esim.backend == 'at')
			? _('The modem downloads over its own network attach — no router data path or APN needed.')
			: _('lpac downloads on the router over your uplink and relays the eUICC APDUs through wwand — no dedicated modem APN needed.');

		out.push(E('h4', {}, _('Download profile')));
		out.push(E('p', {}, E('em', {}, dlHint)));

		var codeIn = E('input', { 'type': 'text', 'class': 'cbi-input-text',
			'style': 'width:min(440px,72%);margin-right:6px',
			'placeholder': 'LPA:1$rsp.example.com$MATCHING-ID' });
		var confIn = E('input', { 'type': 'text', 'class': 'cbi-input-text',
			'style': 'width:min(240px,42%);margin-right:6px',
			'placeholder': _('confirmation code (optional)') });
		var ackChk = E('input', { 'type': 'checkbox', 'checked': 'checked', 'style': 'margin:0 5px 0 0' });

		out.push(E('div', { 'class': 'cbi-section' }, [
			E('div', { 'style': 'margin-bottom:8px' }, [ codeIn, confIn,
				E('button', { 'class': 'btn cbi-button cbi-button-apply',
					'click': ui.createHandlerFn(self, function() {
						if (!(codeIn.value || '').trim()) {
							ui.addNotification(null, E('p', _('Enter an activation code first.')), 'warning');
							return;
						}
						startBusy(_('Starting download…'));
						return callEsim(data.modem, 'download', 0, '', codeIn.value, confIn.value, ackChk.checked).then(function(res) {
							if (res && res.ok === false)
								dom.content(panel, mkBanner('err', '✕', _('Could not start: ') + (res.error || '?')));
							else
								pollStatus('download');
						});
					}) }, _('Download')),
			]),
			E('label', { 'style': 'display:inline-flex;align-items:center;font-weight:normal;color:var(--fg-color-2,#666)' }, [
				ackChk, _('Confirm the install to the operator automatically (recommended; uncheck only for testing)'),
			]),
			panel,
		]));

		// pending eUICC notifications: confirm the download/enable/disable to
		// the operator's SM-DP+ (ES9+). Can be done any time the router has
		// internet — lpac delivers the queued notifications.
		out.push(E('h4', {}, _('Provider confirmations (notifications)')));
		out.push(E('p', {}, E('em', {}, _('After a download or profile change the eUICC queues notifications that confirm the operation to the operator. Send them once the router has internet.'))));
		out.push(E('div', { 'class': 'cbi-section' }, [
			E('button', { 'class': 'btn cbi-button',
				'click': ui.createHandlerFn(self, function() {
					startBusy(_('Listing pending notifications…'));
					return callEsim(data.modem, 'notifications', 0, '', '', '').then(function(r) {
						panel.style.display = '';
						dom.content(panel, [
							mkBanner((r && r.ok) ? 'ok' : 'err', (r && r.ok) ? '✓' : '✕',
								(r && r.log && r.log.trim()) ? _('Pending notifications:') : _('No pending notifications.')),
							(r && r.log && r.log.trim())
								? E('pre', { 'class': 'wwe-log' }, r.log) : '',
						]);
					});
				}) }, _('List pending')),
			' ',
			E('button', { 'class': 'btn cbi-button cbi-button-apply',
				'click': ui.createHandlerFn(self, function() {
					if (!confirm(_('Send all pending notifications to the operator now?')))
						return;
					startBusy(_('Sending confirmations…'));
					return callEsim(data.modem, 'notify', 0, '', '', '').then(function(res) {
						if (res && res.ok === false)
							dom.content(panel, mkBanner('err', '✕', _('Failed: ') + (res.error || '?')));
						else
							pollStatus('notify');
					});
				}) }, _('Send confirmations')),
		]));

		return out;
	},

	apply: function(modem, settings) {
		return callSet(modem, settings).then(function(res) {
			if (res && res.ok && res.unchanged)
				ui.addNotification(null, E('p', _('No change — the modem already runs these settings.')), 'info');
			else if (res && res.ok && res.deferred)
				notifyDeferred(modem);
			else if (res && res.ok)
				ui.addNotification(null, E('p', _('Modem settings applied.')), 'info');
			else
				ui.addNotification(null, E('p', _('Failed: ') + ((res || {}).error || '?')), 'error');
		});
	},

	// --- Network selection (operator scan + manual/automatic) ----------------
	// Protocol-neutral: modem_scan/modem_set_network_selection run over QMI NAS,
	// the MBIM passthrough, or AT+COPS on NCM. The scan is slow (up to ~90 s), so
	// the rpc timeout is bumped for the duration and the button spins meanwhile.
	renderNetSel: function(data) {
		var self = this;
		var s = data.settings || {};
		var mode = (s.selection_mode == 'manual') ? 'manual' : 'auto';
		var reg = s.registered_plmn || {};

		var infoRows = [
			E('div', { 'style': 'margin-bottom:3px' }, [
				E('strong', {}, _('Current mode') + ': '),
				(mode == 'manual') ? _('manual') : _('automatic') ]),
		];
		if (reg && (reg.mcc != null || reg.name))
			infoRows.push(E('div', {}, [ E('strong', {}, _('Registered operator') + ': '),
				(reg.name || _('unknown')) + ' (' + (reg.mcc != null ? reg.mcc : '?') +
				'/' + (reg.mnc != null ? reg.mnc : '?') + ')' ]));

		var results = E('div', { 'style': 'margin-top:10px' });

		var setSelection = function(smode, mcc, mnc, label) {
			return callSetSelection(data.modem, smode, (mcc != null ? +mcc : 0), (mnc != null ? +mnc : 0))
				.then(function(res) {
					if (res && res.ok === false)
						ui.addNotification(null, E('p', _('Failed: ') + (res.error || '?')), 'error');
					else if (res && res.unchanged)
						ui.addNotification(null, E('p',
							_('No change — the modem already runs this selection.')), 'info');
					else if (res && res.deferred)
						notifyDeferred(data.modem);
					else {
						ui.addNotification(null, E('p', label), 'info');
						window.setTimeout(function() { window.location.reload(); }, 800);
					}
				});
		};

		var STATUS_LABEL = {
			current:   _('current'),
			forbidden: _('forbidden'),
			available: _('available'),
		};

		var renderOps = function(ops) {
			if (!ops || !ops.length) {
				dom.content(results, E('em', {}, _('No operators found.')));
				return;
			}
			var rows = ops.map(function(op) {
				var forbidden = (op.status == 'forbidden');
				var current = (op.status == 'current');
				var act;
				if (forbidden)
					act = E('span', { 'style': 'color:#999' }, '—');
				else
					act = E('button', { 'class': 'btn cbi-button cbi-button-apply',
						'click': ui.createHandlerFn(self, function() {
							if (!confirm(_('Register manually to %s (%s/%s)? The connection may briefly drop.')
									.format(op.name || '?', op.mcc, op.mnc)))
								return;
							return setSelection('manual', op.mcc, op.mnc,
								_('Manual network selection applied.'));
						}) }, current ? _('Reselect') : _('Select'));
				return E('tr', { 'class': 'tr',
					'style': forbidden ? 'opacity:.5' : (current ? 'font-weight:600' : '') }, [
					E('td', { 'class': 'td' }, op.name || _('(unnamed)')),
					E('td', { 'class': 'td' }, op.mcc + '/' + op.mnc),
					E('td', { 'class': 'td' }, STATUS_LABEL[op.status] || op.status || ''),
					E('td', { 'class': 'td', 'style': 'width:1%' }, act),
				]);
			});
			dom.content(results, E('table', { 'class': 'table' }, [
				E('tr', { 'class': 'tr table-titles' }, [
					E('th', { 'class': 'th' }, _('Operator')),
					E('th', { 'class': 'th' }, _('PLMN')),
					E('th', { 'class': 'th' }, _('Status')),
					E('th', { 'class': 'th' }, ''),
				]),
			].concat(rows)));
		};

		/* A real operator scan regularly takes MINUTES (AT+COPS=? — and QMI NAS
		   scans on busy bands too), far beyond the XHR/uhttpd/rpcd timeout
		   chain. So: start the scan as a daemon-side job and poll its status
		   every few seconds — every request stays fast. Falls back to the old
		   blocking call when the daemon predates modem_scan_start. */
		var scanBtn;

		var scanFail = function(msg) {
			scanBtn.disabled = false;
			dom.content(results, E('div', { 'class': 'wwe-banner err' },
				[ E('span', {}, '✕'), E('span', {}, _('Scan failed: ') + msg) ]));
		};

		var scanSpinner = function(secs) {
			dom.content(results, E('div', { 'class': 'wwe-banner run',
				'style': 'display:flex;align-items:center;gap:9px' }, [
				E('span', { 'class': 'wwe-spin' }),
				E('span', {}, _('Scanning for operators — this can take several minutes…')
					+ (secs ? ' (' + secs + 's)' : '')),
			]));
		};

		var pollScan = function(started) {
			window.setTimeout(function() {
				callScanStatus(data.modem).then(function(st) {
					if (st && st.running) {
						scanSpinner(st.started ? Math.max(0, Math.round(Date.now() / 1000 - st.started)) : null);
						return pollScan(started);
					}
					if (!st || st.ok === false || st.error || st.idle)
						return scanFail((st && (st.error || (st.idle ? _('scan vanished (daemon restarted?)') : '?'))) || '?');
					scanBtn.disabled = false;
					renderOps(st.operators || []);
				}).catch(function(e) {
					/* one failed poll is not a failed scan (rpcd hiccup) — retry */
					pollScan(started);
				});
			}, 3000);
		};

		var legacyScan = function() {
			/* pre-async daemon: single blocking call with a bumped XHR timeout */
			var saved = L.env.rpctimeout;
			L.env.rpctimeout = 120;
			var restore = function() { L.env.rpctimeout = saved; scanBtn.disabled = false; };
			return callScan(data.modem).then(function(r) {
				restore();
				if (r && r.ok === false)
					return scanFail(r.error || '?');
				renderOps((r || {}).operators || []);
			}).catch(function(e) {
				restore();
				scanFail((e && e.message) || e);
			});
		};

		scanBtn = E('button', { 'class': 'btn cbi-button',
			'click': ui.createHandlerFn(self, function() {
				scanBtn.disabled = true;
				scanSpinner(null);
				return callScanStart(data.modem).then(function(r) {
					if (r && r.ok === false)
						return scanFail(r.error || '?');
					pollScan(r && r.started);
				}).catch(function(e) {
					return legacyScan();
				});
			}) }, _('Scan for operators'));

		var autoBtn = E('button', { 'class': 'btn cbi-button', 'style': 'margin-left:6px',
			'click': ui.createHandlerFn(self, function() {
				return setSelection('auto', 0, 0, _('Automatic network selection enabled.'));
			}) }, _('Set automatic'));

		return E('div', {}, [
			E('style', {}, ESIM_CSS),
			E('h3', {}, _('Network selection')),
			E('div', { 'class': 'cbi-section' }, [
				E('div', {}, infoRows),
				E('p', { 'style': 'margin:8px 0' }, E('em', {},
					_('Automatic lets the modem choose the best operator. A manual scan lists the visible operators so you can force one (e.g. to prefer a partner network while roaming).'))),
				E('div', {}, [ scanBtn, autoBtn ]),
				results,
			]),
		]);
	},

	// --- Cell lock (protocol-neutral: written to uci on the WAN interface) ---
	// The wwand compat layer / proto handler interpret lock_4g (earfcn:pci list),
	// lock_5g (pci:arfcn:scs:band) and lock_persist regardless of qmi/mbim/ncm.
	renderCellLock: function(data) {
		var self = this;
		var out = [ E('h3', {}, _('Cell lock')) ];

		var sid = this.targetIface();
		if (!sid) {
			out.push(E('p', {}, E('em', {},
				_('No qmi interface found — the cell lock is stored on the modem.'))));
			return out;
		}

		// cell lock lives on the wwand_modem section (radio setting); read it
		// there, falling back to the interface for a legacy inline config.
		var readSid = this.modemSid() || sid;
		var lock4g = uci.get('network', readSid, 'lock_4g') || [];
		if (!Array.isArray(lock4g))
			lock4g = (lock4g != null && lock4g !== '') ? [ lock4g ] : [];
		var lock5g = uci.get('network', readSid, 'lock_5g') || '';
		var persist = uci.get('network', readSid, 'lock_persist') == '1';

		var l4In = E('input', { 'type': 'text', 'class': 'cbi-input-text', 'style': 'width:100%',
			'placeholder': '1300:246 5230:118', 'value': lock4g.join(' ') });
		var l5In = E('input', { 'type': 'text', 'class': 'cbi-input-text', 'style': 'width:100%',
			'placeholder': '242:431070:1:78', 'value': lock5g });
		var persistChk = E('input', { 'type': 'checkbox', 'checked': persist ? '' : null });

		var save = function() {
			// write to the wwand_modem section (new-style), clearing any legacy
			// inline copy on the interface.
			var wsid = self.ensureModemSid();
			var l4 = (l4In.value || '').split(/[\s,]+/).filter(function(x) { return x; });
			if (l4.length) uci.set('network', wsid, 'lock_4g', l4);
			else uci.unset('network', wsid, 'lock_4g');
			uci.unset('network', sid, 'lock_4g');

			var v5 = (l5In.value || '').trim();
			if (v5) uci.set('network', wsid, 'lock_5g', v5);
			else uci.unset('network', wsid, 'lock_5g');
			uci.unset('network', sid, 'lock_5g');

			if (persistChk.checked) uci.set('network', wsid, 'lock_persist', '1');
			else uci.unset('network', wsid, 'lock_persist');
			uci.unset('network', sid, 'lock_persist');

			return uci.save().then(function() { return uci.apply(); }).then(function() {
				ui.addNotification(null, E('p',
					_('Cell lock saved. Reconnect the interface to apply.')), 'info');
			});
		};

		var row = function(label, node, hint) {
			return E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title' }, label),
				E('div', { 'class': 'cbi-value-field' },
					hint ? [ node, E('div', { 'class': 'cbi-value-description' }, hint) ] : [ node ]),
			]);
		};

		out.push(E('div', { 'class': 'cbi-section' }, [
			row(_('LTE cell lock'), l4In,
				_('Space/comma separated "earfcn:pci" entries (several = a cell list). See Status → Modem for the live cells and their lock values.')),
			row(_('5G NR SA cell lock'), l5In,
				_('A single 5G SA cell as "pci:arfcn:scs:band".')),
			row(_('Persist in modem'),
				E('label', { 'style': 'font-weight:normal' }, [ persistChk, ' ' + _('Store the lock in modem non-volatile memory') ]),
				null),
			E('div', { 'class': 'cbi-page-actions', 'style': 'margin-top:6px' }, [
				E('button', { 'class': 'btn cbi-button cbi-button-apply',
					'click': ui.createHandlerFn(self, save) }, _('Save cell lock')),
				' ',
				E('button', { 'class': 'btn cbi-button cbi-button-reset',
					'click': ui.createHandlerFn(self, function() {
						l4In.value = ''; l5In.value = ''; persistChk.checked = false;
						return save();
					}) }, _('Clear lock')),
			]),
		]));
		return out;
	},

	// SMS inbox: load stored messages on demand (Refresh) from the selected
	// storage; per-row Delete. Concatenated messages are merged and carry every
	// part's storage index so Delete removes all parts.
	renderSms: function(data) {
		var self = this, modem = data.modem;

		var storageSel = E('select', { 'style': 'width:12em' }, [
			E('option', { value: 'SM' }, _('SIM card')),
			E('option', { value: 'ME' }, _('Modem memory')),
		]);

		var body = E('div', { 'style': 'margin-top:6px' },
			E('em', {}, _('Choose a storage and click Load.')));

		function set(node) {
			body.innerHTML = '';
			body.appendChild(node);
		}

		function rows(msgs) {
			if (!msgs || !msgs.length)
				return E('em', {}, _('No messages stored.'));

			var trs = msgs.map(function(m) {
				var idxs = (m.indexes && m.indexes.length) ? m.indexes
					: (m.index != null ? [ m.index ] : []);
				return E('tr', { 'class': 'tr' }, [
					E('td', { 'class': 'td' }, m.sender || '—'),
					E('td', { 'class': 'td', 'style': 'white-space:nowrap' }, m.timestamp || ''),
					E('td', { 'class': 'td', 'style': 'white-space:pre-wrap' },
						(m.text || '') + (m.incomplete ? ' ' + _('(incomplete)') : '')),
					E('td', { 'class': 'td', 'style': 'width:1%' }, E('button', {
						'class': 'btn cbi-button cbi-button-remove',
						click: ui.createHandlerFn(self, function() {
							if (!confirm(_('Delete this message?')))
								return;
							return Promise.all(idxs.map(function(i) {
								return callSmsDelete(modem, storageSel.value, i);
							})).then(load);
						}) }, _('Delete'))),
				]);
			});

			return E('table', { 'class': 'table' }, [
				E('tr', { 'class': 'tr table-titles' }, [
					E('th', { 'class': 'th' }, _('Sender')),
					E('th', { 'class': 'th' }, _('Received')),
					E('th', { 'class': 'th' }, _('Message')),
					E('th', { 'class': 'th', 'style': 'width:1%' }, ''),
				]),
			].concat(trs));
		}

		function load() {
			set(E('em', {}, _('Loading…')));
			return callSmsList(modem, storageSel.value).then(function(res) {
				if (!res || res.ok === false) {
					var e = res && res.error;
					set(E('em', {}, e == 'unsupported_on_backend'
						? _('This modem does not expose SMS access.')
						: _('Could not read messages: %s').format(e || '?')));
					return;
				}
				set(rows(res.messages));
			});
		}

		return [
			E('h3', {}, _('SMS')),
			E('div', { 'class': 'cbi-section' }, [
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title' }, _('Storage')),
					E('div', { 'class': 'cbi-value-field' }, [ storageSel, ' ',
						E('button', { 'class': 'btn cbi-button cbi-button-action',
							click: ui.createHandlerFn(self, load) }, _('Load')) ]),
				]),
				body,
			]),
		];
	},

	render: function(data) {
		if (!data || !data.modem)
			return E('p', {}, _('No modem present.'));

		var self = this;
		var s = data.settings || {};
		var modeBoxes = MODE_BITS.map(function(m) {
			return E('label', { 'style': 'margin-right:1em' }, [
				E('input', { type: 'checkbox', 'data-bit': m[0],
					checked: (s.mode_preference & m[0]) ? '' : null }),
				' ' + m[1],
			]);
		});

		var usageSel = E('select', {}, [
			E('option', { value: 1, selected: s.usage_preference == 1 ? '' : null }, _('voice centric')),
			E('option', { value: 2, selected: s.usage_preference == 2 ? '' : null }, _('data centric')),
		]);

		var roamSel = E('select', {}, [
			E('option', { value: 1,   selected: s.roaming_preference == 1 ? '' : null }, _('off')),
			E('option', { value: 255, selected: s.roaming_preference == 255 ? '' : null }, _('any')),
		]);

		var ltePicker = bandPicker(lteKnownBands(), s.lte_bands || []);
		var saPicker  = bandPicker(nrKnownBands(), s.nr5g_sa_bands || []);
		var nsaPicker = bandPicker(nrKnownBands(), s.nr5g_nsa_bands || []);

		var collect = function() {
			var mode = 0;
			modeBoxes.forEach(function(l) {
				var cb = l.firstElementChild;
				if (cb.checked)
					mode |= +cb.getAttribute('data-bit');
			});
			return {
				mode_preference: mode,
				usage_preference: +usageSel.value,
				roaming_preference: +roamSel.value,
				lte_bands: ltePicker._collect(),
				nr5g_sa_bands: saPicker._collect(),
				nr5g_nsa_bands: nsaPicker._collect(),
			};
		};

		var row = function(label, node) {
			return E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title' }, label),
				E('div', { 'class': 'cbi-value-field' }, [ node ]),
			]);
		};

		// protocol label (shown if the daemon reports it; graceful if absent)
		var proto = data.info && (data.info.protocol || data.info.proto);
		var head = _('Modem Tools') + ' — ' + data.modem +
			(proto ? ' (' + String(proto).toUpperCase() + ')' : '');

		var warns = renderWarnings(data.info && data.info.config_warnings);

		return E('div', {}, [
			E('h2', {}, head),
			warns || '',
			E('div', { 'class': 'cbi-section' }, [
				row(_('Radio technologies'), E('div', {}, modeBoxes)),
				row(_('UE usage'), usageSel),
				row(_('Roaming'), roamSel),
				row(_('LTE bands'), ltePicker),
				row(_('NR5G SA bands'), saPicker),
				row(_('NR5G NSA bands'), nsaPicker),
				E('p', { 'style': 'margin:6px 0 0;color:var(--fg-color-2,#666)' }, E('em', {},
					_('Leave every band unchecked (and the fallback empty) to let the modem use all supported bands.'))),
			]),
			E('div', { 'class': 'cbi-page-actions' }, [
				E('button', { 'class': 'btn cbi-button cbi-button-apply',
					click: ui.createHandlerFn(self, function() {
						return self.apply(data.modem, collect());
					}) }, _('Apply')),
				' ',
				E('button', { 'class': 'btn cbi-button cbi-button-reset',
					click: ui.createHandlerFn(self, function() {
						if (!confirm(_('Reset radio/band/usage/roaming settings to defaults?')))
							return;
						return self.apply(data.modem, DEFAULTS).then(function() {
							window.location.reload();
						});
					}) }, _('Reset to defaults')),
			]),
			this.renderNetSel(data),
		].concat(this.renderCellLock(data)).concat(this.renderSim(data)).concat([
			E('h3', {}, _('SIM PLMN preference lists')),
			plmnTable(_('User-controlled (EF PLMNwAcT, 6F60)'), (data.plmn || {}).user,
				_('optional SIM file — not provisioned on this SIM, and the device cannot create it')),
			plmnTable(_('Operator-controlled (6F61)'), (data.plmn || {}).operator),
			plmnTable(_('Home PLMN (6F62)'), (data.plmn || {}).home),
		]).concat(this.renderSms(data)));
	},
});
