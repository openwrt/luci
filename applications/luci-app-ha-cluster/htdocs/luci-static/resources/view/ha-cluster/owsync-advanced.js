/*
 * Copyright (c) 2025-2026 Pierre Gaufillet <pierre.gaufillet@bergamote.eu>
 * SPDX-License-Identifier: Apache-2.0
 */
'use strict';
'require view';
'require form';
'require uci';
'require ui';
'require fs';

var ChipListValue = form.Value.extend({
	__name__: 'CBI.ChipListValue',

	renderChip: function(container, value) {
		var self = this;
		var chip = E('span', {
			'style': 'display: inline-flex; align-items: center; margin: 2px 4px 2px 0; padding: 3px 8px; border: 1px solid currentColor; border-radius: 12px; font-family: monospace; font-size: 12px;',
			'data-value': value
		}, [
			E('span', {}, value),
			E('button', {
				'type': 'button',
				'style': 'border: none; background: transparent; cursor: pointer; margin-left: 6px; padding: 0; font-size: 14px; color: inherit; line-height: 1;',
				'title': _('Remove'),
				'click': function(ev) {
					ev.currentTarget.parentNode.remove();
				}
			}, '\u00d7')
		]);
		container.appendChild(chip);
	},

	renderWidget: function(section_id, option_index, cfgvalue) {
		var values = L.toArray(cfgvalue);
		var self = this;

		var chipsContainer = E('div', {
			'id': this.cbid(section_id) + '-chips',
			'style': 'display: flex; flex-wrap: wrap; align-items: center; min-height: 32px; padding: 4px 0;'
		});

		values.forEach(function(v) {
			self.renderChip(chipsContainer, v);
		});

		if (values.length === 0) {
			chipsContainer.appendChild(E('span', {
				'style': 'font-style: italic;'
			}, _('No exclusions configured')));
		}

		var input = E('input', {
			'type': 'text',
			'class': 'cbi-input-text',
			'placeholder': this.placeholder || '',
			'style': 'flex: 1; min-width: 200px;'
		});

		var addBtn = E('button', {
			'type': 'button',
			'class': 'cbi-button cbi-button-add',
			'style': 'margin-left: 4px;',
			'click': L.bind(function(ev) {
				var val = input.value.trim();
				if (!val) return;

				var existing = chipsContainer.querySelectorAll('[data-value]');
				for (var i = 0; i < existing.length; i++) {
					if (existing[i].getAttribute('data-value') === val) {
						ui.addNotification(null, E('p', _('Pattern already exists.')));
						return;
					}
				}

				// Remove placeholder text if present
				var placeholder = chipsContainer.querySelector('span[style*="italic"]');
				if (placeholder) placeholder.remove();

				this.renderChip(chipsContainer, val);
				input.value = '';
			}, this)
		}, _('Add'));

		return E('div', {}, [
			chipsContainer,
			E('div', { 'style': 'display: flex; align-items: center; margin-top: 4px;' }, [
				input,
				addBtn
			])
		]);
	},

	formvalue: function(section_id) {
		var container = document.getElementById(this.cbid(section_id) + '-chips');
		if (!container) return [];

		var chips = container.querySelectorAll('[data-value]');
		var values = [];
		for (var i = 0; i < chips.length; i++) {
			values.push(chips[i].getAttribute('data-value'));
		}
		return values;
	},

	write: function(section_id, formvalue) {
		uci.set('ha-cluster', section_id, this.option, formvalue);
	},

	remove: function(section_id) {
		uci.unset('ha-cluster', section_id, this.option);
	}
});

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('ha-cluster'),
			L.resolveDefault(fs.stat('/usr/bin/owsync'), null),
			L.resolveDefault(ui.menu.load(), null)
		]);
	},

	render: function(data) {
		var owsyncInstalled = data[1] != null;

		if (!owsyncInstalled) {
			// The Software page comes with luci-app-package-manager
			var softwarePage = [ 'admin', 'system', 'package-manager' ].reduce(function(node, name) {
				return (node && node.children) ? node.children[name] : null;
			}, data[2]);
			var hint = E('div', { 'class': 'alert-message warning' },
				E('p', {}, _('Install the owsync package to synchronize configuration files.')));
			if (softwarePage && softwarePage.satisfied)
				hint.appendChild(E('div', { 'class': 'right' }, E('a', { 'class': 'btn', 'href': L.url('admin/system/package-manager') }, _('Go to Software…'))));
			return E('div', { 'class': 'cbi-map' }, [
				E('h2', {}, _('High Availability - Advanced Config Sync')),
				hint
			]);
		}

		var m, s, o;
		var self = this;
		var baseServices = ['dhcp', 'firewall'];

		// UCI boolean as read by config_get_bool
		var getBool = function(value, dflt) {
			if (['1', 'on', 'true', 'yes', 'enabled'].indexOf(value) !== -1)
				return true;
			if (['0', 'off', 'false', 'no', 'disabled'].indexOf(value) !== -1)
				return false;
			return dflt;
		};

		m = new form.Map('ha-cluster', _('High Availability - Advanced Config Sync'),
			_('Custom sync groups for services beyond General settings (e.g., VPN, mwan3).'));

		s = m.section(form.TypedSection, 'advanced', _('Global Settings'),
			_('owsync global options.'));
		s.anonymous = true;
		s.addremove = false;

		o = s.option(form.Value, 'sync_interval', _('Poll Interval (seconds)'),
			_('Seconds between scans of the synced files. A local change is sent to the peers after the next scan.'));
		o.datatype = 'uinteger';
		o.placeholder = '30';

		o = s.option(form.ListValue, 'owsync_log_level', _('Log Level'),
			_('Verbosity of owsync daemon logging.'));
		o.value('0', _('Error'));
		o.value('1', _('Warning'));
		o.value('2', _('Info (default)'));
		o.value('3', _('Debug'));
		o.default = '2';

		s = m.section(form.GridSection, 'sync_group', _('Additional Sync Groups'),
			_('Click Edit to configure files.'));
		s.anonymous = false;
		s.addremove = true;
		s.sortable = true;
		s.nodescriptions = true;

		// Base services are managed in General
		s.filter = function(section_id) {
			return baseServices.indexOf(section_id) === -1;
		};

		o = s.option(form.DummyValue, '_enabled_status', _('Status'));
		o.textvalue = function(section_id) {
			var enabled = uci.get('ha-cluster', section_id, 'enabled');
			var content = [ getBool(enabled, true)
				? E('span', { 'class': 'label success' }, _('Enabled'))
				: E('span', { 'class': 'label' }, _('Disabled')) ];
			if (enabled == null)
				content.push(' ', E('em', {}, _('(not set)')));
			return E('span', { 'class': 'cbi-value-field' }, content);
		};
		o.modalonly = false;

		o = s.option(form.DummyValue, '_files_count', _('Files'));
		o.textvalue = function(section_id) {
			var files = uci.get('ha-cluster', section_id, 'config_files') || [];
			if (!Array.isArray(files)) files = files ? [files] : [];
			return E('span', { 'class': 'cbi-value-field' }, files.length + ' ' + _('configured'));
		};
		o.modalonly = false;

		o = s.option(form.Flag, 'enabled', _('Enable Sync'),
			_('Enable synchronization for this group.'));
		o.rmempty = false;
		o.modalonly = true;
		o.cfgvalue = function(section_id) {
			return getBool(uci.get('ha-cluster', section_id, 'enabled'), true) ? '1' : '0';
		};
		o.write = function(section_id, value) {
			if (this.cfgvalue(section_id) !== value)
				uci.set('ha-cluster', section_id, 'enabled', value);
		};

		o = s.option(form.DynamicList, 'config_files', _('Files/Directories to Sync'),
			_('UCI names (e.g., "openvpn") or absolute paths (e.g., "/etc/openvpn/keys").'));
		o.datatype = 'string';
		o.placeholder = 'openvpn or /etc/openvpn/keys';
		o.modalonly = true;

		s = m.section(form.TypedSection, 'exclude', _('Exclusions'),
			_('Files never synced; exclusions take precedence over sync groups. Default: network, system, owsync, ha-cluster, wireless.'));
		s.anonymous = true;
		s.addremove = false;

		o = s.option(ChipListValue, 'file', _('Excluded Files'));
		o.placeholder = '/etc/dropbear/*.key';

		return m.render();
	}
});
