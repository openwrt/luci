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
	   260/6, and 310/030 is not 310/30 — different operators).

	   `digits` IS THE WHOLE POINT, and nothing here passed it. A bare integer
	   cannot say whether 30 is two digits or three, so padding to a fixed two
	   rendered 310/030 as 310/30 everywhere: operator line, scan table, PLMN
	   editor. The daemon sends `mnc_digits` for exactly this — it takes it from
	   the QMI PCS-digit TLVs and from the quoted PLMN id in an AT scan — and
	   wwandctl_fmt.uc:29-34 has consumed it all along. Bound to 2 or 3 the same
	   way: those are the only lengths 3GPP defines and the value comes over
	   ubus. Found by a full review, 2026-09-19. */
	fmtMnc: function(mnc, digits) {
		if (mnc == null || mnc === '')
			return '?';

		var w = (digits == 3 || digits == 2) ? digits : ((+mnc >= 100) ? 3 : 2);
		var out = String(+mnc);   /* not '%d'.format: the padding is below */

		while (out.length < w)
			out = '0' + out;

		return out;
	},

	/* "mcc/mnc", or '?' when the modem gave neither. JavaScript turns a missing
	   half into the literal string "null" under concatenation, which is how the
	   scan table came to show a mysterious "null" (#6) — and a plain guard at
	   one call site would only have moved the problem to the next one, so the
	   pair is formatted in exactly one place. */
	fmtPlmn: function(mcc, mnc, digits) {
		if (mcc == null && mnc == null)
			return '?';

		return '%s/%s'.format(mcc != null ? mcc : '?', this.fmtMnc(mnc, digits));
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
		var mcc = plmn.mcc, mnc = plmn.mnc, digits = plmn.mnc_digits;

		if ((mcc == null || mnc == null) && /^[0-9]{5,6}$/.test('' + (plmn.id || ''))) {
			mcc = ('' + plmn.id).substr(0, 3);
			mnc = ('' + plmn.id).substr(3);
			/* the raw id states the width by how long its MNC half is — the
			   one place that needs no mnc_digits to know */
			digits = mnc.length;
		}

		var name = (plmn.description || '').trim();
		var pair = (mcc != null && mnc != null)
			? ' (%s/%s)'.format(mcc, this.fmtMnc(mnc, digits)) : '';

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


	/* COLLAPSE A SCAN to one entry per operator. A scan lists the same PLMN
	   once per supported RAT, so the raw list is 2-4 rows deep per operator;
	   this keeps the strongest status and UNIONs the technologies, writing the
	   union to `_rats`.

	   THE MNC WIDTH IS PART OF THE IDENTITY. 310/030 and 310/30 are two
	   operators — that is the whole reason the daemon carries `mnc_digits`
	   beside the number, and why the rows render with it. Keying the collapse
	   on the bare value merged them into one row that inherited the other's
	   status and technologies, so one of the two disappeared from the list it
	   exists to be chosen from. It lives here, rather than inline in the view,
	   because it is a decision about data and this is where such decisions get
	   a test. Found by review, 2026-09-20. */
	collapseScan: function(ops) {
		var rank = { current: 3, available: 2, forbidden: 1 };
		var byPlmn = {}, order = [];

		(ops || []).forEach(function(op) {
			var key = op.mcc + '/' + op.mnc + '/' + (op.mnc_digits || 0);
			var prev = byPlmn[key];

			if (!prev) {
				op._rats = {};
				(op.rats || []).forEach(function(r) { op._rats[r] = true; });
				byPlmn[key] = op; order.push(key);
			} else {
				(op.rats || []).forEach(function(r) { prev._rats[r] = true; });
				if (op.roaming) prev.roaming = true;
				if ((rank[op.status] || 0) > (rank[prev.status] || 0)) {
					op._rats = prev._rats; op.roaming = prev.roaming || op.roaming;
					byPlmn[key] = op;
				}
			}
		});

		return order.map(function(k) { return byPlmn[k]; });
	},

	/* WHICH SLOT'S eSIM CAN BE READ, in one place. Three call sites used to
	   decide this for themselves and two of them disagreed: the status page
	   required an active, present eUICC, the settings page took the first
	   eUICC in the list whatever its state. So one page said "no profiles" and
	   the other issued profile reads against a card it could not reach, for the
	   same modem at the same moment.

	   ACTIVE IS PART OF THE RULE, not an extra caution. The APDU channel the
	   eSIM operations run over belongs to the ACTIVE card (wwand sim.uc
	   `_apdu_be`), so an eUICC sitting in the other slot is not addressable
	   without switching slots first — asking anyway produces failures the UI
	   then has to hide.

	   `> 0`, not `!= null`: slots are 1-based everywhere the daemon builds them
	   (sim.uc, mbim_backend.uc and modem_ncm.uc all count from 1), and 0 was
	   the value that slipped through the daemon's `?? 1` and addressed a slot
	   that is not a slot. */
	euiccReadable: function(sl) {
		return !!(sl && sl.is_euicc && sl.active && sl.card == 'present' && sl.physical > 0);
	},

	/* the readable eUICC slot RECORD, or null when there is none. Callers that
	   must put an integer on the wire supply their own default — see the note
	   in settings.js about the ubus arg being typed. */
	euiccSlot: function(slots) {
		var self = this;
		return (slots || []).filter(function(sl) { return self.euiccReadable(sl); })[0] || null;
	},

	/* THE SLOT WORTH ASKING ABOUT, which is not the same question as
	   euiccSlot's. That one asks "which slot is a known eUICC"; this one asks
	   "where could an eSIM be, such that asking is cheap and honest".

	   They differ on exactly one shape: a slot record the daemon INFERRED
	   because the modem cannot enumerate slots at all (wwand sim.uc
	   single_slot — a QMI firmware answering 71/94, an MBIM device with no UIM
	   client, or any AT modem whose vendor has no dual-SIM recipe, which today
	   is every one but Fibocom). Such a record describes one addressable active
	   card, NOT a physical slot map; it carries `is_euicc: null` — not known —
	   and euiccReadable correctly says no, because it is not a KNOWN eUICC.

	   Saying no there cost us the whole eSIM surface on a Cudy LT300 / MeiG
	   SLM770A: `wwandctl esim eid` read the EID and the four profiles while
	   this panel showed nothing at all, because the gate in front of the read
	   had already decided (2026-09-22).

	   The reasoning that removed an earlier slot-1 fallback still holds and is
	   not being undone: with an eUICC in the INACTIVE slot of a dual-slot
	   modem, slot 1 is a different card and asking about it answers the wrong
	   question. That case is a slot list the modem actually reported, and it
	   still goes through euiccReadable alone. Here there is no list to be wrong
	   about — one addressable active card, and the APDU channel reaches it
	   whatever integer rides along (sim.uc at_apdu_open ignores the slot
	   argument entirely; only QMI-UIM uses it). */
	/* IS THIS SLOT AN eUICC, given what came back. `is_euicc` is tri-state:
	   true, false, or null when the record was inferred because the modem
	   cannot enumerate slots at all (see euiccProbeSlot). On null the profile
	   list settles it — only an eUICC answers one — and `profiles` is null
	   unless a read actually came back, the caller keeping "none installed"
	   apart from "not read" (status.js does that at res[6]). Evidence beats
	   inference, and nothing here guesses: with no reading and no claim, the
	   answer is no. */
	/* What the card's ISD-R says about itself (daemon status `euicc`, read
	   once per modem from the SELECT answer without ES10): an SGP.32 IoT
	   eUICC carries an extra template there, and the SGP.22 version it builds
	   on. null when there is nothing to say. */
	euiccText: function(e) {
		if (!e || (!e.sgp32 && !e.svn))
			return null;

		var base = e.svn ? 'SGP.22 %s'.format(e.svn) : null;

		return e.sgp32
			? (base ? _('SGP.32 IoT eUICC (on %s)').format(base) : _('SGP.32 IoT eUICC'))
			: base;
	},

	/* Which IoT Profile Assistant runs an SGP.32 card. The card's own (IPAe)
	   keeps ES10 to itself, so the router cannot list or switch its profiles;
	   it changes them on its eIM's order and rolls back by itself. null when
	   the card is not SGP.32. */
	ipaText: function(e) {
		if (!e || !e.sgp32)
			return null;

		if (e.ipa == 'ipae')
			return _('in the card (IPAe) — the card and its eIM manage the profiles; the router has no ES10 access');

		if (e.ipa == 'ipad')
			return e.ipae_supported
				? _('on the device (IPAd); the card could also run its own')
				: _('on the device (IPAd)');

		return e.ipae_supported ? _('unknown (the card supports an IPAe)') : _('unknown');
	},

	/* The recovery hold after the card's own IPA changed the subscription
	   (daemon recovery.card_hold, seconds left): without it, "next: modem
	   reset, due now" reads as overdue. null when there is none. */
	cardHoldText: function(rec) {
		var s = rec ? +(rec.card_hold || 0) : 0;

		if (!(s > 0))
			return null;

		return _('modem reset, power cycle and reboot held for %d min — the card is settling its own profile change')
			.format(Math.ceil(s / 60));
	},

	euiccConfirmed: function(sl, profiles) {
		if (!sl)
			return false;

		return (sl.is_euicc != null) ? !!sl.is_euicc : !!profiles;
	},

	/* MAY THIS SLOT BE OFFERED AS A TOPOLOGY CHOICE. The mirror of the
	   daemon's sim.enumerated(): a row the daemon INFERRED because the modem
	   cannot enumerate says one card is reachable, not where it sits, so it
	   must not populate an `option sim_slot` dropdown or a "set as primary"
	   button — those persist a slot number nobody read. Reading it is fine,
	   which is what euiccProbeSlot is for; choosing with it is not.
	   Raised by Codex review, 2026-09-22. */
	slotEnumerated: function(sl) {
		return !!(sl && !sl.inferred);
	},

	/* MAY THIS SLOT BE RECORDED AS THE BOOT PREFERENCE (`option sim_slot`).
	   Two conditions, and they answer different objections:

	   - it must be a slot the MODEM named, not one the daemon inferred for a
	     firmware that cannot enumerate (slotEnumerated) — pinning a
	     placeholder records a topology decision on no evidence;
	   - and it must hold a card. Pinning an empty slot asks the modem to come
	     up on nothing. The status page's "Switch now" has always required a
	     card; the tools page's "Set as primary" sat on the same rows and did
	     not, which is what obsy found (ddimension/luci-app-wwand#12,
	     2026-09-22).

	   Deliberately NOT conditioned on `active`: making the slot that is
	   currently in use the persistent choice is the main thing anyone wants
	   this for. That is the difference from the switch button, which is only
	   meaningful for a slot you are not on. */
	slotPinnable: function(sl) {
		return !!(sl && this.slotEnumerated(sl) && sl.card == 'present');
	},

	/* THE MULTI-SIM SHAPE, IN WORDS — and with the slot count in them, which
	   is the half that was missing. The row already said "one SIM active at a
	   time (switching)" for a DSSA modem; what it did not say is how many
	   slots the modem claims, so a reader looking at two slot rows on a
	   single-slot board had nothing to connect them to. obsy asked exactly
	   that: "the modem has one SIM slot, the status shows it as empty"
	   (ddimension/luci-app-wwand#12, 2026-09-22) — his modem enumerates two
	   slots and reports one executor. What the extra row means physically is
	   not knowable from here; what IS knowable is whose statement it is.

	   `slots` IS THE ROW COUNT THE SLOT BACKEND RETURNED and nothing more —
	   sim.uc:877 takes it from the length of the list, while `exact`
	   (sim.uc:910) says only that the executor and concurrency figures came
	   from MBIM SYS_CAPS. Two earlier versions of this comment claimed more
	   than that and both were wrong: first that the count carried SYS_CAPS
	   provenance, then that it was in every case the modem's own answer. It is
	   not — the Fibocom NCM recipe builds BOTH rows unconditionally from a
	   GTDUALSIM reply that only names the active subscription
	   (modem_ncm.uc:990-1001). So the count is shown whenever there is more
	   than one, and the marker is put beside the mode it qualifies rather than
	   trailing the line, where it read as qualifying all of it. Raised by
	   Codex review, 2026-09-22.

	   Returns null when nothing can be said about the mode — see the note at
	   the call site about not printing a row that reads as a measurement and
	   is not one. */
	MULTISIM_MODE: {
		dssa: _('one SIM active at a time (switching)'),
		dsds: _('both registered, one carries data'),
		dsda: _('both usable at once'),
	},

	multisimText: function(ms) {
		if (!ms || (!ms.mode && !ms.mode_min))
			return null;

		var txt = ms.mode
			? (this.MULTISIM_MODE[ms.mode] || ms.mode.toUpperCase())
			: _('at least %s').format(ms.mode_min.toUpperCase());

		if (ms.slots > 1)
			txt = _('%d slots').format(ms.slots) + ' \u00b7 ' + txt;

		return txt + (ms.exact ? '' : ' (' + _('inferred') + ')');
	},

	/* MAY THIS SLOT BE SWITCHED TO. The third slot policy, and the last one
	   that was written out twice: the status card and the compact row each
	   carried `!sl.active && sl.card == 'present'` in their own words. Two
	   copies of one rule is how the "Set as primary" button came to disagree
	   with the switch button sitting on the same rows
	   (ddimension/luci-app-wwand#12). Raised by Codex review, 2026-09-22.

	   Not the same question as slotPinnable: switching to the slot you are
	   already on does nothing, while pinning it is the ordinary case. */
	slotSwitchable: function(sl) {
		return !!(sl && !sl.active && sl.card == 'present');
	},

	euiccProbeSlot: function(slots) {
		var known = this.euiccSlot(slots);

		if (known)
			return known;

		var list = slots || [];

		if (list.length != 1)
			return null;

		var sl = list[0];

		/* `inferred` is the contract, not the shape. Keying on "one row with a
		   null is_euicc" would adopt any future producer that happens to look
		   like that; the daemon marks the row it made up, so ask about that.
		   Raised by Codex review, 2026-09-22. */
		return (sl && sl.inferred && sl.is_euicc == null &&
		        sl.active && sl.card != 'absent') ? sl : null;
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
		/* o.euicc: the daemon's reading of the ACTIVE card's ISD-R */
		var eu = (sl.active && o.euicc) ? o.euicc : null;
		var isEuicc = this.euiccConfirmed(sl, o.profiles) || !!(eu && eu.sgp32);
		var kind = isEuicc ? _('eUICC (eSIM)') : _('SIM card');
		var head = [
			E('strong', {}, [ _('Slot %d').format(sl.physical) ]),
			' \u00b7 ' + kind,
		];

		/* the card's label from its wwand_sim (`option name`, daemon
		   modem_sim_slots): with two cards the ICCID alone does not say which
		   one is in which slot (ddimension/wwand#44). Text node — it is
		   operator-entered, but still never markup. */
		if (sl.card == 'present' && sl.name)
			head.push(' \u00b7 ', E('span', { 'style': 'font-weight:600' }, [ String(sl.name) ]));

		if (sl.active)
			head.push(E('span', { 'style': 'margin-left:.5em;padding:0 .4em;border-radius:3px;'
				+ 'background:#2c8a2c;color:#fff;font-size:85%' }, [ _('active') ]));
		else if (sl.card != 'present')
			head.push(E('span', { 'style': 'margin-left:.5em;color:#888;font-size:85%' },
				[ this.cardText(sl.card) ]));

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

			var euTxt = this.euiccText(eu), ipaTxt = this.ipaText(eu);

			if (euTxt)
				rows.push([ _('eUICC'), euTxt ]);

			if (ipaTxt)
				rows.push([ _('IPA'), ipaTxt ]);

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

		/* a card whose own IPA runs it does not hand its profile list to the
		   router at all, so "not read" would suggest a read that could work */
		if (isEuicc && sl.card == 'present')
			out.push((eu && eu.ipa == 'ipae')
				? E('div', { 'style': 'margin-left:.8em;font-size:90%;color:#888' },
					[ _('Profiles: kept by the card — its own IPA manages them with the eIM') ])
				: this.esimProfileList(o.profiles, sl.active));

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

	/* ONE WORD PER CARD STATE, because there were two. The daemon's vocabulary
	   is an identifier set — 'present', 'absent', 'unknown', 'error'
	   (wwand sim.uc CARD_STATES, mbim_backend SLOT_STATES) — and simSlotRow
	   printed it verbatim while simSlotCard said "empty" for the same slot.
	   One modem, two pages, two words for one fact: reported by obsy
	   (ddimension/luci-app-wwand#12, 2026-09-22).

	   'unknown' gets its own word rather than being folded into "empty". A
	   slot the modem would not talk about is not a slot known to be empty, and
	   the status page used to state the stronger of the two.

	   The list is not closed: an unrecognised QMI card_status survives as its
	   own number (wwand sim.uc:834), deliberately, so nothing is lost when the
	   protocol grows. Anything outside the four lands on "not read", which is
	   the honest reading of a state this side does not know. */
	CARD_TEXT: {
		present: _('card present'),
		absent:  _('empty'),
		error:   _('card error'),
		unknown: _('not read'),
	},

	cardText: function(card) {
		return this.CARD_TEXT[card] || this.CARD_TEXT.unknown;
	},

	/* the old single-line renderer, kept for the eSIM page's slot list until it
	   moves over too — status.js uses simSlotCard */
	simSlotRow: function(sl, onSwitch, extras) {
		var line = [
			E('strong', {}, [ _('Slot %d').format(sl.physical) +
				(sl.is_euicc ? ' (eSIM)' : '') + (sl.active ? ' \u2713' : '') ]),
			' \u2014 ' + this.cardText(sl.card) + (sl.iccid ? (', ICCID ' + sl.iccid) : '') +
				(sl.eid ? (', EID ' + sl.eid) : '') +
				/* per-slot CPIN/service/ATR (ESLOTSINFO-class slots surface) —
				   the inactive slot's PIN and service state matter when deciding
				   to switch to it */
				(sl.cpin ? (', ' + sl.cpin) : '') +
				(sl.service ? (', ' + sl.service) : '') +
				(sl.atr ? (', ATR ' + sl.atr) : '')
		];
		(extras || []).forEach(function(b) { line.push(b); });
		if (this.slotSwitchable(sl) && onSwitch)
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
	/* The four access technologies a PLMN entry can carry, in the words a
	   reader uses — ONE vocabulary, in ONE place.

	   The keys are the 3GPP names for the radio access network (EF_PLMNwAcT
	   carries them as bits; sim_plmn.uc:68 names them), and they are what the
	   daemon speaks. They are NOT labels: the read-only list rendered them by
	   upper-casing the key, so a SIM entry read "GSM UTRAN" twelve lines under
	   an editor that labels the very same flags "2G 3G" (ddimension/luci-app-wwand#10,
	   2026-09-21). Both ends of that page come from here now.

	   Order is generational and fixed, not the order the flags happen to be
	   set in: "2G 4G" and "4G 2G" are the same entry and should read alike. */
	PLMN_RATS: [
		{ key: 'gsm',    label: '2G' },
		{ key: 'utran',  label: '3G' },
		{ key: 'eutran', label: '4G' },
		{ key: 'ngran',  label: '5G' },
	],

	/* the labels an entry actually carries, oldest first; [] when it carries
	   none — which is a real state for a SIM record with no AcT field, and
	   reads as "—" rather than as an empty column the reader has to interpret */
	plmnRatLabels: function(e) {
		if (!e)
			return [];

		return this.PLMN_RATS.filter(function(r) { return e[r.key]; })
			.map(function(r) { return r.label; });
	},

	/* The GNSS reply, normalised — TWO daemon shapes, because the daemon and
	   this app are pinned separately in the feed and a box can run either
	   pairing.

	     OLD (wwand <= 1.6.7_p58): wwand-gps pointed ugps at the NMEA port and
	     passed ugps' own ubus reply through. Every value is a STRING and an
	     absent one is the EMPTY string — "elevation": "", "satellites": ""
	     (measured on a GL-X3000, 2026-09-20). `reader` said whether ugps
	     answered; `fix` was a boolean.

	     NEW (wwand > 1.6.7_p58): wwand reads the port itself. Values are
	     numbers and absent is null; `reading` says whether the reader is
	     running and `fix` is the TYPE as a word ('2d'/'3d'/'none'/null). It
	     also carries what ugps never had: satellites in view with their SNR,
	     PDOP/VDOP, and a reason when there is nothing to read.

	   `reading` is the discriminator — absent (or null) means the old shape.
	   The new shape sets it on BOTH of its branches, as a boolean, and the old
	   shape has no such key, so the two cannot be confused.

	   Returns null when there is nothing to show at all, so the caller can
	   drop the panel rather than render an empty one. */
	gnss: function(g) {
		if (!g || g.error)
			return null;

		/* Nothing to say at all: no port, nothing reading, and nobody asked.
		   A modem with `option gnss` set and NO port is a different case and
		   does get a panel — "you asked for this and there is no port" is the
		   most useful thing the page can say, and suppressing it made the
		   no_gps_port wording unreachable. Raised by Codex review,
		   2026-09-21. */
		if (!g.port && !g.reader && !g.reading && !g.receiver && !g.configured)
			return null;

		var legacy = (g.reading == null);

		/* ugps' empty string is an ABSENT value, not a zero: `+""` is 0 and an
		   unset elevation would render as "0.0 m", which reads as a
		   measurement rather than as the lack of one. */
		function old(k) {
			var v = g[k];
			return (v != null && v !== '') ? +v : null;
		}
		function num(v) { return (v != null && v !== '') ? +v : null; }

		var out = {
			legacy: legacy,
			port: g.port || null,
			receiver_started: !!g.receiver_started,
			configured: legacy ? !!g.receiver : !!g.configured,
			reading: legacy ? !!g.reader : !!g.reading,
			reason: legacy ? null : (g.reason || null),
			age: legacy ? old('age') : num(g.age),
			latitude: legacy ? old('latitude') : num(g.latitude),
			longitude: legacy ? old('longitude') : num(g.longitude),
			elevation: legacy ? old('elevation') : num(g.elevation),
			course: legacy ? old('course') : num(g.course),
			hdop: legacy ? old('HDOP') : num(g.hdop),
			pdop: legacy ? null : num(g.pdop),
			vdop: legacy ? null : num(g.vdop)
		};

		/* a fix at all, and separately WHAT KIND. The old shape only ever knew
		   the first; the new one reports 'none' for "no solution" and null for
		   "the receiver never said", which are different and a GGA-only
		   receiver makes the second. */
		out.valid = legacy ? !!g.fix : !!g.valid;
		out.fix_type = legacy ? null
			: ((g.fix === '2d' || g.fix === '3d') ? g.fix : null);

		/* ugps reported ONE count, GGA's satellites-in-use. The new shape has
		   that and the number in VIEW, which is the one that says whether the
		   antenna can see anything at all. */
		out.sats_used = legacy ? old('satellites') : num(g.satellites_used);
		out.sats_view = legacy ? null : num(g.satellites_in_view);

		/* ugps had no per-satellite data. Rendering the array as a string is
		   what produced a row of [object Object] on a box whose daemon had
		   moved ahead of this app (seen on the NR7101, 2026-09-21). */
		out.sats = (!legacy && Array.isArray(g.satellites) && g.satellites.length)
			? g.satellites : null;

		/* knots is the NMEA unit; the new shape converts as well, and a
		   consumer should not have to know which one it got. */
		if (legacy) {
			out.speed_knots = old('speed');
			out.speed_kmh = (out.speed_knots != null)
				? Math.round(out.speed_knots * 1.852 * 10) / 10 : null;
		}
		else {
			out.speed_knots = num(g.speed_knots);
			out.speed_kmh = num(g.speed_kmh);
		}

		out.counters = (!legacy && g.sentences != null)
			? { lines: num(g.lines), sentences: num(g.sentences),
			    unparsed: num(g.unparsed) } : null;

		return out;
	},

	/* The strongest few satellites, for a panel that cannot show thirty rows.
	   Sorted by SNR with the unheard ones last: a satellite in view with no
	   SNR is one the receiver can place but not hear, which is worth seeing
	   but not worth the top of the list.

	   ONE ROW PER SATELLITE. The list carries an entry per SIGNAL, so a
	   receiver hearing a satellite on two bands lists it twice — which
	   rendered as "GP18 40 dB · GP18 39 dB" and reads as a bug rather than as
	   two bands (seen on the NR7101, 2026-09-21). The best band is what the
	   row is about; the number of bands is not what this line is for. */
	gnssTopSats: function(sats, n) {
		if (!Array.isArray(sats) || !sats.length)
			return [];

		var best = {};

		for (var i = 0; i < sats.length; i++) {
			var sv = sats[i];

			if (!sv || sv.prn == null)
				continue;

			var k = (sv.talker || '') + '/' + sv.prn;
			var cur = best[k];

			if (!cur || ((sv.snr != null ? sv.snr : -1) > (cur.snr != null ? cur.snr : -1)))
				best[k] = sv;
		}

		return Object.keys(best).map(function(k) { return best[k]; })
			.sort(function(a, b) {
				var x = (a.snr != null) ? a.snr : -1;
				var y = (b.snr != null) ? b.snr : -1;
				return y - x;
			}).slice(0, n || 6);
	},

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

		/* STACKED, not side by side. The second series is the TOTAL — LTE plus
		   5G — so the picture reads as one link: the lower line is what the
		   anchor carries, the upper one where the whole aggregate sits, and the
		   gap between them is the 5G contribution. Drawn absolutely, "LTE 2 +
		   5G 1" put lines at 2 and 1, which invites reading the 5G leg as the
		   smaller half of a link carrying 2 rather than the third carrier of a
		   link carrying 3.

		   The total series stays null while no 5G carrier serves, so a
		   single-RAT link draws one line instead of two identical ones. Same
		   for bandwidth. */
		var caTotal = n.nr ? (n.lte + n.nr) : null;
		var bwTotal = (haveBw.nr && n.nr) ? (bw.lte + bw.nr) : null;

		return {
			ca: [ n.lte || null, caTotal ],
			bw: [ haveBw.lte ? bw.lte : null, bwTotal ],
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
			/* ...and the MNC's WIDTH, the same as fmtOperator: %02d cannot tell
			   310/030 from 310/30, two different operators. fmtMnc keeps the
			   null guard above meaningful — it returns '?' rather than '00'.
			   Found by a full review, 2026-09-19. */
			var op = (reg.plmn && (reg.plmn.description ||
				((reg.plmn.mcc != null && reg.plmn.mnc != null)
					? '%s/%s'.format(reg.plmn.mcc,
						this.fmtMnc(reg.plmn.mnc, reg.plmn.mnc_digits)) : null) ||
				reg.plmn.id)) || _('registered');
			return op + (reg.roaming ? ' ' + _('(roaming)') : '');
		}

		var det = mi.registration_detail;

		if (det && det.reject_text)
			return _('rejected: %s').format(det.reject_text);

		return _('searching…');
	},

	/* MbimDataSubclass -> the words for it (libmbim 1.32.0 mbim-enums.h
	   :1867-1872). A BITMASK, so more than one bit can be set; the names are
	   3GPP's own spellings of how 5G is attached.

	   THE SAME TWO TABLES LIVE IN wwand's src-ucode/wwandctl_fmt.uc, because a
	   ucode module and a browser module cannot share one. The words must match:
	   a page and a CLI that disagree about the same value are worse than either
	   alone, and they drifted once already. Change one, change both.

	   This is the authoritative answer to NSA-vs-SA. Everywhere else on this
	   page that distinction is INFERRED — from whether a 5G cell sits beside an
	   LTE anchor — which is a good guess and still a guess. MBIMEx v3 has the
	   modem say it, so when it does, the page says where the answer came from
	   rather than presenting both the same way. */
	DATA_SUBCLASS: [
		[ 1 << 0, 'ENDC' ],        /* 5G on an LTE anchor — NSA */
		[ 1 << 1, '5G NR' ],       /* standalone */
		[ 1 << 2, 'NEDC' ],
		[ 1 << 3, 'ELTE' ],
		[ 1 << 4, 'NGENDC' ],
	],

	fmtDataSubclass: function(v) {
		if (v == null || v === 0)
			return null;

		var out = [], rest = v;

		this.DATA_SUBCLASS.forEach(function(p) {
			if (v & p[0]) { out.push(p[1]); rest &= ~p[0]; }
		});

		/* AN UNKNOWN BIT IS REPORTED, INCLUDING BESIDE KNOWN ONES. The first
		   version fell back to hex only when NOTHING was recognised, so 0x21
		   came back as a bare "ENDC" and the bit this table does not know was
		   dropped silently — the one case where saying nothing is worst, since
		   a modem setting it is telling us something new. Found by review,
		   2026-09-20. */
		if (rest) out.push('0x' + Number(rest).toString(16));

		return out.length ? out.join(' + ') : null;
	},

	/* MbimFrequencyRange (libmbim 1.32.0 mbim-enums.h:1627-1629), spelled out.
	   A bitmask, because carrier aggregation can span both ranges.

	   "FR1" is 3GPP's name and means nothing to a reader who has not looked it
	   up — and the reason to show this row at all is that the two ranges behave
	   completely differently: FR1 travels and penetrates, FR2 is fast and stops
	   at a wall. The band limits are 3GPP TS 38.104 §5.2 (FR1 410 MHz–7.125 GHz
	   since Rel-17; FR2 24.25–71 GHz), quoted as the round numbers people
	   actually use. */
	FREQUENCY_RANGE: [
		[ 1, 'FR1', _('sub-6 GHz') ],
		[ 2, 'FR2', _('mmWave, 24 GHz and above') ],
	],

	fmtFrequencyRange: function(v, verbose) {
		if (v == null || v === 0)
			return null;

		var out = [], rest = v;

		this.FREQUENCY_RANGE.forEach(function(p) {
			if (v & p[0]) {
				out.push(verbose === false ? p[1] : '%s (%s)'.format(p[1], p[2]));
				rest &= ~p[0];
			}
		});

		/* same rule as the subclass above, and the same bug it had: a bit
		   outside FR1/FR2 is carried, not swallowed by the two recognised */
		if (rest) out.push('0x' + Number(rest).toString(16));

		return out.length ? out.join(' + ') : null;
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
