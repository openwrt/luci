'use strict';
'require view';
'require form';

return view.extend({
	render: function() {
		var m, s, o;

		m = new form.Map('yggdrasil', 'Yggdrasil');

		o = m.section(form.TableSection, "peer", _("Peers"),
			_("List of connection strings for outbound peer connections in URI format, " +
				"e.g. tcp://a.b.c.d:e or socks://a.b.c.d:e/f.g.h.i:j. These connections " +
				"will obey the operating system routing table, therefore you should " +
				"use this section when you may connect via different interfaces."));
		o.option(form.Value, "uri", "URI");
		o.anonymous = true;
		o.addremove = true;

		o = m.section(form.TableSection, "interface_peer", _("Interface peers"),
			_("List of connection strings for outbound peer connections in URI format, " +
				"arranged by source interface, e.g. { \"eth0\": [ tcp://a.b.c.d:e ] }. " +
				"Note that SOCKS peerings will NOT be affected by this option and should " +
				"go in the \"Peers\" section instead."));
		o.option(form.Value, "interface", _("Interface"));
		o.option(form.Value, "uri", "URI");
		o.anonymous = true;
		o.addremove = true;

		return m.render();
	}
});
