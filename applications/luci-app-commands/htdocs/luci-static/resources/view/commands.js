'use strict';

'require view';
'require form';
'require uci';

return view.extend({
	render: function(data) {
		let m, s, o;

		m = new form.Map('luci', _('Custom Commands'),
			_('This page allows you to configure custom shell commands which can be easily invoked from the web interface.'));

		s = m.section(form.GridSection, 'command');
		s.nodescriptions = true;
		s.anonymous = true;
		s.addremove = true;
		s.sortable = true;

		o = s.option(form.Value, 'name', _('Name'),
			_('A short name for the configured command'));

		o = s.option(form.Value, 'description', _('Description'),
			_('An optional longer description to display on the execution page'));
		o.optional = true;

		o = s.option(form.Value, 'id', _('Persistent ID'),
			_('An optional, fixed identifier to use in the public command URL. Once set, the URL keeps working even if other commands are added, removed or reordered. Leave empty to keep relying on the automatically generated, unstable identifier. The identifier must not end with the letter "s".'));
		o.optional = true;
		o.datatype = 'uciname';
		o.validate = function(section_id, value) {
			if (value == null || value == '')
				return true;

			if (/s$/.test(value))
				return _('The identifier must not end with the letter "s"');

			let dup = uci.sections('luci', 'command').some(function(cmd) {
				return cmd['.name'] != section_id && (cmd.id == value || cmd['.name'] == value);
			});

			return dup ? _('This identifier is already used by another command') : true;
		};

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
