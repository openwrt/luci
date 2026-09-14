'use strict';
'require baseclass';
'require uci';

/* Interface → wwand_modem section resolution/migration (network-native model:
   radio/SIM/hardware options live on a `config wwand_modem` section in
   /etc/config/network, referenced from the interface via `option modem`; the
   interface itself carries only the connection). Shared by the proto handler
   (protocol/wwand.js) and the settings page (view/wwand/settings.js) — this
   is correctness-critical migration code: saving must ALWAYS convert an old
   inline config to new-style, so keep both consumers on this single copy.

   The two former copies (proto handler / settings view) were behaviourally
   identical for modemSid/ensureModemSid — the settings view merely resolved
   its target interface itself before calling; bindModem() existed only in the
   proto handler. This module carries the proto-handler (newer) semantics. */

function modemSid(ifaceSid) {
	var ref = uci.get('network', ifaceSid, 'modem');
	if (ref && uci.get('network', ref) != null)
		return ref;
	return null;
}

function ensureModemSid(ifaceSid) {
	var sid = modemSid(ifaceSid);
	if (sid)
		return sid;
	var base = 'wwmodem_' + ifaceSid, name = base, i = 0;
	while (uci.get('network', name) != null)
		name = base + (++i);
	uci.add('network', 'wwand_modem', name);
	uci.set('network', ifaceSid, 'modem', name);
	return name;
}

/* Redirect a form option's storage to the interface's wwand_modem section.
   Reads new-style (wwand_modem) or, until one exists, legacy inline; writes
   new-style and clears any legacy inline copy. */
function bindModem(o) {
	/* WAS THE MODEM RESOLVABLE THE FIRST TIME THIS OPTION WAS READ. A form is
	   drawn before it is saved, so the first read is the render — and the
	   render is the only moment that tells us whether the widget the user
	   looked at was showing the modem's value or a default.

	   RECORDED ONCE PER SECTION AND NEVER OVERWRITTEN. That is the whole
	   difference from the attempt described in remove() below: form.js:2148
	   calls cfgvalue again inside save(), by which time an earlier option has
	   written `option modem` and the lookup succeeds — so a recording that
	   updates on every call always ends up saying "resolved", including for
	   the form that never resolved it at render. */
	var seenResolved = {};

	o.cfgvalue = function(sid) {
		var opt = this.ucioption || this.option;
		var msid = modemSid(sid);

		if (!(sid in seenResolved))
			seenResolved[sid] = (msid != null);

		return uci.get('network', msid || sid, opt);
	};
	o.write = function(sid, val) {
		var opt = this.ucioption || this.option;
		var msid = ensureModemSid(sid);
		uci.set('network', msid, opt, val);
		/* `device` on the interface is the daemon-managed L3 device handle (the
		   mux child / netdev the daemon writes back), NOT a legacy inline modem
		   netdev — never clear it here. Other modem options still migrate. */
		if (msid != sid && opt != 'device')
			uci.unset('network', sid, opt);
	};
	o.remove = function(sid) {
		var opt = this.ucioption || this.option;

		/* NEVER delete on the wwand_modem section from here.

		   This redirect is used by the INTERFACE form (the proto handler). That
		   form only REFERENCES a modem; the section belongs to the hardware and
		   is shared with every other interface on it. An empty field here is
		   almost never "the user cleared this", because the fields are blank
		   whenever the form did not resolve the modem — and LuCI then calls
		   remove() for each of them on save.

		   Two earlier attempts got this wrong, both by assuming when cfgvalue
		   runs:
		     - the original had no guard at all, so adding a SECOND interface on
		       an existing modem deleted its `path` (openwrt/packages#30185);
		     - the next recorded which section cfgvalue had addressed and
		       compared at remove() time. That cannot work: form.js:2148 calls
		       cfgvalue inside save(), AFTER `option modem` has been written by
		       an earlier option, so the recorded value resolves to the modem
		       section and the comparison passes. It also never runs at all for
		       an inactive option (form.js:2167). Reported still broken on r29
		       (ddimension/luci-app-wwand#7), with `reset_gpio` gone as well.

		   Clearing a modem-level option is the MODEMS page's job, where the
		   section IS the wwand_modem and `bind` is a pass-through — there
		   remove() reaches it directly and means what it says. What this one
		   still does is drop a legacy inline copy from the interface, which is
		   the migration half and touches nothing shared.

		   A CHECKBOX IS THE ONE CASE THIS CAN DECIDE, and it had to be carved
		   out because the blanket refusal made it impossible to switch a
		   modem-level flag OFF from the interface form at all: form.Flag sets
		   `default = disabled` in its constructor (form.js:3998-4003), so
		   unchecking always lands in parse()'s remove branch (form.js:4109),
		   and this function then did nothing. The box stayed ticked after
		   Save, with "no changes to apply" — reported for `gnss` by obsy
		   (ddimension/luci-app-wwand#11, 2026-09-22) and true of all seven
		   modem-bound flags.

		   What makes it decidable: a checkbox has no blank state. formvalue()
		   returns `enabled` or `disabled` and nothing else, so "the user
		   cleared it" and "the form never resolved the modem" cannot be
		   confused — the second is answered by seenResolved above, at render,
		   before any save can muddy it. Off is then WRITTEN rather than
		   removed, which the daemon reads identically (config.uc bool_opt
		   treats '0' and absent alike), and only for an option that is
		   currently set to something else, so a form that touched nothing
		   writes nothing.

		   `disabled` is the Flag test HERE, not in general: LuCI puts that
		   property on TextValue too (form.js:5347). It holds because every
		   option modemopts binds is a Flag, a plain Value or a ListValue, and
		   only form.Flag's constructor sets enabled/disabled
		   (form.js:3998-4003). Binding a TextValue through here would need
		   this narrowed first. Raised by Codex review, 2026-09-22. */
		if (this.disabled != null && seenResolved[sid] === true) {
			var msid = modemSid(sid);
			var cur = msid ? uci.get('network', msid, opt) : null;

			if (cur != null && cur != this.disabled)
				uci.set('network', msid, opt, this.disabled);
		}

		if (opt != 'device')
			uci.unset('network', sid, opt);
	};

	return o;
}

return baseclass.extend({
	modemSid: modemSid,
	ensureModemSid: ensureModemSid,
	bindModem: bindModem
});
