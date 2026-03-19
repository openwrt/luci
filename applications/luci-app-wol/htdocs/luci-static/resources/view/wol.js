'use strict';
'require view';
'require uci';
'require ui';
'require rpc';
'require form';
'require tools.widgets as widgets';

const ETHERWAKE_BIN = '/usr/bin/etherwake';
const WAKEONLAN_BIN = '/usr/bin/wakeonlan';

const PACKAGES_URL = 'admin/system/package-manager';

return view.extend({
	outputText: '',

	callStat: rpc.declare({
		object: 'luci.wol',
		method: 'stat',
		params: [],
		expect: {}
	}),

	callExec: rpc.declare({
		object: 'luci.wol',
		method: 'exec',
		params: ['name', 'args'],
		expect: {}
	}),

	callHostHints: rpc.declare({
		object: 'luci-rpc',
		method: 'getHostHints',
		expect: {
			'': {}
		}
	}),

	option_install_etherwake() {
		window.open(L.url(PACKAGES_URL) +
			'?query=etherwake', '_blank', 'noopener');
	},

	option_install_wakeonlan() {
		window.open(L.url(PACKAGES_URL) +
			'?query=wakeonlan', '_blank', 'noopener');
	},

	load() {
		return Promise.all([
			L.resolveDefault(this.callStat()),
			this.callHostHints(),
			uci.load('luci-wol')
		]);
	},

	render([stat, hosts]) {
		const has_ewk = stat && stat.etherwake,
			has_wol = stat && stat.wakeonlan;
		let m, s, o;

		// Check if at least one Wake on LAN utility is available, else show install buttons
		if (!has_ewk && !has_wol) {
			m = new form.Map('luci-wol', _('Wake on LAN'),
				_('Wake on LAN is a mechanism to boot computers remotely in the local network.'));

			s = m.section(form.NamedSection, 'packages', 'packages',
				_('Required Packages'),
				_('At least one Wake on LAN utility is needed. Please install one of the following packages (some extra permissions may be required):'));

			s.render = L.bind(function(view) {
				return form.NamedSection.prototype.render.apply(this, arguments)
					.then(L.bind(function(node) {
						node.appendChild(E('div', {
							'class': 'control-group'
						}, [
							E('button', {
								'class': 'btn cbi-button-action',
								'click': ui.createHandlerFn(view, 'option_install_etherwake', this.map),
								'title': _('Install etherwake package')
							}, [_('Install etherwake')]),
							' ',
							E('button', {
								'class': 'btn cbi-button-action',
								'click': ui.createHandlerFn(view, 'option_install_wakeonlan', this.map),
								'title': _('Install wakeonlan package')
							}, [_('Install wakeonlan')])
						]));
						return node;
					}, this));
			}, s, this);

			return m.render();
		}

		m = new form.Map('luci-wol', _('Wake on LAN'),
			_('Wake on LAN is a mechanism to boot computers remotely in the local network.'));

		// Default settings section (used executable)
		s = m.section(form.NamedSection, 'defaults', 'wol', _('Default Settings'));

		if (has_ewk && has_wol) {
			o = s.option(form.ListValue, 'executable', _('Default WoL program'),
				_('Choose the default Wake on LAN utility'));
			o.value(ETHERWAKE_BIN, 'Etherwake');
			o.value(WAKEONLAN_BIN, 'Wakeonlan');
			o.default = ETHERWAKE_BIN;
			o.onchange = function(ev, section_id, value) {
				return m.save(null, true);
			};
		} else {
			// If only one binary is available, show info message with install button for the other
			o = s.option(form.DummyValue, '_info');
			o.rawhtml = true;
			o.default = E('div', {}, [
				E('p', {}, [
					_('Binary used') + ': ',
					E('strong', {}, has_ewk ? 'Etherwake' : 'Wakeonlan')
				]),
				E('p', {
						'style': 'margin-top: 10px'
					},
					_('You can also install the alternative Wake on LAN utility (some extra permissions may be required):')),
				E('div', {
					'class': 'control-group'
				}, [
					E('button', {
						'class': 'btn cbi-button-action',
						'click': ui.createHandlerFn(this, has_ewk ? 'option_install_wakeonlan' : 'option_install_etherwake'),
						'title': _('Install the alternative Wake on LAN package')
					}, [_('Install %s').format(has_ewk ? 'wakeonlan' : 'etherwake')])
				])
			]);

		}

		// Targets section with GridSection
		s = m.section(form.GridSection, 'target', _('Wake on LAN Targets'), _('Configure hosts that can be woken up. Click the Wake button to send a magic packet.') + '<br>' + _('Note: wakeonlan binary does not support interface, broadcast, and password options (etherwake only).') + ' ' + _('These options will be ignored if wakeonlan is used.'));

		s.addremove = true;
		s.anonymous = true;
		s.sortable = true;
		s.nodescriptions = true;

		// Name column
		o = s.option(form.Value, 'name', _('Name'), _('Mandatory'));
		o.rmempty = false;
		o.datatype = 'string';

		// MAC address column
		o = s.option(form.Value, 'mac', _('MAC Address'), _('Mandatory'));
		o.rmempty = false;
		o.datatype = 'macaddr';
		L.sortedKeys(hosts).forEach(function(mac) { // Add host hints, need 'getHostHints' acl (luci-rpc)
			const hint = hosts[mac].name ||
				L.toArray(hosts[mac].ipaddrs || hosts[mac].ipv4)[0] ||
				L.toArray(hosts[mac].ip6addrs || hosts[mac].ipv6)[0];
			o.value(mac, hint ? '%s (%s)'.format(mac, hint) : mac);
		});

		// Interface column (only for etherwake)
		if (has_ewk) {
			o = s.option(widgets.DeviceSelect, 'iface', _('Interface'), _('Etherwake only')); // Network device selector widget, needs 'getNetworkDevices' acl (luci-rpc)
			o.noaliases = true;
			o.noinactive = true;
		}

		// Broadcast flag (only for etherwake)
		if (has_ewk) {
			o = s.option(form.Flag, 'broadcast', _('Broadcast'), _('Etherwake only'));
			o.default = o.disabled;
		}

		// Password field (only for etherwake)
		if (has_ewk) {
			o = s.option(form.Value, 'password', _('Password'), _('Etherwake only'));
			o.datatype = 'string';
			o.placeholder = '00:22:44:66:88:aa or 192.168.1.1';
			o.datatype = 'or(macaddr,ip4addr("nomask"))'; // Accept MAC or IPv4 address format
		}

		// When editing, set modal title to include target name
		s.modaltitle = L.bind(function(section_id) {
			var name = uci.get('luci-wol', section_id, 'name');
			return _('Edit target') + (name ? ': ' + name : '');
		}, this);

		// Keep reference to GridSection for button handlers
		const gridSection = s;

		// Take default row actions and add "Wake" button
		s.renderRowActions = L.bind(function(section_id) {
			const defaultButtons = form.GridSection.prototype.renderRowActions.call(gridSection, section_id, _('Edit'));

			const wakeButton = E('button', {
				'class': 'cbi-button cbi-button-action',
				'click': ui.createHandlerFn(this, function() {
					return this.handleWakeup(section_id, has_ewk, has_wol);
				})
			}, _('Wake'));

			const buttonContainer = defaultButtons.querySelector('div');
			if (buttonContainer) {
				buttonContainer.insertBefore(wakeButton, buttonContainer.firstChild);
			}

			return defaultButtons;
		}, this);

		// Output section, for wake results
		s = m.section(form.NamedSection, 'output', 'wol', _('Output'));
		s.anonymous = true;
		s.render = L.bind(function() {
			return E('div', {
				'class': 'cbi-section'
			}, [
				E('h3', {}, _('Output')),
				E('textarea', {
					'readonly': true,
					'rows': 10,
					'style': 'width: 100%; font-family: monospace;',
					'id': 'wol-output-text'
				}, this.outputText)
			]);
		}, this);

		return m.render();
	},

	handleWakeup(section_id, has_ewk, has_wol) {
		const self = this;
		const name = uci.get('luci-wol', section_id, 'name');
		const mac = uci.get('luci-wol', section_id, 'mac');

		// Determine which binary to use and verify availability
		const defaultBin = uci.get('luci-wol', 'defaults', 'executable');
		let bin = defaultBin || (has_ewk ? ETHERWAKE_BIN : WAKEONLAN_BIN);

		if (bin == ETHERWAKE_BIN && !has_ewk)
			bin = WAKEONLAN_BIN;
		else if (bin == WAKEONLAN_BIN && !has_wol)
			bin = ETHERWAKE_BIN;

		// Build argument list based on selected binary
		const args = [];

		if (bin == ETHERWAKE_BIN) {
			args.push('-D');
			const iface = uci.get('luci-wol', section_id, 'iface');
			if (iface)
				args.push('-i', iface);

			const broadcast = uci.get('luci-wol', section_id, 'broadcast');
			if (broadcast == '1')
				args.push('-b');

			const password = uci.get('luci-wol', section_id, 'password');
			if (password)
				args.push('-p', password);

			args.push(mac);
		} else {
			args.push(mac);
		}

		// Execute the wake command and handle output
		this.appendOutput(`Sending wakeup to ${name} (${mac})...\n`);

		return this.callExec(bin, args).then(function(res) {
			if (res.stdout)
				self.appendOutput(res.stdout + '\n');
			if (res.stderr)
				self.appendOutput('Error: ' + res.stderr + '\n');
			if (!res.stdout && !res.stderr)
				self.appendOutput('Command completed with code ' + (res.code || 0) + '\n');
			self.appendOutput('\n');
		}).catch(function(err) {
			self.appendOutput('Error: ' + err + '\n\n');
		});
	},

	appendOutput(text) {
		// Append text to the output textarea and scroll to bottom
		this.outputText += text;
		const textarea = document.getElementById('wol-output-text');
		if (textarea) {
			textarea.value = this.outputText;
			textarea.scrollTop = textarea.scrollHeight;
		}
	}
});
