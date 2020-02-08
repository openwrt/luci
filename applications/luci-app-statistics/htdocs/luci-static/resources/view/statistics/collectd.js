'use strict';
'require fs';
'require ui';
'require uci';
'require form';

return L.view.extend({
	load: function() {
		return Promise.all([
			fs.list('/usr/lib/collectd'),
			fs.list('/usr/share/luci/statistics/plugins')
		]).then(function(data) {
			var installed = data[0],
			    plugins = data[1],
			    tasks = [];

			for (var i = 0; i < plugins.length; i++) {
				tasks.push(fs.read_direct('/usr/share/luci/statistics/plugins/' + plugins[i].name, 'json').then(L.bind(function(name, spec) {
					return L.resolveDefault(L.require('view.statistics.plugins.' + name)).then(function(form) {
						return {
							name: name,
							spec: spec,
							form: form,
							installed: installed.filter(function(e) { return e.name == name + '.so' }).length > 0
						};
					});
				}, this, plugins[i].name.replace(/\.json$/, ''))));
			}

			return Promise.all(tasks);
		});
	},

	render: function(plugins) {
		var m, s, o;

		for (var i = 0; i < plugins.length; i++)
			plugins[plugins[i].name] = plugins[i];

		m = new form.Map('luci_statistics', _('Collectd Settings'));
		m.tabbed = true;

		s = m.section(form.NamedSection, 'collectd', 'statistics', _('Collectd Settings'));

		o = s.option(form.Value, 'Hostname', _('Hostname'));
		o.load = function() {
			return fs.trimmed('/proc/sys/kernel/hostname').then(L.bind(function(name) {
				this.placeholder = name;
				return uci.get('collectd', 'statistics', 'hostname');
			}, this));
		};

		o = s.option(form.Value, 'BaseDir', _('Base Directory'));
		o.default = '/var/run/collectd';

		o = s.option(form.Value, 'Include', _('Directory for sub-configurations'));
		o.default = '/etc/collectd/conf.d/*.conf';

		o = s.option(form.Value, 'PluginDir', _('Directory for collectd plugins'));
		o.default = '/usr/lib/collectd/';

		o = s.option(form.Value, 'PIDFile', _('Used PID file'));
		o.default = '/var/run/collectd.pid';

		o = s.option(form.Value, 'TypesDB', _('Datasets definition file'));
		o.default = '/etc/collectd/types.db';

		o = s.option(form.Value, 'Interval', _('Data collection interval'), _('Seconds'));
		o.default = '60';

		o = s.option(form.Value, 'ReadThreads', _('Number of threads for data collection'));
		o.default = '5';

		o = s.option(form.Flag, 'FQDNLookup', _('Try to lookup fully qualified hostname'));
		o.default = o.disabled;
		o.optional = true;
		o.depends('Hostname', '');

		var groupNames = [
			'general', _('General plugins'),
			'network', _('Network plugins'),
			'output', _('Output plugins')
		];

		for (var i = 0; i < groupNames.length; i += 2) {
			s = m.section(form.GridSection, 'statistics_' + groupNames[i], groupNames[i + 1]);

			s.cfgsections = L.bind(function(category) {
				return this.map.data.sections('luci_statistics', 'statistics')
					.map(function(s) { return s['.name'] })
					.filter(function(section_id) {
						var name = section_id.replace(/^collectd_/, ''),
						    plugin = plugins[name];

						return (section_id.indexOf('collectd_') == 0 && plugin != null &&
						        plugin.installed && plugin.spec.category == category);
					});
			}, s, groupNames[i]);

			s.sectiontitle = function(section_id) {
				var name = section_id.replace(/^collectd_/, ''),
				    plugin = plugins[name];

				return plugin ? plugin.spec.title : name
			};

			o = s.option(form.Flag, 'enable', _('Enabled'));
			o.editable = true;
			o.modalonly = false;

			o = s.option(form.DummyValue, '_dummy', _('Status'));
			o.width = '50%';
			o.modalonly = false;
			o.textvalue = function(section_id) {
				var name = section_id.replace(/^collectd_/, ''),
				    section = uci.get('luci_statistics', section_id),
				    plugin = plugins[name];

				if (section.enable != '1')
					return E('em', {}, [_('Plugin is disabled')]);

				var summary = plugin ? plugin.form.configSummary(section) : null;
				return summary || E('em', _('none'));
			};

			s.modaltitle = function(section_id) {
				var name = section_id.replace(/^collectd_/, ''),
				    plugin = plugins[name];

				return plugin ? plugin.form.title : null;
			};

			s.addModalOptions = function(s) {
				var name = s.section.replace(/^collectd_/, ''),
				    plugin = plugins[name];

				if (!plugin)
					return;

				s.description = plugin.form.description;

				plugin.form.addFormOptions(s);
			};

			s.renderRowActions = function(section_id) {
				var name = section_id.replace(/^collectd_/, ''),
				    plugin = plugins[name];

				var trEl = this.super('renderRowActions', [ section_id, _('Configure…') ]);

				if (!plugin || !plugin.form.addFormOptions)
					L.dom.content(trEl, null);

				return trEl;
			};
		}

		return m.render();
	}
});
