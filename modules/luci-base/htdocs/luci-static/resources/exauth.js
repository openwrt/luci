'use strict';
'require view';
'require form';
'require uci';
'require rpc';

var callListAuthPlugins = rpc.declare({
	object: 'luci',
	method: 'listAuthPlugins',
	expect: { }
});

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('luci'),
			callListAuthPlugins()
		]);
	},

	render: function(data) {
		var pluginsData = data[1] || { external_auth: '0', plugins: [] };
		var plugins = pluginsData.plugins || [];

		var m, s, o;

		m = new form.Map('luci', _('Authentication Settings'),
			_('Configure global authentication settings and manage individual authentication plugins.'));

		// Global settings section
		s = m.section(form.NamedSection, 'main', 'core', _('Global Settings'),
			_('Enable or disable external authentication system-wide. When disabled, only password authentication is used.'));
		s.anonymous = true;

		o = s.option(form.Flag, 'external_auth', _('Enable External Authentication'),
			_('When enabled, authentication plugins in /usr/share/luci/auth.d/ will be loaded and used for additional verification during login.'));
		o.rmempty = false;

		// Plugin settings section
		s = m.section(form.NamedSection, 'sauth', 'internal', _('Authentication Plugins'),
			_('Enable or disable individual authentication plugins. Disabled plugins will be skipped during login.'));
		s.anonymous = true;

		// Ensure the sauth section exists
		s.cfgsections = function() {
			var sections = uci.sections('luci', 'internal').filter(function(sec) {
				return sec['.name'] === 'sauth';
			});
			if (sections.length === 0) {
				uci.add('luci', 'internal', 'sauth');
			}
			return ['sauth'];
		};

		if (plugins.length > 0) {
			// Create a Flag option for each plugin
			// The UCI option stores '_disabled=1' when disabled, so label reflects this
			for (var i = 0; i < plugins.length; i++) {
				var plugin = plugins[i];
				var optionName = plugin.name + '_disabled';

				o = s.option(form.Flag, optionName,
					_('Disable %s').format(plugin.name),
					_('Check to disable this plugin. Plugin file: %s').format(plugin.filename));
				o.rmempty = false;
			}
		} else {
			// Show informational message when no plugins exist
			o = s.option(form.DummyValue, '_no_plugins');
			o.rawhtml = true;
			o.cfgvalue = function() {
				return '<em>' + _('No authentication plugins found in /usr/share/luci/auth.d/') + '</em>';
			};
		}

		return m.render();
	}
});
