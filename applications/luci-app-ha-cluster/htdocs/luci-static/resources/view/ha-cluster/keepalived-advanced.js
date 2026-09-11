/*
 * Copyright (c) 2025-2026 Pierre Gaufillet <pierre.gaufillet@bergamote.eu>
 * SPDX-License-Identifier: Apache-2.0
 */
'use strict';
'require view';
'require form';
'require uci';
'require network';
'require fs';
'require ui';
'require rpc';

var callGetInterfaces = rpc.declare({
	object: 'network.interface',
	method: 'dump',
	expect: { 'interface': [] }
});

var hooksPath = '/etc/hotplug.d/keepalived';
var systemHook = null;

var hookTemplate = '#!/bin/sh\n' +
	'# Keepalived state change hook\n' +
	'# Environment: $ACTION (MASTER/BACKUP/FAULT/STOP), $NAME (instance), $TYPE\n' +
	'\n' +
	'[ "$TYPE" = "INSTANCE" ] || exit 0\n' +
	'\n' +
	'case "$ACTION" in\n' +
	'    MASTER)\n' +
	'        # Actions when becoming MASTER\n' +
	'        ;;\n' +
	'    BACKUP)\n' +
	'        # Actions when becoming BACKUP\n' +
	'        ;;\n' +
	'    FAULT)\n' +
	'        # Actions on fault\n' +
	'        ;;\n' +
	'esac\n' +
	'\n' +
	'exit 0\n';

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('ha-cluster'),
			network.getDevices(),
			L.resolveDefault(fs.list(hooksPath), []),
			callGetInterfaces()
		]);
	},

	handleHookEdit: function(filename, ev) {
		var filepath = hooksPath + '/' + filename;

		return L.resolveDefault(fs.read(filepath), '').then(L.bind(function(content) {
			// Use template if content is empty or just whitespace
			var displayContent = (content && content.trim()) ? content : hookTemplate;

			ui.showModal(_('Edit Hook: %s').format(filename), [
			E('p', {}, _('Shell script executed on VRRP state changes. Environment variables: $ACTION, $NAME, $TYPE.')),
			E('textarea', {
				'id': 'modal-hook-content',
				'rows': 20,
				'wrap': 'off'
			}, displayContent),
			E('div', { 'class': 'right' }, [
				E('button', {
					'class': 'btn cbi-button-negative',
					'click': ui.createHandlerFn(this, 'handleHookDeleteFromModal', filename)
				}, _('Delete')),
				' ',
				E('button', {
					'class': 'btn',
					'click': ui.hideModal
				}, _('Cancel')),
				' ',
				E('button', {
					'class': 'btn cbi-button-positive',
					'click': ui.createHandlerFn(this, 'handleHookSaveFromModal', filename)
				}, _('Save'))
			])
		]);
		}, this));
	},

	handleHookSaveFromModal: function(filename, ev) {
		var textarea = document.getElementById('modal-hook-content');
		var content = (textarea.value || '').trim().replace(/\r\n/g, '\n') + '\n';
		var filepath = hooksPath + '/' + filename;

		return fs.write(filepath, content).then(function() {
			ui.hideModal();
			ui.addNotification(null, E('p', _('Hook "%s" saved.').format(filename)), 'info');
		}).catch(function(e) {
			ui.addNotification(null, E('p', _('Unable to save hook: %s').format(e.message)));
		});
	},

	handleHookDeleteFromModal: function(filename, ev) {
		if (!confirm(_('Delete hook "%s"?').format(filename)))
			return;

		var filepath = hooksPath + '/' + filename;

		return fs.remove(filepath).then(function() {
			ui.hideModal();
			var row = document.querySelector('[data-hook="' + CSS.escape(filename) + '"]');
			if (row) row.remove();
			ui.addNotification(null, E('p', _('Hook "%s" deleted.').format(filename)), 'info');
		}).catch(function(e) {
			ui.addNotification(null, E('p', _('Unable to delete hook: %s').format(e.message)));
		});
	},

	handleHookAdd: function(ev) {
		var nameInput = document.getElementById('new-hook-name');
		var filename = (nameInput.value || '').trim();

		if (!filename) {
			ui.addNotification(null, E('p', _('Please enter a hook name.')));
			return;
		}

		// Validate filename (alphanumeric, dash, underscore)
		if (!/^[a-zA-Z0-9_-]+$/.test(filename)) {
			ui.addNotification(null, E('p', _('Hook name must contain only letters, numbers, dashes, and underscores.')));
			return;
		}

		var filepath = hooksPath + '/' + filename;

		return fs.write(filepath, hookTemplate).then(function() {
			nameInput.value = '';
			ui.addNotification(null, E('p', _('Hook "%s" created. Reload page to edit.').format(filename)), 'info');
		}).catch(function(e) {
			ui.addNotification(null, E('p', _('Unable to create hook: %s').format(e.message)));
		});
	},

	renderHookRow: function(file) {
		var filename = file.name;

		return E('tr', { 'class': 'tr', 'data-hook': filename }, [
			E('td', { 'class': 'td' }, filename),
			E('td', { 'class': 'td cbi-section-actions' }, [
				E('button', {
					'class': 'btn cbi-button-edit',
					'click': ui.createHandlerFn(this, 'handleHookEdit', filename),
					'title': _('Edit')
				}, _('Edit'))
			])
		]);
	},

	render: function(data) {
		var netDevs = data[1] || [];
		var hookFiles = (data[2] || []).filter(function(f) {
			return f.name !== systemHook && f.type === 'file';
		});
		var interfaces = data[3] || [];
		var scriptSections = uci.sections('ha-cluster', 'script') || [];
		var m, s, o;
		var self = this;

		var ifaceIconUrl = function(ifname) {
			var dev = null;
			for (var i = 0; i < netDevs.length; i++) {
				if (netDevs[i].getName && netDevs[i].getName() === ifname) {
					dev = netDevs[i];
					break;
				}
			}
			var type = dev ? dev.getType() : 'ethernet';
			return L.resource('icons/%s.svg').format(type);
		};

		m = new form.Map('ha-cluster', _('High Availability - Advanced VRRP'),
			_('Advanced VRRP instance tuning. VIPs and instance assignment are in General.'));

		// === Global Settings ===
		s = m.section(form.TypedSection, 'advanced', _('Global Settings'),
			_('Keepalived global options and email notifications.'));
		s.anonymous = true;
		s.addremove = false;

		o = s.option(form.Value, 'max_auto_priority', _('Max Auto Priority'),
			_('Set to 0 to disable auto-priority (recommended).'));
		o.datatype = 'uinteger';
		o.placeholder = '0';
		o.default = '0';

		o = s.option(form.ListValue, 'log_level', _('HA Cluster Log Level'),
			_('Verbosity of ha-cluster shell scripts logging.'));
		o.value('0', _('Error'));
		o.value('1', _('Warning'));
		o.value('2', _('Info (default)'));
		o.value('3', _('Debug'));
		o.default = '2';

		o = s.option(form.Flag, 'enable_notifications', _('Enable Email Notifications'),
			_('Send email on state changes. Requires SMTP server.'));
		o.default = '0';

		o = s.option(form.DynamicList, 'notification_email', _('Recipient Emails'));
		o.depends('enable_notifications', '1');
		o.placeholder = 'admin@example.com';

		o = s.option(form.Value, 'notification_email_from', _('From Email'));
		o.depends('enable_notifications', '1');
		o.placeholder = 'ha-cluster@router.local';

		o = s.option(form.Value, 'smtp_server', _('SMTP Server'));
		o.depends('enable_notifications', '1');
		o.placeholder = '192.168.1.100';

		// === VRRP Instances ===
		s = m.section(form.GridSection, 'vrrp_instance', _('VRRP Instances'),
			_('The General page creates a single "main" instance for atomic failover of all VIPs. Add extra instances here for independent failover groups.'));
		s.anonymous = false;
		s.addremove = true;
		s.sortable = true;
		s.nodescriptions = true;
		s.tab('general', _('General'));
		s.tab('timing', _('Timing'));
		s.tab('auth', _('Authentication'));
		s.tab('tracking', _('Tracking'));
		s.tab('unicast', _('Unicast'));

		o = s.option(form.DummyValue, '_vrid_display', _('VRID'));
		o.modalonly = false;
		o.textvalue = function(section_id) {
			return uci.get('ha-cluster', section_id, 'vrid') || '-';
		};

		o = s.option(form.DummyValue, '_iface_display', _('Interface'));
		o.modalonly = false;
		o.textvalue = function(section_id) {
			return uci.get('ha-cluster', section_id, 'interface') || '-';
		};

		o = s.option(form.DummyValue, '_vip_count', _('VIPs'));
		o.textvalue = function(section_id) {
			var count = uci.sections('ha-cluster', 'vip').filter(function(vip) {
				return vip.vrrp_instance === section_id;
			}).length;
			return String(count);
		};
		o.modalonly = false;

		// === General Tab ===
		o = s.taboption('general', form.Value, 'vrid', _('VRID'),
			_('Virtual Router ID (1-127). Must match on all cluster nodes. 128-255 reserved for auto-generated IPv6 instances.'));
		o.datatype = 'range(1,127)';
		o.rmempty = false;
		o.modalonly = true;
		o.validate = function(section_id, value) {
			if (!value) return true;
			var vrid = parseInt(value);
			var instances = uci.sections('ha-cluster', 'vrrp_instance');
			for (var i = 0; i < instances.length; i++) {
				if (instances[i]['.name'] === section_id) continue;
				if (parseInt(instances[i].vrid) === vrid)
					return _('VRID %d is already used by instance "%s"').format(vrid, instances[i]['.name']);
			}
			return true;
		};

		o = s.taboption('general', form.ListValue, 'interface', _('Primary Interface'),
			_('Interface used for VRRP advertisements.'));
		o.rmempty = false;
		o.modalonly = true;
		if (interfaces && interfaces.length) {
			var seen3 = {};
			interfaces.forEach(function(iface) {
				if (iface.interface && iface.interface !== 'loopback') {
					var ifname = iface.interface;
					if (seen3[ifname]) return;
					seen3[ifname] = true;
					o.value(ifname, ifname);
				}
			});
		}
		o.cfgvalue = function(section_id) {
			var ifname = uci.get('ha-cluster', section_id, 'interface');
			if (ifname && !(this.keylist || []).includes(ifname)) {
				this.value(ifname, ifname);
			}
			return ifname;
		};

		// === Timing Tab ===
		o = s.taboption('timing', form.Value, 'advert_int', _('Advertisement Interval'),
			_('VRRP advertisement frequency (seconds). Lower = faster failover. Default: 1.'));
		o.datatype = 'float';
		o.placeholder = '1.0';
		o.default = '1';
		o.modalonly = true;

		o = s.taboption('timing', form.Value, 'priority', _('Priority'),
			_('Override global priority for this instance. Leave empty for global priority.'));
		o.datatype = 'range(1,255)';
		o.placeholder = _('Use global priority');
		o.optional = true;
		o.modalonly = true;

		o = s.taboption('timing', form.Flag, 'nopreempt', _('Keep Current MASTER (disable preemption)'),
			_('Current MASTER stays MASTER even if higher-priority router returns.'));
		o.default = '1';
		o.modalonly = true;

		o = s.taboption('timing', form.Value, 'preempt_delay', _('Preempt Delay'),
			_('Seconds before higher-priority router takes over. Prevents flapping. Recommended: 30-60.'));
		o.datatype = 'uinteger';
		o.placeholder = '30';
		o.optional = true;
		o.modalonly = true;

		o = s.taboption('timing', form.Value, 'garp_master_delay', _('GARP Delay'),
			_('Seconds before sending Gratuitous ARP after becoming MASTER. Helps with slow switches. Default: 5.'));
		o.datatype = 'uinteger';
		o.placeholder = '5';
		o.optional = true;
		o.modalonly = true;

		// === Authentication Tab ===
		o = s.taboption('auth', form.ListValue, 'auth_type', _('Authentication Type'),
			_('PASS: basic (max 8 chars, cleartext). AH: cryptographic (requires kmod-ipsec).'));
		o.value('none', _('None'));
		o.value('pass', _('Simple Password (PASS)'));
		o.value('ah', _('IPSec AH'));
		o.default = 'none';
		o.modalonly = true;
		o.cfgvalue = function(section_id) {
			var v = uci.get('ha-cluster', section_id, 'auth_type') || 'none';
			if (v && !(this.keylist || []).includes(v)) {
				this.value(v, v);
			}
			return v;
		};

		o = s.taboption('auth', form.Value, 'auth_pass', _('Authentication Password'),
			_('Shared secret (4-8 chars). Must be identical on all nodes.'));
		o.password = true;
		o.datatype = 'and(minlength(4),maxlength(8))';
		o.placeholder = _('4-8 characters');
		o.depends('auth_type', 'pass');
		o.modalonly = true;

		// === Tracking Tab ===
		o = s.taboption('tracking', form.DynamicList, 'track_interface', _('Track Interfaces'),
			_('Failover when tracked interface goes DOWN. Common: track WAN for internet failover.'));
		netDevs.forEach(function(dev) {
			if (dev.getName) {
				o.value(dev.getName());
			}
		});
		o.placeholder = _('Select interface');
		o.modalonly = true;

		o = s.taboption('tracking', form.DynamicList, 'track_script', _('Track Scripts'),
			_('Failover when health check fails. Define scripts in Health Checks section below.'));
		scriptSections.forEach(function(script) {
			if (script['.name']) {
				o.value(script['.name']);
			}
		});
		o.placeholder = _('Select script');
		o.modalonly = true;

		// === Unicast Tab ===
		// Compute auto-derived unicast values from peer config
		var peers = uci.sections('ha-cluster', 'peer');
		var transport = uci.get('ha-cluster', 'config', 'vrrp_transport') || 'multicast';
		var autoSrcIp = '';
		var autoPeerAddrs = [];
		for (var pi = 0; pi < peers.length; pi++) {
			if (peers[pi].address)
				autoPeerAddrs.push(peers[pi].address);
			if (!autoSrcIp && peers[pi].source_address)
				autoSrcIp = peers[pi].source_address;
		}

		o = s.taboption('unicast', form.Value, 'unicast_src_ip', _('Unicast Source IP'),
			(transport === 'unicast' && autoSrcIp)
				? _('Per-instance override. When empty, auto-derived from peer config: %s').format(autoSrcIp)
				: _('This router\'s IP for unicast VRRP. Leave empty for multicast (default).'));
		o.datatype = 'ipaddr';
		o.placeholder = (transport === 'unicast' && autoSrcIp)
			? _('Auto: %s').format(autoSrcIp)
			: _('e.g., 192.168.1.1');
		o.optional = true;
		o.modalonly = true;

		o = s.taboption('unicast', form.DynamicList, 'unicast_peer', _('Unicast Peer IPs'),
			(transport === 'unicast' && autoPeerAddrs.length > 0)
				? _('Per-instance override. When empty, auto-derived from peer config: %s').format(autoPeerAddrs.join(', '))
				: _('Peer router IPs. Required when using unicast mode. Both src_ip and peer must be set.'));
		o.datatype = 'ipaddr';
		o.placeholder = _('e.g., 192.168.1.2');
		o.modalonly = true;

		// === Health Checks (VRRP Scripts) ===
		s = m.section(form.GridSection, 'script', _('Health Checks (VRRP Scripts)'),
			_('Custom checks referenced by track_script. Examples: ping gateway, check DNS, verify VPN.'));
		s.anonymous = false;
		s.addremove = true;
		s.sortable = true;

		o = s.option(form.DummyValue, '_script', _('Script'));
		o.cfgvalue = function(section_id) { return uci.get('ha-cluster', section_id, 'script') || '-'; };
		o.modalonly = false;

		o = s.option(form.Value, 'script', _('Script Command'),
			_('Command returning 0 for success. Use absolute paths.'));
		o.placeholder = '/bin/ping -c 1 -W 1 8.8.8.8';
		o.rmempty = false;
		o.modalonly = true;

		o = s.option(form.Value, 'interval', _('Interval'),
			_('Seconds between checks.'));
		o.datatype = 'uinteger';
		o.placeholder = '5';
		o.default = '5';
		o.modalonly = true;

		o = s.option(form.Value, 'timeout', _('Timeout'),
			_('Max seconds for script.'));
		o.datatype = 'uinteger';
		o.placeholder = '2';
		o.optional = true;
		o.modalonly = true;

		o = s.option(form.Value, 'weight', _('Weight'),
			_('Priority adjustment on failure (e.g., -10).'));
		o.datatype = 'integer';
		o.placeholder = '-10';
		o.optional = true;
		o.modalonly = true;

		o = s.option(form.Value, 'rise', _('Rise'),
			_('Successes before healthy.'));
		o.datatype = 'uinteger';
		o.placeholder = '2';
		o.optional = true;
		o.modalonly = true;

		o = s.option(form.Value, 'fall', _('Fall'),
			_('Failures before unhealthy.'));
		o.datatype = 'uinteger';
		o.placeholder = '2';
		o.optional = true;
		o.modalonly = true;

		o = s.option(form.Value, 'user', _('User'),
			_('Run as user (default: root).'));
		o.datatype = 'and(minlength(1),maxlength(32))';
		o.placeholder = 'nobody';
		o.optional = true;
		o.modalonly = true;

		// Render form.Map, then append hooks section
		return m.render().then(L.bind(function(mapEl) {
			// Build hooks section with grid
			var hooksTable = E('table', { 'class': 'table cbi-section-table' }, [
				E('tr', { 'class': 'tr table-titles' }, [
					E('th', { 'class': 'th' }, _('Name')),
					E('th', { 'class': 'th cbi-section-actions' }, '')
				])
			]);

			var tbody = E('tbody', { 'id': 'hooks-tbody' });
			hookFiles.forEach(L.bind(function(file) {
				tbody.appendChild(this.renderHookRow(file));
			}, this));

			if (hookFiles.length === 0) {
				tbody.appendChild(E('tr', { 'class': 'tr placeholder' }, [
					E('td', { 'class': 'td', 'colspan': '2', 'style': 'text-align: center; font-style: italic; color: #888;' },
						_('No custom hooks defined.'))
				]));
			}

			hooksTable.appendChild(tbody);

			var hooksContainer = E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, _('State Change Hooks')),
				E('div', { 'class': 'cbi-section-descr' },
					_('Shell scripts executed on VRRP state changes. Click Edit to modify. Environment: $ACTION, $NAME, $TYPE.')),
				hooksTable,
				E('div', { 'class': 'cbi-section-create' }, [
					E('div', {}, [
						E('input', {
							'type': 'text',
							'class': 'cbi-section-create-name',
							'id': 'new-hook-name',
							'placeholder': _('e.g., 60-vpn-failover')
						})
					]),
					E('button', {
						'class': 'cbi-button cbi-button-add',
						'click': ui.createHandlerFn(this, 'handleHookAdd')
					}, _('Add'))
				])
			]);

			mapEl.appendChild(hooksContainer);
			return mapEl;
		}, this));
	}
});
