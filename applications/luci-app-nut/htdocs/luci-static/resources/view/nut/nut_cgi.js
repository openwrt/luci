'use strict';
'require form';
'require view';

return view.extend({
	load: function() {

	},

	render: function() {
		let m, s, o;

		m = new form.Map('nut_cgi', _('NUT CGI'),
			_('Network UPS Tools CGI Configuration') + '<br />' +
			'%s'.format('<a href="/nut">%s</a>'.format(_('Go to NUT CGI'))));

		s = m.section(form.TypedSection, 'host', _('Host'));
		s.addremove = true;
		s.anonymous = true;

		o = s.option(form.Value, 'upsname', _('UPS name'), _('As configured by NUT'));
		o.optional = false;

		o = s.option(form.Value, 'hostname', _('Hostname or IP address'));
		o.optional = false;
		o.datatype = 'or(host,ipaddr)';

		o = s.option(form.Value, 'port', _('Port'));
		o.datatype = 'port';
		o.optional = true;
		o.placeholder = 3493;

		o = s.option(form.Value, 'displayname', _('Display name'));
		o.optional = false;

		s = m.section(form.TypedSection, 'upsset', _('Control UPS via CGI'));
		s.addremove = false;
		s.anonymous = true;
		s.optional = false;

		o = s.option(form.Flag, 'enable', _('Enable'));
		o.optional = false;
		o.default = false;

		return m.render();
	}
});
