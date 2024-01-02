'use strict';
'require view';
'require form';
'require ui';
'require uci';

return view.extend({
	load: function () {
		return Promise.all([uci.load('luci_olsr')]);
	},
	render: function () {
		var m, s, o;

		m = new form.Map('luci_olsr', _('OLSR - Display Options'));

		s = m.section(form.TypedSection, 'olsr');
		s.anonymous = true;

		var res = s.option(
			form.Flag,
			'resolve',
			_('Resolve'),
			_('Resolve hostnames on status pages. It is generally safe to allow this, but if you use public IPs and have unstable DNS-Setup then those pages will load really slow. In this case disable it here.')
		);
		res.default = '0';
		res.optional = true;

		return m.render();
	},
});
