'use strict';
'require view';
'require form';

return view.extend({
	render: function() {
		var m, s, o;

		m = new form.Map('dhcp', _('ISC DHCP Dynamic DNS'));

		s = m.section(form.NamedSection, 'dynamicdns', 'dynamicdns');
		s.addremove = false;
		s.nodescription = true;

		o = s.option(form.Value, 'server', _('Server'));
		o.optional = false;
		o.rmempty = false;
		o.datatype = 'ipaddr';

		o = s.option(form.Value, 'key_name', _('Key Name'));
		o.optional = false;
		o.rmempty = false;
		o.datatype = 'string';

		o = s.option(form.ListValue, 'key_algo', _('Key Algorithm'));
		o.optional = false;
		o.rmempty = false;
		o.value('hmac-sha256', _('HMAC-SHA256'));

		o = s.option(form.Value, 'key_secret', _('Key Secret'));
		o.optional = false;
		o.rmempty = false;
		o.datatype = 'string';
		o.modalonly = true;

		o = s.option(form.DynamicList, 'zones', _('Zones'));
		o.optional = false;
		o.rmempty = false;

		return m.render();
	}
});
