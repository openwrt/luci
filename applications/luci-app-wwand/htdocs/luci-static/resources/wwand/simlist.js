'use strict';
'require baseclass';
'require form';
'require uci';
'require rpc';

/* Shared per-SIM override list (config wwand_sim in /etc/config/network): a
   PIN/APN bundle matched at runtime by ICCID, independent of the modem (a
   wwand_sim with no `modem` applies to whichever modem holds that card). Used —
   like wwand.modemopts — by both the dedicated Modems page and the interface
   proto handler, so the list is defined once. */

var callInventory = rpc.declare({ object: 'wwand', method: 'sim_inventory', expect: { '': {} } });

/* An ICCID as written in the config and as read from the card can differ in
   case and in the 'F' padding of an odd-length ICCID (EF ICCID is BCD,
   ETSI TS 102 221 13.2), so both sides are compared normalised. */
function normIccid(v) {
	return String(v || '').toUpperCase().replace(/F+$/, '');
}

/* one inventory entry, tersely: where the card sits right now */
function whereShort(c, now) {
	var parts = [];

	if (!c.present) {
		if (c.last_seen != null && now != null) {
			var d = Math.max(0, now - c.last_seen);
			return _('not present, %s').format(d < 7200 ? _('%d min').format(Math.floor(d / 60))
				: d < 172800 ? _('%d h').format(Math.floor(d / 3600)) : _('%d d').format(Math.floor(d / 86400)));
		}
		return _('not present');
	}

	if (c.reader)
		parts.push(_('rsim %s').format(c.reader));
	else if (c.modem)
		parts.push(c.slot != null ? _('%s · slot %d').format(c.modem, c.slot) : c.modem);

	if (c.eid)
		parts.push(c.profile && c.profile.state ? _('eSIM %s').format(c.profile.state) : _('eSIM'));

	if (c.active)
		parts.push(_('in use'));

	return parts.join(' · ') || '?';
}

/* the wwand_sim section for a card, matched as the daemon matches it:
   by ICCID, or by an IMSI written into the iccid field or into `imsi`
   (modem_common.uc match_sim_override); null when there is none */
function findSim(iccid, imsi) {
	var want = normIccid(iccid), hit = null;

	uci.sections('network', 'wwand_sim', function(sec) {
		if (hit)
			return;
		if ((want && normIccid(sec.iccid) == want) ||
		    (imsi && (sec.imsi == imsi || sec.iccid == imsi)))
			hit = sec['.name'];
	});

	return hit;
}

return baseclass.extend({
	findSim: findSim,

	/* the card's label (`option name` of its wwand_sim), or null — for the
	   places that list cards by ICCID: with several cards in a box the ICCID
	   alone does not say which one is which (ddimension/wwand#44, #39).
	   Operator-entered text: callers put it in a text node, never markup. */
	simName: function(iccid, imsi) {
		var sid = findSim(iccid, imsi);

		return sid ? (uci.get('network', sid, 'name') || null) : null;
	},

	/* Open the override editor of the list `s` (addSimList's section) for
	   one card: its section when it has one, otherwise a new one with the
	   ICCID filled in — added the way the list's own Add does
	   (GridSection.handleAdd, form.js), so Cancel removes it again and only
	   Save & Apply keeps it. */
	openSim: function(s, iccid, imsi) {
		var sid = findSim(iccid, imsi);

		if (sid)
			return s.renderMoreOptionsModal(sid);

		sid = s.map.data.add('network', 'wwand_sim');
		s.map.data.set('network', sid, 'iccid', iccid);
		s.map.addedSection = sid;

		return s.renderMoreOptionsModal(sid);
	},

	/* add the SIM-override GridSection to the form.Map `m`.
	   opts.prefillIccid — prefill the ICCID on a freshly added row (the active
	   card, so the common "PIN for the inserted SIM" case is one click). */
	addSimList: function(m, opts) {
		opts = opts || {};

		var s = m.section(form.GridSection, 'wwand_sim', _('SIMs (per-ICCID overrides)'),
			_('Match a specific card by its ICCID and give it a PIN — and optionally its own APN/auth. Applies to whichever modem holds that card (leave Modem empty). Handy for dual-SIM or eUICC profiles with different PINs.'));
		s.addremove = true;
		s.anonymous = true;
		s.sortable = false;
		s.nodescriptions = true;
		s.addbtntitle = _('Add SIM');

		/* An override row usually holds the card's PIN, and nothing else in the
		   UI holds it — deleted, it is gone, and the card goes back to whatever
		   the modem section carries (or to no PIN at all). Cheap to ask. */
		s.handleRemove = function(section_id /*, ev */) {
			var iccid = uci.get('network', section_id, 'iccid');

			if (!confirm(iccid
				? _('Delete the override for SIM %s? Its PIN and APN settings are lost.').format(iccid)
				: _('Delete this SIM override? Its PIN and APN settings are lost.')))
				return Promise.resolve();

			return form.GridSection.prototype.handleRemove.apply(this, arguments);
		};

		var o;

		/* Where the card is right now, from the daemon's SIM inventory — status
		   only. One request per page; a page whose ACL lacks sim_inventory (or
		   an older daemon) just shows nothing here. */
		var inventory = L.resolveDefault(callInventory(), {});

		o = s.option(form.Value, 'iccid', _('ICCID'),
			_('The card\'s ICCID (printed on the SIM / shown on the modem status page).'));
		o.rmempty = false;
		o.datatype = 'and(uinteger,minlength(6),maxlength(22))';
		if (opts.prefillIccid)
			o.default = opts.prefillIccid;

		/* A label for the card. With several cards in a box the ICCID alone
		   does not say which one is which (ddimension/wwand#44); the name is
		   shown on the SIM cards page and the modem status. Display only —
		   wwand matches on nothing but the ICCID/IMSI, and renaming the card
		   in use re-dials nothing. */
		o = s.option(form.Value, 'name', _('Name'),
			_('A name for this card, e.g. "Work" or "Travel". Shown on the SIM cards page and the modem status.'));
		o.rmempty = true;
		o.datatype = 'maxlength(32)';

		o = s.option(form.DummyValue, '_where', _('Now'));
		o.modalonly = false;
		o.textvalue = function(section_id) {
			/* the daemon matches a section by ICCID, by `imsi`, or by an IMSI
			   written into the iccid field (modem_common.uc match_sim_override,
			   config.uc accepting `imsi`) — so does this */
			var want = normIccid(uci.get('network', section_id, 'iccid')),
			    imsi = uci.get('network', section_id, 'imsi'),
			    span = E('span', { 'style': 'white-space:nowrap' }, [ '…' ]);

			inventory.then(function(inv) {
				var hits = ((inv && inv.cards) || []).filter(function(c) {
					return (want && (normIccid(c.iccid) == want || c.imsi == want)) ||
					       (imsi && c.imsi == imsi);
				});

				/* a string argument becomes a text node: reader and profile
				   names come from outside and are never parsed as markup */
				span.replaceChildren(hits.length
					? hits.map(function(c) { return whereShort(c, inv.now); }).join('; ')
					: E('span', { 'style': 'opacity:.6' }, [ _('not seen') ]));
			});

			return span;
		};

		o = s.option(form.Value, 'pincode', _('PIN'),
			_('SIM PIN for this card. Overrides the modem\'s default PIN; wwand never retries a PIN when only one attempt is left.'));
		o.datatype = 'and(uinteger,minlength(4),maxlength(8))';
		o.password = true;
		/* `password` masks the input field only: the grid cell is rendered from
		   textvalue(), which is the stored value (form.js renderTextValue), so
		   the list showed every card's PIN in clear. Only whether one is set. */
		o.textvalue = function(section_id) {
			return this.cfgvalue(section_id) ? '••••' : null;
		};

		o = s.option(form.Value, 'apn', _('APN'),
			_('Optional APN for this card, overriding the interface/default APN.'));
		o.rmempty = true;

		o = s.option(form.Value, 'modem', _('Modem'),
			_('Optional: bind this override to one modem (its wwand_modem name). Empty = any modem holding this card.'));
		o.rmempty = true;
		uci.sections('network', 'wwand_modem').forEach(function(sec) { o.value(sec['.name'], sec['.name']); });

		/* modal-only detail: auth + credentials + PDP override */
		o = s.option(form.ListValue, 'auth', _('Authentication type'),
			_('APN authentication for this card (only needed when the operator requires a username/password).'));
		o.modalonly = true;
		o.default = 'none';
		o.value('none', _('None'));
		o.value('pap', 'PAP');
		o.value('chap', 'CHAP');
		o.value('both', 'PAP/CHAP');

		o = s.option(form.Value, 'username', _('PAP/CHAP username'),
			_('Username for the APN authentication.'));
		o.modalonly = true;
		o.depends('auth', 'pap'); o.depends('auth', 'chap'); o.depends('auth', 'both');

		o = s.option(form.Value, 'password', _('PAP/CHAP password'),
			_('Password for the APN authentication.'));
		o.modalonly = true;
		o.password = true;
		o.depends('auth', 'pap'); o.depends('auth', 'chap'); o.depends('auth', 'both');

		o = s.option(form.ListValue, 'pdp_type', _('PDP type'),
			_('IP version(s) requested for this card\'s data session, overriding the interface setting.'));
		o.modalonly = true;
		o.value('', _('(interface default)'));
		o.value('ipv4v6', _('IPv4 + IPv6'));
		o.value('ipv4', _('IPv4'));
		o.value('ipv6', _('IPv6'));

		/* optional preferred-PLMN list for this card — the daemon restores it
		   before every radio-on; a per-SIM list wins over the modem's. The list
		   itself (and its NAS/user type) is a `config wwand_plmnlist`, managed on
		   the modem settings page. */
		o = s.option(form.ListValue, 'plmn_list', _('Preferred-PLMN list'),
			_('Optional: a saved PLMN list to restore for this SIM (type NAS or user is set on the list). Wins over the modem\'s list.'));
		o.modalonly = true;
		o.rmempty = true;
		o.value('', _('(none)'));
		uci.sections('network', 'wwand_plmnlist').forEach(function(sec) {
			var t = (sec.type == 'user') ? 'user' : (sec.type == 'fplmn') ? 'FPLMN' : 'NAS';
			o.value(sec['.name'], sec['.name'] + ' (' + t + ')');
		});

		return s;
	}
});
