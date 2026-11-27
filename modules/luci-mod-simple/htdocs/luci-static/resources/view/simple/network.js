'use strict';
'require validation';
'require network';
'require view';
'require form';
'require poll';
'require rpc';
'require uci';
'require dom';
'require ui';
'require fs';

var callTopologyGetTopology = rpc.declare({
	object: 'topology',
	method: 'getTopology',
	expect: { '': {} }
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

function updateHostSection(mac, options) {
	var sid = null;

	uci.sections('dhcp', 'host', function(host) {
		L.toArray(host.mac).forEach(function(hmac) {
			if (hmac.toUpperCase() == mac.toUpperCase())
				sid = host['.name'];
		});
	});

	if (sid == null) {
		sid = uci.add('dhcp', 'host');
		uci.set('dhcp', sid, 'mac', mac.toUpperCase());
	}

	for (var opt in options)
		if (options.hasOwnProperty(opt))
			uci.set('dhcp', sid, opt, options[opt]);
}

function parseAddressAndNetmask(ipaddr, netmask) {
	var m = (L.toArray(ipaddr)[0] || '').match(/^(.+)\/(\d+)$/);
	if (m) {
		var a = validation.parseIPv4(m[1]),
		    s = network.prefixToMask(m[2]);

		if (a && s)
			return [ m[1], s ];
	}
	else {
		m = (ipaddr || '').match(/^(.+)\/(.+)$/);

		if (m) {
			var a = validation.parseIPv4(m[1]),
			    s = network.maskToPrefix(m[2]);

			if (a && s)
				return [ m[1], network.prefixToMask(s) ];
		}
		else {
			return [ ipaddr, netmask ];
		}
	}

	return null;
}

function calculateBroadcast(s, use_cfgvalue) {
	var readfn = use_cfgvalue ? 'cfgvalue' : 'formvalue',
	    addropt = s.children.filter(function(o) { return o.option == 'addr'})[0],
	    maskopt = s.children.filter(function(o) { return o.option == 'mask'})[0];

	var addr = validation.parseIPv4(L.toArray(addropt[readfn](s.section))[0] || ''),
	    mask = L.toArray(maskopt[readfn](s.section))[0];

	if (addr == null || mask == null)
		return null;

	if (!isNaN(mask))
		mask = validation.parseIPv4(network.prefixToMask(+mask));
	else
		mask = validation.parseIPv4(mask);

	var bc = [
		addr[0] | (~mask[0] >>> 0 & 255),
		addr[1] | (~mask[1] >>> 0 & 255),
		addr[2] | (~mask[2] >>> 0 & 255),
		addr[3] | (~mask[3] >>> 0 & 255)
	];

	return bc.join('.');
}

function validateAddressAndMask(topology, section, section_id, value) {
	var broadcast = calculateBroadcast(section, false);

	for (var zone in topology.zones) {
		if (zone == section_id)
			continue;

		for (var device in topology.zones[zone]) {
			var dev = topology.zones[zone][device];
			if (Array.isArray(dev.ipaddrs)) {
				for (var i = 0; i < dev.ipaddrs.length; i++) {
					if (dev.ipaddrs[i].broadcast == broadcast)
						return _('This address range is already used by the %s network').format(zone);
				}
			}
		}
	}

	return true;
}

function validateNetmask(topology, section, section_id, value) {
	var maskopt = section.children.filter(function(o) { return o.option == 'mask'})[0],
	    maskval = maskopt.formvalue(section_id);

	if (maskval == null || network.maskToPrefix(maskval) == null)
		return _('Invalid network mask');

	return validateAddressAndMask(topology, section, section_id, value);
}

function renderConnection(host, topo, wnets) {
	var details = topo.hosts[host.mac] || {},
	    wnet = details.assoc ? wnets.filter(function(w) { return w.ubus('dev', 'iwinfo', 'phy') == details.assoc.phy })[0] : null,
	    port;

	if (wnet) {
		if (wnet.getChannel() > 13)
			port = _('5GHz Wireless "%h"').format(wnet.getActiveSSID() || wnet.getActiveBSSID() || '?');
		else
			port = _('2.4GHz Wireless "%h"').format(wnet.getActiveSSID() || wnet.getActiveBSSID() || '?');
	}
	else if (details.assoc) {
		port = _('Wireless');
	}
	else {
		port = _('Ethernet');
	}

	switch (host.zone) {
	case 'lan':
		return _('LAN Network - %s').format(port);

	case 'guest':
		return _('Guest Network - %s').format(port);

	case 'wan':
		return _('WAN Network');

	default:
		return host.zone ? _('Network "%h"').format(host.zone) : '';
	}
}

return view.extend({
	loadStatus: function() {
		return Promise.all([
			L.resolveDefault(callTopologyGetTopology(), {}),
			L.resolveDefault(network.getWifiNetworks(), []),
			uci.load('dhcp'),
			uci.load('firewall'),
			uci.load('network')
		]);
	},

	connectionToZone: function(lookup, topo, cache) {
		if (L.isObject(cache) && cache.hasOwnProperty(lookup))
			return cache[lookup];

		for (var zone in topo.zones) {
			for (var device in topo.zones[zone]) {
				if (device == lookup) {
					if (L.isObject(cache))
						cache[device] = zone;

					return zone;
				}
			}
		}

		return null;
	},

	connectionToPort: function(lookup, topo, cache) {
		if (L.isObject(cache) && cache.hasOwnProperty(lookup))
			return cache[lookup];

		for (var zone in topo.zones) {
			for (var device in topo.zones[zone]) {
				if (device == lookup) {
					if (L.isObject(cache))
						cache[lookup] = topo.zones[zone][device];

					return topo.zones[zone][device];
				}

				if (L.isObject(topo.zones[zone][device].ports)) {
					for (var subdevice in topo.zones[zone][device].ports) {
						if (subdevice == lookup) {
							if (L.isObject(cache))
								cache[lookup] = topo.zones[zone][device].ports[subdevice]

							return topo.zones[zone][device].ports[subdevice];
						}
					}
				}
			}
		}

		return null;
	},

	buildHostList: function(topo) {
		var blocked = {},
		    zones = {},
		    ports = {},
		    hosts = {};

		L.toArray(uci.get('firewall', 'hostblock', 'src_mac')).forEach(function(mac) {
			blocked[mac.toUpperCase()] = true;
		});

		uci.sections('dhcp', 'host', function(host) {
			L.toArray(host.mac).forEach(function(mac) {
				hosts[mac.toUpperCase()] = Object.assign({}, {
					mac: mac.toUpperCase(),
					config_ip: host.ip,
					config_name: host.name,
					config_type: host.type || 'laptop'
				});
			});
		});

		for (var mac in (topo.hosts || {})) {
			var host = topo.hosts[mac],
			    neigh = (host.neigh4 || []).concat(host.neigh6 || []),
			    ip6ll = null,
			    ip6s = [];

			for (var i = 0; i < (host.neigh6 || []).length; i++) {
				var a = host.neigh6[i].addr;

				if (a.match(/^fe[89ab][0-9a-f]:/i))
					ip6ll = a;
				else
					ip6s.push(a);
			}

			(host.neigh4 || []).sort(function(a, b) {
				var usedA = (a.used || '-1').split(/\//)[0],
				    usedB = (b.used || '-1').split(/\//)[0];

				return (usedA - usedB);
			});

			hosts[mac] = Object.assign(hosts[mac] || {}, {
				mac: mac,
				active_ip: (host.neigh4 && host.neigh4.length) ? host.neigh4[0].addr : null,
				active_ipmode: host.dhcp ? 'dhcp' : 'static',
				active_name: host.dhcp ? host.dhcp.hostname : host.name,
				active_ip6ll: ip6ll,
				active_ip6addrs: ip6s,
				active_ip6mode: host.dhcp6 ? 'stateful' : 'stateless',
				connected: neigh.filter(function(n) { return n.state.match(/REACHABLE|STALE/) != null }).length > 0,
				connection: host.dev,
				blocked: !!blocked[mac],
				zone: this.connectionToZone(host.dev, topo, zones),
				port: this.connectionToPort(host.dev, topo, ports)
			});
		}

		var zoneweight = { lan: 100, guest: 50, wan: 10 },
		    list = [];

		for (var mac in hosts)
			list.push(hosts[mac]);

		list.sort(function(a, b) {
			var wA = zoneweight[a.zone] || 0,
			    wB = zoneweight[b.zone] || 0,
			    nA = a.config_name || a.active_name || '~' + a.mac,
			    nB = b.config_name || b.active_name || '~' + b.mac;

			if (wA != wB)
				return wA < wB;

			return nA > nB;
		});

		return list;
	},

	load: function() {
		return this.loadStatus();
	},

	renderHost: function(host, topo, wnets) {
		var table = [];
		var data = [
			_('Connection:'),              renderConnection(host, topo, wnets),
			_('IPv4 Address:'),            host.active_ip || host.config_ip || '',
			_('IPv4 Address is from:'),    (host.active_ip || host.config_ip) ? ((host.active_ipmode == 'dhcp') ? 'DHCP' : _('Static', 'Statically configured IP, as opposed to DHCP assigned')) : '',
			_('IPv6 Global:'),             L.toArray(host.active_ip6addrs).join(', '),
			_('IPv6 Link-local:'),         host.active_ip6ll || '',
			_('IPv6 Address Allocation:'), (host.active_ip6ll || L.toArray(host.active_ip6addrs).length) ? ((host.active_ip6mode == 'stateless') ? _('Stateless', 'IPv6 assignment mode') : _('Stateful', 'IPv6 assignment mode')) : '',
			_('MAC address:'),             host.mac,
			_('Status:'),                  this.renderHostStatus(host)
		];

		for (var i = 0; i < data.length; i += 2)
			table.push(E('div', [
				E('div', [ data[i + 0] ]),
				E('div', [ data[i + 1] ])
			]));

		return E([], table);
	},

	handleHostRename: function(host) {
		var m, s, o;

		m = new form.JSONMap({ host: host });

		s = m.section(form.NamedSection, 'host', 'host');

		o = s.option(form.Value, 'config_name', _('Device Name'), _('Specifies the associated hostname of the device. Leave empty to use client provided name.'));
		o.placeholder = host.config_name || host.active_name;
		o.datatype = 'hostname';

		o = s.option(cbiRichListValue, 'config_type', _('Device Icon'), _('Assign a different icon to the device to make it easier to recognize.'));
		o.value('laptop',   E([], [ E('img', { 'style': 'width:1em', 'src': L.resource('svg/laptop.svg') }),   ' ', _('Laptop') ]));
		o.value('computer', E([], [ E('img', { 'style': 'width:1em', 'src': L.resource('svg/computer.svg') }), ' ', _('Computer') ]));
		o.value('tablet',   E([], [ E('img', { 'style': 'width:1em', 'src': L.resource('svg/tablet.svg') }),   ' ', _('Tablet') ]));
		o.value('phone',    E([], [ E('img', { 'style': 'width:1em', 'src': L.resource('svg/phone.svg') }),    ' ', _('Phone') ]));
		o.value('router',   E([], [ E('img', { 'style': 'width:1em', 'src': L.resource('svg/router.svg') }),   ' ', _('Router') ]));

		if (host.zone == 'lan') {
			o = s.option(form.Value, 'config_ip', _('Device Address'), _('Change the reserved DHCP address for this device. Has no effect on devices that use a static configuration and only takes effect when the device reconnects.'));
			o.placeholder = host.active_ip;
			o.datatype = 'ip4addr("nomask")';
		}

		return m.render().then(L.bind(function(nodes) {
			ui.showModal(_('Rename device %s').format(host.config_name || host.active_name || host.mac), [
				nodes,
				E('div', { 'class': 'right' }, [
					E('button', {
						'class': 'btn',
						'click': ui.hideModal
					}, [ _('Cancel') ]),
					' ',
					E('button', {
						'class': 'btn primary',
						'click': ui.createHandlerFn(this, function(ev) {
							return m.save().then(L.bind(function() {
								updateHostSection(host.mac, {
									dns: 1,
									type: host.config_type,
									name: host.config_name,
									ip: host.config_ip,
								});

								return this.handleApply();
							}, this));
						})
					}, [ _('Update details') ])
				])
			]);
		}, this));
	},

	handleHostForgetConfirmed: function(host) {
		uci.sections('dhcp', 'host', function(s) {
			L.toArray(s.mac).forEach(function(mac) {
				if (mac.toUpperCase() == host.mac) {
					uci.remove('dhcp', s['.name']);
					return false;
				}
			});
		});

		var old_macs = L.toArray(uci.get('firewall', 'hostblock', 'src_mac')),
		    new_macs = old_macs.filter(function(mac) { return mac != host.mac });

		if (new_macs.length > 0)
			uci.set('firewall', 'hostblock', 'src_mac', new_macs);
		else if (old_macs.length > 0)
			uci.remove('firewall', 'hostblock');

		return this.handleApply().then(ui.hideModal);
	},

	handleHostForget: function(host) {
		ui.showModal(_('Really remove host details?'), [
			E('p', {}, [ _('If you continue, DHCP reservations and internet block rules for this host will be removed.') ]),
			E('div', { 'class': 'right' }, [
				E('button', {
					'class': 'btn',
					'click': ui.hideModal
				}, [ _('Cancel') ]),
				E('button', {
					'class': 'btn important',
					'click': ui.createHandlerFn(this, 'handleHostForgetConfirmed', host)
				}, [ _('Remove host') ])
			])
		]);
	},

	handleHostBlock: function(host) {
		var macs = L.toArray(uci.get('firewall', 'hostblock', 'src_mac'));

		if (macs.indexOf(host.mac) > -1) {
			macs = macs.filter(function(mac) { return mac != host.mac });

			if (macs.length > 0)
				uci.set('firewall', 'hostblock', 'src_mac', macs);
			else
				uci.remove('firewall', 'hostblock');
		}
		else {
			if (macs.length > 0) {
				macs.push(host.mac);
				macs.sort();
				uci.set('firewall', 'hostblock', 'src_mac', macs);
			}
			else {
				uci.add('firewall', 'rule', 'hostblock');
				uci.set('firewall', 'hostblock', 'src', '*');
				uci.set('firewall', 'hostblock', 'dest', 'wan');
				uci.set('firewall', 'hostblock', 'name', 'Block hosts by MAC address');
				uci.set('firewall', 'hostblock', 'proto', 'all');
				uci.set('firewall', 'hostblock', 'target', 'REJECT');
				uci.set('firewall', 'hostblock', 'src_mac', [ host.mac ]);
			}
		}

		return this.handleApply();
	},

	handleHostDetails: function(host, topo) {
		var details = topo.hosts[host.mac],
		    info = [];

		if (L.isObject(details.dhcp)) {
			var expires;

			if (details.dhcp.expires === false)
				expires = E('em', [ _('unlimited') ]);
			else if (details.dhcp.expires <= 0)
				expires = E('em', [ _('expired') ]);
			else
				expires = '%t'.format(details.dhcp.expires);

			info.push(E('h5', [ _('DHCP') ]), ui.itemlist(E('p'), [
				_('Hostname'), details.dhcp.hostname || E('em', [ _('not sent') ]),
				_('Address'),  details.dhcp.ipaddr,
				_('Expires'),  expires
			]));
		}

		if (L.isObject(details.dhcp6)) {
			var expires;

			if (details.dhcp6.expires === false)
				expires = E('em', [ _('unlimited') ]);
			else if (details.dhcp6.expires <= 0)
				expires = E('em', [ _('expired') ]);
			else
				expires = '%t'.format(details.dhcp6.expires);

			info.push(E('h5', [ _('DHCP') ]), ui.itemlist(E('p'), [
				_('Hostname'), details.dhcp6.hostname || E('em', [ _('not sent') ]),
				_('Address'),  details.dhcp6.ipaddr,
				_('Expires'),  expires,
				_('DUID'),     details.dhcp6.duid
			]));
		}

		if (Array.isArray(details.neigh4)) {
			var ul = E('ul');

			details.neigh4.forEach(function(neigh) {
				var times = (neigh.used || '-1/-1/-1').split(/\//);

				ul.appendChild(ui.itemlist(E('li'), [
					_('Address'),   neigh.addr,
					_('Status'),    neigh.status,
					_('Used'),      times[0] > -1 ? _('%t ago', 'Amount of time (%t) passed').format(times[0]) : E('em', [ _('never') ]),
					_('Confirmed'), times[1] > -1 ? _('%t ago', 'Amount of time (%t) passed').format(times[1]) : E('em', [ _('never') ]),
					_('Updated'),   times[2] > -1 ? _('%t ago', 'Amount of time (%t) passed').format(times[2]) : E('em', [ _('never') ])
				]));
			});

			info.push(E('h5', [ _('ARP') ]), ul);
		}

		if (Array.isArray(details.neigh6)) {
			var ul = E('ul');

			details.neigh6.forEach(function(neigh) {
				var times = (neigh.used || '-1/-1/-1').split(/\//);

				ul.appendChild(ui.itemlist(E('li'), [
					_('Address'),   neigh.addr,
					_('Status'),    neigh.status,
					_('Used'),      times[0] > -1 ? _('%t ago', 'Amount of time (%t) passed').format(times[0]) : E('em', [ _('never') ]),
					_('Confirmed'), times[1] > -1 ? _('%t ago', 'Amount of time (%t) passed').format(times[1]) : E('em', [ _('never') ]),
					_('Updated'),   times[2] > -1 ? _('%t ago', 'Amount of time (%t) passed').format(times[2]) : E('em', [ _('never') ]),
					null,           neigh.router ? E('em', [ _('Acting as IPv6 router') ]) : null
				]));
			});

			info.push(E('h5', [ _('NDP') ]), ul);
		}

		/* TODO: render wireless details */
		/* info.push(E('pre', JSON.stringify(details, null, '  '))); */

		ui.showModal(_('Details for %s').format(host.config_name || host.active_name || host.mac), [
			E('div', info),
			E('div', { 'class': 'right' }, [
				E('button', { 'class': 'btn', 'click': ui.hideModal }, [ _('Close') ])
			])
		]);
	},

	handleHostAction: function(action, host, topo) {
		switch (action) {
		case 'rename':
			return this.handleHostRename(host);

		case 'forget':
			return this.handleHostForget(host);

		case 'block':
			return this.handleHostBlock(host);

		case 'details':
			return this.handleHostDetails(host, topo);
		}
	},

	handleApply: function() {
		var dlg = ui.showModal(null, [ E('em', { 'class': 'spinning' }, [ _('Saving configuration…') ]) ]);
		dlg.removeChild(dlg.firstElementChild);

		return uci.save().then(function() {
			return Promise.all([
				callUciCommit('dhcp'),
				callUciCommit('firewall'),
				callUciCommit('network')
			]);
		}).then(L.bind(this.redraw, this)).catch(function(err) {
			ui.addNotification(null, [ E('p', [ _('Failed to save configuration: %s').format(err) ]) ])
		}).finally(function() {
			ui.hideIndicator('uci-changes');
			ui.hideModal();
		});
	},

	renderHostStatus: function(host) {
		if (host.blocked)
			return E('span', { 'style': 'color:#a00' }, [ _('Blocked') ]);
		else if (host.connected)
			return E('span', { 'style': 'color:#0a4' }, [ _('Active') ]);
		else
			return E('span', { 'style': 'color:#a00' }, [ _('Inactive') ]);
	},

	renderHostAction: function(host, topo) {
		var keys = [], choices = {};

		if (host.zone == 'lan' || host.zone == 'guest') {
			keys.push('block');
			choices.block = host.blocked ? _('Unblock internet access') : _('Block internet access');
		}

		keys.push('details');
		choices.details = _('View device details');

		keys.push('rename');
		choices.rename = _('Rename this device');

		if (host.config_ip || host.config_name || host.config_type) {
			keys.push('forget');
			choices.forget = _('Forget this device');
		}

		var dd = new ui.Dropdown(null, choices, {
			sort: keys,
			//click: ui.createHandlerFn(this, 'handleHostAction', host, topo),
			select_placeholder: _('Device options…')
		});

		dd.toggleItem = L.bind(function(host, sb, li) {
			this.handleHostAction(li.getAttribute('data-value'), host, topo);
			dd.closeDropdown(sb);
		}, this, host);

		return E('div', { 'style': 'width:200px' }, dd.render());
	},

	renderHostListSelector: function() {
		var choices = {
			all: _('Display all devices'),
			active: _('Show active devices'),
			blocked: _('Show blocked devices'),
			lan: _('Show LAN devices'),
			guest: _('Show guest devices')
		};

		var dd = new ui.Dropdown(null, choices, {
			sort: [ 'all', 'active', 'blocked', 'lan', 'guest' ],
			optional: false
		});

		dd.toggleItem = function(sb, li) {
			var table = document.querySelector('div[data-tab="hosts"] > table'),
			    rows = table.querySelectorAll('tr:not(.placeholder)'),
			    mode = li.getAttribute('data-value'),
			    matched = 0;

			rows.forEach(function(row) {
				switch (mode) {
				case 'all':
					row.style.display = '';
					matched++;
					return;

				case 'active':
					row.style.display = (row.getAttribute('data-connected') == 'true') ? '' : 'none';
					matched += (row.style.display != 'none');
					return;

				case 'blocked':
					row.style.display = (row.getAttribute('data-blocked') == 'true') ? '' : 'none';
					matched += (row.style.display != 'none');
					return;

				case 'lan':
				case 'guest':
					row.style.display = (row.getAttribute('data-zone') == mode) ? '' : 'none';
					matched += (row.style.display != 'none');
					return;
				}
			});

			table.firstElementChild.style.display = matched ? 'none' : '';

			ui.Dropdown.prototype.toggleItem.apply(this, [sb, li]);
		};

		return E('p', { 'class': 'right' }, dd.render());
	},

	renderHostIcon: function(host) {
		return E('img', { 'src': L.resource('svg/%s.svg'.format(host.config_type || 'laptop')) });
	},

	renderHostList: function(data) {
		var topo = data[0],
		    wnets = data[1],
		    list = this.buildHostList(topo);

		var view = E([], [
			E('style', { 'type': 'text/css' }, [
				'.host-icon { flex: 0 0 50px; padding: 0 1em 0 0 }',
				'.host-info { flex: 1 1 auto }',
				'.host-info > * { display: flex; padding: .125em 0 }',
				'.host-info > * > :first-child { flex: 1 1 40% }',
				'.host-info > * > :last-child { flex: 1 1 60% }',
				'.host-info > :first-child { padding: 0 0 .5em }',
				'.host-info > :first-child > :first-child { font-size: 120%; align-self: center }'
			]),
			E('table', { 'class': 'table' }, [
				E('tr', { 'class': 'tr placeholder', 'style': list.length ? 'display:none' : '' }, [
					E('td', { 'class': 'td' }, [
						E('em', [ _('No devices found') ])
					])
				])
			])
		]);

		for (var i = 0; i < list.length; i++)
			view.lastElementChild.appendChild(E('tr', {
				'class': 'tr',
				'data-zone': list[i].zone,
				'data-connected': list[i].connected,
				'data-blocked': list[i].blocked
			}, [
				E('td', { 'class': 'td' }, [
					E('div', { 'style': 'display:flex' }, [
						E('div', { 'class': 'host-icon' }, this.renderHostIcon(list[i])),
						E('div', { 'class': 'host-info' }, [
							E('div', [
								E('strong', [ list[i].config_name || list[i].active_name || 'unknown_%s'.format(list[i].mac) ]),
								E('div', [ this.renderHostAction(list[i], topo) ])
							]),
							this.renderHost(list[i], topo, wnets)
						])
					])
				])
			]));

		return view;
	},

	handleSettingsSave: function(formdata) {
		var m = L.dom.findClassInstance(document.querySelector('div[data-tab="settings"] > .cbi-map'));

		return m.save().then(L.bind(function() {
			for (var net = 'lan'; net != null; net = (net == 'lan') ? 'guest' : null) {
				uci.set('network', net, 'ipaddr', formdata[net].addr);
				uci.set('network', net, 'netmask', formdata[net].mask);

				if (formdata[net].dhcp != '1')
					uci.set('dhcp', net, 'ignore', '1');
				else
					uci.set('dhcp', net, 'ignore', '0');

				if (formdata[net].ipv6 != '1') {
					uci.set('dhcp', net, 'ra', 'disabled');
					uci.set('dhcp', net, 'dhcpv6', 'disabled');
				}
				else {
					uci.set('dhcp', net, 'ra', 'server');
					uci.set('dhcp', net, 'dhcpv6', 'server');
				}
			}

			return this.handleApply();
		}, this));
	},

	renderNetworkSettings: function(data, formdata) {
		var m, s, o;

		var addr_lan = parseAddressAndNetmask(
			uci.get('network', 'lan', 'ipaddr'),
			uci.get('network', 'lan', 'netmask'));

		var addr_guest = parseAddressAndNetmask(
			uci.get('network', 'guest', 'ipaddr'),
			uci.get('network', 'guest', 'netmask'));

		Object.assign(formdata, {
			lan: {
				addr: addr_lan ? addr_lan[0] : null,
				mask: addr_lan ? addr_lan[1] : null,
				dhcp: (uci.get('dhcp', 'lan', 'ignore') != '1') ? '1' : '0',
				ipv6: (uci.get('dhcp', 'lan', 'dhcpv6') != 'disabled') ? '1' : '0'
			},
			guest: {
				addr: addr_guest ? addr_guest[0] : null,
				mask: addr_guest ? addr_guest[1] : null,
				dhcp: (uci.get('dhcp', 'guest', 'ignore') != '1') ? '1' : '0',
				ipv6: (uci.get('dhcp', 'guest', 'dhcpv6') != 'disabled') ? '1' : '0'
			}
		});

		m = new form.JSONMap(formdata);

		s = m.section(form.NamedSection, 'lan', 'lan', _('Local Network Settings'));

		o = s.option(form.Value, 'addr', _('IP Address'));
		o.rmempty = false;
		o.datatype = 'ip4addr("nomask")';
		o.validate = validateAddressAndMask.bind(o, data[0], s);

		o = s.option(form.Value, 'mask', _('Netmask'));
		o.rmempty = false;
		o.datatype = 'ip4addr("nomask")';
		o.validate = validateNetmask.bind(o, data[0], s);

		o = s.option(form.Flag, 'dhcp', _('Enable DHCP Service'));
		o = s.option(form.Flag, 'ipv6', _('Enable IPv6'));


		s = m.section(form.NamedSection, 'guest', 'guest', _('Guest Network Settings'));

		o = s.option(form.Value, 'addr', _('IP Address'));
		o.rmempty = false;
		o.datatype = 'ip4addr("nomask")';
		o.validate = validateAddressAndMask.bind(o, data[0], s);

		o = s.option(form.Value, 'mask', _('Netmask'));
		o.rmempty = false;
		o.datatype = 'ip4addr("nomask")';
		o.validate = validateNetmask.bind(o, data[0], s);

		o = s.option(form.Flag, 'dhcp', _('Enable DHCP Service'));
		o = s.option(form.Flag, 'ipv6', _('Enable IPv6'));

		return m.render();
	},

	redraw: function() {
		this.load().then(L.bind(function(data) {
			var oldTable = document.querySelector('div[data-tab="hosts"] > .table'),
			    newTable = this.renderHostList(data),
			    filter = document.querySelector('div[data-tab="hosts"] > p > .cbi-dropdown')

			oldTable.parentNode.replaceChild(newTable, oldTable);
			L.dom.callClassMethod(filter, 'toggleItem', filter, filter.querySelector('li[selected]'));
		}, this));
	},

	render: function(data) {
		var formdata = {};

		return Promise.all([
			this.renderHostList(data),
			this.renderNetworkSettings(data, formdata)
		]).then(L.bind(function(panes) {
			var view = E('div', [
				E('div', [
					E('div', { 'data-tab': 'hosts', 'data-tab-title': _('Connected Devices') }, [
						this.renderHostListSelector(),
						panes[0]
					]),
					E('div', { 'data-tab': 'settings', 'data-tab-title': _('Network Settings') }, [
						panes[1],
						E('div', { 'class': 'right' }, [
							E('button', {
								'class': 'btn',
								'click': ui.createHandlerFn(this, 'handleSettingsSave', formdata)
							}, [ _('Save settings') ])
						])
					])
				])
			]);

			ui.tabs.initTabGroup(view.firstElementChild.childNodes);

			return view;
		}, this));
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
