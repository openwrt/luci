'use strict';
'require ui';
'require form';
'require network';
'require firewall';
'require fs';


/**
 * Get users found in `/etc/passwd`.
 * @returns {string[]}
 */
function getUsers() {
    return fs.lines('/etc/passwd').then(function(lines) {
        return lines.map(function(line) { return line.split(/:/)[0] });
    });
}

/**
 * Get users found in `/etc/group`.
 * @returns {string[]}
 */
function getGroups() {
    return fs.lines('/etc/group').then(function(lines) {
        return lines.map(function(line) { return line.split(/:/)[0] });
    });
}

/**
 * Get bridge devices or Layer 3 devices of a network object.
 * @param {object} network
 * @returns {string[]}
 */
function getDevices(network) {
	if (network.isBridge()) {
		var devices = network.getDevices();
		return devices ? devices : [];
	} else {
		return L.toArray(network.getL3Device());
	}
}

var CBIZoneSelect = form.ListValue.extend({
	__name__: 'CBI.ZoneSelect',

	load(section_id) {
		return Promise.all([ firewall.getZones(), network.getNetworks() ]).then(L.bind(function(zn) {
			this.zones = zn[0];
			this.networks = zn[1];

			return this.super('load', section_id);
		}, this));
	},

	filter(section_id, value) {
		return true;
	},

	lookupZone(name) {
		return this.zones.filter(function(zone) { return zone.getName() == name })[0];
	},

	lookupNetwork(name) {
		return this.networks.filter(function(network) { return network.getName() == name })[0];
	},

	renderWidget(section_id, option_index, cfgvalue) {
		const values = L.toArray((cfgvalue != null) ? cfgvalue : this.default);
		let isOutputOnly = false;
		const choices = {};
		let datatype_str = 'ucifw4zonename';
		if (!L.hasSystemFeature('firewall4'))
			datatype_str = `and(${datatype_str},maxlength(11))`;
		if (this.allowany && this.nocreate)
			datatype_str = `or(${datatype_str},"*")`;
		if (this.multiple)
			datatype_str = `list(${datatype_str})`;

		if (this.option == 'dest') {
			for (let c of this.section.children) {
				const opt = c;
				if (opt.option == 'src') {
					const val = opt.cfgvalue(section_id) || opt.default;
					isOutputOnly = (val == null || val == '');
					break;
				}
			}

			this.title = isOutputOnly ? _('Output zone') :  _('Destination zone');
		}

		if (this.allowlocal) {
			choices[''] = E('span', {
				'class': 'zonebadge',
				'style': firewall.getZoneColorStyle(null)
			}, [
				E('strong', _('Device')),
				(this.allowany || this.allowlocal)
					? E('span', ' (%s)'.format(this.option != 'dest' ? _('output') : _('input'))) : ''
			]);
		}
		else if (!this.multiple && (this.rmempty || this.optional)) {
			choices[''] = E('span', {
				'class': 'zonebadge',
				'style': firewall.getZoneColorStyle(null)
			}, E('em', _('unspecified')));
		}

		if (this.allowany) {
			choices['*'] = E('span', {
				'class': 'zonebadge',
				'style': firewall.getZoneColorStyle(null)
			}, [
				E('strong', _('Any zone')),
				(this.allowany && this.allowlocal && !isOutputOnly) ? E('span', ' (%s)'.format(_('forward'))) : ''
			]);
		}

		for (let zone of this.zones) {
			const name = zone.getName();
			const networks = zone.getNetworks();
			const ifaces = [];

			if (!this.filter(section_id, name))
				continue;

			for (let n of networks) {
				const network = this.lookupNetwork(n);

				if (!network)
					continue;

				const span = E('span', {
					'class': 'ifacebadge' + (network.isUp() ? ' ifacebadge-active' : '')
				}, network.getName() + ': ');

				const devices = getDevices(network);

				for (let d of devices) {
					span.appendChild(E('img', {
						'title': d.getI18n(),
						'src': L.resource('icons/%s%s.svg'.format(d.getType(), d.isUp() ? '' : '_disabled'))
					}));
				}

				if (!devices.length)
					span.appendChild(E('em', _('(empty)')));

				ifaces.push(span);
			}

			if (!ifaces.length)
				ifaces.push(E('em', _('(empty)')));

			choices[name] = E('span', {
				'class': 'zonebadge',
				'style': firewall.getZoneColorStyle(zone)
			}, [ E('strong', name) ].concat(ifaces));
		}

		const widget = new ui.Dropdown(values, choices, {
			id: this.cbid(section_id),
			sort: true,
			multiple: this.multiple,
			optional: this.optional || this.rmempty,
			disabled: (this.readonly != null) ? this.readonly : this.map.readonly,
			select_placeholder: E('em', _('unspecified')),
			display_items: this.display_size || this.size || 3,
			dropdown_items: this.dropdown_size || this.size || 5,
			validate: L.bind(this.validate, this, section_id),
			datatype: datatype_str,
			create: !this.nocreate,
			create_markup: '' +
				'<li data-value="{{value}}">' +
					'<span class="zonebadge" style="background:repeating-linear-gradient(45deg,rgba(204,204,204,0.5),rgba(204,204,204,0.5) 5px,rgba(255,255,255,0.5) 5px,rgba(255,255,255,0.5) 10px)">' +
						'<strong>{{value}}:</strong> <em>('+_('create')+')</em>' +
					'</span>' +
				'</li>'
		});

		const elem = widget.render();

		if (this.option == 'src') {
			elem.addEventListener('cbi-dropdown-change', L.bind(function(ev) {
				const opt = this.map.lookupOption('dest', section_id);
				const val = ev.detail.instance.getValue();

				if (opt == null)
					return;

				const cbid = opt[0].cbid(section_id);
				const label = document.querySelector('label[for="widget.%s"]'.format(cbid));
				const node = document.getElementById(cbid);

				L.dom.content(label, val == '' ? _('Output zone') : _('Destination zone'));

				if (val == '') {
					if (L.dom.callClassMethod(node, 'getValue') == '')
						L.dom.callClassMethod(node, 'setValue', '*');

					const emptyval = node.querySelector('[data-value=""]');
					const anyval = node.querySelector('[data-value="*"]');

					L.dom.content(anyval.querySelector('span'), E('strong', _('Any zone')));

					if (emptyval != null)
						emptyval.parentNode.removeChild(emptyval);
				}
				else {
					const anyval = node.querySelector('[data-value="*"]') || '';
					let emptyval = node.querySelector('[data-value=""]') || '';

					if (emptyval == null && anyval) {
						emptyval = anyval.cloneNode(true);
						emptyval.removeAttribute('display');
						emptyval.removeAttribute('selected');
						emptyval.setAttribute('data-value', '');
					}

					if (opt[0]?.allowlocal && emptyval)
						L.dom.content(emptyval.querySelector('span'), [
							E('strong', _('Device')), E('span', ' (%s)'.format(_('input')))
						]);
					if (opt[0]?.allowany && anyval && emptyval) {
						L.dom.content(anyval.querySelector('span'), [
							E('strong', _('Any zone')), E('span', ' (%s)'.format(_('forward')))
						]);

						anyval.parentNode.insertBefore(emptyval, anyval);
					}
				}

			}, this));
		}
		else if (isOutputOnly) {
			const emptyval = elem.querySelector('[data-value=""]');
			emptyval.parentNode.removeChild(emptyval);
		}

		return elem;
	},
});

var CBIZoneForwards = form.DummyValue.extend({
	__name__: 'CBI.ZoneForwards',

	load(section_id) {
		return Promise.all([
			firewall.getDefaults(),
			firewall.getZones(),
			network.getNetworks(),
			network.getDevices()
		]).then(L.bind(function(dznd) {
			this.defaults = dznd[0];
			this.zones = dznd[1];
			this.networks = dznd[2];
			this.devices = dznd[3];

			return this.super('load', section_id);
		}, this));
	},

	renderZone(zone) {
		const name = zone.getName();
		const networks = zone.getNetworks();
		const devices = zone.getDevices();
		const subnets = zone.getSubnets();
		const ifaces = [];

		for (let n of networks) {
			const network = this.networks.filter(function(net) { return net.getName() == n })[0];

			if (!network)
				continue;

			const span = E('span', {
				'class': 'ifacebadge' + (network.isUp() ? ' ifacebadge-active' : '')
			}, network.getName() + ': ');

			const subdevs = getDevices(network);

			for (let s of subdevs) {
				span.appendChild(E('img', {
					'title': s.getI18n(),
					'src': L.resource('icons/%s%s.svg'.format(s.getType(), s.isUp() ? '' : '_disabled'))
				}));
			}

			if (!subdevs.length)
				span.appendChild(E('em', _('(empty)')));

			ifaces.push(span);
		}

		for (let d of devices) {
			const device = this.devices.filter(function(dev) { return dev.getName() == d })[0];
			const title = device ? device.getI18n() : _('Absent Interface');
			const type = device ? device.getType() : 'ethernet';
			const up = device ? device.isUp() : false;

			ifaces.push(E('span', { 'class': 'ifacebadge' }, [
				E('img', {
					'title': title,
					'src': L.resource('icons/%s%s.svg'.format(type, up ? '' : '_disabled'))
				}),
				device ? device.getName() : d
			]));
		}

		if (subnets.length > 0)
			ifaces.push(E('span', { 'class': 'ifacebadge' }, [ '{ %s }'.format(subnets.join('; ')) ]));

		if (!ifaces.length)
			ifaces.push(E('span', { 'class': 'ifacebadge' }, E('em', _('(empty)'))));

		return E('label', {
			'class': 'zonebadge cbi-tooltip-container',
			'style': firewall.getZoneColorStyle(zone)
		}, [
			E('strong', name),
			E('div', { 'class': 'cbi-tooltip' }, ifaces)
		]);
	},

	renderWidget(section_id, option_index, cfgvalue) {
		const value = (cfgvalue != null) ? cfgvalue : this.default;
		const zone = this.zones.filter(function(z) { return z.getName() == value })[0];

		if (!zone)
			return E([]);

		const forwards = zone.getForwardingsBy('src');
		const dzones = [];

		for (var i = 0; i < forwards.length; i++) {
			const dzone = forwards[i].getDestinationZone();

			if (!dzone)
				continue;

			dzones.push(this.renderZone(dzone));
		}

		if (!dzones.length)
			dzones.push(E('label', { 'class': 'zonebadge zonebadge-empty' },
				E('strong', this.defaults.getForward())));
		else
			dzones.push(E('label', { 'class': 'zonebadge zonebadge-empty' },
				E('strong', '%s %s'.format(this.defaults.getForward(), ('all others')))));

		return E('div', { 'class': 'zone-forwards' }, [
			E('div', { 'class': 'zone-src' }, this.renderZone(zone)),
			E('span', '⇒'),
			E('div', { 'class': 'zone-dest' }, dzones)
		]);
	},
});

const CBIIPSelect = form.ListValue.extend({
	__name__: 'CBI.IPSelect',

	load(section_id) {
		return network.getDevices().then(L.bind(function(devices) {
			this.devices = devices;
			return this.super('load', section_id);
		}, this));
	},

	filter(section_id, value) {
		return true;
	},

	renderIfaceBadge(device, ip) {
		return E('div', {}, [
			ip,
			' ',
			E('span', { 'class': 'ifacebadge', }, [ device.getName(),
				E('img', {
					'title': device.getI18n(),
					'src': L.resource('icons/%s%s.svg'.format(device.getType(), device.isUp() ? '' : '_disabled'))
				})
			]),
		]);
	},

	renderWidget(section_id, option_index, cfgvalue) {
		let values = L.toArray((cfgvalue != null) ? cfgvalue : this.default);
		const choices = {};
		const checked = {};

		for (const val of values)
			checked[val] = true;

		values = [];

		if (!this.multiple && (this.rmempty || this.optional))
			choices[''] = E('em', _('unspecified'));


		for (const device of (this.devices || [])) {
			const name = device.getName();

			if (name == this.exclude || !this.filter(section_id, name))
				continue;

			if (name == 'loopback' && !this.loopback)
				continue;

			if (this.novirtual && device.isVirtual())
				continue;

			for (const ip of [...device.getIPAddrs(), ...device.getIP6Addrs()]) {
				const iponly = ip.split('/')?.[0]
				if (checked[iponly])
					values.push(iponly);
				choices[iponly] = this.renderIfaceBadge(device, iponly);
			}
		}

		const widget = new ui.Dropdown(this.multiple ? values : values[0], choices, {
			id: this.cbid(section_id),
			sort: true,
			multiple: this.multiple,
			optional: this.optional || this.rmempty,
			disabled: (this.readonly != null) ? this.readonly : this.map.readonly,
			select_placeholder: E('em', _('unspecified')),
			display_items: this.display_size || this.size || 2,
			dropdown_items: this.dropdown_size || this.size || 5,
			datatype: this.multiple ? 'list(ipaddr)' : 'ipaddr',
			validate: L.bind(this.validate, this, section_id),
			create: false,
		});

		return widget.render();
	},

	textvalue(section_id) {
		const cfgvalue = this.cfgvalue(section_id);
		const values = L.toArray((cfgvalue != null) ? cfgvalue : this.default);
		const rv = E([]);

		for (const device of (this.devices || [])) {
			for (const ip of [...device.getIPAddrs(), ...device.getIP6Addrs()]) {
				const iponly = ip.split('/')[0];
				if (values.indexOf(iponly) === -1)
					continue;

				if (rv.childNodes.length)
					rv.appendChild(document.createTextNode(' '));

				rv.appendChild(this.renderIfaceBadge(device, iponly));
			}
		}

		if (!rv.firstChild)
			rv.appendChild(E('em', _('unspecified')));

		return rv;
	},
});


var CBINetworkSelect = form.ListValue.extend({
	__name__: 'CBI.NetworkSelect',

	load(section_id) {
		return network.getNetworks().then(L.bind(function(networks) {
			this.networks = networks;

			return this.super('load', section_id);
		}, this));
	},

	filter(section_id, value) {
		return true;
	},

	renderIfaceBadge(network) {
		const span = E('span', { 'class': 'ifacebadge' }, network.getName() + ': ');
		const devices = getDevices(network);

		for (let d of devices) {
			span.appendChild(E('img', {
				'title': d.getI18n(),
				'src': L.resource('icons/%s%s.svg'.format(d.getType(), d.isUp() ? '' : '_disabled'))
			}));
		}

		if (!devices.length) {
			span.appendChild(E('em', { 'class': 'hide-close' }, _('(no interfaces attached)')));
			span.appendChild(E('em', { 'class': 'hide-open' }, '-'));
		}

		return span;
	},

	renderWidget(section_id, option_index, cfgvalue) {
		let values = L.toArray((cfgvalue != null) ? cfgvalue : this.default);
		const choices = {};
		const checked = {};

		for (var i = 0; i < values.length; i++)
			checked[values[i]] = true;

		values = [];

		if (!this.multiple && (this.rmempty || this.optional))
			choices[''] = E('em', _('unspecified'));

		for (let network of this.networks) {
			const name = network.getName();

			if (name == this.exclude || !this.filter(section_id, name))
				continue;

			if (name == 'loopback' && !this.loopback)
				continue;

			if (this.novirtual && network.isVirtual())
				continue;

			if (checked[name])
				values.push(name);

			choices[name] = this.renderIfaceBadge(network);
		}

		const widget = new ui.Dropdown(this.multiple ? values : values[0], choices, {
			id: this.cbid(section_id),
			sort: true,
			multiple: this.multiple,
			optional: this.optional || this.rmempty,
			disabled: (this.readonly != null) ? this.readonly : this.map.readonly,
			select_placeholder: E('em', _('unspecified')),
			display_items: this.display_size || this.size || 3,
			dropdown_items: this.dropdown_size || this.size || 5,
			datatype: this.multiple ? 'list(uciname)' : 'uciname',
			validate: L.bind(this.validate, this, section_id),
			create: !this.nocreate,
			create_markup: '' +
				'<li data-value="{{value}}">' +
					'<span class="ifacebadge" style="background:repeating-linear-gradient(45deg,rgba(204,204,204,0.5),rgba(204,204,204,0.5) 5px,rgba(255,255,255,0.5) 5px,rgba(255,255,255,0.5) 10px)">' +
						'{{value}}: <em>('+_('create')+')</em>' +
					'</span>' +
				'</li>'
		});

		return widget.render();
	},

	textvalue(section_id) {
		const cfgvalue = this.cfgvalue(section_id);
		const values = L.toArray((cfgvalue != null) ? cfgvalue : this.default);
		const rv = E([]);

		for (let network of this.networks) {
			const name = network.getName();

			if (values.indexOf(name) == -1)
				continue;

			if (rv.length)
				L.dom.append(rv, ' ');

			L.dom.append(rv, this.renderIfaceBadge(network));
		}

		if (!rv.firstChild)
			rv.appendChild(E('em', _('unspecified')));

		return rv;
	},
});

var CBIDeviceSelect = form.ListValue.extend({
	__name__: 'CBI.DeviceSelect',

	load(section_id) {
		return Promise.all([
			network.getDevices(),
			this.noaliases ? null : network.getNetworks()
		]).then(L.bind(function(data) {
			this.devices = data[0];
			this.networks = data[1];

			return this.super('load', section_id);
		}, this));
	},

	filter(section_id, value) {
		return true;
	},

	renderWidget(section_id, option_index, cfgvalue) {
		var values = L.toArray((cfgvalue != null) ? cfgvalue : this.default),
		    choices = {},
		    checked = {},
		    order = [];

		for (var i = 0; i < values.length; i++)
			checked[values[i]] = true;

		values = [];

		if (!this.multiple && (this.rmempty || this.optional))
			choices[''] = E('em', _('unspecified'));

		for (let device of this.devices) {
			const name = device.getName();
			const type = device.getType();

			if (name == 'lo' || name == this.exclude || !this.filter(section_id, name))
				continue;

			if (this.noaliases && type == 'alias')
				continue;

			if (this.nobridges && type == 'bridge')
				continue;

			if (this.noinactive && device.isUp() == false)
				continue;

			const item = E([
				E('img', {
					'title': device.getI18n(),
					'src': L.resource('icons/%s%s.svg'.format(type, device.isUp() ? '' : '_disabled'))
				}),
				E('span', { 'class': 'hide-open' }, [ name ]),
				E('span', { 'class': 'hide-close'}, [ device.getI18n() ])
			]);

			const networks = device.getNetworks();

			if (networks.length > 0)
				L.dom.append(item.lastChild, [ ' (', networks.map(function(n) { return n.getName() }).join(', '), ')' ]);

			if (checked[name])
				values.push(name);

			choices[name] = item;
			order.push(name);
		}

		if (this.networks != null) {
			for (let net of this.networks) {
				const device = network.instantiateDevice('@%s'.format(net.getName()), net);
				const name = device.getName();

				if (name == '@loopback' || name == this.exclude || !this.filter(section_id, name))
					continue;

				if (this.noinactive && net.isUp() == false)
					continue;

				const item = E([
					E('img', {
						'title': device.getI18n(),
						'src': L.resource('icons/alias%s.svg'.format(device.isUp() ? '' : '_disabled'))
					}),
					E('span', { 'class': 'hide-open' }, [ name ]),
					E('span', { 'class': 'hide-close'}, [ device.getI18n() ])
				]);

				if (checked[name])
					values.push(name);

				choices[name] = item;
				order.push(name);
			}
		}

		if (this.includeips) {
			this.devices.forEach(net_dev => {
				['getIPAddrs', 'getIP6Addrs'].forEach(fn => {
					net_dev[fn]().forEach(addr => {
						const name = addr.split('/')[0];
						if (checked[name]) values.push(name);

						choices[name] = E([], [name, ' (', E('strong', net_dev.getName()), ')']);
						order.push(name);
					});
				});
			});
		}

		if (!this.nocreate) {
			const keys = Object.keys(checked).sort(L.naturalCompare);

			for (let k of keys) {
				if (choices.hasOwnProperty(k))
					continue;

				choices[k] = E([
					E('img', {
						'title': _('Absent Interface'),
						'src': L.resource('icons/ethernet_disabled.svg')
					}),
					E('span', { 'class': 'hide-open' }, [ k ]),
					E('span', { 'class': 'hide-close'}, [ '%s: "%h"'.format(_('Absent Interface'), k) ])
				]);

				values.push(k);
				order.push(k);
			}
		}

		const widget = new ui.Dropdown(this.multiple ? values : values[0], choices, {
			id: this.cbid(section_id),
			sort: order,
			multiple: this.multiple,
			optional: this.optional || this.rmempty,
			disabled: (this.readonly != null) ? this.readonly : this.map.readonly,
			select_placeholder: E('em', _('unspecified')),
			display_items: this.display_size || this.size || 3,
			dropdown_items: this.dropdown_size || this.size || 5,
			validate: L.bind(this.validate, this, section_id),
			create: !this.nocreate,
			create_markup: '' +
				'<li data-value="{{value}}">' +
					'<img title="'+_('Custom Interface')+': &quot;{{value}}&quot;" src="'+L.resource('icons/ethernet_disabled.svg')+'" />' +
					'<span class="hide-open">{{value}}</span>' +
					'<span class="hide-close">'+_('Custom Interface')+': "{{value}}"</span>' +
				'</li>'
		});

		return widget.render();
	},
});

var CBIUserSelect = form.ListValue.extend({
	__name__: 'CBI.UserSelect',

	load(section_id) {
		return getUsers().then(L.bind(function(users) {
			delete this.keylist;
			delete this.vallist;
			for (var i = 0; i < users.length; i++) {
				this.value(users[i]);
			}

			return this.super('load', section_id);
		}, this));
	},

	filter(section_id, value) {
		return true;
	},
});

var CBIGroupSelect = form.ListValue.extend({
	__name__: 'CBI.GroupSelect',

	load(section_id) {
		return getGroups().then(L.bind(function(groups) {
			for (var i = 0; i < groups.length; i++) {
				this.value(groups[i]);
			}

			return this.super('load', section_id);
		}, this));
	},

	filter(section_id, value) {
		return true;
	},
});


return L.Class.extend({
	ZoneSelect: CBIZoneSelect,
	ZoneForwards: CBIZoneForwards,
	IPSelect: CBIIPSelect,
	NetworkSelect: CBINetworkSelect,
	DeviceSelect: CBIDeviceSelect,
	UserSelect: CBIUserSelect,
	GroupSelect: CBIGroupSelect,
});
