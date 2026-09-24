'use strict';
'require view';
'require poll';
'require dom';
'require ui';
'require wwand.bands as bands';
'require wwand.logbox as logbox';
'require wwand.rpc as wrpc';
'require wwand.format as fmt';
'require wwand.graph as graph';
'require request';
'require wwand.mccmnc as mccmnc';

/* ubus declarations live in the shared wwand.rpc module */
var callStatus = wrpc.statusRaw;
var callContexts = wrpc.contexts;
var callSignal = wrpc.signal;
var callCells = wrpc.cells;
var callDatapath = wrpc.datapath;
var callCtxStatus = wrpc.ctxStatus;
var callSlots = wrpc.slots;
var callSwitchSlot = wrpc.switchSlot;

/* value formatters live in the shared wwand.format module */
var fmtList = fmt.fmtList;
var fmtBytes = fmt.fmtBytes;
var fmtDur = fmt.fmtDur;
var fmtRate = fmt.fmtRate;
var dBm = fmt.dBm;
var dB = fmt.dB;
var tbl = fmt.tbl;
var renderWarnings = fmt.renderWarnings;

/* Band/frequency helpers come from the shared wwand.bands module. */



/* Unified cell table: carrier-aggregation carriers and neighbour cells share the
   same columns in the same positions, so CA cells and neighbours can be compared
   at a glance. Each source fills the fields it has; the rest show "—". */
/* translatable headers are marked with literal _() so the i18n scanner picks
   them up (a runtime _(h) on a variable is invisible to it); acronyms stay as-is
   and carry a mouse-over explanation instead */
var CELL_HEAD = [
	[ _('Type'), null ],
	[ _('Band'), _('3GPP frequency band of the cell (B… = LTE, n… = 5G NR)') ],
	[ 'EARFCN', _('E-UTRA Absolute Radio Frequency Channel Number — the LTE (or, in the 5G tables, NR-ARFCN) channel number of the carrier') ],
	[ _('Frequency'), _('Downlink centre frequency derived from the channel number') ],
	[ _('Bandwidth'), _('Channel bandwidth of the carrier') ],
	[ 'PCI', _('Physical Cell ID — identifies the cell on this frequency; EARFCN:PCI addresses one specific cell') ],
	[ 'RSRP', _('Reference Signal Received Power — signal strength of this cell in dBm (closer to 0 = stronger; -80 excellent, -110 weak)') ],
	[ 'RSRQ', _('Reference Signal Received Quality in dB (higher = better; -10 good, -15 poor)') ],
	[ _('Lock'), _('EARFCN:PCI value to copy into the cell-lock field of the modem settings') ],
];
function cellHead() {
	return E('tr', { 'class': 'tr table-titles' }, CELL_HEAD.map(function(h) {
		return E('th', { 'class': 'th' }, h[1] ? fmt.term(h[0], h[1]) : h[0]);
	}));
}
/* array, not a bare string: dom.append() would otherwise route it through
   innerHTML (luci.js:1394-96). These cells carry cell-scan output — operator
   names come off the air. */
function cd(v) { return E('td', { 'class': 'td' }, [ (v == null || v === '') ? '—' : ('' + v) ]); }
function cellRow(o) {
	return E('tr', { 'class': 'tr' }, [ cd(o.type), cd(o.band), cd(o.earfcn),
		cd(o.freq), cd(o.bw), cd(o.pci), cd(o.rsrp), cd(o.rsrq), cd(o.lock) ]);
}
function cellTable(title, rows) {
	return E('div', { 'class': 'cbi-section' }, [ E('h3', {}, title),
		E('table', { 'class': 'table' }, [ cellHead() ].concat(rows)) ]);
}
function mhz(f) { return f ? f.mhz.toFixed(1) + ' MHz' : null; }

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
			/* array, not a bare string: E() assigns a bare string child through
			   innerHTML (luci.js:1395) while an array member becomes a text
			   node. `st` is daemon/uci text, so it must not be parsed as
			   markup. */
			[ _('State'), E('strong', { 'style': 'color:%s'.format(st == 'CONNECTED' ? '#3c3' : '#da3') }, [ st ]) ]
		];
		if (v4) {
			rows.push([ _('IPv4'), '%s/%d'.format(v4.addr, v4.prefix) ]);
			rows.push([ _('IPv4 gateway'), v4.gateway || '—' ]);
			rows.push([ _('IPv4 DNS'), fmtList(v4.dns) ]);
		}
		if (v6) {
			if (v6.unmanaged) {
				/* RNDIS v6 model: the host address is RA/SLAAC on the netdev,
				   managed by the dhcpv6 subinterface — nothing null/0 here */
				rows.push([ _('IPv6'), E('em', {}, _('unmanaged — RA/SLAAC on the netdev (dhcpv6 subinterface)')) ]);
				if (v6.dns && v6.dns.length)
					rows.push([ _('IPv6 DNS'), fmtList(v6.dns) ]);
			}
			else {
				rows.push([ _('IPv6'), '%s/%d'.format(v6.addr, v6.plen) ]);
				rows.push([ _('IPv6 gateway'), v6.gateway || '—' ]);
				rows.push([ _('IPv6 DNS'), fmtList(v6.dns) ]);
			}
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
				[ '%s%s'.format(le.text, (le.code != null) ? ' (%s %s)'.format(le.type || _('code'), le.code) : '') ]) ]);

		return E('div', { 'class': 'cbi-section', 'style': 'flex:1;min-width:280px' }, [
			E('h4', { 'style': 'margin:0 0 4px' }, [ d.cfg.interface ]), tbl(rows)
		]);
	});

	return E('div', { 'class': 'cbi-section' }, [
		E('h3', {}, _('Active connections')),
		E('div', { 'style': 'display:flex;gap:16px;flex-wrap:wrap' }, cards)
	]);
}

/* capability chips: each supported RAT slug from the daemon's caps.rats; the
   IoT / RedCap / NTN variants (which QMI/MBIM cannot even name) are highlighted. */
function capsBadges(caps) {
	if (!caps || !caps.rats || !caps.rats.length)
		return E('span', { 'style': 'color:#999' }, '—');
	var labels = { 'gsm': '2G', 'gprs': '2G', 'edge': '2G', 'umts': '3G', 'hspa': '3G',
		'td-scdma': '3G', 'cdma': 'CDMA', 'evdo': 'EVDO', 'lte': 'LTE', 'nr5g': '5G',
		'lte-m': 'LTE-M', 'nb-iot': 'NB-IoT', 'ec-gsm-iot': 'EC-GSM-IoT', 'redcap': 'RedCap', 'ntn': 'NTN' };
	var iot = { 'lte-m': 1, 'nb-iot': 1, 'ec-gsm-iot': 1, 'redcap': 1, 'ntn': 1 };
	return caps.rats.map(function(s) {
		return E('span', { 'style':
			'display:inline-block;padding:0 5px;margin-right:3px;border-radius:3px;font-size:85%;' +
			(iot[s] ? 'background:#f7e6ee;color:#524;font-weight:600' : 'background:#e6eef7;color:#245') },
			[ labels[s] || s ]);
	});
}
/* Datapath / muxing: the link-layer config wwand applied at datapath setup
   (backend, QMAP aggregation the modem negotiated, endpoint) plus the live
   aggregation seen on the wire — the mean number of packets the modem packs
   into one USB frame (parent frames vs demuxed child packets). */
function fmtProto(p) {
	/* WDA data-aggregation protocol enum */
	return ({ 0: '—', 1: 'none', 2: 'QMAP', 3: 'QMAP', 5: 'QMAPv5' })[p] || ('' + p);
}
function renderDatapath(dp) {
	if (!dp || dp.error || !dp.backend)
		return null;

	var rows = [
		/* name the QMAP version, do not leave v1 and v4 looking identical: the
		   old form appended "· QMAPv5" only for v5, so everything else read as
		   plain "rmnet" whether it was v1 or v4. `v5` is the fallback for a
		   daemon older than qmap_version. */
		[ _('Backend'), dp.backend + (dp.qmap_version != null
			? ' · QMAP v' + dp.qmap_version
			: (dp.v5 ? ' · QMAP v5' : '')) ],
		[ _('Parent device'), dp.parent || '—' ]
	];
	if (dp.urb_size)
		rows.push([ _('URB / frame size'), fmtBytes(dp.urb_size) ]);

	var wda = dp.wda || {};
	if (wda.dl_max_datagrams != null)
		rows.push([ _('Downlink aggregation (negotiated)'),
			_('%s protocol · up to %d datagrams / %s').format(
				fmtProto(wda.dl_protocol), wda.dl_max_datagrams, fmtBytes(wda.dl_max_size)) ]);
	if (wda.ul_max_datagrams != null)
		rows.push([ _('Uplink aggregation (negotiated)'),
			_('%s protocol · up to %d datagrams / %s').format(
				fmtProto(wda.ul_protocol), wda.ul_max_datagrams, fmtBytes(wda.ul_max_size)) ]);

	/* MBIM/NCM NTB aggregation (cdc_ncm framing) */
	var ntb = dp.ntb;
	if (ntb) {
		if (ntb.rx_max != null)
			rows.push([ _('Downlink NTB (aggregation buffer)'), fmtBytes(ntb.rx_max) ]);
		if (ntb.tx_max != null)
			rows.push([ _('Uplink NTB'),
				fmtBytes(ntb.tx_max) + (ntb.tx_max_datagrams != null ?
					_(' · up to %d datagrams').format(ntb.tx_max_datagrams) : '') ]);
		if (ntb.tx_timer_usecs != null)
			rows.push([ _('Uplink coalescing timer'), ntb.tx_timer_usecs + ' µs' ]);
	}

	/* rows the datapath itself contributed (a vendor datapath's own view of the
	   link — e.g. the NSS one reports the driver's channel count, its RX buffer
	   and whether the NSS shim was loaded). Keys arrive as the datapath named
	   them; render them readably rather than inventing a schema per datapath. */
	var extra = dp.extra || {};
	Object.keys(extra).forEach(function(k) {
		var v = extra[k];
		if (v == null || v === '')
			return;
		if (/_size$/.test(k) && typeof v == 'number')
			v = fmtBytes(v);
		/* The contract says "keys are shown as given" and the datapaths in tree
		   send strings and numbers, so this is for the ones that are not in
		   tree (docs/extending.md invites them): a boolean would otherwise land
		   as a bare, untranslated `true` beside translated labels. `false` is
		   deliberately still rendered — the guard above lets it through, and
		   "NSS shim: no" is the interesting answer. */
		if (typeof v == 'boolean')
			v = v ? _('yes') : _('no');
		rows.push([ k.replace(/_/g, ' ').replace(/^./, function(c){ return c.toUpperCase(); }),
			'' + v ]);
	});

	/* mux channels */
	(dp.channels || []).forEach(function(c) {
		rows.push([ _('Mux channel %d').format(c.mux_id),
			'%s → %s'.format(c.netdev, c.interface) ]);
	});

	/* live datapath counters (every backend) + the QMAP aggregation ratio
	   (rmnet/qmimux only — on MBIM/NCM the NTB block above is the aggregation
	   indicator; the parent-vs-child packet ratio there is meaningless) */
	var st = dp.stats;
	if (st && st.parent) {
		var p = st.parent, kids = st.children || {};
		var kidRx = 0, kidTx = 0;
		Object.keys(kids).forEach(function(k){ kidRx += (kids[k].rx_packets||0); kidTx += (kids[k].tx_packets||0); });

		if (st.rx_aggregation != null) {
			rows.push([ E('strong', {}, _('Downlink packets / frame')),
				E('strong', { 'style': 'color:%s'.format(st.rx_aggregation >= 2 ? '#3c3' : '#da3') },
					[ st.rx_aggregation.toFixed(2) + '×' ]) ]);
			rows.push([ _('… based on'),
				_('%d demuxed packets over %d USB frames').format(kidRx, p.rx_packets || 0) ]);
		}
		/* independent of the downlink one: the daemon suppresses each direction
		   on its own when its counters are not comparable, so nesting this
		   inside the check above would hide a perfectly good uplink figure */
		if (st.tx_aggregation != null)
			rows.push([ _('Uplink packets / frame'),
				'%s× (%d / %d)'.format(st.tx_aggregation.toFixed(2), kidTx, p.tx_packets || 0) ]);

		rows.push([ _('Datapath counters (parent)'),
			'↓ %s · ↑ %s'.format(fmtBytes(p.rx_bytes), fmtBytes(p.tx_bytes)) ]);
	}

	return E('div', { 'class': 'cbi-section' }, [
		E('h3', {}, _('Datapath & muxing')), tbl(rows)
	]);
}

/* Heavy RPCs (SIM-EF reads, UIM slot status, cell scans) don't belong in the
   1 s poll: cache each per modem and refresh it in the background at its own
   cadence. A tick always resolves immediately with the latest known value — a
   modem op that blocks (eSIM management, UIM busy, init phases) can delay ONE
   background refresh but can no longer stall the page. */
/* null-prototype: the keys are modem names straight out of uci, so a section
   literally called `__proto__` would otherwise write through to Object's
   prototype. Only an admin can create that name, which is why this is a
   two-character fix and not a vulnerability — but CodeQL flags the pattern and
   a cache keyed by names from outside has no business having a prototype
   (openwrt/luci#8917, code-scanning alert 16). */
var slowCache = Object.create(null);
function cachedCall(name, key, ttl_s, fn) {
	var c = slowCache[name] = slowCache[name] || Object.create(null);
	var e = c[key] = c[key] || { t: 0, v: null, busy: false };
	if (!e.busy && (Date.now() - e.t) >= ttl_s * 1000) {
		e.busy = true;
		var p = L.resolveDefault(fn(), {}).then(function(v) {
			e.v = v; e.t = Date.now(); e.busy = false; return v;
		});
		if (e.v == null)
			return p;   /* nothing cached yet: the first paint waits */
	}
	return Promise.resolve(e.v || {});
}

/* The ladder's action names, in words. Only the software rungs need one here —
   the hardware step has its own sentence above it. */
const ACTION_LABEL = {
	opmode_cycle: _('cycle the radio'),
	modem_reset:  _('reset the modem'),
};

function renderLive(name, modem, graphs, board) {
	return Promise.all([
		L.resolveDefault(callSignal(name), {}),   /* every tick: antenna aiming */
		cachedCall(name, 'cells', 3, function() { return callCells(name); }),
		L.resolveDefault(callContexts(), {}),
		cachedCall(name, 'slots', 15, function() { return callSlots(name); }),
		cachedCall(name, 'datapath', 5, function() { return callDatapath(name); })
	]).then(function(res) {
		/* The eUICC's profile list, and ONLY when the active slot is one.
		   Reading it walks an APDU channel to the card, which is expensive
		   compared with everything else on this page and pointless on a plain
		   SIM — and impossible for an eUICC sitting in the inactive slot, where
		   there is no channel to walk. Cached hard (60 s): a profile list
		   changes when somebody downloads or switches a profile, not between
		   two ticks of a status page. */
		/* the RECORD, not a boolean: the read needs that slot's physical number.
		   The bridge does `+(params?.slot ?? 1)`, so an explicit 0 is NOT
		   replaced by the default — it is sent as the physical UIM slot, and
		   slots are 1-based (modem_sim_switch_slot refuses anything else). QMI
		   would open the wrong slot; MBIM and AT ignore the field, which is
		   exactly what would have hidden it. The daemon's esim_ready handler
		   passes eslot.physical for the same reason. */
		var euicc = ((res[3] || {}).slots || []).find(function(sl) {
			return sl.active && sl.is_euicc && sl.card == 'present' && sl.physical > 0;
		});

		return (euicc
			? cachedCall(name, 'profiles', 60, function() {
				return wrpc.esimProfiles(name, euicc.physical);
			})
			: Promise.resolve(null)
		).then(function(pr) {
			/* KEY OFF `profiles`, not off truthiness. cachedCall substitutes {}
			   for a denied or failed read (L.resolveDefault) and caches THAT for
			   60 s — and `{}.profiles || []` is an empty list, so the slot said
			   "no profiles installed", the one claim esimProfileList() exists to
			   keep apart from "not read". An eUICC that genuinely has none answers
			   profiles: [], and an empty array is truthy, so that still reads as
			   installed-none (openwrt/luci#8917). */
			res[5] = (pr && pr.ok !== false && pr.profiles) ? pr.profiles : null;
			return res;
		});
	}).then(function(res) {
		var sig = res[0] || {}, cells = (res[1] || {}).cells || {};
		var allCtx = res[2] || {};
		var dpath = res[4] || {};
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

		/* The graphs live OUTSIDE the node this function returns — the caller
		   replaces that node every second, and a canvas rebuilt with it would
		   lose its ring buffers every tick. So feed them the sample we already
		   have rather than letting them fetch their own: same data, no second
		   RPC, and the numbers below cannot disagree with the lines above. */
		if (graphs)
			graphs.push(sig, reg, cells);

		var term = fmt.term;

		/* --- modem & SIM panel: device identity + the active SIM --- */
		var mdmRows = [
			[ term(_('State'), _('wwand state for this modem: READY = usable, REGISTERING = searching for a network, WAITING_MODEM/ABSENT = control device not present, SIM_BLOCKED = PIN/PUK required')),
				modem.state || '?' ],
			[ term(_('Mode'), _('Control protocol wwand uses to drive this modem: QMI (Qualcomm native), MBIM (the USB standard) or NCM (AT commands with an ethernet-style data port)')),
				(modem.protocol || '?').toUpperCase() ],
		];
		/* modem identity read via the backend's native path (QMI DMS, MBIM
		   device caps, AT CGMI/CGMR) — absent fields are hidden */
		if (modem.manufacturer) mdmRows.push([ _('Manufacturer'), modem.manufacturer ]);
		if (modem.model)        mdmRows.push([ _('Model'), modem.model ]);
		if (modem.firmware)
			mdmRows.push([ term(_('Firmware'), _('Firmware version reported by the modem — relevant when comparing behaviour or looking for carrier-specific builds')), modem.firmware ]);
		if (modem.revision && modem.revision != modem.firmware)
			mdmRows.push([ _('Revision'), modem.revision ]);
		/* which RATs the modem supports (best-effort) — incl. IoT/RedCap/NTN */
		if (modem.caps && modem.caps.rats && modem.caps.rats.length)
			mdmRows.push([ term(_('Capabilities'), _('Radio access technologies this modem hardware reports to support')),
				E('span', {}, capsBadges(modem.caps)) ]);
		/* Temperature: read from the STATUS object. It used to be read as
		   `cells.temperature`, but the daemon puts it at the top level of the
		   modem_cells reply, not inside its `cells` — so this row never rendered
		   once. It now lives on the status object, beside the mitigation state
		   it wants to be read with. */
		if (modem.temperature && modem.temperature.celsius != null)
			mdmRows.push([ term(_('Temperature'), _('Modem baseband temperature. Whether the module is actually throttling is reported separately below — the modem itself says so, no guessing from the number needed.')),
				'%d °C'.format(modem.temperature.celsius) ]);

		/* What the modem DECIDED about its own thermal state (QMI TMD). The
		   headline comes from `mitigated`, never from active.length: the daemon
		   already excluded environmental devices there, and a healthy NR7101
		   carries `cpr_cold` at level 1 forever simply because it is cold. */
		if (modem.thermal) {
			var th = modem.thermal;
			var rfAct = (th.active || []).filter(function(d) { return d.rf; });
			var envAct = (th.active || []).filter(function(d) { return !d.rf; });

			if (th.mitigated)
				mdmRows.push([ term(_('Thermal'), _('The modem is holding its own radio back — usually reduced transmit power. This is the explanation for throughput that drops while the signal stays good.')),
					E('span', { 'style': 'color:#c00;font-weight:bold' },
						[ _('throttling, level %d').format(th.level || 0) +
						  (rfAct.length ? ' · ' + rfAct.map(function(d) {
						      return '%s %d/%d'.format(d.label || d.id, d.level, d.max);
						  }).join(', ') : '') ]) ]);
			else if (envAct.length)
				/* worth showing — "this modem is cold" explains a slow start on
				   a winter rooftop — but it is NOT an alarm */
				mdmRows.push([ term(_('Thermal'), _('An environmental limit the modem reports (temperature, voltage or charge state). It is not throttling the radio.')),
					E('span', { 'style': 'color:#666' },
						[ envAct.map(function(d) {
						      return '%s %d/%d'.format(d.label || d.id, d.level, d.max);
						  }).join(', ') + ' · ' + _('not throttling') ]) ]);
		}

		/* Only shown when it is FALSE, which is the whole point: `proven` says
		   the modem has answered at least once in the protocol wwand chose for
		   it, and until it has, every hardware recovery step — op-mode cycle,
		   modem reset, power-cycle, reboot — is held back. A working modem is
		   proven within seconds and the row never appears; one that is not is
		   usually a wrong `option protocol` or an unrecognised driver, and the
		   operator needs to know that recovery is disarmed rather than wonder
		   why nothing is being retried.

		   ONLY when there is no `recovery` block. `proven` and the ladder's
		   `armed` are the SAME fact — the daemon derives both from
		   `counters.proto_ok` — so with a ladder present this pushed two rows
		   both labelled Recovery, saying the same thing in different words
		   with different tooltips (openwrt/luci#8917). The ladder row is the
		   superset and carries the advice now. This one stays for the case
		   the ladder cannot cover: a daemon old enough to report no
		   `recovery` block at all, which is not hypothetical — a WH3000 Pro
		   on r68 reports none.

		   `!modem.recovery`, not `== null`: this has to be the exact complement
		   of the ladder's own `if (rec)`, or a falsy-but-not-null value would
		   render NEITHER row. recovery_view() always returns an object today, so
		   that gap is unreachable — but the pair should hold by construction, not
		   because the other end happens to cooperate. */
		if (modem.proven === false && !modem.recovery)
			mdmRows.push([ term(_('Recovery'), _('The modem has not yet answered in the control protocol wwand is using, so no hardware recovery step will run — repowering a modem that was never broken only adds outages. Check the control protocol setting and the bound driver.')),
				E('span', { 'style': 'color:#b8860b' }, [ _('disarmed — the modem has not answered yet') ]) ]);

		/* The card's own last word about itself, from the UIM indications. A
		   removed or busy card used to leave these rows simply absent, which
		   read as "nothing to report" rather than "the card is gone". */
		if (modem.sim_busy)
			mdmRows.push([ term(_('SIM card'), _('The card reports itself busy. Reads of ICCID, IMSI and the PIN state will fail until it clears, which is why those rows may be missing.')),
				E('span', { 'style': 'color:#c00;font-weight:bold' }, [ _('busy — reads failing') ]) ]);

		if (modem.sim_note)
			mdmRows.push([ term(_('SIM event'), _('The last thing the card said about itself: a session it closed and why, an internal recovery, or an activation that did not complete.')),
				E('span', { 'style': 'color:#c00' }, [ modem.sim_note ]) ]);
		/* ICCID and IMSI now live in the SIM slots panel, beside the slot they
		   came out of — they are the CARD's identity, and repeating them here
		   made the same number appear twice on one screen with nothing saying
		   which slot the one in this panel belonged to.

		   IMEI STAYS. It identifies the modem hardware, not the card: it does
		   not change when you switch slots, and putting it under "SIM slots"
		   would file a device serial under the wrong heading. */
		if (modem.imei)
			mdmRows.push([ term('IMEI', _('International Mobile Equipment Identity — the modem hardware serial')), modem.imei ]);
		if (modem.msisdn)
			mdmRows.push([ term('MSISDN', _('The phone number stored on the SIM (often empty on data SIMs)')), modem.msisdn ]);

		/* THE RECOVERY LADDER, not just its counter.
		 *
		 * A bare attempt count tells an operator a number. What they need while
		 * a box is misbehaving is which escalations have already fired, what
		 * comes next, how far off it is — and, at the hardware rung, which of
		 * the two actions this box would actually take. The last one is not
		 * guessable from the UI: a board with a power line still cannot use it
		 * when two modems share it, so the escalation silently has nothing to
		 * fire. The daemon answers that with the same code path the action
		 * takes (hwops.repower_plan), so the page cannot promise what the
		 * ladder would not do. */
		var rec = modem.recovery;

		if (rec) {
			var fired = rec.rungs ? rec.rungs.filter(function(x) { return x.fired; }).length : 0;
			var state = rec.armed
				? _('armed')
				: _('not armed — no exchange has succeeded in the selected protocol yet');
			/* ONE msgid per sentence. `_('steps taken')` dropped into an
			   untranslatable '%s' shell reaches a translator as two
			   context-free words they cannot reorder — the same defect the
			   graph.js legend line was collapsed to fix. */
			var line = _('%s · %d/%d steps taken').format(state, fired,
				rec.rungs ? rec.rungs.length : 0);

			if (rec.next)
				line += ' · %s'.format(rec.next['in'] > 0
					? _('next: %s in %d attempts').format(rec.next.action, rec.next['in'])
					: _('next: %s, due now').format(rec.next.action));

			mdmRows.push([ term(_('Recovery'), _('wwand escalates a failing modem in steps: cycle the operating mode, reset the modem, then the board\'s power or reset line, and a reboot beyond that. Each step fires once per outage. The ladder stays disarmed until one exchange has succeeded in the selected control protocol, so a misdetected modem is never repowered.')),
				_('%s (%d attempts)').format(line, rec.attempts || 0) ]);

			var hw = rec.hardware || {};
			var hwText;

			/* ABSENT IS NOT "NONE". A daemon that does not report this field at
			   all (it is newer than the field) must not have silence read as an
			   answer — saying "this board exposes no power or reset line" about
			   a board that has one is worse than saying nothing. Seen for real:
			   a WH3000 Pro on r68 reports no `recovery` block whatsoever, and
			   the profile for that board does carry a modem power line. */
			if (rec.hardware == null)
				hwText = _('not reported by this wwand version');
			else if (hw.action == 'reset_gpio')
				hwText = _('reset line %s (%s)').format(hw.gpio,
					hw.source == 'modem' ? _('from this modem\'s configuration') : _('board default'));
			else if (hw.action == 'power_cycle')
				hwText = (hw.has_power !== false)
					? _('power cycle the modem')
					/* has_power false has two causes and they want different
					   things from the reader. A board wwand KNOWS, whose profile
					   carries no power line, cannot be repowered and that is the
					   end of it. A board wwand does not know looks identical
					   from here — same false, same null reset line — while its
					   pins may be sitting there unread; that owner needs a
					   profile, not a shrug. Told apart by board.profile, which
					   the daemon reports for exactly this. */
					: (board && board.profile === false)
						? _('nothing — "%s" is not in wwand\'s board profile table, so its modem power and reset lines are unknown. They may well exist.')
							.format(board.id || '?')
						: _('power cycle — but this board has no modem power line');
			/* An action this page does not know — a rung added to the daemon
			   after this release. Falling through to the branch below would
			   describe it as "no GPIO — software only", which the daemon never
			   said, under a tooltip promising the answer came from the code
			   that performs it. Quote it instead and say plainly that the page
			   is the older half (openwrt/luci#8917). */
			else if (hw.action != null && hw.action !== '')
				hwText = _('%s — reported by the daemon; this page is older than that step and cannot describe it.')
					.format(hw.action);
			else {
				/* NO HARDWARE STEP. "nothing" was true and not useful: what a
				   reader needs is what is left, and that is not "reboot only"
				   either — the ladder still cycles the radio and soft-resets the
				   modem before it gets anywhere near a reboot, and the reboot is
				   only in it when failreboot is non-zero.

				   Read from rec.rungs rather than spelled out here, for the
				   reason recovery.uc gives for exporting that table at all: a
				   copy in the UI goes on naming the old ladder long after the
				   real one has moved. */
				var soft = (rec.rungs || [])
					.filter(function(r) { return r.action != 'usb_repower' && r.action != 'reboot'; })
					.map(function(r) { return ACTION_LABEL[r.action] || r.action; });
				var canReboot = (rec.rungs || []).some(function(r) { return r.action == 'reboot'; });

				var why = (hw.error == 'multi_modem_needs_reset_gpio')
					? _('this box has more than one modem and the board lines would hit the wrong one — set "Modem reset GPIO" on this modem to give the step something to do')
					: (hw.error == 'no_board_profile')
						? _('no board profile for this device, so no power or reset line is known')
						: _('this board exposes no modem power or reset line');

				hwText = soft.length
					? (canReboot
						? _('no GPIO — software only (%s), then a router reboot. %s.')
							.format(soft.join(_(', then ')), why)
						: _('no GPIO — software only (%s), and no reboot either, so the ladder keeps retrying. %s.')
							.format(soft.join(_(', then ')), why))
					: _('no GPIO — nothing. %s.').format(why);
			}

			mdmRows.push([ term(_('Hardware step'), _('What the hardware step of the recovery ladder would actually do on this box for this modem — asked of the same code that performs it, not inferred.')),
				hwText ]);
		}
		if (modem.fcc_lock != null && modem.fcc_lock != 0)
			mdmRows.push([ term(_('FCC lock'), _('This module boots radio-locked (laptop-SKU) and the modem will not register while the lock is armed — set fcc_auth on the modem configuration to unlock at boot')),
				_('active (mode %d)').format(modem.fcc_lock) ]);
		var lockTxt = fmt.fmtLocks(modem.locks);

		if (lockTxt)
			mdmRows.push([ term(_('Locked to'), _('Cell/frequency locks the modem currently has armed — the read-back of the cell-lock editor, showing what the modem ACTUALLY locked')), lockTxt ]);

		cols.push(E('div', { 'class': 'cbi-section', 'style': 'flex:1;min-width:280px' }, [
			E('h3', {}, _('Modem')), tbl(mdmRows)
		]));

		/* --- serving cell / registration panel (radio side) --- */
		var lc = cells.lte_intra;
		var ef = lc ? bands.lteEarfcn(lc.earfcn) : null;
		var plmn = reg.plmn;
		var srvRows = [
			[ term(_('Registration'), _('Network registration state: home / roaming / searching / denied')),
				fmt.regShort(reg) ]
		];
		/* why registration is stuck: EMM reject cause / limited service */
		var rd = modem.registration_detail;
		if (rd && (rd.reject_text || rd.reject_cause != null || rd.limited)) {
			var msg = rd.reject_text ||
				(rd.reject_cause != null ? _('reject cause %d').format(rd.reject_cause) : _('limited service'));
			if (rd.limited && (rd.reject_text || rd.reject_cause != null))
				msg += ' · ' + _('limited service');
			/* carried over from the previous registration attempt */
			if (rd.stale)
				msg += ' · ' + _('(last attempt)');
			srvRows.push([ term(_('Problem'), _('Registration problem reported by the network — the 3GPP reject cause explains why the attach was refused')),
				E('span', { 'style': 'color:#c00;font-weight:bold' }, [ msg ]) ]);
		}
		var opLine = fmt.fmtOperator(reg);
		if (opLine) {
			/* resolve the PLMN against the bundled MCC/MNC table; append the
			   name only when the network-provided description doesn't carry it */
			var opName = plmn ? mccmnc.name(plmn.mcc, plmn.mnc) : null;
			if (opName && opLine.toLowerCase().indexOf(opName.substr(0, 4).toLowerCase()) < 0)
				opLine += ' — ' + opName;
			srvRows.push([ term(_('Operator'), _('The network currently serving the modem, as name (MCC/MNC). MCC = country, MNC = network within it')), opLine ]);
		}
		/* the daemon-identified fine access technology (NB-IoT/LTE-M/5G-SA/…, from
		   AT where QMI/MBIM can't name it) wins; else the LTE/5G block derives it */
		var techTerm = term(_('Technology'), _('Radio access technology of the current connection (LTE, 5G NSA = 5G carrier on an LTE anchor, 5G SA = standalone 5G, NB-IoT/LTE-M = IoT modes)'));
		if (modem.rat)
			srvRows.push([ techTerm, modem.rat ]);
		/* the daemon-reported registration tech (reg.tech) covers modems
		   without a cell environment — a cells-less huawei-cdc stack names
		   its mode from ^HCSQ; only shown when neither source above applies */
		if (!modem.rat && !lc && reg.tech)
			srvRows.push([ techTerm, reg.tech.toUpperCase() ]);
		if (lc) {
			var dsd = cells.dsd, svl = (cells.serving||{}).lte;
			var tech = 'LTE' + ((fmt.hasSignal(nr.rsrp) || (cells.serving||{}).nr) ? ' + 5G NR' : '');
			if (dsd && dsd.mode && dsd.mode != 'LTE') tech += ' · ' + dsd.mode;
			if (!modem.rat) srvRows.push([ techTerm, tech ]);
			srvRows.push([ term(_('Band'), _('3GPP frequency band of the serving cell (B… = LTE, n… = 5G NR) — lower bands travel further, higher bands carry more bandwidth')),
				(svl && svl.band != null) ? ('B'+svl.band) : (ef ? ef.band : '—') ]);
			srvRows.push([ term(_('Frequency'), _('Downlink centre frequency of the serving cell · channel bandwidth')),
				(ef ? ef.mhz.toFixed(1)+' MHz' : '—') +
				((svl && svl.bandwidth_mhz) ? ' · ' + svl.bandwidth_mhz + ' MHz' : '') ]);
			srvRows.push([ term('EARFCN / PCI', _('EARFCN = LTE channel number of the carrier; PCI = Physical Cell ID. EARFCN:PCI identifies the exact cell (usable for the cell lock)')),
				'%d / %d'.format(lc.earfcn, lc.serving_cell_id) ]);
			srvRows.push([ term(_('TAC / Cell ID'), _('TAC = Tracking Area Code (paging area); Cell ID = the network-wide unique identifier of this cell')),
				'%d / %d'.format(lc.tac, lc.global_cell_id) ]);
		}
		var nc = cells.nr5g_cell, sn = (cells.serving||{}).nr;
		var narfcn = (sn && sn.arfcn) || cells.nr5g_arfcn;
		var nf = narfcn ? bands.nrArfcn(narfcn) : null;
		if (nc || sn) {
			var nband = (sn && sn.band != null) ? ('n'+sn.band) : (nf && nf.band ? nf.band : '?');
			var npci = (sn && sn.pci != null) ? sn.pci : (nc ? nc.pci : '?');
			var nbw = (sn && sn.bandwidth_mhz) ? ' · ' + sn.bandwidth_mhz + ' MHz' : '';
			srvRows.push([ term(_('5G cell'), _('The 5G NR serving cell: band · centre frequency · bandwidth · Physical Cell ID')),
				'%s · %s MHz%s · PCI %s'.format(
				nband, nf ? nf.mhz.toFixed(1) : '?', nbw, npci) ]);
		}

		cols.push(E('div', { 'class': 'cbi-section', 'style': 'flex:1;min-width:280px' }, [
			E('h3', {}, _('Serving cell')), tbl(srvRows)
		]));

		/* --- SIM slots (multi-slot devices; hidden when unsupported) --- */
		var slots = (res[3] || {}).slots || [];
		if (slots.length) {
			var msAll = (res[3] || {}).multisim || {};
			/* the radio-stack column is noise on a box with one stack and the
			   point of the panel on a box with two */
			var showLogical = (+(msAll.executors || 1) > 1);

			/* the active card's own detail, which the slot list does not carry:
			   IMSI and the home operator it names, and the PIN state. Only the
			   active slot can have them — an inactive card has no IMSI to read
			   without powering it up. */
			var iName = null;

			if (modem.imsi) {
				var iM = '' + modem.imsi;
				iName = mccmnc.name(iM.substr(0, 3), iM.substr(3, 2)) ||
				        mccmnc.name(iM.substr(0, 3), iM.substr(3, 3));
			}

			/* THREE outcomes, not two. `enabled` is a tri-state: true (the card
			   asks for a PIN at power-up), false (it does not), and NULL —
			   which is MBIM, where the protocol reports the PIN it CURRENTLY
			   requires and therefore cannot say whether one is configured on a
			   card that is already unlocked. Folding null in with false printed
			   "not required" for a card nobody had asked. */
			var pinTxt = modem.sim_block
				? _('blocked — %s').format(modem.sim_block.reason || '?')
				: (modem.pin1
					? (modem.pin1.enabled === true
						? _('required (%d attempts left)').format(modem.pin1.retries != null ? modem.pin1.retries : 3)
						: (modem.pin1.enabled === false
							? _('not required')
							: _('unlocked — this backend does not report whether a PIN is set')))
					: null);

			var slotRows = slots.map(function(sl) {
				return fmt.simSlotCard(sl, {
					operator: sl.active ? iName : null,
					imsi:     sl.active ? modem.imsi : null,
					pin:      sl.active ? pinTxt : null,
					profiles: (sl.is_euicc && sl.active) ? (res[5] || null) : null,
					showLogical: showLogical,
					buttons: (!sl.active && sl.card == 'present') ? [
						E('button', { 'class': 'btn cbi-button cbi-button-apply',
							'style': 'margin-left:.5em',
							'click': ui.createHandlerFn(null, function() {
								if (!confirm(_('Switch to SIM slot %d? The connection will drop and re-establish.').format(sl.physical)))
									return;
								return callSwitchSlot(name, sl.physical);
							}) }, _('Switch now')) ] : [],
				});
			});
			/* Two slots is not two usable SIMs, and the slot list alone does not
			   say which it is. `mode` is stated ONLY when the counts are exact,
			   which today means MBIM SYS_CAPS; over QMI the executor count is a
			   lower bound inferred from logical slots in use, so the most that
			   can be said is a floor. Rendered with "at least" so an inference
			   can never be read as a fact.

			   AND WHEN NEITHER IS AVAILABLE, NOTHING IS SHOWN. Over QMI a single
			   logical slot in use supports no floor at all — a modem with a
			   second radio stack whose other slot is empty looks exactly like a
			   single-stack one — so the daemon returns mode and mode_min both
			   null. That is every QMI dual-slot box with one SIM in it, i.e. the
			   normal case, and it used to render as "not determinable over QMI ·
			   inferred": a row that tells the operator nothing, with a word
			   appended that is wrong twice over, since nothing was inferred.
			   Same rule as the aggregation ratio in docs/gotchas.md — report
			   nothing rather than something that reads as a measurement. */
			var ms = (res[3] || {}).multisim, msNode = null;

			if (ms && (ms.mode || ms.mode_min)) {
				var msTxt = ms.mode
					? (({
						dssa: _('one SIM active at a time (switching)'),
						dsds: _('both registered, one carries data'),
						dsda: _('both usable at once'),
					})[ms.mode] || ms.mode.toUpperCase())
					: _('at least %s').format(ms.mode_min.toUpperCase());

				msNode = E('div', { 'style': 'margin-top:6px;font-size:90%;color:#666' }, [
					E('span', { 'title': ms.exact
						? _('Reported by the modem (MBIM SYS_CAPS).')
						: _('Inferred from how many logical slots are in use. That is a lower bound: a modem with a second radio stack whose other slot is empty looks exactly like a single-stack one, so no definite mode can be stated.') },
						[ msTxt + (ms.exact ? '' : ' · ' + _('inferred')) ]) ]);
			}

			cols.push(E('div', { 'class': 'cbi-section', 'style': 'flex:1;min-width:320px' },
				[ E('h3', {}, _('SIM slots')) ]
					.concat(msNode ? [ msNode ] : [])
					.concat([ E('div', {}, slotRows) ])));
		}

		/* Configuration warnings are NOT rendered here any more: they belong
		   above the graphs, and everything above the graphs has to survive the
		   per-second repaint of this node. The caller owns them now. */
		var out = [];

		out.push(E('div', { 'style': 'display:flex;gap:16px;flex-wrap:wrap' }, cols));

		/* --- active connections (per context) --- */
		var conns = renderConnections(ctxDetails);
		if (conns) out.push(conns);

		/* --- datapath & muxing (aggregation) --- */
		var dpanel = renderDatapath(dpath);
		if (dpanel) out.push(dpanel);

		/* --- carrier aggregation (active carriers) --- unified cell columns --- */
		if (cells.ca && cells.ca.length) {
			out.push(cellTable(_('Carrier aggregation'), cells.ca.map(function(c){
				/* `rat`, not the role string. This tested role.indexOf('NR'),
				   and role is only ever 'PCC' or 'SCC' — so it was never true
				   and every carrier was resolved as an LTE EARFCN. Harmless
				   while the parser dropped 5G rows outright; wrong the moment
				   it stopped, because an NR-ARFCN read as an EARFCN yields a
				   plausible LTE band rather than nothing. */
				var isNR = (c.rat == 'nr' ||
					(c.rat == null && ('' + c.role).toUpperCase().indexOf('NR') >= 0));
				var cf = isNR ? bands.nrArfcn(c.earfcn) : bands.lteEarfcn(c.earfcn);
				return cellRow({
					/* the Fibocom rows already say 'PCC NR'; do not say it twice */
					type: (isNR && ('' + c.role).toUpperCase().indexOf('NR') < 0)
						? (c.role + ' 5G') : c.role,
					/* the modem's own band token wins — it knows n78 from 78 */
					band: (c.band != null) ? c.band : (cf ? cf.band : null),
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
				var fef = bands.lteEarfcn(fr.earfcn);
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
				var nf = (c.arfcn != null) ? bands.nrArfcn(c.arfcn) : null;
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
	/* Only the canvas. The status itself is NOT fetched here: refresh() issues
	   its own callStatus() as soon as the view is rendered, so a second one at
	   load time is a ubus round trip whose result is thrown away — and it was,
	   silently, because nothing read it. */
	load: function() {
		/* the graph canvas: threshold rules only, series drawn by graph.js */
		return request.get(L.resource('wwand/signal.svg')).then(function(r) {
			return r.ok ? r.text() : null;
		}).catch(function() { return null; });
	},

	render: function(svgText) {
		/* deep link from the Modems overview: ?modem=<name> preselects */
		var current = null;
		try { current = new URLSearchParams(window.location.search).get('modem'); } catch(e) {}
		var selWrap = E('span', {});   // filled with a modem selector when >1

		/* THREE PERSISTENT BOXES, then the per-tick one. Everything the poll
		   rebuilds wholesale lives in `live`; the warnings and the graphs sit
		   above it and are updated IN PLACE, because a graph rebuilt every
		   second would lose its ring buffers every second and never draw a
		   line. That constraint is what fixes the page order — warnings, then
		   graphs, then the panels — rather than a preference. */
		var warnBox = E('div', {});
		var graphBox = E('div', {});
		var live = E('div', { 'id': 'wwand-live' }, E('em', {}, _('loading…')));

		/* OUTSIDE `live`, like the graphs and for the same reason: the poll
		   replaces that node wholesale every second, and a log box rebuilt with
		   it would reset its filters and its scroll position once a second. It
		   is also not per-modem — the daemon log is one stream, and the modem
		   filter inside it is what narrows it. */
		var logBox = logbox.create();

		/* One graph instance PER MODEM, kept across selector changes so coming
		   back to a modem still shows the window it had. Only the selected one
		   is fed (that is the only modem the page fetches signal for), so an
		   unwatched modem's line has a real gap rather than an invented one.

		   Instances are NOT evicted when a modem leaves the status reply, and
		   that is deliberate: a modem vanishing for a few seconds — a reset, a
		   re-enumeration, the very events worth having history across — would
		   otherwise take its history with it. The cost is one detached SVG per
		   modem name seen since the page loaded, which is bounded by how many
		   modems a box has. */
		var graphs = {};

		function showGraphs(name) {
			/* The canvas asset is fetched once in load(). If that failed there
			   are no graphs for the life of the page — say why, once, instead
			   of leaving a gap where they should be and letting the reader
			   wonder whether the modem is reporting nothing. */
			if (!svgText) {
				if (graphBox._for !== '_nosvg') {
					graphBox._for = '_nosvg';
					dom.content(graphBox, E('em', { 'style': 'color:#666' },
						[ _('Signal graphs unavailable: the graph canvas (wwand/signal.svg) could not be loaded. Reload the page to try again.') ]));
				}

				return null;
			}

			if (graphBox._for === name)
				return graphs[name];

			graphBox._for = name;
			graphs[name] = graphs[name] || graph.create(svgText);
			dom.content(graphBox, graphs[name].node);

			return graphs[name];
		}

		/* Warnings change rarely; rebuilding them every second would drop any
		   text selection and flicker. Compare a signature first, like the
		   selector does. */
		function showWarnings(modem) {
			var w = (modem || {}).config_warnings;
			var sig = JSON.stringify(w || null);

			if (sig === warnBox._sig)
				return;

			warnBox._sig = sig;
			dom.content(warnBox, renderWarnings(w) || '');
		}

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
				'change': function(ev){ current = ev.target.value; refresh(); } },
				names.map(function(n){
					var m = ms[n];
					return E('option', { 'value': n,
						'selected': (n == current) ? 'selected' : null },
						[ '%s (%s)'.format(m.netdev || n, m.model || '?') ]);
				}));
			dom.content(selWrap, [ _('Modem') + ': ', sel ]);
		}

		/* the poll must never die or pile up: skip a tick while the previous one
		   is still in flight, and swallow (but log) render errors — one bad
		   payload may skip a repaint but must not freeze the page for good */
		function refresh() {
			if (refresh._busy) return;
			refresh._busy = true;
			var done = function() { refresh._busy = false; };
			/* statusRaw, not status: the same single call, but the whole reply.
			   The board block hangs off the top level and the Hardware step row
			   needs it to tell "this board has no power line" from "wwand has
			   no profile for this board" — two very different things to be told
			   when your modem will not come back. */
			return callStatus().then(function(st) {
				st = st || {};
				var ms = st.modems || {};
				var names = Object.keys(ms);
				var el = document.getElementById('wwand-live');
				if (!el) return;

				if (!names.length) {
					current = null;
					dom.content(selWrap, '');
					dom.content(warnBox, ''); warnBox._sig = null;
					dom.content(graphBox, ''); graphBox._for = null;
					dom.content(el, E('em', {}, _('wwand is not running or no modem present yet.')));
					return;
				}

				if (!current || !ms[current]) current = names[0];
				buildSelector(ms);
				showWarnings(ms[current]);

				/* the log follows the modem this page is showing; it ignores a
				   repeat, so a reader who set the filter by hand keeps it until
				   the page's own selection moves */
				logBox.selectModem(current);

				/* Remember WHICH modem this render is for. renderLive() is
				   asynchronous (five ubus calls deep), and a selector change
				   during that window returns early from its own refresh()
				   because this one is still busy — so without the check below
				   the in-flight result lands after the change and paints the
				   old modem's panels beneath the new modem's name. Discard it
				   and let the next tick, a second away, render the right one. */
				var want = current;

				return renderLive(want, ms[want], showGraphs(want), st.board).then(function(node){
					var e2 = document.getElementById('wwand-live');
					if (e2 && current === want) dom.content(e2, node);
				});
			}).then(done, function(e) {
				done();
				if (window.console && console.error)
					console.error('wwand status render failed:', e);
			});
		}

		poll.add(refresh, 1);
		refresh();

		return E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, _('Modem Status')),
			E('div', { 'class': 'cbi-map-descr' },
				_('Live cellular signal and cell environment — updates about once per second. Aim the antenna for the highest RSRP / SINR: the graphs keep the last few minutes in the browser, so you can see what turning it did. The history is not stored on the router and starts empty after a reload.')),
			E('div', { 'class': 'cbi-section', 'style': 'display:flex;gap:12px;align-items:center' },
				[ selWrap ]),
			warnBox,
			graphBox,
			live,
			logBox.node
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
