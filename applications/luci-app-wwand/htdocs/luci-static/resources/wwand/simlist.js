'use strict';
'require baseclass';
'require form';
'require uci';

/* Shared per-SIM override list (config wwand_sim in /etc/config/network): a
   PIN/APN bundle matched at runtime by ICCID, independent of the modem (a
   wwand_sim with no `modem` applies to whichever modem holds that card). Used —
   like wwand.modemopts — by both the dedicated Modems page and the interface
   proto handler, so the list is defined once. */

return baseclass.extend({
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

		var o;

		o = s.option(form.Value, 'iccid', _('ICCID'),
			_('The card\'s ICCID (printed on the SIM / shown on the modem status page).'));
		o.rmempty = false;
		o.datatype = 'and(uinteger,minlength(6),maxlength(22))';
		if (opts.prefillIccid)
			o.default = opts.prefillIccid;

		o = s.option(form.Value, 'pincode', _('PIN'));
		o.datatype = 'and(uinteger,minlength(4),maxlength(8))';
		o.password = true;

		o = s.option(form.Value, 'apn', _('APN'),
			_('Optional APN for this card, overriding the interface/default APN.'));
		o.rmempty = true;

		o = s.option(form.Value, 'modem', _('Modem'),
			_('Optional: bind this override to one modem (its wwand_modem name). Empty = any modem holding this card.'));
		o.rmempty = true;
		uci.sections('network', 'wwand_modem').forEach(function(sec) { o.value(sec['.name'], sec['.name']); });

		/* modal-only detail: auth + credentials + PDP override */
		o = s.option(form.ListValue, 'auth', _('Authentication type'));
		o.modalonly = true;
		o.default = 'none';
		o.value('none', _('None'));
		o.value('pap', 'PAP');
		o.value('chap', 'CHAP');
		o.value('both', 'PAP/CHAP');

		o = s.option(form.Value, 'username', _('PAP/CHAP username'));
		o.modalonly = true;
		o.depends('auth', 'pap'); o.depends('auth', 'chap'); o.depends('auth', 'both');

		o = s.option(form.Value, 'password', _('PAP/CHAP password'));
		o.modalonly = true;
		o.password = true;
		o.depends('auth', 'pap'); o.depends('auth', 'chap'); o.depends('auth', 'both');

		o = s.option(form.ListValue, 'pdp_type', _('PDP type'));
		o.modalonly = true;
		o.value('', _('(interface default)'));
		o.value('ipv4v6', _('IPv4 + IPv6'));
		o.value('ipv4', _('IPv4'));
		o.value('ipv6', _('IPv6'));

		return s;
	}
});
