'use strict';

'require form';
'require uci';
'require view';

return view.extend({
	load: function () {
		return Promise.all([
			uci.load('rpcd')
		]);
	},

	render: function () {
		let m, s, o;

		if (!uci.get('rpcd', 'policy'))
			uci.add('rpcd', 'policy', 'policy');

		m = new form.Map('rpcd', _('Policy'));
		m.readonly = !L.hasViewPermission();

		s = m.section(form.NamedSection, 'policy')
		s.addremove = false;
		s.anonymous = true;

		o = s.option(form.Flag, 'enabled',
			_('Enable password policy'));
		o.default = o.disabled;

		o = s.option(form.Value, 'pw_length',
			_('Require a minimum password length'));
		o.datatype = 'uinteger';
		o.rmempty = true;
		o.depends('enabled', '1');

		o = s.option(form.Flag, 'digits',
			_('Require digits'));
		o.default = o.disabled;
		o.rmempty = true;
		o.depends('enabled', '1');

		o = s.option(form.Flag, 'uc_lc',
			_('Require upper/lower case'));
		o.default = o.disabled;
		o.rmempty = true;
		o.depends('enabled', '1');

		o = s.option(form.Flag, 'special_characters',
			_('Require special characters <br/> (e.g., !, @, #, $, %, &)'));
		o.default = o.disabled;
		o.rmempty = true;
		o.depends('enabled', '1');

		return m.render();
	}
});
