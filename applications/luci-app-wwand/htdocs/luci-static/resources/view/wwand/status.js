'use strict';
'require view';
'require poll';
'require dom';
'require rpc';
'require ui';
'require wwand.bands as bands';

var callStatus = rpc.declare({ object: 'wwand', method: 'status', expect: { modems: {} } });
var callContexts = rpc.declare({ object: 'wwand', method: 'status', expect: { contexts: {} } });
var callSignal = rpc.declare({ object: 'wwand', method: 'modem_signal', params: [ 'modem' ], expect: {} });
var callCells  = rpc.declare({ object: 'wwand', method: 'modem_cells',  params: [ 'modem' ], expect: {} });
var callCtxStatus = rpc.declare({ object: 'wwand', method: 'context_status', params: [ 'interface' ], expect: {} });
var callSlots = rpc.declare({ object: 'wwand', method: 'modem_sim_slots', params: [ 'modem' ], expect: {} });
var callSwitchSlot = rpc.declare({ object: 'wwand', method: 'modem_sim_switch_slot', params: [ 'modem', 'slot' ], expect: {} });

function fmtList(a) { return (a && a.length) ? a.join(', ') : '—'; }

function fmtBytes(n) {
	if (n == null) return '—';
	var u = ['B','KB','MB','GB','TB'], i = 0;
	while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
	return (i ? n.toFixed(2) : n) + ' ' + u[i];
}
function fmtDur(s) {
	if (s == null) return '—';
	var d = Math.floor(s/86400); s -= d*86400;
	var h = Math.floor(s/3600);  s -= h*3600;
	var m = Math.floor(s/60),  sec = s - m*60;
	if (d) return '%dd %dh %dm'.format(d, h, m);
	if (h) return '%dh %dm'.format(h, m);
	if (m) return '%dm %ds'.format(m, sec);
	return '%ds'.format(sec);
}
function fmtRate(bps) {
	if (bps == null || bps <= 0) return '—';
	return (bps >= 1e9) ? (bps/1e9).toFixed(2) + ' Gbps' : (bps/1e6).toFixed(1) + ' Mbps';
}

/* Band/frequency helpers come from the shared wwand.bands module. */
function lteEarfcn(e) { return bands.lteEarfcn(e); }
function nrArfcn(a) { return bands.nrArfcn(a); }

/* Unified cell table: carrier-aggregation carriers and neighbour cells share the
   same columns in the same positions, so CA cells and neighbours can be compared
   at a glance. Each source fills the fields it has; the rest show "—". */
var CELL_HEAD = [ 'Type', 'Band', 'EARFCN', 'Frequency', 'Bandwidth', 'PCI', 'RSRP', 'RSRQ', 'Lock' ];
function cellHead() {
	return E('tr', { 'class': 'tr table-titles' }, CELL_HEAD.map(function(h) {
		return E('th', { 'class': 'th' }, /^(EARFCN|PCI|RSRP|RSRQ)$/.test(h) ? h : _(h));
	}));
}
function cd(v) { return E('td', { 'class': 'td' }, (v == null || v === '') ? '—' : ('' + v)); }
function cellRow(o) {
	return E('tr', { 'class': 'tr' }, [ cd(o.type), cd(o.band), cd(o.earfcn),
		cd(o.freq), cd(o.bw), cd(o.pci), cd(o.rsrp), cd(o.rsrq), cd(o.lock) ]);
}
function cellTable(title, rows) {
	return E('div', { 'class': 'cbi-section' }, [ E('h3', {}, title),
		E('table', { 'class': 'table' }, [ cellHead() ].concat(rows)) ]);
}
function dBm(v) { return (v != null) ? (v / 10).toFixed(1) + ' dBm' : null; }
function dB(v)  { return (v != null) ? (v / 10).toFixed(1) + ' dB' : null; }
function mhz(f) { return f ? f.mhz.toFixed(1) + ' MHz' : null; }

/* peak-hold across polls, per modem, for antenna alignment */
var peak = {};
function trackPeak(name, key, val) {
	if (val == null) return null;
	peak[name] = peak[name] || {};
	if (peak[name][key] == null || val > peak[name][key]) peak[name][key] = val;
	return peak[name][key];
}

/* colour by quality thresholds [good, fair] (higher = better) */
function qcolor(v, good, fair) {
	if (v == null) return '#888';
	if (v >= good) return '#3c3'; if (v >= fair) return '#da3'; return '#e33';
}

/* a labelled bar: value mapped from [min,max] to 0..100% */
function bar(label, val, unit, min, max, good, fair) {
	var pct = (val == null) ? 0 : Math.max(0, Math.min(100, (val - min) / (max - min) * 100));
	var col = qcolor(val, good, fair);
	return E('div', { 'style': 'margin:4px 0' }, [
		E('div', { 'style': 'display:flex;justify-content:space-between' }, [
			E('span', {}, label),
			E('strong', { 'style': 'color:%s'.format(col) },
				(val == null) ? '—' : '%s %s'.format(val, unit))
		]),
		E('div', { 'style': 'background:#eee;border-radius:3px;height:10px;overflow:hidden' },
			E('div', { 'style': 'width:%d%%;height:100%%;background:%s'.format(pct, col) }))
	]);
}

function tbl(rows) {
	return E('table', { 'class': 'table' }, rows.map(function(r) {
		return E('tr', { 'class': 'tr' }, [
			E('td', { 'class': 'td left', 'width': '30%' }, r[0]),
			E('td', { 'class': 'td left' }, r[1]) ]);
	}));
}

/* status().config_warnings for a modem (added by a sibling daemon change).
   Absent/empty -> null so nothing is rendered. */
function renderWarnings(warns) {
	if (!warns || !warns.length)
		return null;
	var items = warns.map(function(w) {
		var warn = (w.severity == 'warn');
		var det = [];
		if (w.expected != null) det.push(_('expected') + ': ' + w.expected);
		if (w.actual != null)   det.push(_('actual') + ': ' + w.actual);
		return E('div', { 'style': 'display:flex;gap:9px;align-items:flex-start;padding:8px 12px;' +
			'border-radius:6px;margin:5px 0;' +
			(warn ? 'background:rgba(192,57,43,.12);color:#b3271a' : 'background:rgba(11,111,194,.11);color:#0b6fc2') }, [
			E('span', { 'style': 'font-size:1.15em;flex:none' }, warn ? '⚠' : 'ℹ'),
			E('div', {}, [
				E('div', {}, [ w.check ? E('strong', {}, w.check + ': ') : '', w.message || '' ]),
				det.length ? E('div', { 'style': 'opacity:.85;font-size:.9em;margin-top:2px' }, det.join(' · ')) : '' ]) ]);
	});
	return E('div', { 'class': 'cbi-section' },
		[ E('h3', {}, _('Configuration warnings')) ].concat(items));
}

/* Per-context connection detail: IPs, gateways, DNS, MTU — the stuff you
   otherwise only see by digging through ubus / the modem. */
function renderConnections(details) {
	var conns = details.filter(function(d) { return d.st && !d.st.error; });
	if (!conns.length)
		return null;

	var cards = conns.map(function(d) {
		var s = d.st.settings || {}, v4 = s.ipv4, v6 = s.ipv6;
		var st = d.st.state || d.cfg.state || '?';
		var rows = [
			[ _('Interface'), d.cfg.interface + (d.cfg.mux_id ? ' · mux %d'.format(d.cfg.mux_id) : '') ],
			[ _('State'), E('strong', { 'style': 'color:%s'.format(st == 'CONNECTED' ? '#3c3' : '#da3') }, st) ]
		];
		if (v4) {
			rows.push([ _('IPv4'), '%s/%d'.format(v4.addr, v4.prefix) ]);
			rows.push([ _('IPv4 gateway'), v4.gateway || '—' ]);
			rows.push([ _('IPv4 DNS'), fmtList(v4.dns) ]);
		}
		if (v6) {
			rows.push([ _('IPv6'), '%s/%d'.format(v6.addr, v6.plen) ]);
			rows.push([ _('IPv6 gateway'), v6.gateway || '—' ]);
			rows.push([ _('IPv6 DNS'), fmtList(v6.dns) ]);
		}
		if (!v4 && !v6)
			rows.push([ _('IP'), E('em', {}, _('not connected')) ]);
		rows.push([ _('MTU'), '' + (s.mtu || '—') ]);

		if (d.st.uptime != null)
			rows.push([ _('Uptime'), fmtDur(d.st.uptime) ]);
		var dc = d.st.stats;
		if (dc) {
			rows.push([ _('Data'), '\u2193 %s \u00b7 \u2191 %s'.format(fmtBytes(dc.rx_bytes), fmtBytes(dc.tx_bytes)) ]);
			if ((dc.rx_errors||0)+(dc.tx_errors||0)+(dc.rx_dropped||0)+(dc.tx_dropped||0) > 0)
				rows.push([ _('Errors / dropped'),
					'rx %d/%d \u00b7 tx %d/%d'.format(dc.rx_errors||0, dc.rx_dropped||0, dc.tx_errors||0, dc.tx_dropped||0) ]);
		}

		var cr = d.st.channel_rate;
		if (cr && (cr.max_rx_rate || cr.max_tx_rate))
			rows.push([ _('Max rate'),
				'\u2193 %s \u00b7 \u2191 %s'.format(fmtRate(cr.max_rx_rate), fmtRate(cr.max_tx_rate)) ]);

		/* last activation failure (bad password / forbidden APN / …) */
		var le = d.st.last_error;
		if (le && le.text && st != 'CONNECTED')
			rows.push([ _('Last error'), E('span', { 'style': 'color:#e33' },
				'%s%s'.format(le.text, (le.code != null) ? ' (%s %s)'.format(le.type || _('code'), le.code) : '')) ]);

		return E('div', { 'class': 'cbi-section', 'style': 'flex:1;min-width:280px' }, [
			E('h4', { 'style': 'margin:0 0 4px' }, d.cfg.interface), tbl(rows)
		]);
	});

	return E('div', { 'class': 'cbi-section' }, [
		E('h3', {}, _('Active connections')),
		E('div', { 'style': 'display:flex;gap:16px;flex-wrap:wrap' }, cards)
	]);
}

function renderLive(name, modem) {
	return Promise.all([
		L.resolveDefault(callSignal(name), {}),
		L.resolveDefault(callCells(name), {}),
		L.resolveDefault(callContexts(), {}),
		L.resolveDefault(callSlots(name), {})
	]).then(function(res) {
		var sig = res[0] || {}, cells = (res[1] || {}).cells || {};
		var allCtx = res[2] || {};
		var myCtx = Object.keys(allCtx)
			.filter(function(k){ return allCtx[k].modem == name; })
			.map(function(k){ return { name: k, cfg: allCtx[k] }; });

		/* fetch per-context IP settings in parallel, then render everything */
		return Promise.all(myCtx.map(function(c){
			return L.resolveDefault(callCtxStatus(c.cfg.interface), {})
				.then(function(st){ return { name: c.name, cfg: c.cfg, st: st }; });
		})).then(function(ctxDetails){
		var reg = modem.registration || {};
		var lte = sig.lte || {}, nr = sig.nr5g || {};
		var cols = [];

		/* --- signal panel (alignment) --- */
		var sigRows = [];
		if (lte.rsrp != null && lte.rsrp > -32768) {
			sigRows.push(bar(_('LTE RSRP'), lte.rsrp, 'dBm', -120, -70, -90, -105));
			sigRows.push(bar(_('LTE RSRQ'), lte.rsrq, 'dB', -20, -3, -10, -15));
			sigRows.push(bar(_('LTE SINR'), (lte.snr/10), 'dB', -5, 30, 13, 0));
			var pk = trackPeak(name, 'rsrp', lte.rsrp);
			var pkq = trackPeak(name, 'sinr', lte.snr/10);
			sigRows.push(E('div', { 'style': 'margin-top:6px;color:#666;font-size:90%' },
				_('Peak: RSRP %s dBm · SINR %s dB').format(pk, (pkq != null) ? pkq.toFixed(1) : '—')));
		}
		if (nr.rsrp != null && nr.rsrp > -32768) {
			sigRows.push(E('hr'));
			sigRows.push(bar(_('5G RSRP'), nr.rsrp, 'dBm', -120, -70, -90, -105));
			sigRows.push(bar(_('5G SINR'), (nr.snr/10), 'dB', -5, 30, 13, 0));
		}
		if (!sigRows.length)
			sigRows.push(E('em', {}, _('no signal (modem not registered)')));

		cols.push(E('div', { 'class': 'cbi-section', 'style': 'flex:1;min-width:280px' }, [
			E('h3', {}, _('Signal — aim the antenna for the highest RSRP/SINR')),
			E('div', {}, sigRows)
		]));

		/* --- serving/registration panel --- */
		var lc = cells.lte_intra;
		var ef = lc ? lteEarfcn(lc.earfcn) : null;
		var plmn = reg.plmn;
		var srvRows = [
			[ _('State'), modem.state || '?' ],
			[ _('Registration'), (reg.registration == 1) ? _('registered') : _('searching') ]
		];
		/* why registration is stuck: EMM reject cause / limited service */
		var rd = modem.registration_detail;
		if (rd && (rd.reject_text || rd.reject_cause != null || rd.limited)) {
			var msg = rd.reject_text ||
				(rd.reject_cause != null ? _('reject cause %d').format(rd.reject_cause) : _('limited service'));
			if (rd.limited && (rd.reject_text || rd.reject_cause != null))
				msg += ' · ' + _('limited service');
			srvRows.push([ _('Problem'), E('span', { 'style': 'color:#c00;font-weight:bold' }, msg) ]);
		}
		if (plmn) srvRows.push([ _('Operator'), '%s (%s/%s)%s'.format((plmn.description||'').trim(),
			plmn.mcc, plmn.mnc, reg.roaming ? ' · '+_('roaming') : '') ]);
		if (lc) {
			var dsd = cells.dsd, svl = (cells.serving||{}).lte;
			var tech = 'LTE' + ((nr.rsrp > -32768 || (cells.serving||{}).nr) ? ' + 5G NR' : '');
			if (dsd && dsd.mode && dsd.mode != 'LTE') tech += ' · ' + dsd.mode;
			srvRows.push([ _('Technology'), tech ]);
			srvRows.push([ _('Band'), (svl && svl.band != null) ? ('B'+svl.band) : (ef ? ef.band : '—') ]);
			srvRows.push([ _('Frequency'), (ef ? ef.mhz.toFixed(1)+' MHz' : '—') +
				((svl && svl.bandwidth_mhz) ? ' · ' + svl.bandwidth_mhz + ' MHz' : '') ]);
			srvRows.push([ _('EARFCN / PCI'), '%d / %d'.format(lc.earfcn, lc.serving_cell_id) ]);
			srvRows.push([ _('TAC / Cell ID'), '%d / %d'.format(lc.tac, lc.global_cell_id) ]);
		}
		var nc = cells.nr5g_cell, sn = (cells.serving||{}).nr;
		var narfcn = (sn && sn.arfcn) || cells.nr5g_arfcn;
		var nf = narfcn ? nrArfcn(narfcn) : null;
		if (nc || sn) {
			var nband = (sn && sn.band != null) ? ('n'+sn.band) : (nf && nf.band ? nf.band : '?');
			var npci = (sn && sn.pci != null) ? sn.pci : (nc ? nc.pci : '?');
			var nbw = (sn && sn.bandwidth_mhz) ? ' · ' + sn.bandwidth_mhz + ' MHz' : '';
			srvRows.push([ _('5G cell'), '%s · %s MHz%s · PCI %s'.format(
				nband, nf ? nf.mhz.toFixed(1) : '?', nbw, npci) ]);
		}

		cols.push(E('div', { 'class': 'cbi-section', 'style': 'flex:1;min-width:280px' }, [
			E('h3', {}, _('Serving cell')), tbl(srvRows)
		]));

		/* --- SIM slots (multi-slot devices; hidden when unsupported) --- */
		var slots = (res[3] || {}).slots || [];
		if (slots.length) {
			var slotRows = slots.map(function(sl) {
				var line = [
					E('strong', {}, _('Slot %d').format(sl.physical) +
						(sl.is_euicc ? ' (eSIM)' : '') + (sl.active ? ' ✓' : '')),
					' — ' + sl.card + (sl.iccid ? (', ICCID ' + sl.iccid) : '') +
						(sl.eid ? (', EID ' + sl.eid) : '')
				];
				if (!sl.active && sl.card == 'present')
					line.push(E('button', {
						'class': 'btn cbi-button cbi-button-apply',
						'style': 'margin-left:8px',
						'click': function() {
							if (!confirm(_('Switch to SIM slot %d? The connection will drop and re-establish.').format(sl.physical)))
								return;
							callSwitchSlot(name, sl.physical);
						}
					}, _('Activate')));
				return E('div', { 'style': 'margin-bottom:4px' }, line);
			});
			cols.push(E('div', { 'class': 'cbi-section', 'style': 'flex:1;min-width:280px' }, [
				E('h3', {}, _('SIM slots')), E('div', {}, slotRows)
			]));
		}

		var out = [];

		/* --- configuration warnings (if the daemon reports any) --- */
		var warns = renderWarnings(modem.config_warnings);
		if (warns) out.push(warns);

		out.push(E('div', { 'style': 'display:flex;gap:16px;flex-wrap:wrap' }, cols));

		/* --- active connections (per context) --- */
		var conns = renderConnections(ctxDetails);
		if (conns) out.push(conns);

		/* --- carrier aggregation (active carriers) --- unified cell columns --- */
		if (cells.ca && cells.ca.length) {
			out.push(cellTable(_('Carrier aggregation'), cells.ca.map(function(c){
				var isNR = ('' + c.role).indexOf('NR') >= 0;
				var cf = isNR ? nrArfcn(c.earfcn) : lteEarfcn(c.earfcn);
				return cellRow({
					type: c.role,
					band: cf ? cf.band : null,
					earfcn: c.earfcn,
					freq: mhz(cf),
					bw: c.bandwidth_mhz ? c.bandwidth_mhz + ' MHz' : null,
					pci: c.pci,
					rsrp: dBm(c.rsrp),
					rsrq: dB(c.rsrq),
					lock: null
				});
			})));
		}

		/* --- intra-frequency neighbour cells --- same columns as CA --- */
		if (lc && lc.cells && lc.cells.length > 1) {
			var neigh = lc.cells.filter(function(c){ return c.pci != lc.serving_cell_id; });
			out.push(cellTable(_('LTE neighbour cells (intra-frequency)'), neigh.map(function(c){
				return cellRow({
					type: _('neighbour'),
					band: ef ? ef.band : null,
					earfcn: lc.earfcn,
					freq: mhz(ef),
					bw: null,
					pci: c.pci,
					rsrp: dBm(c.rsrp),
					rsrq: dB(c.rsrq),
					lock: '%d:%d'.format(lc.earfcn, c.pci)
				});
			})));
		}

		/* --- inter-frequency neighbour cells --- same columns as CA --- */
		var li = cells.lte_inter;
		var interRows = [];
		if (li && li.freqs)
			li.freqs.forEach(function(fr){
				var fef = lteEarfcn(fr.earfcn);
				(fr.cells || []).forEach(function(c){
					interRows.push(cellRow({
						type: _('neighbour'),
						band: fef ? fef.band : null,
						earfcn: fr.earfcn,
						freq: mhz(fef),
						bw: null,
						pci: c.pci,
						rsrp: dBm(c.rsrp),
						rsrq: dB(c.rsrq),
						lock: '%d:%d'.format(fr.earfcn, c.pci)
					}));
				});
			});
		if (interRows.length)
			out.push(cellTable(_('LTE neighbour cells (inter-frequency)'), interRows));

		/* --- 5G NR neighbour cells (AT+QENG only — QMI reports no NR neighbours;
		   same columns as CA/LTE so all cell tables line up) --- */
		var nn = cells.nr5g_neigh;
		if (nn && nn.length) {
			out.push(cellTable(_('5G NR neighbour cells'), nn.map(function(c){
				var nf = (c.arfcn != null) ? nrArfcn(c.arfcn) : null;
				return cellRow({
					type: _('neighbour'),
					band: nf ? nf.band : null,
					earfcn: c.arfcn,           /* NR-ARFCN in the shared column */
					freq: mhz(nf),
					bw: null,
					pci: c.pci,
					rsrp: dBm(c.rsrp),
					rsrq: dB(c.rsrq),
					lock: (c.arfcn != null ? c.arfcn + ':' : '') + c.pci
				});
			})));
		}

		return E('div', {}, out);
		});
	});
}

return view.extend({
	load: function() {
		return L.resolveDefault(callStatus(), {});
	},

	render: function(modems) {
		var current = null;
		var selWrap = E('span', {});   // filled with a modem selector when >1
		var live = E('div', { 'id': 'wwand-live' }, E('em', {}, _('loading…')));

		/* Rebuild the modem dropdown only when the set of modems actually
		   changes; otherwise the 1s poll would recreate the <select> under the
		   user every second, making it flicker and impossible to open. The last
		   signature is stashed on selWrap so no extra closure state is needed. */
		function buildSelector(ms) {
			var names = Object.keys(ms || {});
			if (names.length < 2) {
				if (selWrap._sig !== '') { dom.content(selWrap, ''); selWrap._sig = ''; }
				return;
			}
			var sig = names.map(function(n){
				return n + ':' + (ms[n].netdev || '') + ':' + (ms[n].model || '');
			}).join('|');
			if (sig === selWrap._sig) return;
			selWrap._sig = sig;
			var sel = E('select', { 'class': 'cbi-input-select',
				'change': function(ev){ current = ev.target.value; peak[current] = {}; refresh(); } },
				names.map(function(n){
					var m = ms[n];
					return E('option', { 'value': n,
						'selected': (n == current) ? 'selected' : null },
						'%s (%s)'.format(m.netdev || n, m.model || '?'));
				}));
			dom.content(selWrap, [ _('Modem') + ': ', sel ]);
		}

		function refresh() {
			return callStatus().then(function(ms) {
				ms = ms || {};
				var names = Object.keys(ms);
				var el = document.getElementById('wwand-live');
				if (!el) return;

				if (!names.length) {
					current = null;
					dom.content(selWrap, '');
					dom.content(el, E('em', {}, _('wwand is not running or no modem present yet.')));
					return;
				}

				if (!current || !ms[current]) current = names[0];
				buildSelector(ms);
				return renderLive(current, ms[current]).then(function(node){
					var e2 = document.getElementById('wwand-live');
					if (e2) dom.content(e2, node);
				});
			});
		}

		var resetBtn = E('button', { 'class': 'btn cbi-button', 'click': function(){
			if (current) peak[current] = {}; refresh();
		} }, _('Reset peak'));

		poll.add(refresh, 1);
		refresh();

		return E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, _('Modem Status')),
			E('div', { 'class': 'cbi-map-descr' },
				_('Live cellular signal and cell environment — updates about once per second. Aim the antenna for the highest RSRP / SINR; the peak values below help while turning it.')),
			E('div', { 'class': 'cbi-section', 'style': 'display:flex;gap:12px;align-items:center' },
				[ selWrap, resetBtn ]),
			live
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
