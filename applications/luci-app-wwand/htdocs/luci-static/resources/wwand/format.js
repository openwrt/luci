'use strict';
'require baseclass';
'require ui';

/* Shared formatting/rendering helpers for the wwand LuCI packages (status
   page, settings page, Modems overview and the proto handler). Single source
   so the value formatters and the small table/warning renderers are not
   copy-pasted across resources. */

/* Shared panel/banner/spinner/progress CSS for the wwand panels (eSIM steps,
   scan banners). Kept here — the single cross-panel rendering home — so the
   esim and netsel modules do not each emit their own <style> (which the
   settings page, rendering both, injected twice) and netsel need not depend on
   esim for a string. The owning view injects it once via injectStyle(). */
var WWE_CSS = '' +
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

return baseclass.extend({
	/* the shared .wwe-* stylesheet as a <style> node; the page that hosts the
	   wwand panels renders this once (see view/wwand/settings.js). */
	injectStyle: function() { return E('style', {}, WWE_CSS); },

	fmtList: function(a) { return (a && a.length) ? a.join(', ') : '—'; },

	/* a technical term with a mouse-over explanation: dotted underline +
	   help cursor signal that hovering reveals the description (title attr) */
	term: function(label, desc) {
		return E('span', { 'title': desc,
			'style': 'cursor:help;text-decoration:underline dotted;text-underline-offset:2px' },
			label);
	},

	/* MNC as a zero-padded code: the leading zero is significant (260/06 is not
	   260/6). QMI hands us a bare integer (digit count lost), so pad to 2 digits
	   minimum; genuine 3-digit MNCs (>=100) keep all three. */
	fmtMnc: function(mnc) {
		if (mnc == null || mnc === '')
			return '?';
		return '%02d'.format(+mnc);
	},

	/* "mcc/mnc", or '?' when the modem gave neither. JavaScript turns a missing
	   half into the literal string "null" under concatenation, which is how the
	   scan table came to show a mysterious "null" (#6) — and a plain guard at
	   one call site would only have moved the problem to the next one, so the
	   pair is formatted in exactly one place. */
	fmtPlmn: function(mcc, mnc) {
		if (mcc == null && mnc == null)
			return '?';

		return '%s/%s'.format(mcc != null ? mcc : '?', this.fmtMnc(mnc));
	},

	/* registered operator line — "Name (mcc/mnc) · roaming" — from the modem's
	   `registration` block; shared by the status page and the proto handler */
	fmtOperator: function(reg) {
		var plmn = reg && reg.plmn;
		if (!plmn)
			return null;

		/* Two shapes reach this: QMI reports mcc/mnc separately, MBIM reports
		   one concatenated ProviderId ("26006"). The daemon emits both from
		   1.6.2 on, but an older one on a newer UI (or the reverse) is exactly
		   the pairing users run, and reading only mcc/mnc printed
		   "PLAY (undefined/undefined)" — reported as a missing operator.
		   Fall back to the raw id, split the same way the daemon does. */
		var mcc = plmn.mcc, mnc = plmn.mnc;

		if ((mcc == null || mnc == null) && /^[0-9]{5,6}$/.test('' + (plmn.id || ''))) {
			mcc = ('' + plmn.id).substr(0, 3);
			mnc = ('' + plmn.id).substr(3);
		}

		var name = (plmn.description || '').trim();
		var pair = (mcc != null && mnc != null)
			? ' (%s/%s)'.format(mcc, this.fmtMnc(mnc)) : '';

		/* neither a name nor an id would otherwise render as a bare "()" */
		if (!name && !pair)
			return null;

		return '%s%s%s'.format(name, pair,
			(reg && reg.roaming) ? ' \u00b7 ' + _('roaming') : '');
	},

	/* one SIM-slot row (status page + SIM/eSIM tools panel): identity line
	   plus a "Switch now" button on an inactive present slot. `extras` =
	   page-specific buttons rendered before it (e.g. "Set as primary");
	   `onSwitch(physical)` runs after the shared confirm. */
	/* A 20-digit ICCID or a 32-digit EID printed as one run cannot be checked
	   against the number on the card in your hand — which is the only thing
	   anyone ever does with it. Grouped in fours, and in a monospace run so the
	   groups line up between slots. */
	groupDigits: function(v) {
		return ('' + v).replace(/(.{4})/g, '$1 ').trim();
	},

	digits: function(v) {
		return E('span', { 'style': 'font-family:monospace' }, [ this.groupDigits(v) ]);
	},

	/* One slot, as a labelled block rather than a comma-separated sentence.
	   What it used to print was
	     Slot 2 (eSIM) — present, ICCID 8988…95, EID 8903…64 [Switch now]
	   which is every fact the panel had, in prose, with the two longest numbers
	   in the tree jammed into the middle of it — and, on an eUICC, no mention of
	   the profiles, which is the whole question you have about an eSIM. The card
	   on the Chateau carries four.

	   `live` is the active card's detail (imsi/operator/pin), which only the
	   caller can supply and only for the ACTIVE slot: an inactive card has no
	   IMSI to read and no PIN state to report without powering it up, so those
	   rows are simply absent there rather than guessed at.

	   `profiles` is the eUICC's profile list, likewise only readable while that
	   eUICC is the active card — the APDU channel runs through the active slot.
	   Said in those words when it cannot be read, because "no profiles" and
	   "cannot look from here" are different statements. */
	simSlotCard: function(sl, o) {
		o = o || {};

		var rows = [];
		var kind = sl.is_euicc ? _('eUICC (eSIM)') : _('SIM card');
		var head = [
			E('strong', {}, [ _('Slot %d').format(sl.physical) ]),
			' \u00b7 ' + kind,
		];

		if (sl.active)
			head.push(E('span', { 'style': 'margin-left:.5em;padding:0 .4em;border-radius:3px;'
				+ 'background:#2c8a2c;color:#fff;font-size:85%' }, [ _('active') ]));
		else if (sl.card != 'present')
			head.push(E('span', { 'style': 'margin-left:.5em;color:#888;font-size:85%' }, [ _('empty') ]));

		(o.buttons || []).forEach(function(b) { head.push(b); });

		if (sl.card == 'present') {
			if (o.operator)
				rows.push([ _('Operator'), o.operator ]);

			if (sl.iccid)
				rows.push([ 'ICCID', this.digits(sl.iccid) ]);

			if (sl.eid)
				rows.push([ 'EID', this.digits(sl.eid) ]);

			if (o.imsi)
				rows.push([ 'IMSI', E('span', { 'style': 'font-family:monospace' }, [ o.imsi ]) ]);

			if (o.pin)
				rows.push([ _('PIN'), o.pin ]);

			/* the per-slot surface some AT modems expose (ESLOTSINFO-class):
			   the INACTIVE slot's PIN and service state is exactly what decides
			   whether switching to it is worth trying */
			if (sl.cpin)    rows.push([ _('PIN state'), this.cpinText(sl.cpin) ]);
			if (sl.service) rows.push([ _('Service'), sl.service ]);
			if (sl.atr)     rows.push([ 'ATR', E('span', { 'style': 'font-family:monospace' }, [ sl.atr ]) ]);

			/* which radio stack this slot is wired to — noise on a box with one,
			   and the whole point on a box with two */
			if (o.showLogical && sl.logical_slot != null)
				rows.push([ _('Radio stack'), '' + sl.logical_slot ]);
		}

		var body = rows.map(function(r) {
			return E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td', 'style': 'width:7em;color:#888' }, [ r[0] ]),
				E('td', { 'class': 'td' }, [ r[1] ]),
			]);
		});

		var out = [ E('div', { 'style': 'margin-bottom:2px' }, head) ];

		if (body.length)
			out.push(E('table', { 'class': 'table', 'style': 'margin:0 0 .4em .8em' }, body));

		if (sl.is_euicc && sl.card == 'present')
			out.push(this.esimProfileList(o.profiles, sl.active));

		return E('div', { 'style': 'margin-bottom:.8em' }, out);
	},

	/* +CPIN state -> words. The modem's own vocabulary is what the slot read
	   returns, and printing `EMPTY_EUICC` under a row labelled "PIN state" tells
	   a reader neither what it means nor that it is not about a PIN at all — it
	   means the eUICC carries no profile, which is the single most useful thing
	   that row can say about an empty eSIM. An unknown token is passed through:
	   a state this table has not met is still better read than hidden. */
	cpinText: function(v) {
		const CPIN = {
			'READY':        _('unlocked'),
			'SIM PIN':      _('PIN required'),
			'SIM PUK':      _('PUK required — the PIN is blocked'),
			'SIM PIN2':     _('PIN2 required'),
			'SIM PUK2':     _('PUK2 required'),
			'PH-NET PIN':   _('network lock (SIM not accepted by this modem)'),
			'EMPTY_EUICC':  _('eUICC with no profile installed'),
			'NOT_INSERTED': _('no card'),
		};

		return CPIN[('' + v).toUpperCase()] || v;
	},

	/* The profiles on an eUICC. `list` null = not read (see simSlotCard). */
	esimProfileList: function(list, active) {
		if (list == null)
			return E('div', { 'style': 'margin-left:.8em;font-size:90%;color:#888' },
				[ active ? _('Profiles: not read')
					: _('Profiles are readable only while this slot is the active one') ]);

		if (!list.length)
			return E('div', { 'style': 'margin-left:.8em;font-size:90%;color:#888' },
				[ _('No profiles installed') ]);

		var self = this;
		var rows = list.map(function(p) {
			var on = (p.state == 'enabled');
			/* arrays, not bare strings: a profile name comes off the CARD and
			   dom.append() would route a bare string through innerHTML
			   (luci.js:1394-96) */
			var label = p.provider || p.name || p.nickname || _('(unnamed)');
			var nick = (p.nickname && p.nickname != label) ? (' \u201c' + p.nickname + '\u201d') : '';

			return E('tr', { 'class': 'tr', 'style': on ? 'font-weight:600' : 'opacity:.75' }, [
				E('td', { 'class': 'td', 'style': 'width:1.2em' }, [ on ? '\u25cf' : '' ]),
				E('td', { 'class': 'td' }, [ label + nick ]),
				E('td', { 'class': 'td', 'style': 'width:6em' }, [ on ? _('enabled') : (p.state || '') ]),
				E('td', { 'class': 'td', 'style': 'font-family:monospace' },
					[ p.iccid ? self.groupDigits(p.iccid) : '' ]),
			]);
		});

		return E('div', { 'style': 'margin-left:.8em' }, [
			E('div', { 'style': 'font-size:90%;color:#888' },
				[ _('Profiles (%d)').format(list.length) ]),
			E('table', { 'class': 'table', 'style': 'margin:0' }, rows),
		]);
	},

	/* the old single-line renderer, kept for the eSIM page's slot list until it
	   moves over too — status.js uses simSlotCard */
	simSlotRow: function(sl, onSwitch, extras) {
		var line = [
			E('strong', {}, [ _('Slot %d').format(sl.physical) +
				(sl.is_euicc ? ' (eSIM)' : '') + (sl.active ? ' \u2713' : '') ]),
			' \u2014 ' + sl.card + (sl.iccid ? (', ICCID ' + sl.iccid) : '') +
				(sl.eid ? (', EID ' + sl.eid) : '') +
				/* per-slot CPIN/service/ATR (ESLOTSINFO-class slots surface) —
				   the inactive slot's PIN and service state matter when deciding
				   to switch to it */
				(sl.cpin ? (', ' + sl.cpin) : '') +
				(sl.service ? (', ' + sl.service) : '') +
				(sl.atr ? (', ATR ' + sl.atr) : '')
		];
		(extras || []).forEach(function(b) { line.push(b); });
		if (!sl.active && sl.card == 'present' && onSwitch)
			line.push(E('button', { 'class': 'btn cbi-button cbi-button-apply',
				'style': 'margin-left:4px',
				'click': ui.createHandlerFn(null, function() {
					if (!confirm(_('Switch to SIM slot %d? The connection will drop and re-establish.').format(sl.physical)))
						return;
					return onSwitch(sl.physical);
				}) }, _('Switch now')));
		return E('div', { 'style': 'margin-bottom:4px' }, line);
	},

	fmtBytes: function(n) {
		if (n == null) return '—';
		var u = ['B','KB','MB','GB','TB'], i = 0;
		while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
		return (i ? n.toFixed(2) : n) + ' ' + u[i];
	},

	fmtDur: function(s) {
		if (s == null) return '—';
		var d = Math.floor(s/86400); s -= d*86400;
		var h = Math.floor(s/3600);  s -= h*3600;
		var m = Math.floor(s/60),  sec = s - m*60;
		if (d) return '%dd %dh %dm'.format(d, h, m);
		if (h) return '%dh %dm'.format(h, m);
		if (m) return '%dm %ds'.format(m, sec);
		return '%ds'.format(sec);
	},

	fmtRate: function(bps) {
		if (bps == null || bps <= 0) return '—';
		return (bps >= 1e9) ? (bps/1e9).toFixed(2) + ' Gbps' : (bps/1e6).toFixed(1) + ' Mbps';
	},

	dBm: function(v) { return (v != null) ? (v / 10).toFixed(1) + ' dBm' : null; },
	dB:  function(v) { return (v != null) ? (v / 10).toFixed(1) + ' dB' : null; },

	/* signal values use -32768 as the "not measured" sentinel */
	hasSignal: function(v) { return v != null && v > -32768; },

	/* The plotted series out of one modem_signal reply, grouped by QUANTITY:
	     rsrp = [ RSRP LTE, RSRP 5G, RSCP 3G ]                  dBm
	     rssi = [ RSSI LTE, RSSI 3G, RSSI 2G, RSSI untagged ]   dBm
	     sinr = [ LTE, 5G ]                          dB
	     rsrq = [ LTE, 5G ]                          dB
	     ecio = [ 3G ]                               dB
	   Each group gets its own canvas, because each is graded by its own
	   thresholds — SINR, RSRQ and Ec/Io are all in dB and mean entirely
	   different things, so sharing an axis would have one judged by another's
	   rules. Sharing a unit is not sharing a scale.

	   ONE SERIES PER RAT within a group, never one line that changes meaning.
	   A modem flapping between 4G and 5G would otherwise draw a trace that is
	   sometimes the LTE anchor and sometimes the NR carrier, with nothing saying
	   where it switched — and on EN-DC both arrive in the SAME reply and differ
	   a lot (LTE -94 dBm beside 5G -106, observed on an RG502Q, 2026-09-10). A
	   gap in the 5G line is then the useful information: 5G was not serving.
	   The same argument covers a modem falling back to 3G or 2G, which is
	   precisely the event worth seeing on a graph.

	   THE 2G/3G STRENGTH MEASURES ARE NOT RSRP and are not graded like it. RSCP
	   is the 3G equivalent of RSRP — the serving cell's own pilot — so it sits
	   with them. RSSI does not: it is the whole band, its ladder is 20 dB higher
	   (-65/-75/-85 against -80/-90/-100), and a strong signal reaches -46 dBm,
	   which is off the top of any scale drawn for RSRP. Sharing the canvas
	   pinned it to the ceiling where it carried no information at all
	   (HW-observed, ddimension/wwand#14, 2026-09-11).

	   RSSI KEEPS ITS RAT. The daemon reports rssi in up to four places, and only
	   the top-level one is genuinely RAT-less (the AT+CSQ floor a NAS 1.0 stack
	   falls back to — HW-seen on the E182E). `lte.rssi`, `wcdma.rssi` and
	   `gsm_rssi` all say which radio measured them. An earlier cut collapsed
	   them with `sig.rssi ?? lte.rssi` into one line labelled plainly "RSSI",
	   which meant that on any modem without a top-level value — the RM520N-GL,
	   for one — the RAT-less line WAS the LTE line and did not say so. Each RAT
	   now carries its own, and RSCP is not folded in either: RSCP and RSSI are
	   different measures of 3G strength and a series must not change which one
	   it means. The untagged line appears only when the reply really is
	   untagged, which is exactly when there is no better answer — a modem that
	   reports BOTH forms gets one line, the tagged one, because the second
	   would be the same measurement drawn again without its radio.

	   UNIT TRAPS, all three of them real:
	     - `snr` arrives in TENTHS of a dB from every backend.
	     - NR RSRQ is NOT inside `nr5g`: QMI NAS Get Signal Info carries NR
	       RSRP/SNR in TLV 0x17 and RSRQ in TLV 0x18 of its own, so the reply has
	       a top-level `nr5g_rsrq` (codec/schema/nas.uc:110-113, libqmi 1.38).
	     - 3G Ec/Io is `ecio` from the QMI and ^HCSQ paths and `ecno` from
	       +CESQ (atcmd_parse.uc:307,356) — the same measure under two names.

	   A missing value stays null and must NOT become 0: on a dBm scale a zero is
	   off the top, and a gap has to read as "not reported", never as a reading. */
	signalSample: function(sig) {
		sig = sig || {};

		let lte = sig.lte || {};
		let nr = sig.nr5g || {};
		let wcdma = sig.wcdma || {};
		let num = (v) => this.hasSignal(v) ? v : null;
		let snr = (v) => this.hasSignal(v) ? v / 10 : null;

		/* The untagged slot is a LAST RESORT, not an extra line. Several modems
		   report the same measurement twice — the FM350-GL sends rssi -101 and
		   lte.rssi -101, the E3372 sends -85 and -86 (both HW-observed
		   2026-09-10) — and drawing both gave a duplicate line whose only
		   distinction was claiming to have no radio behind it. It appears when,
		   and only when, nothing tagged is on offer: that is the E182E on a
		   NAS 1.0 stack, whose AT+CSQ floor really is all there is. */
		const tagged = num(lte.rssi) ?? num(wcdma.rssi) ?? num(sig.gsm_rssi);

		return {
			rsrp: [ num(lte.rsrp), num(nr.rsrp), num(wcdma.rscp) ],
			rssi: [ num(lte.rssi), num(wcdma.rssi), num(sig.gsm_rssi),
			        (tagged != null) ? null : num(sig.rssi) ],
			sinr: [ snr(lte.snr), snr(nr.snr) ],
			rsrq: [ num(lte.rsrq), num(nr.rsrq) ?? num(sig.nr5g_rsrq) ],
			ecio: [ num(wcdma.ecio) ?? num(wcdma.ecno) ],
		};
	},

	/* carrierSample(cells): the aggregation picture, per RAT, for the two count
	   canvases — [ LTE, 5G NR ] in the same order as their SERIES.

	   BOTH LEGS ARE COUNTED. Under EN-DC the modem aggregates an LTE anchor and
	   one or more 5G carriers, and the carrier list carries a row for each with
	   its own band token, so `rat` separates them. An entry without one is the
	   QMI carrier-aggregation message, which is LTE by construction.

	   AN SCC THAT IS NOT ACTIVATED IS NOT A CARRIER. QMI reports a secondary
	   cell's QmiNasScellState (0 deconfigured, 1 deactivated, 2 activated) and
	   a deconfigured one still appears in the list; counting it would show
	   3-carrier aggregation on a link carrying one. A row with no state is the
	   AT path, which lists only what is in use.

	   NO CARRIER LIST IS NOT NO CARRIER. A modem that answers neither query
	   still has a serving cell, and drawing zero there would read as a dead
	   link. The serving cell supplies the floor — but only for a leg that is
	   actually serving: a 5G-capable modem parked on LTE still reports the
	   neighbouring NR band it can see (HW-observed on an RG502QEA, 2026-09-12:
	   serving.nr band n1 while dsd said mode LTE, nr false), and taking that as
	   a carrier would draw a 5G line for a leg carrying nothing. `dsd.nr` is
	   the thing that says the 5G leg is up. */
	carrierSample: function(cells) {
		cells = cells || {};

		var ca = Array.isArray(cells.ca) ? cells.ca : [];
		var srv = cells.serving || {};
		var dsd = cells.dsd || {};
		var n = { lte: 0, nr: 0 };
		var bw = { lte: 0, nr: 0 };
		var haveBw = { lte: false, nr: false };

		for (var i = 0; i < ca.length; i++) {
			var c = ca[i];
			/* `rat` where the producer sets it; the role text is the fallback,
			   because the Fibocom telemetry has said 'PCC NR' in the role since
			   before there was a `rat` field and an installed base still
			   answers that way (found on a WH3000 Pro, 2026-09-12). Same
			   two-step in the collectd feed, deliberately. */
			var rat = (c.rat == 'nr' ||
				(c.rat == null && ('' + c.role).toUpperCase().indexOf('NR') >= 0))
				? 'nr' : 'lte';

			if (c.role == 'SCC' && c.state != null && c.state != 2)
				continue;

			n[rat]++;

			if (c.bandwidth_mhz != null) { bw[rat] += c.bandwidth_mhz; haveBw[rat] = true; }
		}

		if (!n.lte && srv.lte) {
			n.lte = 1;

			if (srv.lte.bandwidth_mhz != null) { bw.lte = srv.lte.bandwidth_mhz; haveBw.lte = true; }
		}

		if (!n.nr && srv.nr && dsd.nr) {
			n.nr = 1;

			if (srv.nr.bandwidth_mhz != null) { bw.nr = srv.nr.bandwidth_mhz; haveBw.nr = true; }
		}

		return {
			ca: [ n.lte || null, n.nr || null ],
			bw: [ haveBw.lte ? bw.lte : null, haveBw.nr ? bw.nr : null ],
		};
	},

	/* What to say when there is no signal detail at all. The old text asserted
	   "modem not registered" whenever RSRP was missing, which is a different
	   claim entirely — and one the Serving cell panel beside it contradicted on
	   screen, saying `registered` for the same modem. Registration comes from
	   the registration block, the same source regShort() uses. */
	signalNone: function(reg) {
		return (reg && reg.registration == 1)
			? _('registered — this modem reports no signal detail')
			: _('no signal (modem not registered)');
	},

	/* frequency in MHz (plain number, NOT tenths) -> "1234.5 MHz" */
	mhz: function(v) { return (v != null) ? v.toFixed(1) + ' MHz' : null; },

	/* one-word registration state for status rows/columns */
	regShort: function(reg) {
		return (reg && reg.registration == 1) ? _('registered') : _('searching');
	},

	/* two-column label/value table; widthPercent = width of the label column
	   (default 30 — the proto handler uses 33). */
	/* Values go in as one-element ARRAYS, and that is load-bearing rather than
	   style: dom.append() assigns a bare string through innerHTML
	   (luci.js:1394-1396) and only turns an array element into a createTextNode
	   (:1382-1383). Half the rows this renders are strings the MODEM supplied —
	   manufacturer, model, firmware, revision (QMI DMS / AT CGMI/CGMM/CGMR) —
	   or the network did, and none of that is ours to trust with markup. An
	   element passed as a value still appends as itself (:1380-1381), so the
	   rows that build their own nodes are unaffected. */
	tbl: function(rows, widthPercent) {
		var w = (widthPercent || 30) + '%';
		return E('table', { 'class': 'table' }, rows.map(function(r) {
			return E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td left', 'width': w }, [ r[0] ]),
				E('td', { 'class': 'td left' }, [ r[1] ]) ]);
		}));
	},

	/* status().config_warnings for a modem (added by the daemon). Absent/empty
	   -> null so nothing is rendered. Inline-styled — no external CSS needed. */
	renderWarnings: function(warns) {
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
					/* arrays throughout: check/message/details are daemon strings
					   and carry expected/actual values read off the modem */
					E('div', {}, [ w.check ? E('strong', {}, [ w.check + ': ' ]) : '', w.message || '' ]),
					det.length ? E('div', { 'style': 'opacity:.85;font-size:.9em;margin-top:2px' },
						[ det.join(' · ') ]) : '' ]) ]);
		});
		return E('div', { 'class': 'cbi-section' },
			[ E('h3', {}, _('Configuration warnings')) ].concat(items));
	},

	/* Canonical COMPACT one-line mappings of a modem-info object's
	   registration / SIM state (as used by the Modems overview table). The
	   status page and the proto handler render richer views on purpose and do
	   not use these. */
	fmtRegistration: function(mi) {
		var reg = mi && mi.registration;

		if (!reg)
			return '-';

		if (reg.registration == 1) {
			/* same two shapes as fmtOperator; prefer the name, then either
			   spelling of the numeric id, and only then the generic word.
			   BOTH halves are guarded: '%02d'.format(null) is
			   Math.floor(+null || 0) -> "00" (cbi.js:753-754), so guarding only
			   mcc renders a real-looking 260/00 for a half-populated plmn
			   instead of falling through to plmn.id. fmtOperator in this file
			   already guards both; this one did not. */
			var op = (reg.plmn && (reg.plmn.description ||
				((reg.plmn.mcc != null && reg.plmn.mnc != null)
					? '%d/%02d'.format(reg.plmn.mcc, reg.plmn.mnc) : null) ||
				reg.plmn.id)) || _('registered');
			return op + (reg.roaming ? ' ' + _('(roaming)') : '');
		}

		var det = mi.registration_detail;

		if (det && det.reject_text)
			return _('rejected: %s').format(det.reject_text);

		return _('searching…');
	},

	/* The SIM column of the modem list. `slots` is the modem_sim_slots reply
	   when the caller has one — the readiness word alone answered "can this
	   modem use its card", which is worth knowing and is not the question
	   anybody actually has on a box with two slots or an eSIM in one of them.
	   Optional, because the column still has to render when the read failed
	   (an E392 answers sim_transport/unsupported) — then it says exactly what
	   it said before rather than inventing a slot number. */
	fmtSim: function(mi, slots) {
		var base = this.fmtSimState(mi);
		var where = this.fmtSimWhere(slots);

		if (!where)
			return base;

		/* "- · Slot 1/2 · eSIM" is what happens when the readiness word is the
		   placeholder: a dash means "nothing to report", and leading with it in
		   front of two things that ARE reported reads as an error. Seen on an
		   MBIM box (RM520N-GL) whose status carries no pin1, which is the only
		   input fmtSimState has left once the card is neither blocked, busy nor
		   annotated. Where there is something to say, say it. */
		return (base == '-') ? where : (base + ' \u00b7 ' + where);
	},

	/* which slot is live, and what kind of card is in it — the half the state
	   word cannot carry. Silent on a single-slot box with an ordinary SIM,
	   where there is nothing to choose between and nothing to say. */
	fmtSimWhere: function(slots) {
		var list = (slots && Array.isArray(slots.slots)) ? slots.slots : null;

		if (!list || !list.length)
			return null;

		var act = null;

		for (var i = 0; i < list.length; i++)
			if (list[i].active) { act = list[i]; break; }

		if (!act)
			return null;

		var parts = [];

		if (list.length > 1)
			parts.push(_('Slot %d/%d').format(act.physical, list.length));

		if (act.is_euicc)
			parts.push('eSIM');

		return parts.length ? parts.join(' \u00b7 ') : null;
	},

	fmtSimState: function(mi) {
		if (!mi)
			return '-';

		if (mi.sim_block)
			return _('blocked (%s)').format(mi.sim_block.reason || '?');

		if (mi.state == 'WAITING_MODEM' || mi.state == 'UNRESOLVED')
			return '-';

		/* What the CARD last said about itself, ahead of the PIN state. The
		   daemon learns these from the UIM indications (session closed and why,
		   an internal recovery, an activation that failed); before it did, a
		   card that had been REMOVED still read "ready" here, because pin1 was
		   the last thing we knew and nothing had contradicted it. */
		if (mi.sim_busy)
			return _('busy (reads failing)');

		if (mi.sim_note)
			return mi.sim_note;

		if (mi.pin1)
			return mi.pin1.enabled ? _('ready, PIN enabled') : _('ready');

		return '-';
	},

	/* Cell/frequency lock read-back, shared by the status page and the cell-lock
	   editor so the two cannot drift. `locks` is the daemon's shape:
	     { lte: { enabled, values: [earfcn, pci, ...] },
	       nr5g: { enabled, values: [pci, arfcn, scs, band, ...] } }
	   Rendered in the same colon spelling the lock editor accepts, instead of
	   the raw JSON both call sites used to print at the user. A lock that is
	   present but DISARMED is omitted — "locked to" should not list something
	   the modem is not locked to. Returns null when nothing is armed. */
	fmtLocks: function(locks) {
		if (!locks)
			return null;

		var out = [];

		var group = function(l, width, label) {
			/* loose on purpose: the daemon emits a real boolean today, but an
			   `enabled: 0` from a future producer must skip too. A lock with no
			   `enabled` key at all still renders — that is the `{ lte: true }`
			   shape the fallback loop below tolerates. */
			if (!l || (l.enabled != null && !l.enabled))
				return;

			/* The payload can arrive in more shapes than { values: [...] }.
			   Reading only `l.values` would render every other shape as a bare
			   "armed" and silently drop what the lock actually holds — the
			   opposite of what the fallback loop below promises. `true` stays
			   payload-free on purpose: it IS the "armed, no detail" spelling. */
			var v;

			if (l === true)
				v = [];
			else if (Array.isArray(l))
				v = l;                           /* the payload IS the array */
			else if (typeof l != 'object')
				v = [ l ];                       /* scalar: the value itself */
			else if (Array.isArray(l.values))
				v = l.values;                    /* lte/nr5g and anything like them */
			else if (l.values != null)
				v = [ l.values ];                /* a lone non-array value */
			else {
				v = Object.keys(l).filter(function(kk) { return kk != 'enabled'; })
				          .map(function(kk) { return '%s=%s'.format(kk, l[kk]); });
				width = 0;                       /* k=v pairs are not positional */
			}

			var items = [];

			if (width && v.length && v.length % width == 0)
				for (var i = 0; i < v.length; i += width)
					items.push(v.slice(i, i + width).join(':'));
			else if (v.length)
				items.push(v.join(', '));

			out.push(items.length ? '%s %s'.format(label, items.join(', '))
			                      : '%s %s'.format(label, _('armed')));
		};

		/* RAT acronyms are literals everywhere else in this package (settings.js
		   MODE_BITS, netsel.js, status.js) — keep them out of the .pot */
		group(locks.lte, 2, 'LTE');
		group(locks.nr5g, 4, 'NR5G');

		/* anything the daemon grows later is shown rather than silently
		   dropped, just without a specific spelling. Routed through group()
		   like the two known keys: a bare `locks[k] !== false` test would
		   catch only a literal false and let { enabled: false, values: [] } —
		   the exact shape the daemon already uses for lte/nr5g — through as
		   raw JSON, disarmed and all, contradicting the rule stated above. */
		for (var k in locks)
			if (k != 'lte' && k != 'nr5g')
				group(locks[k], 0, k);

		return out.length ? out.join(' \u00b7 ') : null;
	}
});
