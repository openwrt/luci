'use strict';
'require view';
'require form';

return view.extend({
	render: function() {
		let m, s, o;

		m = new form.Map('keepalived');

		s = m.section(form.GridSection, 'url', _('URLs'),
			_('URLs can be referenced into Real Servers to test'));
		s.anonymous = true;
		s.addremove = true;
		s.nodescriptions = true;

		o = s.option(form.Value, 'name', _('Name'));
		o.optional = false;

		o = s.option(form.Value, 'path', _('URL Path'),
			_('URL path, i.e path /, or path /mrtg2/'));
		o.optional = false;

		o = s.option(form.Value, 'digest', _('Digest'),
			_('Digest computed with genhash'));
		o.datatype = 'length(32)';

		return m.render();
	}
});
