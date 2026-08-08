'use strict';
'require view';
'require form';
'require uci';
'require wwand.modemopts as modemopts';
'require wwand.simlist as simlist';

/* Dedicated wwand modem editor (Network → Modems). Manages the
   `config wwand_modem` sections in /etc/config/network directly — the same
   hardware / SIM / radio / resilience options the interface proto handler shows
   inline, shared via wwand.modemopts. A modem is referenced from an interface
   (proto wwand) by its section name; several interfaces can share one modem via
   different mux channels (set per-interface, not here). */

return view.extend({
	load: function() {
		return uci.load('network');
	},

	render: function() {
		var m, s, o;

		m = new form.Map('network', _('Mobile Modems'),
			_('Cellular modems managed by wwand. Each modem is referenced from an interface (Network → Interfaces, protocol "Cellular / 5G") by its name; its hardware, SIM and radio settings live here. Several interfaces can share one modem through different mux channels.'));

		s = m.section(form.TypedSection, 'wwand_modem', _('Modems'),
			_('Add a modem here, then point an interface at it with the "Modem" field on the interface page.'));
		s.addremove = true;
		s.anonymous = false;
		s.addbtntitle = _('Add modem');
		s.nodescriptions = false;

		s.tab('modem', _('Modem & SIM'), _('Which modem, and its SIM.'));
		s.tab('radio', _('Radio & Cell'), _('Radio technology, manual operator selection and cell lock.'));
		s.tab('resilience', _('Resilience'), _('Recovery, watchdogs and telemetry cadence.'));

		/* on this page the edited section IS the wwand_modem, so options store
		   directly (no interface→modem redirect). */
		var direct = function(o) { return o; };

		/* the modem identity comes first (the interface page picks this via a
		   dropdown; here it is a plain field, with the optional USB path below). */
		o = s.taboption('modem', form.Value, 'device', _('Modem device'),
			_('Network device name (e.g. wwan0), a mux parent, or a control node (/dev/cdc-wdm0). Leave empty and set only the USB path to bind purely by topology.'));

		modemopts.addModemSim(s, 'modem', direct);
		modemopts.addRadio(s, 'radio', direct);
		modemopts.addCellLock(s, 'radio', direct);
		modemopts.addResilience(s, 'resilience', direct);

		/* per-ICCID SIM overrides (PIN/APN), the same list shown inline on the
		   interface page — shared via wwand.simlist */
		simlist.addSimList(m, {});

		return m.render();
	}
});
