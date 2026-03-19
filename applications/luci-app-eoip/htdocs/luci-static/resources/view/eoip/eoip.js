'use strict';
'require form';
'require view';
'require uci';

return view.extend({
	render: function() {
		var m, s, n, id, d, o, v;
		
		m = new form.Map("eoip", _("EoIP - Tunneling"), _("Here you can configure EoIP tunnel. At current moment it is easiest way to create stateless tunnel with Mikrotik."));

		s = m.section(form.TypedSection, "eoip", _("Settings"));
		s.addremove = true;
		s.anonymous = true;
		
		o = s.option(form.Flag, "enabled", _("Enable tunnel"));

		n = s.option(form.Value, "name", _("Name interface [zeoip"), _("If you input 0 interface name zeoip0"));
		n.rmempty = false;
		n.datatype = "uinteger";
		n.default = 0;
		n.validate = function(section_id, value) {
                        var sections = uci.sections('eoip');
                        for (var i = 0; i < sections.length; i++) {
                                if (uci.get('eoip', sections[i]['.name'], 'name') == value && section_id != sections[i]['.name'])
                                {return _('Name interface already in used');}

                        }
                return true;
                };

		
		id = s.option(form.Value, "idtun", _("ID tunnel"), _("Indeficator id tunnel"));
		id.rmempty = false;
		id.datatype = "and(min(1), integer)";
		id.default = 1;
		
		d = s.option(form.Value, "dst", _("Destination"), _("Destination IP address for connection EoIP."));
		d.rmempty = false;
		d.datatype = "ipaddr";
		d.placeholder = "0.0.0.0";
		
		o = s.option(form.Flag, "dynamic", _("Dynamic"), _("If you use dynamic option, take attention that there is no authorization, and it is not secure. It is not good idea to use this feature with public ip or insecure(not completely under your control, each host) network."));
		
		v = s.option(form.DynamicList,"vlan", _("VLAN"), _("VLAN TAG on this interface"));
		v.datatype = "range(1,4094)";

		return m.render();
	}
});
