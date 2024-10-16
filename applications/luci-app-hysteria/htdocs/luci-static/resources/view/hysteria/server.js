'use strict';
'require view';
'require form';

return view.extend({
	render: function() {
		var m, s, o;

		m = new form.Map('hysteria', _('Hysteria Server'),
			_('Hysteria is a powerful, lightning fast and censorship resistant proxy.'));

		s = m.section(form.TypedSection, 'server');
		s.anonymous = false;
		s.addremove = true;
		s.addbtntitle = _('Add server instance', 'Hysteria Serverd instance');

		s.option(form.Flag, 'enabled',
			_('Enabled'),
			_('Enable Hysteria Server instance.'));

		o = s.option(form.Value, 'confdir',
			_('Configuration Directory'),
			_('Directory where the Hysteria Server configuration file is located.')
		)
		o.optional = true;
		o.placeholder = '/etc/hysteria';

		o = s.option(form.Value, 'conffile',
			_('Configuration File'),
			_('Hysteria Server configuration file.')
		)
		o.optional = true;
		o.render = function(option_index, section_id, in_table) {
			this.placeholder = section_id + '.yaml';

			return Promise.resolve(this.cfgvalue(section_id))
				.then(this.renderWidget.bind(this, section_id, option_index))
				.then(this.renderFrame.bind(this, section_id, in_table, option_index));
		};

		return m.render();
	},
});
