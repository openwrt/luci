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
	o.cfgvalue = function(sid) {
		var opt = this.ucioption || this.option;
		var msid = modemSid(sid);
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
		var msid = modemSid(sid);
		if (msid)
			uci.unset('network', msid, opt);
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
