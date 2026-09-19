'use strict';
'require network';
'require request';
'require session';
'require view';
'require form';
'require poll';
'require rpc';
'require uci';
'require dom';
'require ui';

var callBoardJSON = rpc.declare({
	object: 'luci-rpc',
	method: 'getBoardJSON',
	expect: { '': {} }
});

var callNetworkInterfaceStatus = rpc.declare({
	object: 'network.interface',
	method: 'status',
	expect: { '': {} },
	params: [ 'interface' ]
});

var callNetworkInterfaceUp = rpc.declare({
	object: 'network.interface',
	method: 'up',
	params: [ 'interface' ]
});

var callNetworkInterfaceDown = rpc.declare({
	object: 'network.interface',
	method: 'down',
	params: [ 'interface' ]
});

var callUciCommit = rpc.declare({
	object: 'uci',
	method: 'commit',
	params: [ 'config' ]
});

var cbiRichListValue = form.ListValue.extend({
	renderWidget: function(section_id, option_index, cfgvalue) {
		var choices = this.transformChoices();
		var widget = new ui.Dropdown((cfgvalue != null) ? cfgvalue : this.default, choices, {
			id: this.cbid(section_id),
			sort: this.keylist,
			optional: this.optional,
			select_placeholder: this.select_placeholder || this.placeholder,
			custom_placeholder: this.custom_placeholder || this.placeholder,
			validate: L.bind(this.validate, this, section_id),
			disabled: (this.readonly != null) ? this.readonly : this.map.readonly
		});

		return widget.render();
	}
});

var cbiWifiList = form.Value.extend({
	scanNetworks: function() {
		if (this.networks)
			return Promise.resolve(this.networks);

		return network.getWifiDevices().then(L.bind(function(phys) {
			return Promise.all(phys.map(function(phy) {
				return phy.getScanList();
			})).then(L.bind(function(results) {
				var list = [];

				for (var i = 0; i < results.length; i++)
					for (var j = 0; j < results[i].length; j++)
						list.push(Object.assign(results[i][j], {
							radio: phys[i].getName(),
							encryption: this.convertEncryption(results[i][j].encryption)
						}));

				return list;
			}, this));
		}, this));
	},

	renderWidget: function(section_id) {
		var node = E('div', [
			E('p', { 'class': 'spinning' }, [
				_('The device is now scanning for surrounding wireless networks…')
			])
		]);

		this.scanNetworks().then(L.bind(function(networks) {
			var choices = {},
			    order = [];

			for (var i = 0; i < networks.length; i++) {
				var qv = networks[i].quality || 0,
				    qm = networks[i].quality_max || 0,
				    q = (qv > 0 && qm > 0) ? Math.floor((100 / qm) * qv) : 0,
				    icon;

				if (q == 0)
					icon = L.resource('icons/signal-0.png');
				else if (q < 25)
					icon = L.resource('icons/signal-0-25.png');
				else if (q < 50)
					icon = L.resource('icons/signal-25-50.png');
				else if (q < 75)
					icon = L.resource('icons/signal-50-75.png');
				else
					icon = L.resource('icons/signal-75-100.png');

				order.push(i);
				choices[i] = E('div', [
					E('img', { 'src': icon, 'class': 'middle' }), ' ',
					E('strong', [ networks[i].ssid || E('em', [ _('hidden') ]) ]),
					E('br'),
					_('Channel %d').format(networks[i].channel), ' - ',
					networks[i].encryption.match(/sae|owe/) ? _('open') : _('secured')
				]);
			}

			order.sort(function(a, b) {
				var q1 = networks[a].quality,
				    s1 = networks[a].ssid,
				    q2 = networks[b].quality,
				    s2 = networks[b].ssid;

				if (q1 != q2)
					return q2 - q1;

				return s1 > s2;
			});

			order.unshift(-1);
			choices[-1] = E('div', [
				E('strong', [ _('Enter information manually') ]),
				E('br'),
				E('em', [ _('Choose this option when the network is not listed.') ])
			]);

			this.networks = networks;
			this.dropdown = new ui.Dropdown(order[1], choices, {
				sort: order,
				optional: false
			});

			dom.content(node, this.dropdown.render());
			this.map.checkDepends();
			this.handleLoad();
		}, this));

		return node;
	},

	handleLoad: function(ev) {},

	convertEncryption: function(encryption) {
		if (!encryption || !encryption.enabled)
			return 'none';

		if (encryption.wep)
			return 'wep';

		if (encryption.wpa) {
			var versions = L.toArray(encryption.wpa)
				.reduce(function(o, k) { o[k] = true; return o }, {});

			var suites = L.toArray(encryption.authentication)
				.reduce(function(o, k) { o[k] = true; return o }, {});

			if (suites['802.1x']) {
				if (versions[3])
					return versions[2] ? 'wpa3-mixed' : 'wpa3';
				else if (versions[2])
					return 'wpa2';
				else
					return 'wpa';
			}
			else {
				if (versions[3])
					return versions[2] ? 'sae-mixed' : 'sae';
				else if (versions[2])
					return versions[1] ? 'psk-mixed' : 'psk2';
				else
					return 'psk';
			}
		}

		return 'unknown';
	},

	formvalue: function(section_id) {
		if (!this.dropdown)
			return '';

		var network = this.networks[this.dropdown.getValue()];
		return network ? network.encryption : 'custom';
	},

	write: function(section_id, formvalue) {
		var network = this.networks[this.dropdown.getValue()];
		this.super('write', [ section_id, JSON.stringify(Object.assign({}, network)) ]);
	}
});

return view.extend({
	load: function() {
		return Promise.all([
			callBoardJSON(),
			L.resolveDefault(callNetworkInterfaceStatus('wan'), {}),
			L.resolveDefault(callNetworkInterfaceStatus('wwan'), {}),
			L.resolveDefault(callNetworkInterfaceStatus('wan6'), {}),
			L.resolveDefault(uci.load('network')),
			L.resolveDefault(uci.load('wireless')),
			L.resolveDefault(uci.load('firewall'))
		]);
	},

	handleReconnect: function(ev) {
		var logicalIfname = this.wwanStatus.proto ? 'wwan' : 'wan';

		ui.showModal(_('Restart connection'),
			E('p', { 'class': 'spinning' }, [ _('Shutting the internet connection down…') ]));

		window.setTimeout(function() {
			return callNetworkInterfaceDown(logicalIfname).then(function() {
				ui.showModal(_('Restart connection'),
					E('p', { 'class': 'spinning' }, [ _('Starting the internet connection…') ]));

				return callNetworkInterfaceUp(logicalIfname).then(function() {
					window.setTimeout(ui.hideModal, 1500);
				});
			});
		}, 1500);
	},

	renderInternetStatus: function() {
		var iface = this.wwanStatus.proto ? this.wwanStatus : this.wanStatus,
		    iface6 = this.wan6Status,
		    addr = L.toArray(iface['ipv4-address']),
		    addr6 = L.toArray((iface['ipv6-address'] && iface['ipv6-address'].length) ? iface['ipv6-address'] : iface6['ipv6-address']),
		    type = this.wwanStatus.proto ? 'wifi' : 'dhcp';

		var typeNames = {
			wifi: _('Wireless'),
			dhcp: _('DHCP'),
			pppoe: _('PPPoE'),
			static: _('Static Address')
		};

		var view = E([], [
			E('style', { 'type': 'text/css' }, [
				'.cbi-dropdown { height: auto !important }',
				'[id="cbid.json.data.proto"] { max-width: 100% !important }'
			]),
			E('h1', [ _('Internet Status') ]),
			E('div', { 'class': 'table' }, [
				E('div', { 'class': 'tr' }, [
					E('div', { 'class': 'td', 'style': 'max-width:200px' }, E('strong', [ _('Connection Status:') ])),
					E('div', { 'class': 'td' }, [ iface.up ? _('Connected (%t)', 'Connected since amount of time').format(iface.uptime) : _('Not connected') ])
				]),
				E('div', { 'class': 'tr' }, [
					E('div', { 'class': 'td' }, E('strong', [ _('Connection Type:') ])),
					E('div', { 'class': 'td' }, [ typeNames[type] || _('Other') ])
				]),
				addr.length ? E('div', { 'class': 'tr' }, [
					E('div', { 'class': 'td' }, E('strong', [ _('IP Address:') ])),
					E('div', { 'class': 'td' }, [ addr[0].address ])
				]) : E([]),
				addr6.length ? E('div', { 'class': 'tr' }, [
					E('div', { 'class': 'td' }, E('strong', [ _('IPv6 Address:') ])),
					E('div', { 'class': 'td' }, [ addr6[0].address ])
				]) : E([])
			]),
			E('hr'),
			E('div', { 'class': 'right' }, [
				E('button', {
					'class': 'btn',
					'click': ui.createHandlerFn(this, 'handleReconnect')
				}, [ _('Restart connection') ]),
				' ',
				E('button', {
					'class': 'btn',
					'click': ui.createHandlerFn(this, 'renderProtocolSelect')
				}, [ _('Configure internet access…') ])
			])
		]);

		return view;
	},

	renderProtocolSelect: function() {
		var m, s, o, json = { data: { proto: 'dhcp' } };

		m = new form.JSONMap(json, null,
			_('This setup will guide you through the initial steps to setup your internet connection. First of all, choose your connection type.'));

		s = m.section(form.TypedSection, 'data');
		s.addremove = false;
		s.anonymous = true;

		o = s.option(cbiRichListValue, 'proto');
		o.value('dhcp', E('div', { 'style': 'white-space:normal' }, [
			E('strong', [ _('Automatic address configuration (DHCP)') ]), E('br'),
			E('span', { 'class': 'hide-open' }, [ _('This is the most common way to access the internet. It is usually used with cable internet or optical fiber connections.') ])
		]));
		o.value('pppoe', E('div', { 'style': 'white-space:normal' }, [
			E('strong', [ _('Username and password (PPPoE)') ]), E('br'),
			E('span', { 'class': 'hide-open' }, [ _('The PPPoE protocol is commonly used with DSL connections and usually requires you to enter the ISP provided credentials.') ])
		]));
		o.value('wifi', E('div', { 'style': 'white-space:normal' }, [
			E('strong', [ _('Join into an existing wireless network') ]), E('br'),
			E('span', { 'class': 'hide-open' }, [ _('Instead of using a physical cable or ethernet connection, login into an existing wireless network to access the internet.') ])
		]));
		o.value('static', E('div', { 'style': 'white-space:normal' }, [
			E('strong', [ _('Static address configuration') ]), E('br'),
			E('span', { 'class': 'hide-open' }, [ _('Use this option if the ISP provided specific settings to enter, such as IP address, gateway and DNS server.') ])
		]));

		o = s.option(form.Flag, 'custom_dns', _('Use different DNS servers'));
		o.depends('proto', 'dhcp');
		o.depends('proto', 'pppoe');
		o.depends('proto', 'wifi');

		o = s.option(cbiRichListValue, 'dns_provider', _('DNS Provider'));
		o.depends('custom_dns', '1');
		o.value('8.8.8.8 8.8.4.4', E('div', { 'style': 'white-space:normal' }, [
			E('strong', [ _('Google DNS') ]), E('br'),
			'8.8.8.8 · 8.8.4.4'
		]));
		o.value('1.1.1.1 1.0.0.1', E('div', { 'style': 'white-space:normal' }, [
			E('strong', [ _('Cloudflare DNS') ]), E('br'),
			'1.1.1.1 · 1.0.0.1'
		]));
		o.value('208.67.222.222 208.67.220.220', E('div', { 'style': 'white-space:normal' }, [
			E('strong', [ _('OpenDNS') ]), E('br'),
			'208.67.222.222 · 208.67.220.220'
		]));
		o.value('-', E('div', { 'style': 'white-space:normal' }, [
			E('strong', [ _('Enter manually') ]), E('br'),
			_('Do not use any of the predefined providers.')
		]));

		o = s.option(form.DynamicList, 'dns_addrs', _('DNS Servers'));
		o.depends({ custom_dns: '1', dns_provider: '-' });
		o.datatype = 'ipaddr("nomask")';
		o.placeholder = _('Enter DNS server IP');

		return m.render().then(L.bind(function(form) {
			ui.showModal(_('Setup internet connectivity'), [
				form,
				E('div', { 'class': 'right' }, [
					E('button', {
						'class': 'btn',
						'click': ui.hideModal
					}, [ _('Cancel') ]),
					' ',
					E('button', {
						'class': 'btn primary',
						'click': ui.createHandlerFn(this, function(ev) {
							m.save(null, true).then(L.bind(function() {
								return this.handleProtocolSelect(json.data);
							}, this)).catch(L.bind(function(err) {
								alert(_('Please correct the invalid inputs'));
							}, this));
						})
					}, [ _('Setup connection…') ])
				])
			]);
		}, this));
	},

	handleProtocolSelect: function(data, ev) {
		var m, s, o, json = { data: data };

		switch (data.proto) {
		case 'dhcp':
			break;

		case 'pppoe':
			m = new form.JSONMap(json);

			s = m.section(form.TypedSection, 'data');
			s.addremove = false;
			s.anonymous = true;

			o = s.option(form.Value, 'username', _('Username'));
			o = s.option(form.Value, 'password', _('Password'));
			o.password = true;
			break;

		case 'wifi':
			m = new form.JSONMap(json);

			s = m.section(form.TypedSection, 'data');
			s.addremove = false;
			s.anonymous = true;

			o = s.option(cbiWifiList, 'network', _('Wireless network'));
			o.handleLoad = function(ev) {
				document.querySelector('button[name="proceed-connection-settings"]').disabled = false;
			};

			var radios = uci.sections('wireless', 'wifi-device');

			if (radios.length > 1) {
				o = s.option(form.ListValue, 'radio', _('Frequency'));
				o.depends('network', 'custom');

				for (var i = 0; i < radios.length; i++) {
					if (radios[i].hwmode == '11a') {
						o.value(radios[i]['.name'], '5GHz');
					}
					else {
						o.value(radios[i]['.name'], '2.4Ghz');
						o.default = radios[i]['.name'];
					}
				}
			}

			o = s.option(form.Value, 'ssid', _('SSID'));
			o.depends('network', 'custom');
			o.rmempty = false;

			o = s.option(form.ListValue, 'encryption', _('Encryption'));
			o.depends('network', 'custom');

			o.value('psk2', _('WPA2 Personal'));
			o.value('psk-mixed', _('WPA2/WPA Personal mixed mode'));
			o.value('psk', _('WPA Personal'));

			o.value('sae', _('WPA3 SAE'));
			o.value('sae-mixed', _('WPA3 SAE/WPA2 Personal mixed mode'));

			o.value('wpa2', _('WPA2 Enterprise'));
			o.value('wpa3', _('WPA3 Enterprise (Suite-B)'));
			o.value('wpa3-mixed', _('WPA3/WPA2 Enterprise mixed mode'));
			o.value('wpa', _('WPA Enterprise'));

			o.value('wep', _('WEP'));

			o.value('owe', _('OWE'));
			o.value('none', _('No encryption'));


			o = s.option(form.Value, 'wpakey', _('WPA Passphrase'));
			o.depends('encryption', 'psk2');
			o.depends('encryption', 'psk');
			o.depends('encryption', 'psk-mixed');
			o.depends('encryption', 'sae');
			o.depends('encryption', 'sae-mixed');
			o.depends('network', 'psk2');
			o.depends('network', 'psk');
			o.depends('network', 'psk-mixed');
			o.depends('network', 'sae');
			o.depends('network', 'sae-mixed');
			o.datatype = 'wpakey';
			o.password = true;
			o.rmempty = false;

			o = s.option(form.Value, 'wepkey', _('WEP Key'));
			o.depends('encryption', 'wep');
			o.depends('network', 'wep');
			o.datatype = 'wepkey';
			o.password = true;
			o.rmempty = false;

			o = s.option(form.Value, 'eapuser', _('EAP Username'));
			o.depends('encryption', 'wpa3');
			o.depends('encryption', 'wpa3-mixed');
			o.depends('encryption', 'wpa2');
			o.depends('encryption', 'wpa');
			o.depends('network', 'wpa3');
			o.depends('network', 'wpa3-mixed');
			o.depends('network', 'wpa2');
			o.depends('network', 'wpa');
			o.rmempty = false;

			o = s.option(form.Value, 'eappass', _('EAP Password'));
			o.depends('encryption', 'wpa3');
			o.depends('encryption', 'wpa3-mixed');
			o.depends('encryption', 'wpa2');
			o.depends('encryption', 'wpa');
			o.depends('network', 'wpa3');
			o.depends('network', 'wpa3-mixed');
			o.depends('network', 'wpa2');
			o.depends('network', 'wpa');
			o.password = true;
			o.rmempty = false;
			break;

		case 'static':
			m = new form.JSONMap(json);

			s = m.section(form.TypedSection, 'data');
			s.addremove = false;
			s.anonymous = true;

			o = s.option(form.Value, 'ip4addr', _('IP address'));
			o.datatype = 'ip4addr("nomask")';
			o.rmempty = false;

			o = s.option(form.Value, 'netmask', _('Netmask'));
			o.datatype = 'ip4addr("nomask")';
			o.rmempty = false;

			o = s.option(form.Value, 'gateway', _('Gateway'));
			o.datatype = 'ip4addr("nomask")';
			o.rmempty = false;

			o = s.option(form.DynamicList, 'dns', _('DNS server'));
			o.datatype = 'ip4addr("nomask")';
			o.rmempty = false;

			o = s.option(form.Flag, 'ipv6', _('Configure IPv6'));

			o = s.option(form.Value, 'ip6addr', _('IPv6 address'));
			o.depends('ipv6', '1');
			o.datatype = 'ip6addr';
			o.rmempty = false;

			o = s.option(form.Value, 'ip6gw', _('IPv6 gateway'));
			o.depends('ipv6', '1');
			o.datatype = 'ip6addr("nomask")';
			o.rmempty = false;

			o = s.option(form.Value, 'ip6prefix', _('IPv6 subnet'));
			o.depends('ipv6', '1');
			o.datatype = 'ip6addr';
		}

		if (m != null) {
			return m.render().then(L.bind(function(form) {
				ui.showModal(_('Connection Settings'), [
					form,
					E('div', { 'class': 'right' }, [
						E('button', {
							'class': 'btn',
							'click': ui.hideModal
						}, [ _('Cancel') ]),
						' ',
						E('button', {
							'name': 'proceed-connection-settings',
							'disabled': (data.proto == 'wifi') || null,
							'class': 'btn primary',
							'click': ui.createHandlerFn(this, function(ev) {
								m.save(null, true).then(L.bind(function() {
									return this.handleProtocolConfig(json.data);
								}, this)).catch(L.bind(function(err) {
									alert(_('Please correct the invalid inputs'));
								}, this));
							})
						}, [ _('Proceed') ])
					])
				]);
			}, this));
		}
		else {
			return this.handleProtocolConfig(json.data);
		}
	},

	handleProtocolConfig: function(data) {
		var logicalIfname = 'wan',
		    dns = null;

		if (data.custom_dns)
			dns = L.toArray(data.dns_provider != '-' ? data.dns_provider : data.dns_addrs);

		uci.remove('network', 'wan');
		uci.remove('network', 'wan6');
		uci.remove('network', 'wwan');
		uci.remove('wireless', 'wwan');

		switch (data.proto) {
		case 'dhcp':
			uci.add('network', 'interface', 'wan');
			uci.set('network', 'wan', 'proto', 'dhcp');
			uci.set('network', 'wan', 'metric', '10');
			uci.set('network', 'wan', 'ifname', this.wanIfname);

			uci.add('network', 'interface', 'wan6');
			uci.set('network', 'wan6', 'proto', 'dhcpv6');
			uci.set('network', 'wan6', 'ifname', '@wan');
			break;

		case 'pppoe':
			uci.add('network', 'interface', 'wan');
			uci.set('network', 'wan', 'proto', 'pppoe');
			uci.set('network', 'wan', 'metric', '10');
			uci.set('network', 'wan', 'ipv6', 'auto');
			uci.set('network', 'wan', 'ifname', this.wanIfname);
			uci.set('network', 'wan', 'username', data.username);
			uci.set('network', 'wan', 'password', data.password);
			break;

		case 'wifi':
			var bss = data.network ? JSON.parse(data.network) : {},
			    radio = data.radio || bss.radio || uci.sections('wireless', 'wifi-device')[0]['.name'];

			logicalIfname = 'wwan';

			uci.add('network', 'interface', 'wwan');
			uci.set('network', 'wwan', 'proto', 'dhcp');
			uci.set('network', 'wwan', 'metric', '10');

			uci.add('network', 'interface', 'wan6');
			uci.set('network', 'wan6', 'proto', 'dhcpv6');
			uci.set('network', 'wan6', 'ifname', '@wwan');

			uci.set('wireless', radio, 'disabled', '0');
			uci.remove('wireless', 'default_radio0');
			uci.remove('wireless', 'default_radio1');

			uci.add('wireless', 'wifi-iface', 'wwan');
			uci.set('wireless', 'wwan', 'device', radio);
			uci.set('wireless', 'wwan', 'network', 'wwan');
			uci.set('wireless', 'wwan', 'mode', 'sta');
			uci.set('wireless', 'wwan', 'ssid', data.ssid || bss.ssid);

			switch (data.encryption || bss.encryption) {
			case 'psk2':
			case 'psk-mixed':
				uci.set('wireless', 'wwan', 'encryption', 'psk2');
				uci.set('wireless', 'wwan', 'key', data.wpakey);
				break;

			case 'psk':
				uci.set('wireless', 'wwan', 'encryption', 'psk');
				uci.set('wireless', 'wwan', 'key', data.wpakey);
				break;

			case 'sae':
			case 'sae-mixed':
				uci.set('wireless', 'wwan', 'encryption', 'sae');
				uci.set('wireless', 'wwan', 'key', data.wpakey);
				break;

			case 'wpa3':
			case 'wpa3-mixed':
			case 'wpa2':
			case 'wpa':
				var enc = (data.encryption || bss.encryption).replace(/-mixed$/, '');

				uci.set('wireless', 'wwan', 'encryption', enc);
				uci.set('wireless', 'wwan', 'eap_type', 'ttls');
				uci.set('wireless', 'wwan', 'auth', 'CHAP');
				uci.set('wireless', 'wwan', 'identity', data.eapuser);
				uci.set('wireless', 'wwan', 'password', data.eappass);
				break;

			case 'wep':
				uci.set('wireless', 'wwan', 'encryption', 'wep');
				uci.set('wireless', 'wwan', 'key', '1');
				uci.set('wireless', 'wwan', 'key1', data.wepkey);
				break;

			case 'none':
			case 'owe':
				uci.set('wireless', 'wwan', 'encryption', data.encryption || bss.encryption);
				break;
			}
			break;

		case 'static':
			uci.add('network', 'interface', 'wan');
			uci.set('network', 'wan', 'proto', 'static');
			uci.set('network', 'wan', 'metric', '10');
			uci.set('network', 'wan', 'dns', data.dns);
			uci.set('network', 'wan', 'ipaddr', '%s/%s'.format(data.ip4addr, data.netmask));
			uci.set('network', 'wan', 'gateway', data.gateway);
			uci.set('network', 'wan', 'ip6addr', data.ip6addr);
			uci.set('network', 'wan', 'ip6gw', data.ip6gw);
			uci.set('network', 'wan', 'ip6prefix', data.ip6prefix);
			break;
		}

		if (dns && dns.length) {
			uci.set('network', logicalIfname, 'peerdns', '0');
			uci.set('network', logicalIfname, 'dns', dns);
		}

		uci.sections('firewall', 'zone', function(s) {
			if (s.name != 'wan' && s['.name'] != 'wan')
				return;

			var networks = L.toArray(s.network);

			if (networks.filter(function(net) { return net == logicalIfname }).length == 0)
				networks.push(logicalIfname);

			uci.set('firewall', s['.name'], 'network', networks);
		});

		return uci.save().then(L.bind(function() {
			ui.showModal(_('Setting up…'), [
				E('p', { 'class': 'spinning' },
					[ _('Please wait while the internet connection is setting up.') ])
			]);

			Promise.all([
				callUciCommit('wireless'),
				callUciCommit('network'),
				callUciCommit('firewall')
			]).then(L.bind(function() {
				var deadline = Date.now() + 30 * 1000;
				var pollfn = function() {
					return callNetworkInterfaceStatus(logicalIfname).then(function(res) {
						if (Date.now() >= deadline) {
							ui.showModal(_('Connection failed'), [
								E('p', [ _('The router could not acquire a connection to the internet.') ]),
								logicalIfname == 'wwan'
									? E('p', [ _('Make sure that the target network is in range and that the router has a good reception.') ])
									: E('p', [ _('Make sure that the internet cable is connected properly.') ]),
								E('div', { 'class': 'right' }, [
									E('button', {
										'class': 'btn',
										'click': ui.hideModal
									}, [ _('Close') ])
								])
							]);

							return;
						}

						if (res.up != true) {
							window.setTimeout(pollfn, 3000);
							return;
						}

						ui.showModal(_('Connected!'), [
							E('p', [ _('Your connection is set up now.') ])
						]);

						window.setTimeout(ui.hideModal, 1500);
					}).catch(function(err) {});
				};

				ui.hideIndicator('uci-changes');
				window.setTimeout(pollfn, 5000);
			}, this));
		}, this));
	},

	render: function(data) {
		if (L.isObject(data[0].network) && L.isObject(data[0].network.wan))
			this.wanIfname = data[0].network.wan.ifname;

		if (L.isObject(data[0].network) && L.isObject(data[0].network.lan))
			this.lanIfname = data[0].network.lan.ifname;

		this.wanStatus = data[1];
		this.wwanStatus = data[2];
		this.wan6Status = data[3];

		poll.add(L.bind(function() {
			return Promise.all([
				L.resolveDefault(callNetworkInterfaceStatus('wan'), {}),
				L.resolveDefault(callNetworkInterfaceStatus('wwan'), {}),
				L.resolveDefault(callNetworkInterfaceStatus('wan6'), {})
			]).then(L.bind(function(res) {
				this.wanStatus = res[0];
				this.wwanStatus = res[1];
				this.wan6Status = res[2];

				dom.content(document.querySelector('#view'), this.renderInternetStatus());
			}, this))
		}, this), 3);

		if (!this.wanIfname || !this.lanIfname)
			return ui.addNotification(_('Unable to determine hardware layout'),
				E('p', [ _('Could not retrieve the device information to initialize the network configuration.') ]));

		return this.renderInternetStatus();
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
