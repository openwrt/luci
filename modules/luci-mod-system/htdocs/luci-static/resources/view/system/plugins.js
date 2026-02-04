'use strict';
'require dom';
'require form';
'require fs';
'require uci';
'require view';

// const plugins_path = '/usr/share/ucode/luci/plugins';
const view_plugins = `/www/${L.resource('view/plugins')}`;

const luci_plugins = 'luci_plugins';

return view.extend({
	load() {
		return Promise.all([
			L.resolveDefault(fs.list(`/www/${L.resource('view/plugins')}`), []).then((entries) => {
				return Promise.all(entries.filter((e) => {
					return (e.type == 'file' && e.name.match(/\.js$/));
				}).map((e) => {
					return 'view.plugins.' + e.name.replace(/\.js$/, '');
				}).sort().map((n) => {
					return L.require(n);
				}));
			}),
			uci.load(luci_plugins),
		])
	},

	render([plugins]) {
		let m, s, o, p_enabled;
		const groups = new Set();

		// Set global uci config if absent
		if (!uci.get(luci_plugins, 'global')) {
			uci.add(luci_plugins, 'global', 'global');
		}

		for (let plugin of plugins) {
			const name = plugin.id;
			const class_type = `${plugin.class}_${plugin.type}`;
			const class_type_i18n = `${plugin.class_i18n} ${plugin.type_i18n}`
			groups.add(class_type);
			groups[class_type] = class_type_i18n;
			plugins[plugin.id] = plugin;

			// Set basic uci config for each plugin if absent
			if (!uci.get(luci_plugins, plugin.id)) {
				// add the plugin via its uuid under its class+type for filtering
				uci.add(luci_plugins, class_type, plugin.id);
				uci.set(luci_plugins, plugin.id, 'name', plugin.name);
			}
		}

		m = new form.Map(luci_plugins, _('Plugins'));
		m.tabbed = true;

		s = m.section(form.NamedSection, 'global', 'global', _('Global Settings'));

		o = s.option(form.Flag, 'enabled', _('Enabled'));
		o.default = o.disabled;
		o.optional = true;

		for (const group of new Set([...groups].sort())) {
			o = s.option(form.Flag, group + '_enabled', groups[group] + ' ' + _('Enabled'));
			o.default = o.disabled;
			o.optional = true;
		}

		for (const group of new Set([...groups].sort())) {

			s = m.section(form.GridSection, group, groups[group]);

			s.sectiontitle = function(section_id) {
				const plugin = plugins[section_id];

				return plugin.title;
			};

			p_enabled = s.option(form.Flag, 'enabled', _('Enabled'));
			p_enabled.editable = true;
			p_enabled.modalonly = false;
			p_enabled.renderWidget = function(section_id, option_index, cfgvalue) {
				const widget = form.Flag.prototype.renderWidget.apply(this, [section_id, option_index, cfgvalue]);

				widget.querySelector('input[type="checkbox"]').addEventListener('click', L.bind(function(section_id, plugin, ev) {
					if (ev.target.checked && plugin && plugin.addFormOptions)
						this.section.renderMoreOptionsModal(section_id);
				}, this, section_id, plugins[section_id]));

				return widget;
			};

			o = s.option(form.DummyValue, '_dummy', _('Status'));
			o.width = '50%';
			o.modalonly = false;
			o.textvalue = function(section_id) {
				const section = uci.get(luci_plugins, section_id);
				const plugin = plugins[section_id];

				if (section.enabled != '1')
					return E('em', {}, [_('Plugin is disabled')]);

				const  summary = plugin ? plugin.configSummary(section) : null;
				return summary || E('em', _('none'));
			};

			s.modaltitle = function(section_id) {
				const plugin = plugins[section_id];

				return plugin ? plugin.title : null;
			};

			s.addModalOptions = function(s) {
				const name = s.section;
				const plugin = plugins[name];

				if (!plugin)
					return;

				s.description = plugin.description;

				plugin.addFormOptions(s);

				const opt = s.children.filter(function(o) { return o.option == 'enabled' })[0];
				if (opt)
					opt.cfgvalue = function(section_id, set_value) {
						if (arguments.length == 2)
							return form.Flag.prototype.cfgvalue.apply(this, [section_id, p_enabled.formvalue(section_id)]);
						else
							return form.Flag.prototype.cfgvalue.apply(this, [section_id]);
					};
			};

			s.renderRowActions = function(section_id) {
				const plugin = plugins[section_id];

				const trEl = this.super('renderRowActions', [ section_id, _('Configure…') ]);

				if (!plugin || !plugin.addFormOptions)
					dom.content(trEl, null);

				return trEl;
			};
		}

		return m.render();
	}
});
