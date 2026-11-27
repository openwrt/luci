'use strict';
'require network';
'require request';
'require session';
'require firewall';
'require view';
'require form';
'require poll';
'require rpc';
'require uci';
'require dom';
'require ui';
'require fs';

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

var callSystemBoardRelease = rpc.declare({
	object: 'system',
	method: 'board',
	expect: { 'release': {} }
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

var cbiColumnSection = form.TableSection.extend({
	renderContents: function(cfgsections, nodes) {
		var section_id = null,
		    config_name = this.uciconfig || this.map.config,
		    max_cols = isNaN(this.max_cols) ? this.children.length : this.max_cols,
		    has_more = max_cols < this.children.length,
		    sectionEl = E('div', {
				'id': 'cbi-%s-%s'.format(config_name, this.sectiontype),
				'class': 'cbi-section cbi-tblsection',
				'data-tab': (this.map.tabbed && !this.parentoption) ? this.sectiontype : null,
				'data-tab-title': (this.map.tabbed && !this.parentoption) ? this.title || this.sectiontype : null
			}),
			tableEl = E('div', {
				'class': 'table cbi-section-table'
			});

		if (this.title != null && this.title != '')
			sectionEl.appendChild(E('h3', {}, this.title));

		if (this.description != null && this.description != '')
			sectionEl.appendChild(E('div', { 'class': 'cbi-section-descr' }, this.description));

		if (!this.anonymous || this.sectiontitle) {
			var trEl = E('div', { 'class': 'tr cbi-section-table-titles' }, [
				E('div', { 'class': 'th cbi-section-table-cell' }, '&#160;')
			]);

			for (var i = 0; i < cfgsections.length; i++) {
				var sectionname = this.titleFn('sectiontitle', cfgsections[i]);

				if (sectionname == null)
					sectionname = cfgsections[i];

				trEl.appendChild(E('div', {
					'class': 'th cbi-section-table-cell' ,
					'style': 'width:%d%%'.format(100 / cfgsections.length)
				}, [ sectionname ]));
			}

			tableEl.appendChild(trEl);
		}

		while (nodes[0].firstChild) {
			var trEl = E('div', {
				'class': 'tr cbi-section-table-row',
				'data-section-id': cfgsections[i]
			}, [
				E('div', { 'class': 'td cbi-section-table-cell' }, [
					E('strong', [ nodes[0].firstChild.getAttribute('data-title') ])
				])
			]);

			for (var i = 0; i < nodes.length; i++) {
				nodes[i].firstChild.classList.remove('hidden');
				trEl.appendChild(nodes[i].firstChild);
			}

			tableEl.appendChild(trEl);
		}

		if (nodes.length == 0)
			tableEl.appendChild(E('div', { 'class': 'tr cbi-section-table-row placeholder' },
				E('div', { 'class': 'td' },
					E('em', {}, _('This section contains no values yet')))));

		sectionEl.appendChild(tableEl);

		dom.bindClassInstance(sectionEl, this);

		return sectionEl;
	}
});

var CBIWifiTxPowerValue = form.Value.extend({
	callTxPowerList: rpc.declare({
		object: 'iwinfo',
		method: 'txpowerlist',
		params: [ 'device' ],
		expect: { results: [] }
	}),

	load: function(section_id) {
		return this.callTxPowerList(section_id).then(L.bind(function(pwrlist) {
			this.maxpower = 0;

			for (var i = 0; i < pwrlist.length; i++)
				this.maxpower = Math.max(this.maxpower, pwrlist[i].dbm);

			return form.Value.prototype.load.apply(this, [ section_id ]);
		}, this));
	},

	validate: function(section_id, value) {
		if (this.maxpower && (isNaN(value) || +value < 0 || +value > 100))
			return _('Expecting a value between 0 and 100');

		return true;
	},

	cfgvalue: function(section_id) {
		var dbm = this.map.data.get('wireless', section_id, 'txpower') || this.maxpower;
		return this.maxpower ? '%d'.format(100 / this.maxpower * +dbm) : '100';
	},

	formvalue: function(section_id) {
		var percent = form.Value.prototype.formvalue.apply(this, [ section_id ]),
		    power = this.maxpower ? '%d'.format(+percent / 100 * this.maxpower) : '';

		return (power != this.maxpower) ? power : '';
	},

	renderWidget: function(/* ... */) {
		var node = form.Value.prototype.renderWidget.apply(this, arguments),
		    input = node.querySelector('input');

		input.style.width = '3em';
		input.parentNode.insertBefore(document.createTextNode(' %'), input.nextSibling);

		return node;
	}
});

function addSection(config, type, name, values) {
	if (!uci.get(config, name))
		uci.add(config, type, name);

	if (L.isObject(values))
		for (var key in values)
			uci.set(config, name, key, values[key]);
}

return view.extend({
	load: function() {
		return Promise.all([
			callSystemBoardRelease(),
			network.getWifiDevices(),
			network.getHostHints(),
			fs.trimmed('/sys/class/ieee80211/phy0/macaddress'),
			fs.trimmed('/sys/class/ieee80211/phy1/macaddress'),
			L.resolveDefault(uci.load('dhcp')),
			L.resolveDefault(uci.load('network')),
			L.resolveDefault(uci.load('wireless')),
			L.resolveDefault(uci.load('firewall'))
		]);
	},

	handleSaveSettings: function(m, json) {
		console.debug('save', json);
		return m.save().then(function() {
			var encryption, ssid, key,
			    guest_encryption, guest_enabled, guest_ssid, guest_key;

			for (var radio in json) {
				var sid = 'ap_%s'.format(radio),
				    gsid = 'guest_%s'.format(radio);

				key = key || json[radio].key;
				ssid = ssid || json[radio].ssid;
				encryption = encryption || json[radio].encryption;

				guest_key = guest_key || json[radio].guest_key;
				guest_ssid = guest_ssid || json[radio].guest_ssid;
				guest_enabled = guest_enabled || json[radio].guest_enabled,
				guest_encryption = guest_encryption || json[radio].guest_encryption;

				uci.remove('wireless', 'default_%s'.format(radio));

				for (var id = sid; id; id = (id == sid) ? gsid : null) {
					var en = (json[radio].enabled == '1') && (id == sid ? true : guest_enabled == '1'),
					    bc = (id == sid) ? json[radio].broadcast : '1';

					if (en)
						uci.set('wireless', radio, 'disabled', '0');

					addSection('wireless', 'wifi-iface', id, {
						device: radio,
						mode: 'ap',
						disabled: en ? '0' : '1',
						network: (id == sid) ? 'lan' : 'guest',
						require_mode: json[radio].require_mode || null,
						hidden: (bc == '0') ? '1' : '0',
						wmm: json[radio].wmm
					});
				}

				if (json[radio].macfilter != 'disable') {
					uci.set('wireless', sid, 'macfilter', json[radio].macfilter);
					uci.set('wireless', sid, 'maclist', json[radio].maclist);
				}
				else {
					uci.unset('wireless', sid, 'macfilter');
				}

				uci.set('wireless', radio, 'txpower', json[radio].txpower);
			}

			for (var radio in json) {
				var sid = 'ap_%s'.format(radio),
				    gsid = 'guest_%s'.format(radio);

				for (var id = sid; id; id = (id == sid) ? gsid : null) {
					var name = (id == sid) ? ssid : guest_ssid,
					    encr = (id == sid) ? encryption : guest_encryption,
					    ekey = (id == sid) ? key : guest_key;

					uci.set('wireless', id, 'ssid', name);

					if (encr == 'psk2') {
						uci.set('wireless', id, 'encryption', 'psk2');
						uci.set('wireless', id, 'key', ekey);
					}
					else {
						uci.set('wireless', id, 'encryption', 'none');
						uci.unset('wireless', id, 'key');
					}
				}
			}

			uci.set('network', 'guest', 'auto', guest_enabled ? '1' : '0');

			ui.showModal(_('Configuring wireless'), [
				E('p', { 'class': 'spinning' }, [ _('The wireless networks are being set up now…') ])
			]);

			return uci.save().then(function() {
				return Promise.all([
					callUciCommit('wireless'),
					callUciCommit('network'),
					callUciCommit('firewall'),
					callUciCommit('dhcp')
				]).then(function() {
					window.setTimeout(ui.hideModal, 1500);
				});
			});
		});
	},

	readWifiSettings: function(radios) {
		var json = {};

		for (var i = 0; i < radios.length; i++) {
			var sid = 'ap_%s'.format(radios[i].getName()),
			    gsid = 'guest_%s'.format(radios[i].getName()),
			    off = false;

			if (uci.get('wireless', radios[i].getName(), 'disabled') == '1' ||
			    uci.get('wireless', sid, 'disabled') == '1' ||
			    uci.get('wireless', sid) == null)
				off = true;

			json[radios[i].getName()] = {
				enabled:      off ? '0' : '1',
				broadcast:    (uci.get('wireless', sid, 'hidden') == '1') ? '0' : '1',
				ssid:         uci.get('wireless', sid, 'ssid'),
				encryption:   uci.get('wireless', sid, 'encryption') || 'psk2',
				key:          uci.get('wireless', sid, 'key'),
				wmm:          (uci.get('wireless', sid, 'wmm') == '0') ? '0' : '1',
				txpower:      uci.get('wireless', radios[i].getName(), 'txpower'),
				macfilter:    uci.get('wireless', sid, 'macfilter') || 'disable',
				maclist:      uci.get('wireless', sid, 'maclist'),
				require_mode: uci.get('wireless', sid, 'require_mode'),

				guest_ssid:       uci.get('wireless', gsid, 'ssid'),
				guest_enabled:    (uci.get('network', 'guest', 'auto') == '1') ? '1' : '0',
				guest_encryption: uci.get('wireless', gsid, 'encryption') || 'psk2',
				guest_key:        uci.get('wireless', gsid, 'key')
			};
		}

		console.debug('load', json);
		return json;
	},

	renderInitialSetup: function(radios) {
		ui.showModal(_('Wireless Setup'), [
			E('span', { 'class': 'spinning' }, [ _('Setting up initial configuration…') ])
		]);

		for (var i = 0; i < radios.length; i++)
			uci.remove('wireless', 'default_%s'.format(radios[i].getName()));

		addSection('network', 'interface', 'guest', {
			type: 'bridge',
			proto: 'static',
			ipaddr: '192.168.75.1/24',
			metric: '5',
			auto: '0'
		});

		addSection('dhcp', 'dhcp', 'guest', {
			interface: 'guest',
			force: '1',
			start: '100',
			limit: '150',
			leasetime: '12h',
			dhcpv6: 'server',
			ra: 'server',
			ra_slaac: '1',
			ra_flags: ['managed-config', 'other-config']
		});

		return firewall.getZone('guest').then(function(zone) {
			return zone || firewall.addZone('guest');
		}).then(function(zone) {
			zone.set('input', 'REJECT');
			zone.set('output', 'ACCEPT');
			zone.set('forward', 'REJECT');
			zone.addNetwork('guest');
			zone.addForwardingTo('wan');

			addSection('firewall', 'rule', 'guest_dns', {
				family: 'ipv4',
				proto: ['udp', 'tcp'],
				src: 'guest',
				dest_port: '53',
				target: 'ACCEPT'
			});

			addSection('firewall', 'rule', 'guest_icmp', {
				family: 'ipv4',
				proto: 'icmp',
				icmp_type: ['echo-request', 'echo-reply'],
				src: 'guest',
				target: 'ACCEPT'
			});

			addSection('firewall', 'rule', 'guest_dhcp', {
				family: 'ipv4',
				proto: 'udp',
				src: 'guest',
				src_port: '68',
				dest_port: '67',
				target: 'ACCEPT'
			});

			addSection('firewall', 'rule', 'guest_dhcpv6', {
				family: 'ipv6',
				proto: 'udp',
				src: 'guest',
				src_ip: 'fc00::/6',
				dest_ip: 'fc00::/6',
				dest_port: '546',
				target: 'ACCEPT'
			});

			addSection('firewall', 'rule', 'guest_icmpv6', {
				family: 'ipv6',
				proto: 'icmp',
				icmp_type: ['echo-request', 'echo-reply', 'destination-unreachable', 'packet-too-big', 'time-exceeded', 'bad-header', 'unknown-header-type', 'router-solicitation', 'neighbour-solicitation', 'router-advertisement', 'neighbour-advertisement'],
				src: 'guest',
				target: 'ACCEPT'
			});

			addSection('firewall', 'rule', 'guest_mldv6', {
				family: 'ipv6',
				proto: 'icmp',
				icmp_type: ['130/0', '131/0', '132/0', '143/0'],
				src: 'guest',
				src_ip: 'fe80::/10',
				target: 'ACCEPT'
			});

			return uci.save();
		}).then(function() {
			return Promise.all([
				callUciCommit('wireless'),
				callUciCommit('network'),
				callUciCommit('firewall'),
				callUciCommit('dhcp')
			]);
		}).then(function() {
			window.setTimeout(ui.hideModal, 1500);
		});
	},

	renderBasicSettings: function(json, defaultssid, radios) {
		var m, s, o;

		var renderFirstRadioOnly = function(section_id, option_index, in_table) {
			return (section_id == radios[0].getName())
				? Object.getPrototypeOf(this).renderWidget.apply(this, [ section_id, option_index, in_table ])
				: E('div', '&#160;');
		};

		var formvalueFirstRadioOnly = function(section_id) {
			return (section_id == radios[0].getName())
				? Object.getPrototypeOf(this).formvalue.apply(this, [ section_id ])
				: json[section_id][this.option];
		};

		m = new form.JSONMap(json);

		s = m.section(cbiColumnSection, 'wifi-device');

		s.sectiontitle = function(section_id) {
			return (section_id == radios[0].getName()) ? '2.4GHz' : '5GHz';
		};

		s.cfgsections = function() {
			return radios.map(function(radio) {
				return radio.getName();
			});
		};

		o = s.option(form.ListValue, 'enabled', _('Status'));
		o.value('1', _('On', 'Option is enabled'));
		o.value('0', _('Off', 'Option is disabled'));
		o.widget = 'radio';
		o.orientation = 'horizontal';

		o = s.option(form.Value, 'ssid', _('SSID'));
		o.renderWidget = renderFirstRadioOnly;
		o.formvalue = formvalueFirstRadioOnly;
		o.default = defaultssid;
		o.rmempty = false;

		o = s.option(form.ListValue, 'encryption', _('Security'));
		o.renderWidget = renderFirstRadioOnly;
		o.formvalue = formvalueFirstRadioOnly;
		o.value('psk2', 'WPA2');
		o.value('none', _('None', 'No security enabled'));
		o.widget = 'radio';
		o.orientation = 'vertical';

		o = s.option(form.Value, 'key', _('Password'));
		o.depends('encryption', 'psk2');
		o.renderWidget = renderFirstRadioOnly;
		o.formvalue = formvalueFirstRadioOnly;
		o.datatype = 'wpakey';
		o.password = true;
		o.setActive = function(section_id, active) {
			var el = active ? null : this.getUIElement(section_id);
			if (el) {
				el.setValue('');
				el.triggerValidation();
			}

			return this.super('setActive', [ section_id, active ]);
		};
		o.parse = function(section_id) {
			if (section_id == radios[0].getName() && !this.formvalue(section_id))
				return Promise.reject(new TypeError(_('You must specify a WPA key')));

			return this.super('parse', [ section_id ]);
		};

		return m.render().then(L.bind(function(form) {
			return E([], [
				form,
				E('div', { 'class': 'right' }, [
					E('button', {
						'class': 'important',
						'click': ui.createHandlerFn(this, 'handleSaveSettings', m, json)
					}, [ _('Save Changes') ])
				])
			]);
		}, this));
	},

	renderAdvancedSettings: function(json, defaultssid, radios, hints) {
		var m, s, o;

		var renderFirstRadioOnly = function(section_id, option_index, in_table) {
			return (section_id == radios[0].getName())
				? Object.getPrototypeOf(this).renderWidget.apply(this, [ section_id, option_index, in_table ])
				: E('div', '&#160;');
		};

		var formvalueFirstRadioOnly = function(section_id) {
			return (section_id == radios[0].getName())
				? Object.getPrototypeOf(this).formvalue.apply(this, [ section_id ])
				: json[section_id][this.option];
		};

		m = new form.JSONMap(json);

		s = m.section(cbiColumnSection, 'wifi-device');

		s.sectiontitle = function(section_id) {
			return (section_id == radios[0].getName()) ? '2.4GHz' : '5GHz';
		};

		s.cfgsections = function() {
			return radios.map(function(radio) {
				return radio.getName();
			});
		};

		o = s.option(form.ListValue, 'broadcast', _('Broadcast'));
		o.value('1', _('On', 'Option is enabled'));
		o.value('0', _('Off', 'Option is disabled'));
		o.widget = 'radio';
		o.orientation = 'horizontal';

		o = s.option(form.ListValue, 'macfilter', _('MAC Authentication'));
		o.value('disable', _('Disable access list'));
		o.value('allow', _('Accept all devices listed below'));
		o.value('deny', _('Deny all devices listed below'));
		o.widget = 'radio';
		o.orientation = 'vertical';

		o = s.option(form.DynamicList, 'maclist', _('MAC List'));
		o.depends('macfilter', 'allow');
		o.depends('macfilter', 'deny');
		o.datatype = 'macaddr';

		hints.getMACHints().forEach(function(tuple) {
			if (tuple[0] == '00:00:00:00:00:00')
				return;

			o.value(tuple[0], E('span', [ tuple[0], ' (', E('strong', [ tuple[1] ]), ')' ]));
		});

		o = s.option(form.ListValue, 'require_mode', _('802.11 Mode'));
		o.renderWidget = function(section_id, option_index, cfgvalue) {
			var radio = radios.filter(function(radio) { return radio.getName() == section_id })[0],
			    hwmodes = radio.getHWModes();

			this.keylist = [];
			this.vallist = [];

			hwmodes.sort(function(a, b) {
				if (a.length == b.length)
					return a > b;

				return a.length > b.length;
			});

			if (hwmodes.indexOf('a') > -1 || hwmodes.indexOf('b') > -1 || hwmodes.indexOf('g') > -1)
				this.value('', _('Legacy mode (802.11%s)').format(hwmodes.join('/')));

			if (hwmodes.indexOf('n') > -1) {
				if (hwmodes.indexOf('ac') > -1) {
					this.value('n', _('Compatibility mode (802.11n/ac)'));
					this.value('ac', _('Wi-Fi 5 Only (802.11ac)'));
				}
				else {
					this.value('n', _('Wi-Fi 4 Only (802.11n)'));
				}
			}

			return form.ListValue.prototype.renderWidget.apply(this, [ section_id, option_index, cfgvalue ]);
		};

		o = s.option(CBIWifiTxPowerValue, 'txpower', _('Transmit Power'));

		o = s.option(form.ListValue, 'wmm', _('Wireless QoS (WMM)'));
		o.value('1', _('On', 'Option is enabled'));
		o.value('0', _('Off', 'Option is disabled'));
		o.widget = 'radio';
		o.orientation = 'horizontal';

		return m.render().then(L.bind(function(form) {
			return E([], [
				form,
				E('div', { 'class': 'right' }, [
					E('button', {
						'class': 'important',
						'click': ui.createHandlerFn(this, 'handleSaveSettings', m, json)
					}, [ _('Save Changes') ])
				])
			]);
		}, this));
	},

	renderGuestSettings: function(json, defaultssid, radios, hints) {
		var m, s, o;

		var renderFirstRadioOnly = function(section_id, option_index, in_table) {
			return (section_id == radios[0].getName())
				? Object.getPrototypeOf(this).renderWidget.apply(this, [ section_id, option_index, in_table ])
				: E('div', '&#160;');
		};

		var formvalueFirstRadioOnly = function(section_id) {
			return (section_id == radios[0].getName())
				? Object.getPrototypeOf(this).formvalue.apply(this, [ section_id ])
				: json[section_id][this.option];
		};

		m = new form.JSONMap(json);

		s = m.section(form.NamedSection, radios[0].getName(), 'wifi-device');

		o = s.option(form.ListValue, 'guest_enabled', _('Guest Wi-Fi'));
		o.value('1', _('On', 'Option is enabled'));
		o.value('0', _('Off', 'Option is disabled'));
		o.widget = 'radio';
		o.orientation = 'horizontal';

		o = s.option(form.ListValue, 'guest_encryption', _('Security'));
		o.value('psk2', _('Password protected', 'Network is encrypted'));
		o.value('none', _('Open (Not recommended)', 'Network is not encrypted'));
		o.widget = 'radio';
		o.default = 'psk2';
		o.orientation = 'vertical';

		o = s.option(form.Value, 'guest_ssid', _('SSID'));
		o.default = defaultssid + '-Guest';
		o.rmempty = false;
		o.validate = function(section_id, value) {
			if (value == json[section_id].ssid)
				return _('The guest Wi-Fi SSID must be different to the main network SSID.');

			return true;
		};

		o = s.option(form.Value, 'guest_key', _('Password'));
		o.depends('guest_encryption', 'psk2');
		o.datatype = 'wpakey';
		o.password = true;
		o.remove = function() {};
		o.parse = function(section_id) {
			if (this.isActive(section_id) && !this.formvalue(section_id))
				return Promise.reject(new TypeError(_('You must specify a guest Wi-Fi password')));

			return this.super('parse', [ section_id ]);
		};

		return m.render().then(L.bind(function(form) {
			return E([], [
				form,
				E('div', { 'class': 'right' }, [
					E('button', {
						'class': 'important',
						'click': ui.createHandlerFn(this, 'handleSaveSettings', m, json)
					}, [ _('Save Changes') ])
				])
			]);
		}, this));
	},

	render: function(data) {
		var radios = [],
		    release = data[0],
		    phys = data[1],
		    hints = data[2],
		    phymac = data[3] || data[4],
		    defaultssid = (release.distribution || 'OpenWrt') +
		    	(phymac ? '-' + phymac.substring(9).replace(/:/g, '').toUpperCase() : '');

		for (var i = 0; i < phys.length; i++) {
			var hwmodes = phys[i].getHWModes();

			if (hwmodes.indexOf('a') > -1 || hwmodes.indexOf('ac') > -1)
				radios[1] = radios[1] || phys[i];
			else
				radios[0] = radios[0] || phys[i];
		}

		var initTask = null;

		if (!uci.get('network', 'guest') ||
		    !uci.get('firewall', 'guest_dhcp') ||
		    uci.get('wireless', 'default_radio0') ||
		    uci.get('wireless', 'default_radio1'))
		    initTask = this.renderInitialSetup(radios);

		return Promise.resolve(initTask).then(L.bind(function() {
			var json = this.readWifiSettings(radios);

			return Promise.all([
				this.renderBasicSettings(json, defaultssid, radios, hints),
				this.renderAdvancedSettings(json, defaultssid, radios, hints),
				this.renderGuestSettings(json, defaultssid, radios, hints)
			]);
		}, this)).then(function(panes) {
			var view = E([], [
				E('h1', [ _('Wi-Fi Settings') ]),
				E('div', [
					E('div', [
						E('div', { 'data-tab': 'basic', 'data-tab-title': _('Basic Settings') }, [
							panes[0]
						]),
						E('div', { 'data-tab': 'advanced', 'data-tab-title': _('Advanced Settings') }, [
							panes[1]
						]),
						E('div', { 'data-tab': 'guest', 'data-tab-title': _('Guest Network') }, [
							panes[2]
						])
					])
				])
			]);

			ui.tabs.initTabGroup(view.lastElementChild.lastElementChild.childNodes);

			return view;
		});
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
