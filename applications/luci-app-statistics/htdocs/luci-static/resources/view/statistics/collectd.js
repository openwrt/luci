'use strict';
'require view';
'require dom';
'require fs';
'require ui';
'require uci';
'require form';

return view.extend({
	load: function() {
		return Promise.all([
			fs.list('/usr/lib/collectd'),
			fs.list('/usr/share/luci/statistics/plugins'),
			uci.load('luci_statistics')
		]).then(function(data) {
			var installed = data[0],
			    plugins = data[1],
			    tasks = [];

			for (var i = 0; i < plugins.length; i++) {
				tasks.push(fs.read_direct('/usr/share/luci/statistics/plugins/' + plugins[i].name, 'json').then(L.bind(function(name, spec) {
					return L.resolveDefault(L.require('view.statistics.plugins.' + name)).then(function(form) {
						if (!uci.get('luci_statistics', 'collectd_' + name))
							uci.add('luci_statistics', 'statistics', 'collectd_' + name);

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
		var m, s, o, enabled;

		for (var i = 0; i < plugins.length; i++)
			plugins[plugins[i].name] = plugins[i];

		m = new form.Map('luci_statistics', _('Collectd Settings'));
		m.tabbed = true;

		s = m.section(form.NamedSection, 'collectd', 'statistics', _('Collectd Settings'));

		o = s.option(form.Value, 'Hostname', _('Hostname'));
		o.load = function() {
			return fs.trimmed('/proc/sys/kernel/hostname').then(L.bind(function(name) {
				this.placeholder = name;
				return uci.get('luci_statistics', 'collectd', 'Hostname');
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

		o = s.option(form.Flag, 'FQDNLookup', _('Try to look up fully qualified hostname'));
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

			enabled = s.option(form.Flag, 'enable', _('Enabled'));
			enabled.editable = true;
			enabled.modalonly = false;
			enabled.renderWidget = function(section_id, option_index, cfgvalue) {
				var widget = form.Flag.prototype.renderWidget.apply(this, [section_id, option_index, cfgvalue]);

				widget.querySelector('input[type="checkbox"]').addEventListener('click', L.bind(function(section_id, plugin, ev) {
					if (ev.target.checked && plugin && plugin.form.addFormOptions)
						this.section.renderMoreOptionsModal(section_id);
				}, this, section_id, plugins[section_id.replace(/^collectd_/, '')]));

				return widget;
			};

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

				var opt = s.children.filter(function(o) { return o.option == 'enable' })[0];
				if (opt)
					opt.cfgvalue = function(section_id, set_value) {
						if (arguments.length == 2)
							return form.Flag.prototype.cfgvalue.apply(this, [section_id, enabled.formvalue(section_id)]);
						else
							return form.Flag.prototype.cfgvalue.apply(this, [section_id]);
					};
			};

			s.renderRowActions = function(section_id) {
				var name = section_id.replace(/^collectd_/, ''),
				    plugin = plugins[name];

				var trEl = this.super('renderRowActions', [ section_id, _('Configure…') ]);

				if (!plugin || !plugin.form.addFormOptions)
					dom.content(trEl, null);

				return trEl;
			};
		}

		return m.render();
	}
});
