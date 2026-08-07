'use strict';
'require view';
'require poll';
'require dom';
'require rpc';
'require wwand.bands as bands';

// Detail status: everything wwand collects, structured, for every modem and
// every connection. The pretty overview lives on Status → Modem; this page is
// the full firehose (identity, registration, data-system mode, signal, serving
// cells, carrier aggregation, neighbours, SIM slots, recovery, per-context
// addresses + stats).

var callStatus = rpc.declare({ object: 'wwand', method: 'status', expect: {} });
var callCells  = rpc.declare({ object: 'wwand', method: 'modem_cells', params: [ 'modem' ], expect: {} });
var callSlots  = rpc.declare({ object: 'wwand', method: 'modem_sim_slots', params: [ 'modem' ], expect: {} });
var callCtx    = rpc.declare({ object: 'wwand', method: 'context_status', params: [ 'interface' ], expect: {} });

function dash(v) { return (v == null || v === '') ? '—' : v; }
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
	var h = Math.floor(s/3600); s -= h*3600;
	var m = Math.floor(s/60), sec = s - m*60;
	if (d) return '%dd %dh %dm'.format(d, h, m);
	if (h) return '%dh %dm'.format(h, m);
	if (m) return '%dm %ds'.format(m, sec);
	return '%ds'.format(sec);
}
function fmtRate(bps) {
	if (bps == null || bps <= 0) return '—';
	return (bps >= 1e9) ? (bps/1e9).toFixed(2) + ' Gbps' : (bps/1e6).toFixed(1) + ' Mbps';
}
var RADIO = { 1:'CDMA', 2:'EVDO', 3:'AMPS', 4:'GSM', 5:'UMTS', 8:'LTE', 9:'TD-SCDMA', 12:'5G NR' };
function radioList(a) { return (a && a.length) ? a.map(function(r){ return RADIO[r] || r }).join(' + ') : '—'; }

// a key/value table from [[label, value], ...] (values may be nodes)
function kv(rows) {
	return E('table', { 'class': 'table', 'style': 'width:auto' },
		rows.filter(Boolean).map(function(r){
			return E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td', 'style': 'font-weight:600;padding-right:1.5em;white-space:nowrap' }, r[0]),
				E('td', { 'class': 'td' }, r[1]) ]);
		}));
}
// a data table from headers[] + rows[][]
function grid(headers, rows) {
	return E('table', { 'class': 'table' }, [
		E('tr', { 'class': 'tr table-titles' }, headers.map(function(h){ return E('th', { 'class':'th' }, h) }))
	].concat(rows.map(function(cells){
		return E('tr', { 'class': 'tr' }, cells.map(function(c){ return E('td', { 'class':'td' }, c) }));
	})));
}
function section(title, node) {
	return E('div', { 'class': 'cbi-section', 'style': 'margin:0 0 4px' }, [
		E('h4', { 'style': 'margin:.2em 0 .4em' }, title), node ]);
}

// --- signal / cell formatting ------------------------------------------------

function sig10(v, unit) { return (v == null || v <= -32768) ? '—' : (v/10).toFixed(1) + ' ' + unit; }
function sig1(v, unit)  { return (v == null || v <= -32768) ? '—' : v + ' ' + unit; }

function renderSignal(sig) {
	if (!sig) return E('em', {}, _('no signal data'));
	var rows = [];
	var l = sig.lte;
	if (l) rows.push([ 'LTE', sig1(l.rssi,'dBm'), sig1(l.rsrp,'dBm'), sig1(l.rsrq,'dB'), sig10(l.snr,'dB') ]);
	var n = sig.nr5g;
	if (n && (n.rsrp > -32768 || n.snr > -32768))
		rows.push([ '5G NR', '—', sig10(n.rsrp,'dBm'), sig10(sig.nr5g_rsrq,'dB'), sig10(n.snr,'dB') ]);
	var w = sig.wcdma;
	if (w && w.rssi != null && w.rssi > -128)
		rows.push([ 'UMTS', sig1(w.rssi,'dBm'), '—', sig10(w.ecio,'dB'), '—' ]);
	if (sig.gsm_rssi != null && sig.gsm_rssi > -128)
		rows.push([ 'GSM', sig1(sig.gsm_rssi,'dBm'), '—', '—', '—' ]);
	if (!rows.length) return E('em', {}, _('no signal data'));
	return grid([ _('RAT'), 'RSSI', 'RSRP', 'RSRQ', 'SNR/SINR' ], rows);
}

// serving cells: merge QMI cell-location with the QENG serving detail
function renderServing(cells) {
	var rows = [], sv = cells.serving || {};
	var lc = cells.lte_intra, sl = sv.lte;
	// QMI serving-cell metrics live in the intra-freq list entry whose PCI is the
	// serving one — fall back to it when the QENG (AT) detail is absent
	var lqmi = null;
	if (lc && lc.cells) lqmi = lc.cells.filter(function(c){ return c.pci == lc.serving_cell_id })[0];
	if (lc || sl) {
		var earfcn = (sl && sl.earfcn) || (lc && lc.earfcn);
		var ef = bands.lteEarfcn(earfcn);
		rows.push([ 'LTE',
			(sl && sl.band != null) ? ('B' + sl.band) : (ef ? ef.band : '—'),
			dash(earfcn), ef ? ef.mhz.toFixed(1)+' MHz' : '—',
			(sl && sl.bandwidth_mhz) ? (sl.bandwidth_mhz + ' MHz') : '—',
			dash((lc && lc.serving_cell_id) != null ? lc.serving_cell_id : (sl && sl.pci)),
			sl ? sig1(sl.rsrp,'dBm') : (lqmi ? sig10(lqmi.rsrp,'dBm') : '—'),
			(sl && sl.rsrq != null) ? sig1(sl.rsrq,'dB') : (lqmi ? sig10(lqmi.rsrq,'dB') : '—'),
			(sl && sl.sinr != null) ? sig1(sl.sinr,'dB') : '—' ]);
	}
	var nc = cells.nr5g_cell, sn = sv.nr;
	if (nc || sn) {
		var arfcn = (sn && sn.arfcn) || cells.nr5g_arfcn;
		var nf = bands.nrArfcn(arfcn);
		rows.push([ '5G NR' + (sn && sn.mode ? ' ('+sn.mode+')' : ''),
			(sn && sn.band != null) ? ('n' + sn.band) : (nf && nf.band ? nf.band : '—'),
			dash(arfcn), nf ? nf.mhz.toFixed(1)+' MHz' : '—',
			(sn && sn.bandwidth_mhz) ? (sn.bandwidth_mhz + ' MHz') : '—',
			dash((nc && nc.pci) != null ? nc.pci : (sn && sn.pci)),
			sn ? sig1(sn.rsrp,'dBm') : (nc ? sig10(nc.rsrp,'dBm') : '—'),
			(sn && sn.rsrq != null) ? sig1(sn.rsrq,'dB') : (nc ? sig10(nc.rsrq,'dB') : '—'),
			(sn && sn.sinr != null) ? sig1(sn.sinr,'dB') : (nc ? sig10(nc.snr,'dB') : '—') ]);
	}
	if (!rows.length) return E('em', {}, _('no serving-cell data'));

	var g = grid([ _('RAT'), _('Band'), 'ARFCN', _('Frequency'), _('Bandwidth'), 'PCI', 'RSRP', 'RSRQ', 'SNR/SINR' ], rows);

	// serving-cell identifiers + timing advance (compact line under the table)
	var idbits = [];
	if (lc && lc.tac != null) idbits.push('TAC ' + lc.tac);
	if (lc && lc.global_cell_id != null) idbits.push(_('Cell') + ' ' + lc.global_cell_id);
	if (cells.lte_timing_advance != null && cells.lte_timing_advance != 0xFFFFFFFF)
		idbits.push(_('Timing advance') + ' ' + cells.lte_timing_advance);
	if (!idbits.length) return g;
	return E('div', {}, [ g, E('div', { 'style': 'margin-top:4px;color:#888;font-size:90%' }, idbits.join(' · ')) ]);
}

var SCELL_STATE = { 0: _('deconfigured'), 1: _('deactivated'), 2: _('activated') };
function renderCA(ca) {
	if (!ca || !ca.length) return null;
	return section(_('Carrier aggregation') + ' (' + ca.length + ')', grid(
		[ _('Carrier'), _('Band'), 'ARFCN', _('Frequency'), _('Bandwidth'), 'PCI', _('State') ],
		ca.map(function(c){
			var isNR = (''+c.role).indexOf('NR') >= 0;
			var f = isNR ? bands.nrArfcn(c.earfcn) : bands.lteEarfcn(c.earfcn);
			return [ c.role, f ? f.band : '—', ''+c.earfcn,
				f ? f.mhz.toFixed(1)+' MHz' : '—',
				c.bandwidth_mhz ? c.bandwidth_mhz+' MHz' : '—', ''+c.pci,
				(c.role == 'PCC') ? _('primary') : (c.state != null ? (SCELL_STATE[c.state] || (''+c.state)) : '—') ];
		})));
}

function renderNeighbours(cells) {
	var out = [];
	var lc = cells.lte_intra;
	if (lc && lc.cells && lc.cells.length > 1) {
		var ef = bands.lteEarfcn(lc.earfcn);
		var rows = lc.cells.filter(function(c){ return c.pci != lc.serving_cell_id })
			.map(function(c){ return [ ''+c.pci, ef ? ef.mhz.toFixed(1)+' MHz' : '—',
				sig10(c.rsrp,'dBm'), sig10(c.rsrq,'dB'), sig10(c.rssi,'dBm'), sig10(c.srxlev,'dB') ]; });
		if (rows.length) out.push(section(_('LTE neighbours (intra-frequency)'),
			grid([ 'PCI', _('Freq'), 'RSRP', 'RSRQ', 'RSSI', 'Srxlev' ], rows)));
	}
	var li = cells.lte_inter, irows = [];
	if (li && li.freqs) li.freqs.forEach(function(fr){
		var fef = bands.lteEarfcn(fr.earfcn);
		(fr.cells || []).forEach(function(c){
			irows.push([ fef ? '%s · %d'.format(fef.band, fr.earfcn) : ''+fr.earfcn,
				fef ? fef.mhz.toFixed(1)+' MHz' : '—', ''+c.pci, sig10(c.rsrp,'dBm'), sig10(c.rsrq,'dB'), sig10(c.srxlev,'dB') ]);
		});
	});
	if (irows.length) out.push(section(_('LTE neighbours (inter-frequency)'),
		grid([ _('Band / EARFCN'), _('Freq'), 'PCI', 'RSRP', 'RSRQ', 'Srxlev' ], irows)));
	return out;
}

function renderSlots(slots) {
	if (!slots || !slots.length) return null;
	return section(_('SIM slots'), grid(
		[ _('Slot'), _('Card'), 'ICCID', _('Type'), 'EID', _('Active') ],
		slots.map(function(s){ return [ ''+s.physical, s.card, dash(s.iccid),
			s.is_euicc ? 'eSIM' : _('physical'), dash(s.eid), s.active ? '✓' : '' ]; })));
}

// --- per-connection ----------------------------------------------------------

function renderConnection(iface, cs) {
	var s = cs.settings || {}, v4 = s.ipv4, v6 = s.ipv6, st = cs.stats || {}, cr = cs.channel_rate || {};
	var rows = [
		[ _('Interface'), iface ],
		[ _('State'), cs.state + (cs.last_error ? ' · ' + cs.last_error : '') ],
		cs.bearer ? [ _('Bearer'), cs.bearer ] : null,
		[ _('Uptime'), fmtDur(cs.uptime) ],
		v4 ? [ _('IPv4'), '%s/%s'.format(v4.addr, v4.prefix != null ? v4.prefix : 32) +
			(v4.gateway ? ' → ' + v4.gateway : '') ] : null,
		(v4 && v4.dns) ? [ _('IPv4 DNS'), fmtList(v4.dns) ] : null,
		v6 ? [ _('IPv6'), dash(v6.addr) + (v6.gateway ? ' → ' + v6.gateway : '') ] : null,
		(v6 && v6.dns) ? [ _('IPv6 DNS'), fmtList(v6.dns) ] : null,
		(s.mtu != null) ? [ 'MTU', ''+s.mtu ] : null,
		(cr.max_rx_rate || cr.max_tx_rate) ? [ _('Link rate (max)'),
			'↓ ' + fmtRate(cr.max_rx_rate) + '  ↑ ' + fmtRate(cr.max_tx_rate) ] : null,
		st ? [ _('Traffic'), '↓ ' + fmtBytes(st.rx_bytes) + ' (' + dash(st.rx_packets) + ' pkt)  ' +
			'↑ ' + fmtBytes(st.tx_bytes) + ' (' + dash(st.tx_packets) + ' pkt)' ] : null,
		(cs.families && cs.families.length) ? [ _('Bearers'),
			cs.families.map(function(f){ return 'IPv%d cid %s pdh %s'.format(f.family, dash(f.cid), dash(f.pdh)) }).join(' · ') ] : null,
	];
	return section(_('Connection %s').format(iface), kv(rows));
}

// --- assembly ----------------------------------------------------------------

return view.extend({
	load: function() {
		return callStatus().then(function(st){
			var modems = st.modems || {}, contexts = st.contexts || {};
			var mnames = Object.keys(modems), cnames = Object.keys(contexts);
			return Promise.all([
				Promise.all(mnames.map(function(m){ return L.resolveDefault(callCells(m), {}); })),
				Promise.all(mnames.map(function(m){ return L.resolveDefault(callSlots(m), {}); })),
				Promise.all(cnames.map(function(c){
					return L.resolveDefault(callCtx(contexts[c].interface || c), {}).then(function(r){
						return { iface: contexts[c].interface || c, ctx: contexts[c], status: r };
					});
				})),
			]).then(function(r){
				return { modems: modems, mnames: mnames, cells: r[0], slots: r[1], conns: r[2] };
			});
		});
	},

	render: function(data) {
		var self = this;
		var container = E('div', {});

		var draw = function(d) {
			var cols = [];

			d.mnames.forEach(function(m, i){
				var mo = d.modems[m], cells = d.cells[i] || {}, reg = cells.registration || mo.registration || {};
				var plmn = reg.plmn, dsd = cells.dsd;

				var ident = kv([
					[ _('Model'), dash(mo.model) ],
					[ _('Revision'), dash(mo.revision) ],
					[ 'IMEI', dash(mo.imei) ],
					[ _('Device'), '%s → %s'.format(dash(mo.device), dash(mo.netdev)) ],
					[ _('AT port'), dash(mo.at_tty) ],
					[ _('State'), dash(mo.state) ],
					[ _('Recovery'), _('%d attempts, %d protocol errors').format(mo.attempts || 0, (mo.proto_errors != null ? mo.proto_errors : mo.qmi_errors) || 0) ],
				]);

				var rd = cells.registration_detail || mo.registration_detail;
				var rdMsg = null;
				if (rd && (rd.reject_text || rd.reject_cause != null || rd.limited)) {
					rdMsg = rd.reject_text ||
						(rd.reject_cause != null ? _('reject cause %d').format(rd.reject_cause) : _('limited service'));
					if (rd.limited && (rd.reject_text || rd.reject_cause != null))
						rdMsg += ' · ' + _('limited service');
				}

				var registration = kv([
					[ _('Status'), (reg.registration == 1) ? _('registered') : _('searching') ],
					rdMsg ? [ _('Problem'), E('span', { 'style': 'color:#c00;font-weight:bold' }, rdMsg) ] : null,
					plmn ? [ _('Operator'), '%s (%s/%s)'.format((plmn.description||'').replace(/[^\x20-\x7e]/g,'').trim(), plmn.mcc, plmn.mnc) ] : null,
					[ _('Roaming'), reg.roaming ? _('yes') : _('no') ],
					[ _('Radio'), radioList(reg.radio_ifs) ],
					dsd ? [ _('Data system'), (dsd.mode ? (dsd.mode + (dsd.mode=='NSA' ? ' (5G + LTE)' : dsd.mode=='SA' ? ' (5G)' : '')) : '—') + (dsd.source && dsd.source != 'dsd' ? ' · ' + dsd.source : '') ] : null,
				]);

				var body = [
					section(_('Identity'), ident),
					section(_('Registration'), registration),
					section(_('Signal'), renderSignal(cells.signal)),
					section(_('Serving cells'), renderServing(cells)),
					renderCA(cells.ca),
				].concat(renderNeighbours(cells))
				 .concat([ renderSlots((d.slots[i]||{}).slots) ])
				 .filter(Boolean);

				cols.push(E('div', { 'class': 'cbi-section', 'style': 'flex:1;min-width:340px;max-width:560px' },
					[ E('h3', {}, _('Modem %s').format(m)) ].concat(body)));
			});

			var out = [ E('div', { 'style': 'display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start' }, cols) ];

			if (d.conns.length) {
				var ccols = d.conns.map(function(c){
					return E('div', { 'class': 'cbi-section', 'style': 'flex:1;min-width:340px;max-width:560px' },
						[ renderConnection(c.iface, c.status || {}) ]);
				});
				out.push(E('h3', {}, _('Connections')));
				out.push(E('div', { 'style': 'display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start' }, ccols));
			}

			dom.content(container, out);
		};

		draw(data);

		poll.add(function(){
			return self.load().then(draw);
		}, 5);

		return container;
	},

	handleSaveApply: null, handleSave: null, handleReset: null,
});
