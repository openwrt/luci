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
