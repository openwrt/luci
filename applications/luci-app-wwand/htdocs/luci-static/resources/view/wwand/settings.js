'use strict';
'require view';
'require ui';
'require dom';
'require uci';
'require wwand.bands as bands';
'require wwand.rpc as wrpc';
'require wwand.format as fmt';
'require wwand.modemsid as modemsid';
'require wwand.esim as esim';
'require wwand.netsel as netsel';
'require wwand.mccmnc as mccmnc';

// wwand modem settings editor. All values go through the daemon's now
// protocol-neutral ubus methods (QMI NAS, MBIM QMI-over-MBIM passthrough, or an
// AT fallback on NCM); band preferences travel as band-number lists (u64 masks
// would lose precision in JS numbers). The ubus declarations live in the
// shared wwand.rpc module; the SIM/eSIM and network-selection panels are the
// shared wwand.esim / wwand.netsel modules.

var callStatus = wrpc.status;
var callGet = wrpc.getSettings;
var callSet = wrpc.setSettings;
var callPlmn = wrpc.plmn;
var callPlmnSet = wrpc.plmnSet;
var callPlmnRestore = wrpc.plmnRestore;
var callSlots = wrpc.slots;
var callSmsList = wrpc.smsList;
var callSmsDelete = wrpc.smsDelete;
var callModemReset = wrpc.modemReset;
var callEsim = wrpc.esim;

var renderWarnings = fmt.renderWarnings;

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
						ui.addNotification(null, E('p', [ _('Modem reset failed: %s').format(r.error || '?') ]), 'error');
					else
						ui.addNotification(null, E('p',
							_('Modem is restarting — the connection resumes automatically once it re-registers.')), 'info');
				});
			},
		}, _('Restart modem now')),
	]), 'warning');
}

// after an eSIM profile switch the daemon applies via an automatic SIM
// hot-reset (`applied: 'sim_reset'` — connection re-establishes on its own);
// when no SIM-reset path exists it asks for a full modem restart
// (`apply: 'modem_reset'`). Surface both.
function notifyEsimApply(modem, res) {
	if (res && res.error) {
		/* SGP.22 test-profile rule: while a test profile is enabled the eUICC
		   only re-enables the profile that was active before it — enabling a
		   never-enabled profile fails with "wrongProfileReenabling" (lpac:
		   "wrong profile reenabling"). Turn that into an actionable hint. */
		var lpacLog = (res.detail && res.detail.log) || '';
		if (/wrong ?profile ?reenabling/i.test(lpacLog)) {
			ui.addNotification(null, E('div', {}, [
				E('p', {}, _('The eUICC refused to enable this profile: while a test profile is enabled, only the profile that was active before it can be re-enabled (SGP.22 "wrongProfileReenabling").')),
				E('p', {}, _('Disable the currently enabled (test) profile first, then enable this profile.')),
			]), 'warning');
			return;
		}
		ui.addNotification(null, E('p',
			[ _('Profile switch failed: %s').format((res.detail && res.detail.error) || res.error) ]), 'error');
		return;
	}
	if (res && res.apply == 'modem_reset')
		return notifyDeferred(modem);
	ui.addNotification(null, E('p',
		_('Profile switched — the SIM was reset automatically, the connection re-establishes in a few seconds.')), 'info');
	window.setTimeout(function() { window.location.reload() }, 4000);
}

/* A failing daemon call answers { ok:false, error:'qmi', detail:{ result, code } }.
   The bare `error` alone ("qmi") is useless for diagnosis, so append whatever
   detail the daemon passed on — a QMI protocol error number is the difference
   between "it does not work" and a fixable answer. */
function describeError(res) {
	var r = res || {}, d = r.detail, txt = r.error || '?';
	if (d && typeof d == 'object') {
		var bits = [];
		if (d.result != null) bits.push(_('result %d').format(d.result));
		if (d.code != null)   bits.push(_('code %d').format(d.code));
		if (d.key != null)    bits.push(String(d.key));
		if (bits.length) txt += ' (' + bits.join(', ') + ')';
	}
	return txt;
}

var MODE_BITS = [
	[ 0x04, 'GSM' ],
	[ 0x08, 'UMTS' ],
	[ 0x10, 'LTE' ],
	[ 0x40, 'NR5G' ],
];

/* Bits this picker actually renders. QmiNasRatModePreference also carries CDMA
   (0x01), HDR/EVDO (0x02) and TD-SCDMA (0x20), which no European modem UI needs
   to show — but rebuilding the mask from the checkboxes alone silently CLEARED
   them on every save (seen on an RG650E: 0x7F -> 0x5C). Whatever we do not
   render is preserved from the value the modem reported. */
var MODE_BITS_MASK = MODE_BITS.reduce(function(a, m) { return a | m[0] }, 0);

// reset-to-defaults preset: everything the modem supports (it clamps unknown
// band bits itself), data-centric, roaming allowed.
//
// mode_preference is MODE_BITS_MASK, i.e. every RAT this picker renders — it
// used to be a hardcoded 0x50 (LTE|NR5G), which contradicted "everything the
// modem supports" and made a reset silently drop the 2G/3G fallback on a modem
// that had it. Deriving it from the mask also keeps the two from drifting when
// a RAT is added to MODE_BITS.
var DEFAULTS = {
	mode_preference: MODE_BITS_MASK,
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

/* editable USER-controlled preferred-PLMN list (EF 6F60). Rows carry MCC/MNC
   inputs + per-RAT checkboxes; Apply writes the whole list via modem_plmn_set
   (AT+CPOL) and the daemon reads it back over QMI/UIM to cross-verify. */
/* uci `list plmn` <-> editor entry: '<mccmnc> rat,rat' */
function encodePlmnEntries(entries) {
	return entries.map(function(e) {
		var rats = [ 'gsm', 'utran', 'eutran', 'ngran' ].filter(function(k) { return e[k]; }).join(',');
		return (e.mcc || '') + (e.mnc || '') + (rats ? ' ' + rats : '');
	});
}
function decodePlmnEntry(str) {
	var f = ('' + (str || '')).trim().split(/[ \t,]+/);
	var id = (f[0] || '').replace(/\D/g, '');
	var e = { mcc: id.slice(0, 3), mnc: id.slice(3), gsm: false, utran: false, eutran: false, ngran: false };
	for (var i = 1; i < f.length; i++) {
		var r = f[i].toLowerCase();
		if (r == 'gsm' || r == '2g') e.gsm = true;
		else if (r == 'utran' || r == '3g' || r == 'umts') e.utran = true;
		else if (r == 'eutran' || r == '4g' || r == 'lte') e.eutran = true;
		else if (r == 'ngran' || r == '5g' || r == 'nr' || r == 'nr5g') e.ngran = true;
	}
	return e;
}
function plmnRatBox(e, key, label) {
	var attrs = { 'type': 'checkbox', 'data-rat': key };
	if (e && e[key]) attrs.checked = 'checked';
	return E('label', { 'style': 'margin-right:8px;white-space:nowrap' }, [ E('input', attrs), ' ' + label ]);
}
function plmnEditRow(e, noRat) {
	e = e || {};
	var mccIn = E('input', { 'type': 'text', 'class': 'cbi-input-text',
		'style': 'width:5em', 'data-f': 'mcc', 'maxlength': '3', 'placeholder': 'MCC', 'value': e.mcc || '' });
	var mncIn = E('input', { 'type': 'text', 'class': 'cbi-input-text',
		'style': 'width:5em', 'data-f': 'mnc', 'maxlength': '3', 'placeholder': 'MNC', 'value': e.mnc || '' });
	/* live operator-name resolution from the bundled MCC/MNC table, updated
	   while typing so a typo is caught before writing to the SIM */
	var nameEl = E('td', { 'class': 'td', 'style': 'color:#666' },
		mccmnc.describe(e.mcc, e.mnc) || '');
	var upd = function() {
		nameEl.textContent = mccmnc.describe(
			(mccIn.value || '').replace(/\D/g, ''),
			(mncIn.value || '').replace(/\D/g, '')) || '';
	};
	mccIn.addEventListener('input', upd);
	mncIn.addEventListener('input', upd);
	var cells = [
		E('td', { 'class': 'td' }, mccIn),
		E('td', { 'class': 'td' }, mncIn),
		nameEl,
	];
	/* the forbidden list (EF_FPLMN) has no per-RAT flags — just MCC/MNC */
	if (!noRat)
		cells.push(E('td', { 'class': 'td' }, [
			plmnRatBox(e, 'gsm', '2G'), plmnRatBox(e, 'utran', '3G'),
			plmnRatBox(e, 'eutran', '4G'), plmnRatBox(e, 'ngran', '5G') ]));
	cells.push(E('td', { 'class': 'td', 'style': 'width:1%' }, E('button', {
		'class': 'btn cbi-button cbi-button-remove',
		'click': function(ev) { var tr = ev.target.parentNode.parentNode; tr.parentNode.removeChild(tr); } }, '✕')));
	return E('tr', { 'class': 'tr' }, cells);
}
function plmnTable(title, list, absentHint) {
	if (list == null)
		return E('p', {}, [ E('em', {}, [ title + ': ' + _('not present on this SIM') +
			(absentHint ? ' — ' + absentHint : '') ]) ]);

	var rows = list.map(function(e) {
		var rats = [ 'gsm', 'utran', 'eutran', 'ngran' ]
			.filter(function(k) { return e[k] })
			.map(function(k) { return k.toUpperCase() }).join(' ');
		return E('tr', { 'class': 'tr' }, [
			E('td', { 'class': 'td' }, [ e.mcc + '/' + e.mnc ]),
			E('td', { 'class': 'td' }, mccmnc.describe(e.mcc, e.mnc) || '—'),
			E('td', { 'class': 'td' }, rats),
		]);
	});

	return E('div', {}, [
		E('h4', {}, [ title + ' (' + list.length + ')' ]),
		E('table', { 'class': 'table' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th' }, 'PLMN'),
				E('th', { 'class': 'th' }, _('Operator')),
				E('th', { 'class': 'th' }, _('Access technologies')),
			]),
		].concat(rows)),
	]);
}

return view.extend({
	handleSaveApply: null,
	handleSave: null,
	handleReset: null,

	load: function() {
		return Promise.all([ callStatus(), uci.load('network') ]).then(function(r) {
			var names = Object.keys(r[0] || {});

			if (!names.length)
				return { modem: null };

			/* multi-modem: ?modem=<name> selects the modem, default first */
			var picked = null;
			try { picked = new URLSearchParams(window.location.search).get('modem'); } catch(e) {}
			var name = (picked && names.indexOf(picked) >= 0) ? picked : names[0];

			return Promise.all([
				callGet(name),
				L.resolveDefault(callPlmn(name), {}),
				L.resolveDefault(callSlots(name), {}),
				L.resolveDefault(callEsim(name, 'profiles', 0, '', '', ''), {}),
				L.resolveDefault(callEsim(name, 'backend', 0, '', '', ''), {}),
				/* carrier config: absent on modems without QMI PDC, which is
				   normal — resolveDefault keeps the page working either way */
				L.resolveDefault(wrpc.carrierConfig(name, 'get', ''), {}),
				L.resolveDefault(wrpc.carrierConfig(name, 'list', ''), {}),
			]).then(function(res) {
				var esimData = res[3] || {};
				esimData.backend = (res[4] || {}).backend;
				return { modem: name, mods: r[0] || {}, info: (r[0] || {})[name] || {},
				         settings: res[0], plmn: res[1],
				         slots: (res[2] || {}).slots || [], esim: esimData,
				         mbnSel: res[5] || {}, mbnList: (res[6] || {}).configs || [] };
			});
		});
	},

	/* Carrier configuration (MBN) over QMI PDC. Absent on modems that do not
	   expose the service — then the section is simply not rendered, because an
	   empty picker invites the question "why can I not choose".

	   A selection only takes effect after a MODEM RESET, and PDC reports it as
	   `pending` until then. The UI says exactly that rather than implying the
	   radio changed underneath the operator. */
	renderCarrierConfig: function(data) {
		var list = data.mbnList || [], sel = data.mbnSel || {};

		if (!list.length && !sel.active)
			return [];

		var rows = list.map(function(c) {
			var isActive = (sel.active && c.id == sel.active);
			var isPending = (sel.pending && c.id == sel.pending);

			return E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td' }, [ c.description || c.id.substr(0, 12) ]),
				E('td', { 'class': 'td' }, [ isActive ? _('active')
					: isPending ? _('pending — takes effect after a modem reset')
					: '' ]),
				E('td', { 'class': 'td', 'style': 'font-family:monospace;font-size:85%' },
					[ c.id.substr(0, 16) + '…' ]),
				E('td', { 'class': 'td' }, [
					(isActive || isPending) ? '' :
					E('button', { 'class': 'btn cbi-button', 'click': ui.createHandlerFn(this,
						function(id, ev) {
							return wrpc.carrierConfig(data.modem, 'set', id).then(function(r) {
								if (r && r.ok === false)
									return ui.addNotification(null,
										E('p', {}, [ _('Selecting the carrier configuration failed.') ]), 'error');

								ui.addNotification(null, E('p', {},
									[ _('Carrier configuration selected. It takes effect after a modem reset.') ]));
							});
						}, c.id) }, [ _('Select') ]),
				]),
			]);
		}, this);

		return [
			E('h3', {}, _('Carrier configuration')),
			E('div', { 'class': 'cbi-section' }, [
				E('p', {}, [ _('The carrier profile (MBN) the modem applies: APN defaults, IMS settings, band and roaming policy for a given network. The wrong one leaves the modem technically working but subtly wrong on that network — a rejected attach, no IMS, a missing band.') ]),
				sel.pending ? E('p', { 'style': 'color:#b8860b' },
					[ _('A different configuration is selected and waiting for a modem reset — the radio is still running the previous one.') ]) : '',
				E('table', { 'class': 'table' }, [
					E('tr', { 'class': 'tr table-titles' }, [
						E('th', { 'class': 'th' }, [ _('Configuration') ]),
						E('th', { 'class': 'th' }, [ _('State') ]),
						E('th', { 'class': 'th' }, [ _('Id') ]),
						E('th', { 'class': 'th' }, [ '' ]),
					]),
				].concat(rows)),
			]),
		];
	},

	// the interface section carrying wwand's per-interface config for the
	// SELECTED modem (this page is per-modem via ?modem=): prefer the
	// interface referencing that modem, fall back to the first wwand/qmi
	// interface (legacy inline configs). MULTI-MODEM FIX: this used to always
	// pick the first interface, so cell-lock / primary-slot writes landed on
	// modem 1 regardless of the selected tab.
	targetIface: function(modem) {
		var target = null, first = null;
		uci.sections('network', 'interface', function(s) {
			if (s.proto == 'wwand' || s.proto == 'qmi') {
				if (!first) first = s['.name'];
				if (!target && modem && s.modem == modem) target = s['.name'];
			}
		});
		return target || first;
	},

	// network-native model: SIM slot + cell lock live on the modem's
	// wwand_modem section. When the selected modem name IS such a section
	// (the normal case — daemon modem names are the section names) use it
	// directly; else resolve/migrate via the interface (shared wwand.modemsid).
	modemSid: function(modem) {
		var sec = modem ? uci.get('network', modem) : null;
		if (sec && sec['.type'] == 'wwand_modem')
			return modem;
		var iface = this.targetIface(modem);
		if (!iface) return null;
		return modemsid.modemSid(iface);
	},

	ensureModemSid: function(modem) {
		var sid = this.modemSid(modem);
		if (sid) return sid;
		var iface = this.targetIface(modem);
		if (!iface) return null;
		return modemsid.ensureModemSid(iface);
	},

	/* comfortable preferred-PLMN manager: edit the modem's NAS or EF-6F60 list,
	   write it now, save it as a named wwand_plmnlist (persisted + re-applied by
	   the daemon before every radio-on), and attach a saved list to this modem. */
	renderPlmnManager: function(modem, data) {
		var self = this, lists = data.plmn || {};
		var msid = this.modemSid(modem);
		var curListName = msid ? (uci.get('network', msid, 'plmn_list') || '') : '';

		var typeSel = E('select', { 'class': 'cbi-input-select', 'style': 'width:auto' }, [
			E('option', { 'value': 'nas' }, _('NAS preferred networks')),
			E('option', { 'value': 'user' }, _('User list (SIM EF 6F60)')),
			E('option', { 'value': 'fplmn' }, _('Forbidden list (FPLMN, EF 6F7B)')) ]);

		var mkHead = function(noRat) {
			var th = [ E('th', { 'class': 'th' }, 'MCC'), E('th', { 'class': 'th' }, 'MNC'),
				E('th', { 'class': 'th' }, _('Operator')) ];
			if (!noRat) th.push(E('th', { 'class': 'th' }, _('Access technologies')));
			th.push(E('th', { 'class': 'th' }, ''));
			return E('tr', { 'class': 'tr table-titles' }, th);
		};
		/* the editor table lives inside a container div and is REBUILT whole on
		   each (re)seed — replacing a <table>'s <tr> children in place leaves the
		   browser's implicit <tbody> around and the rows accumulate on toggle */
		var tcontainer = E('div');
		var tableOf = function() { return tcontainer.querySelector('table'); };
		var seedRows = function(arr) {
			var noRat = (typeSel.value == 'fplmn');
			dom.content(tcontainer, E('table', { 'class': 'table' },
				[ mkHead(noRat) ].concat((arr && arr.length ? arr : [ {} ]).map(function(e) {
					return plmnEditRow(e, noRat);
				}))));
		};
		var collect = function() {
			var out = [], trs = tcontainer.getElementsByTagName('tr');
			for (var i = 0; i < trs.length; i++) {
				var mI = trs[i].querySelector('[data-f="mcc"]');
				if (!mI) continue;
				var mcc = (mI.value || '').replace(/\D/g, '');
				var mnc = (trs[i].querySelector('[data-f="mnc"]').value || '').replace(/\D/g, '');
				if (!mcc && !mnc) continue;
				var rec = { mcc: mcc, mnc: mnc }, cbs = trs[i].querySelectorAll('[data-rat]');
				for (var j = 0; j < cbs.length; j++) rec[cbs[j].getAttribute('data-rat')] = cbs[j].checked;
				out.push(rec);
			}
			return out;
		};
		/* re-read the CURRENT list from the modem for the selected type, then seed.
		   Called on load, on type toggle and from "Reload from modem" so the editor
		   always reflects what the modem holds right now (not the page-load cache). */
		var loadFromModem = function() {
			seedRows([]);   // clear immediately so a stale list never lingers
			busy(_('reading…'));
			return callPlmn(modem).then(function(r) {
				busy('');
				lists = r || {};
				seedRows(lists[typeSel.value]);
			}).catch(function(e) {
				busy('');
				ui.addNotification(null, E('p', {}, [ _('Could not read the %s list: %s').format(typeSel.value == 'nas' ? 'NAS' : typeSel.value == 'fplmn' ? 'FPLMN' : 'user', (e && e.message) || e) ]), 'warning');
			});
		};
		seedRows(lists[typeSel.value]);
		typeSel.addEventListener('change', loadFromModem);

		var note = E('span', { 'style': 'margin-left:8px' });
		var busy = function(msg) { dom.content(note, msg ? E('em', {}, msg) : ''); };

		var btn = function(label, cls, fn) {
			return E('button', { 'class': 'btn cbi-button ' + (cls || ''), 'click': fn }, label);
		};

		/* write the edited list straight to the modem (not persisted) */
		var writeNow = ui.createHandlerFn(self, function() {
			var entries = collect(), t = typeSel.value;
			if (!confirm(_('Write %d record(s) to the modem\'s %s list now? (not saved to config)')
					.format(entries.length, t == 'nas' ? 'NAS' : t == 'fplmn' ? 'FPLMN' : 'user')))
				return;
			busy(_('writing…'));
			return callPlmnSet(modem, t, entries).then(function(r) {
				busy('');
				if (r && r.ok) {
					ui.addNotification(null, E('p', {}, [ _('Written to the modem (%d record(s)).').format(r.written != null ? r.written : entries.length) ]), 'info');
					return loadFromModem();   // reflect what the modem now actually holds
				}
				ui.addNotification(null, E('p', {}, [ _('Write failed: %s. The SIM/modem may reject it.').format((r && (r.note || r.error)) || '?') ]), 'warning');
			}).catch(function(e) {
				busy('');
				ui.addNotification(null, E('p', {}, [ _('Write failed: %s').format((e && e.message) || e) ]), 'warning');
			});
		});

		/* save the edited list as a named wwand_plmnlist + attach it to this modem */
		var saveAs = ui.createHandlerFn(self, function() {
			var entries = collect(), t = typeSel.value;
			var name = (window.prompt(_('Save as list — name:'), curListName || (t + '-list')) || '').replace(/[^a-zA-Z0-9_]/g, '');
			if (!name) return;
			if (uci.get('network', name) == null) uci.add('network', 'wwand_plmnlist', name);
			uci.set('network', name, 'type', t);
			uci.set('network', name, 'plmn', encodePlmnEntries(entries));
			var sid = self.ensureModemSid(modem);
			if (sid) uci.set('network', sid, 'plmn_list', name);
			return uci.save().then(function() { return uci.apply(); }).then(function() {
				ui.addNotification(null, E('p', {}, [ _('Saved list "%s" (%d record(s)) and attached it to this modem.').format(name, entries.length) ]), 'info');
				window.location.reload();
			});
		});

		var editorTools = E('div', { 'style': 'margin-top:6px' }, [
			btn(_('Add entry'), '', function() { var t = tableOf(); if (t) t.appendChild(plmnEditRow({})); }), ' ',
			btn(_('Reload from modem'), '', loadFromModem), ' ',
			btn(_('Write to modem now'), 'cbi-button-action', writeNow), ' ',
			btn(_('Save as list & attach'), 'cbi-button-save', saveAs), note ]);

		/* saved named lists (wwand_plmnlist) */
		var savedRows = [];
		uci.sections('network', 'wwand_plmnlist', function(s) {
			var n = s['.name'], cnt = (L.toArray(s.plmn)).length, t = s.type || 'nas';
			savedRows.push(E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td', 'style': (n == curListName ? 'font-weight:600' : '') },
					[ n + (n == curListName ? ' ✓' : '') ]),
				E('td', { 'class': 'td' }, [ (t == 'nas' ? _('NAS') : t == 'fplmn' ? _('Forbidden') : _('User')) + ' · ' + cnt ]),
				E('td', { 'class': 'td', 'style': 'width:1%;white-space:nowrap' }, [
					btn(_('Load'), '', function() {
						typeSel.value = t;
						seedRows(L.toArray(s.plmn).map(decodePlmnEntry));
					}), ' ',
					btn(_('Use here'), '', ui.createHandlerFn(self, function() {
						var sid = self.ensureModemSid(modem);
						if (!sid) return;
						uci.set('network', sid, 'plmn_list', n);
						return uci.save().then(function() { return uci.apply(); }).then(function() { window.location.reload(); });
					})), ' ',
					btn('✕', 'cbi-button-remove', ui.createHandlerFn(self, function() {
						if (!confirm(_('Delete the saved list "%s"?').format(n))) return;
						uci.remove('network', n);
						if (n == curListName && msid) uci.unset('network', msid, 'plmn_list');
						return uci.save().then(function() { return uci.apply(); }).then(function() { window.location.reload(); });
					})),
				]),
			]));
		});

		var restoreBtn = curListName ? E('div', { 'style': 'margin-top:6px' }, [
			E('span', {}, [ _('This modem restores "%s" before every radio-on. ').format(curListName) ]),
			btn(_('Restore now'), 'cbi-button-action', ui.createHandlerFn(self, function() {
				busy(_('restoring…'));
				return callPlmnRestore(modem).then(function(r) {
					busy('');
					ui.addNotification(null, E('p', {}, [ (r && r.ok)
						? _('Configured list restored to the modem.')
						: _('Restore failed: %s').format((r && (r.note || r.error)) || '?') ]), (r && r.ok) ? 'info' : 'warning');
				});
			})),
		]) : E('p', {}, E('em', {}, _('No saved list is attached to this modem yet — edit above and "Save as list & attach".')));

		return E('div', { 'class': 'cbi-section' }, [
			E('h4', {}, [ _('Preferred-PLMN editor — '), typeSel ]),
			E('p', { 'style': 'color:#666;font-size:90%;margin:2px 0' },
				_('NAS = QMI preferred-networks list; User = SIM EF 6F60 (preference, not a lock); Forbidden = SIM EF 6F7B (FPLMN) — networks the modem must NOT use. Editing here is temporary; save it as a list so the daemon re-applies it before every radio-on (survives modem reboots).')),
			tcontainer, editorTools,
			E('h4', { 'style': 'margin-top:12px' }, _('Saved PLMN lists')),
			savedRows.length ? E('table', { 'class': 'table' }, [
				E('tr', { 'class': 'tr table-titles' }, [ E('th', { 'class': 'th' }, _('Name')),
					E('th', { 'class': 'th' }, _('Type · entries')), E('th', { 'class': 'th' }, '') ]) ].concat(savedRows))
				: E('p', {}, E('em', {}, _('none yet'))),
			restoreBtn,
		]);
	},

	simSlotUci: function(modem, slot) {
		var sid = this.ensureModemSid(modem);
		if (!sid)
			return Promise.reject(new Error('no wwand interface'));
		uci.set('network', sid, 'sim_slot', String(slot));
		var iface = this.targetIface(modem);
		if (iface)
			uci.unset('network', iface, 'sim_slot');   // drop legacy inline
		return uci.save().then(function() { return uci.apply() });
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
				ui.addNotification(null, E('p', [ _('Failed: ') + describeError(res) ]), 'error');
		});
	},

	// --- Cell lock (protocol-neutral: written to uci on the WAN interface) ---
	// The wwand compat layer / proto handler interpret lock_4g (earfcn:pci list),
	// lock_5g (pci:arfcn:scs:band) and lock_persist regardless of qmi/mbim/ncm.
	renderCellLock: function(data) {
		var self = this;
		var out = [ E('h3', {}, _('Cell lock')) ];

		var sid = this.targetIface(data.modem);
		if (!sid) {
			out.push(E('p', {}, E('em', {},
				_('No wwand interface found — the cell lock is stored on the modem.'))));
			return out;
		}

		// cell lock lives on the wwand_modem section (radio setting); read it
		// there, falling back to the interface for a legacy inline config.
		var readSid = this.modemSid(data.modem) || sid;
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
			var wsid = self.ensureModemSid(data.modem);
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
			/* the daemon's live read-back: what the modem ACTUALLY has locked */
			(function() {
				var lockTxt = fmt.fmtLocks((data.info || {}).locks);

				if (!lockTxt) return null;

				return E('div', { 'class': 'cbi-value-description', 'style': 'margin:4px 0' },
					[ _('Modem currently locked: %s — the live read-back of the lock editor.').format(lockTxt) ]);
			})(),
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
			dom.content(body, node);
		}

		function rows(msgs) {
			if (!msgs || !msgs.length)
				return E('em', {}, _('No messages stored.'));

			var trs = msgs.map(function(m) {
				var idxs = (m.indexes && m.indexes.length) ? m.indexes
					: (m.index != null ? [ m.index ] : []);
				return E('tr', { 'class': 'tr' }, [
					/* arrays: an SMS is written by whoever knows the number, so
					   sender, timestamp and body are all outside text */
					E('td', { 'class': 'td' }, [ m.sender || '—' ]),
					E('td', { 'class': 'td', 'style': 'white-space:nowrap' }, [ m.timestamp || '' ]),
					E('td', { 'class': 'td', 'style': 'white-space:pre-wrap' },
						[ (m.text || '') + (m.incomplete ? ' ' + _('(incomplete)') : '') ]),
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
					set(E('em', {}, [ e == 'unsupported_on_backend'
						? _('This modem does not expose SMS access.')
						: _('Could not read messages: %s').format(e || '?') ]));
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
			// start from the bits we do not render, so they survive the save
			var mode = (+s.mode_preference || 0) & ~MODE_BITS_MASK;
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

		/* multi-modem: one tab per live modem; a tab reloads the page with
		   ?modem=<name> so every tool section below targets that modem */
		var modNames = Object.keys(data.mods || {});
		var modemSel = (modNames.length < 2) ? '' :
			E('ul', { 'class': 'cbi-tabmenu', 'style': 'margin:0 0 12px' },
				modNames.map(function(n) {
					var m = data.mods[n] || {};
					return E('li', { 'class': (n == data.modem) ? 'cbi-tab' : 'cbi-tab-disabled' },
						E('a', { 'href': window.location.pathname + '?modem=' + encodeURIComponent(n) },
							[ '%s (%s)'.format(m.netdev || n, m.model || n) ]));
				}));

		/* callbacks the shared SIM/eSIM + network-selection panels need from
		   this page (uci persistence + the apply notifications) */
		var panelCtx = {
			simSlotUci: function(slot) { return self.simSlotUci(data.modem, slot); },
			notifyEsimApply: notifyEsimApply,
			notifyDeferred: notifyDeferred,
		};

		/* backlinks: this page is reached from the Modems overview' Tools button;
		   offer the way back plus the modem's status/config, so users are never
		   stranded on the tools page. */
		var nav = E('div', { 'style': 'margin:0 0 10px;font-size:95%' }, [
			E('a', { 'href': L.url('admin/network/wwand') }, [ '← ' + _('Modems') ]),
			' · ',
			E('a', { 'href': L.url('admin/status/wwand') }, _('Status')),
			' · ',
			E('a', { 'href': L.url('admin/network/network') }, _('Interfaces')),
		]);

		return E('div', {}, [
			fmt.injectStyle(),
			nav,
			E('h2', {}, head),
			modemSel,
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
						/* keep the RAT bits this picker cannot show (CDMA/EVDO/
						   TD-SCDMA): a reset means "defaults for what is on
						   screen", not "drop what the UI never rendered" —
						   otherwise this button re-clobbers exactly what
						   collect() preserves. */
						var defs = Object.assign({}, DEFAULTS);
						defs.mode_preference = ((+s.mode_preference || 0) & ~MODE_BITS_MASK) |
							DEFAULTS.mode_preference;

						return self.apply(data.modem, defs).then(function() {
							window.location.reload();
						});
					}) }, _('Reset to defaults')),
			]),
			/* Control-protocol switch (QMI <-> MBIM): a full modem reset.
			   Gated on the daemon's `proto_switch` capability, which is a
			   property of the MODEL — the AT recipe is per-vendor and the
			   hardware-unverified ones are deliberately not offered. Gating on
			   "the modem currently speaks QMI or MBIM" would be no gate at all:
			   that is true of nearly every modem this app manages and says
			   nothing about whether the switch exists for it. */
			(function() {
				var p = proto && String(proto).toLowerCase();
				if (!(data.info && data.info.proto_switch)) return '';
				if (p != 'qmi' && p != 'mbim') return '';
				var target = (p == 'qmi') ? 'mbim' : 'qmi';
				return E('div', { 'class': 'cbi-section' }, [
					E('h3', {}, _('Control protocol')),
					E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title' }, [ _('Switch to %s').format(target.toUpperCase()) ]),
						E('div', { 'class': 'cbi-value-field' }, [
							E('button', { 'class': 'btn cbi-button cbi-button-reset',
								click: ui.createHandlerFn(self, function() {
									/* a supported recipe does not promise the target
									   protocol actually works: some firmwares reject
									   MBIM_OPEN and the modem comes back unusable on
									   MBIM until switched back (field-seen). */
									if (!confirm((target == 'mbim'
											? _('Switch the control protocol to MBIM? The modem resets and re-enumerates. Some firmwares reject MBIM even though the switch itself succeeds — if the modem does not come back, switch it to QMI again.')
											: _('Switch the control protocol to %s? The modem resets and re-enumerates — its connections come back on their own.').format(target.toUpperCase()))))
										return;
									return wrpc.setProtocol(data.modem, target).then(function(res) {
										ui.addNotification(null, E('p',
											[ res && res.ok
												? _('Protocol switch to %s issued — the modem resets.').format(target.toUpperCase())
												: _('Protocol switch failed: %s.').format(describeError(res)) ]),
											res && res.ok ? 'info' : 'warning');
									});
								}) }, _('Switch protocol')),
							E('div', { 'class': 'cbi-value-description' },
								_('Flips the control protocol (QMI ↔ MBIM). The modem resets; use only when the other protocol is known to work on this module.')),
						]),
					]),
				]);
			})(),
			netsel.render(panelCtx, data),
		].concat(this.renderCarrierConfig(data)).concat(this.renderCellLock(data)).concat(esim.render(panelCtx, data)).concat([
			E('h3', {}, _('Preferred PLMN lists')),
			this.renderPlmnManager(data.modem, data),
			plmnTable(_('Operator-controlled (6F61)'), (data.plmn || {}).operator),
			plmnTable(_('Home PLMN (6F62)'), (data.plmn || {}).home),
		]).concat(this.renderSms(data)));
	},
});
