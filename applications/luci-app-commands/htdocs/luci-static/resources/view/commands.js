'use strict';

'require view';
'require form';

return view.extend({
	render: function(data) {
		var m, s, o;

		m = new form.Map('luci', _('Custom Commands'),
			_('This page allows you to configure custom shell commands which can be easily invoked from the web interface.'));

		s = m.section(form.GridSection, 'command');
		s.nodescriptions = true;
		s.anonymous = true;
		s.addremove = true;

		o = s.option(form.Value, 'name', _('Description'),
			_('A short textual description of the configured command'));

		o = s.option(form.Value, 'command', _('Command'), _('Command line to execute'));
		o.textvalue = function(section_id) {
			return E('code', [ this.cfgvalue(section_id) ]);
		};

		o = s.option(form.Flag, 'param', _('Custom arguments'),
			_('Allow the user to provide additional command line arguments'));

		o = s.option(form.Flag, 'public', _('Public access'),
			_('Allow executing the command and downloading its output without prior authentication'));

		return m.render();
	}
});
