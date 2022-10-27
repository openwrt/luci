'use strict';
'require view';
'require dom';
'require poll';
'require fs';
'require ui';
'require uci';
'require form';
'require network';
'require firewall';
'require tools.widgets as widgets';
'require tools.network as nettools';

var isReadonlyView = !L.hasViewPermission() || null;

function count_changes(section_id) {
	var changes = ui.changes.changes, n = 0;

	if (!L.isObject(changes))
		return n;

	if (Array.isArray(changes.network))
		for (var i = 0; i < changes.network.length; i++)
			n += (changes.network[i][1] == section_id);

	if (Array.isArray(changes.dhcp))
		for (var i = 0; i < changes.dhcp.length; i++)
			n += (changes.dhcp[i][1] == section_id);

	return n;
}

function render_iface(dev, alias) {
	var type = dev ? dev.getType() : 'ethernet',
	    up   = dev ? dev.isUp() : false;

	return E('span', { class: 'cbi-tooltip-container' }, [
		E('img', { 'class' : 'middle', 'src': L.resource('icons/%s%s.png').format(
			alias ? 'alias' : type,
			up ? '' : '_disabled') }),
		E('span', { 'class': 'cbi-tooltip ifacebadge large' }, [
			E('img', { 'src': L.resource('icons/%s%s.png').format(
				type, up ? '' : '_disabled') }),
			L.itemlist(E('span', { 'class': 'left' }), [
				_('Type'),      dev ? dev.getTypeI18n() : null,
				_('Device'),    dev ? dev.getName() : _('Not present'),
				_('Connected'), up ? _('yes') : _('no'),
				_('MAC'),       dev ? dev.getMAC() : null,
				_('RX'),        dev ? '%.2mB (%d %s)'.format(dev.getRXBytes(), dev.getRXPackets(), _('Pkts.')) : null,
				_('TX'),        dev ? '%.2mB (%d %s)'.format(dev.getTXBytes(), dev.getTXPackets(), _('Pkts.')) : null
			])
		])
	]);
}

function render_status(node, ifc, with_device) {
	var desc = null, c = [];

	if (ifc.isDynamic())
		desc = _('Virtual dynamic interface');
	else if (ifc.isAlias())
		desc = _('Alias Interface');
	else if (!uci.get('network', ifc.getName()))
		return L.itemlist(node, [
			null, E('em', _('Interface is marked for deletion'))
		]);

	var i18n = ifc.getI18n();
	if (i18n)
		desc = desc ? '%s (%s)'.format(desc, i18n) : i18n;

	var changecount = with_device ? 0 : count_changes(ifc.getName()),
	    ipaddrs = changecount ? [] : ifc.getIPAddrs(),
	    ip6addrs = changecount ? [] : ifc.getIP6Addrs(),
	    errors = ifc.getErrors(),
	    maindev = ifc.getL3Device() || ifc.getDevice(),
	    macaddr = maindev ? maindev.getMAC() : null;

	return L.itemlist(node, [
		_('Protocol'), with_device ? null : (desc || '?'),
		_('Device'),   with_device ? (maindev ? maindev.getShortName() : E('em', _('Not present'))) : null,
		_('Uptime'),   (!changecount && ifc.isUp()) ? '%t'.format(ifc.getUptime()) : null,
		_('MAC'),      (!changecount && !ifc.isDynamic() && !ifc.isAlias() && macaddr) ? macaddr : null,
		_('RX'),       (!changecount && !ifc.isDynamic() && !ifc.isAlias() && maindev) ? '%.2mB (%d %s)'.format(maindev.getRXBytes(), maindev.getRXPackets(), _('Pkts.')) : null,
		_('TX'),       (!changecount && !ifc.isDynamic() && !ifc.isAlias() && maindev) ? '%.2mB (%d %s)'.format(maindev.getTXBytes(), maindev.getTXPackets(), _('Pkts.')) : null,
		_('IPv4'),     ipaddrs[0],
		_('IPv4'),     ipaddrs[1],
		_('IPv4'),     ipaddrs[2],
		_('IPv4'),     ipaddrs[3],
		_('IPv4'),     ipaddrs[4],
		_('IPv6'),     ip6addrs[0],
		_('IPv6'),     ip6addrs[1],
		_('IPv6'),     ip6addrs[2],
		_('IPv6'),     ip6addrs[3],
		_('IPv6'),     ip6addrs[4],
		_('IPv6'),     ip6addrs[5],
		_('IPv6'),     ip6addrs[6],
		_('IPv6'),     ip6addrs[7],
		_('IPv6'),     ip6addrs[8],
		_('IPv6'),     ip6addrs[9],
		_('IPv6-PD'),  changecount ? null : ifc.getIP6Prefix(),
		_('Information'), with_device ? null : (ifc.get('auto') != '0' ? null : _('Not started on boot')),
		_('Error'),    errors ? errors[0] : null,
		_('Error'),    errors ? errors[1] : null,
		_('Error'),    errors ? errors[2] : null,
		_('Error'),    errors ? errors[3] : null,
		_('Error'),    errors ? errors[4] : null,
		null, changecount ? E('a', {
			href: '#',
			click: L.bind(ui.changes.displayChanges, ui.changes)
		}, _('Interface has %d pending changes').format(changecount)) : null
	]);
}

function render_modal_status(node, ifc) {
	var dev = ifc ? (ifc.getDevice() || ifc.getL3Device() || ifc.getL3Device()) : null;

	dom.content(node, [
		E('img', {
			'src': L.resource('icons/%s%s.png').format(dev ? dev.getType() : 'ethernet', (dev && dev.isUp()) ? '' : '_disabled'),
			'title': dev ? dev.getTypeI18n() : _('Not present')
		}),
		ifc ? render_status(E('span'), ifc, true) : E('em', _('Interface not present or not connected yet.'))
	]);

	return node;
}

function render_ifacebox_status(node, ifc) {
	var dev = ifc.getL3Device() || ifc.getDevice(),
	    subdevs = dev ? dev.getPorts() : null,
	    c = [ render_iface(dev, ifc.isAlias()) ];

	if (subdevs && subdevs.length) {
		var sifs = [ ' (' ];

		for (var j = 0; j < subdevs.length; j++)
			sifs.push(render_iface(subdevs[j]));

		sifs.push(')');

		c.push(E('span', {}, sifs));
	}

	c.push(E('br'));
	c.push(E('small', {}, ifc.isAlias() ? _('Alias of "%s"').format(ifc.isAlias())
	                                    : (dev ? dev.getName() : E('em', _('Not present')))));

	dom.content(node, c);

	return firewall.getZoneByNetwork(ifc.getName()).then(L.bind(function(zone) {
		this.style.backgroundColor = zone ? zone.getColor() : '#EEEEEE';
		this.title = zone ? _('Part of zone %q').format(zone.getName()) : _('No zone assigned');
	}, node.previousElementSibling));
}

function iface_updown(up, id, ev, force) {
	var row = document.querySelector('.cbi-section-table-row[data-sid="%s"]'.format(id)),
	    dsc = row.querySelector('[data-name="_ifacestat"] > div'),
	    btns = row.querySelectorAll('.cbi-section-actions .reconnect, .cbi-section-actions .down');

	btns[+!up].blur();
	btns[+!up].classList.add('spinning');

	btns[0].disabled = true;
	btns[1].disabled = true;

	if (!up) {
		L.resolveDefault(fs.exec_direct('/usr/libexec/luci-peeraddr')).then(function(res) {
			var info = null; try { info = JSON.parse(res); } catch(e) {}

			if (L.isObject(info) &&
			    Array.isArray(info.inbound_interfaces) &&
			    info.inbound_interfaces.filter(function(i) { return i == id })[0]) {

				ui.showModal(_('Confirm disconnect'), [
					E('p', _('You appear to be currently connected to the device via the "%h" interface. Do you really want to shut down the interface?').format(id)),
					E('div', { 'class': 'right' }, [
						E('button', {
							'class': 'cbi-button cbi-button-neutral',
							'click': function(ev) {
								btns[1].classList.remove('spinning');
								btns[1].disabled = false;
								btns[0].disabled = false;

								ui.hideModal();
							}
						}, _('Cancel')),
						' ',
						E('button', {
							'class': 'cbi-button cbi-button-negative important',
							'click': function(ev) {
								dsc.setAttribute('disconnect', '');
								dom.content(dsc, E('em', _('Interface is shutting down...')));

								ui.hideModal();
							}
						}, _('Disconnect'))
					])
				]);
			}
			else {
				dsc.setAttribute('disconnect', '');
				dom.content(dsc, E('em', _('Interface is shutting down...')));
			}
		});
	}
	else {
		dsc.setAttribute(up ? 'reconnect' : 'disconnect', force ? 'force' : '');
		dom.content(dsc, E('em', up ? _('Interface is reconnecting...') : _('Interface is shutting down...')));
	}
}

function get_netmask(s, use_cfgvalue) {
	var readfn = use_cfgvalue ? 'cfgvalue' : 'formvalue',
	    addrs = L.toArray(s[readfn](s.section, 'ipaddr')),
	    mask = s[readfn](s.section, 'netmask'),
	    firstsubnet = mask ? addrs[0] + '/' + mask : addrs.filter(function(a) { return a.indexOf('/') > 0 })[0];

	if (firstsubnet == null)
		return null;

	var subnetmask = firstsubnet.split('/')[1];

	if (!isNaN(subnetmask))
		subnetmask = network.prefixToMask(+subnetmask);

	return subnetmask;
}

var cbiRichListValue = form.ListValue.extend({
	renderWidget: function(section_id, option_index, cfgvalue) {
		var choices = this.transformChoices();
		var widget = new ui.Dropdown((cfgvalue != null) ? cfgvalue : this.default, choices, {
			id: this.cbid(section_id),
			sort: this.keylist,
			optional: true,
			select_placeholder: this.select_placeholder || this.placeholder,
			custom_placeholder: this.custom_placeholder || this.placeholder,
			validate: L.bind(this.validate, this, section_id),
			disabled: (this.readonly != null) ? this.readonly : this.map.readonly
		});

		return widget.render();
	},

	value: function(value, title, description) {
		if (description) {
			form.ListValue.prototype.value.call(this, value, E([], [
				E('span', { 'class': 'hide-open' }, [ title ]),
				E('div', { 'class': 'hide-close', 'style': 'min-width:25vw' }, [
					E('strong', [ title ]),
					E('br'),
					E('span', { 'style': 'white-space:normal' }, description)
				])
			]));
		}
		else {
			form.ListValue.prototype.value.call(this, value, title);
		}
	}
});

return view.extend({
	poll_status: function(map, networks) {
		var resolveZone = null;

		for (var i = 0; i < networks.length; i++) {
			var ifc = networks[i],
			    row = map.querySelector('.cbi-section-table-row[data-sid="%s"]'.format(ifc.getName()));

			if (row == null)
				continue;

			var dsc = row.querySelector('[data-name="_ifacestat"] > div'),
			    box = row.querySelector('[data-name="_ifacebox"] .ifacebox-body'),
			    btn1 = row.querySelector('.cbi-section-actions .reconnect'),
			    btn2 = row.querySelector('.cbi-section-actions .down'),
			    stat = document.querySelector('[id="%s-ifc-status"]'.format(ifc.getName())),
			    resolveZone = render_ifacebox_status(box, ifc),
			    disabled = ifc ? !ifc.isUp() : true,
			    dynamic = ifc ? ifc.isDynamic() : false;

			if (dsc.hasAttribute('reconnect')) {
				dom.content(dsc, E('em', _('Interface is starting...')));
			}
			else if (dsc.hasAttribute('disconnect')) {
				dom.content(dsc, E('em', _('Interface is stopping...')));
			}
			else if (ifc.getProtocol() || uci.get('network', ifc.getName()) == null) {
				render_status(dsc, ifc, false);
			}
			else if (!ifc.getProtocol()) {
				var e = map.querySelector('[id="cbi-network-%s"] .cbi-button-edit'.format(ifc.getName()));
				if (e) e.disabled = true;

				var link = L.url('admin/system/opkg') + '?query=luci-proto';
				dom.content(dsc, [
					E('em', _('Unsupported protocol type.')), E('br'),
					E('a', { href: link }, _('Install protocol extensions...'))
				]);
			}
			else {
				dom.content(dsc, E('em', _('Interface not present or not connected yet.')));
			}

			if (stat) {
				var dev = ifc.getDevice();
				dom.content(stat, [
					E('img', {
						'src': L.resource('icons/%s%s.png').format(dev ? dev.getType() : 'ethernet', (dev && dev.isUp()) ? '' : '_disabled'),
						'title': dev ? dev.getTypeI18n() : _('Not present')
					}),
					render_status(E('span'), ifc, true)
				]);
			}

			btn1.disabled = isReadonlyView || btn1.classList.contains('spinning') || btn2.classList.contains('spinning') || dynamic;
			btn2.disabled = isReadonlyView || btn1.classList.contains('spinning') || btn2.classList.contains('spinning') || dynamic || disabled;
		}

		document.querySelectorAll('.port-status-device[data-device]').forEach(function(node) {
			nettools.updateDevBadge(node, network.instantiateDevice(node.getAttribute('data-device')));
		});

		document.querySelectorAll('.port-status-link[data-device]').forEach(function(node) {
			nettools.updatePortStatus(node, network.instantiateDevice(node.getAttribute('data-device')));
		});

		return Promise.all([ resolveZone, network.flushCache() ]);
	},

	load: function() {
		return Promise.all([
			network.getDSLModemType(),
			network.getDevices(),
			fs.lines('/etc/iproute2/rt_tables'),
			L.resolveDefault(fs.read('/usr/lib/opkg/info/netifd.control')),
			uci.changes()
		]);
	},

	interfaceBridgeWithIfnameSections: function() {
		return uci.sections('network', 'interface').filter(function(ns) {
			return ns.type == 'bridge' && !ns.ports && ns.ifname;
		});
	},

	deviceWithIfnameSections: function() {
		return uci.sections('network', 'device').filter(function(ns) {
			return ns.type == 'bridge' && !ns.ports && ns.ifname;
		});
	},

	interfaceWithIfnameSections: function() {
		return uci.sections('network', 'interface').filter(function(ns) {
			return !ns.device && ns.ifname;
		});
	},

	handleBridgeMigration: function(ev) {
		var tasks = [];

		this.interfaceBridgeWithIfnameSections().forEach(function(ns) {
			var device_name = 'br-' + ns['.name'];

			tasks.push(uci.callAdd('network', 'device', null, {
				'name': device_name,
				'type': 'bridge',
				'ports': L.toArray(ns.ifname),
				'mtu': ns.mtu,
				'macaddr': ns.macaddr,
				'igmp_snooping': ns.igmp_snooping
			}));

			tasks.push(uci.callSet('network', ns['.name'], {
				'type': '',
				'ifname': '',
				'mtu': '',
				'macaddr': '',
				'igmp_snooping': '',
				'device': device_name
			}));
		});

		return Promise.all(tasks)
			.then(L.bind(ui.changes.init, ui.changes))
			.then(L.bind(ui.changes.apply, ui.changes));
	},

	renderBridgeMigration: function() {
		ui.showModal(_('Network bridge configuration migration'), [
			E('p', _('The existing network configuration needs to be changed for LuCI to function properly.')),
			E('p', _('Upon pressing "Continue", bridges configuration will be updated and the network will be restarted to apply the updated configuration.')),
			E('div', { 'class': 'right' },
				E('button', {
					'class': 'btn cbi-button-action important',
					'click': ui.createHandlerFn(this, 'handleBridgeMigration')
				}, _('Continue')))
		]);
	},

	handleIfnameMigration: function(ev) {
		var tasks = [];

		this.deviceWithIfnameSections().forEach(function(ds) {
			tasks.push(uci.callSet('network', ds['.name'], {
				'ifname': '',
				'ports': L.toArray(ds.ifname)
			}));
		});

		this.interfaceWithIfnameSections().forEach(function(ns) {
			tasks.push(uci.callSet('network', ns['.name'], {
				'ifname': '',
				'device': ns.ifname
			}));
		});

		return Promise.all(tasks)
			.then(L.bind(ui.changes.init, ui.changes))
			.then(L.bind(ui.changes.apply, ui.changes));
	},

	renderIfnameMigration: function() {
		ui.showModal(_('Network ifname configuration migration'), [
			E('p', _('The existing network configuration needs to be changed for LuCI to function properly.')),
			E('p', _('Upon pressing "Continue", ifname options will get renamed and the network will be restarted to apply the updated configuration.')),
			E('div', { 'class': 'right' },
				E('button', {
					'class': 'btn cbi-button-action important',
					'click': ui.createHandlerFn(this, 'handleIfnameMigration')
				}, _('Continue')))
		]);
	},

	render: function(data) {
		var netifdVersion = (data[3] || '').match(/Version: ([^\n]+)/);

		if (netifdVersion && netifdVersion[1] >= "2021-05-26") {
			if (this.interfaceBridgeWithIfnameSections().length)
				return this.renderBridgeMigration();
			else if (this.deviceWithIfnameSections().length || this.interfaceWithIfnameSections().length)
				return this.renderIfnameMigration();
		}

		var dslModemType = data[0],
		    netDevs = data[1],
		    m, s, o;

		var rtTables = data[2].map(function(l) {
			var m = l.trim().match(/^(\d+)\s+(\S+)$/);
			return m ? [ +m[1], m[2] ] : null;
		}).filter(function(e) {
			return e && e[0] > 0;
		});

		m = new form.Map('network');
		m.tabbed = true;
		m.chain('dhcp');

		s = m.section(form.GridSection, 'interface', _('Interfaces'));
		s.anonymous = true;
		s.addremove = true;
		s.addbtntitle = _('Add new interface...');

		s.load = function() {
			return Promise.all([
				network.getNetworks(),
				firewall.getZones()
			]).then(L.bind(function(data) {
				this.networks = data[0];
				this.zones = data[1];
			}, this));
		};

		s.tab('general', _('General Settings'));
		s.tab('advanced', _('Advanced Settings'));
		s.tab('physical', _('Physical Settings'));
		s.tab('brport', _('Bridge port specific options'));
		s.tab('bridgevlan', _('Bridge VLAN filtering'));
		s.tab('firewall', _('Firewall Settings'));
		s.tab('dhcp', _('DHCP Server'));

		s.cfgsections = function() {
			return this.networks.map(function(n) { return n.getName() })
				.filter(function(n) { return n != 'loopback' });
		};

		s.modaltitle = function(section_id) {
			return _('Interfaces') + ' » ' + section_id;
		};

		s.renderRowActions = function(section_id) {
			var tdEl = this.super('renderRowActions', [ section_id, _('Edit') ]),
			    net = this.networks.filter(function(n) { return n.getName() == section_id })[0],
			    disabled = net ? !net.isUp() : true,
			    dynamic = net ? net.isDynamic() : false;

			dom.content(tdEl.lastChild, [
				E('button', {
					'class': 'cbi-button cbi-button-neutral reconnect',
					'click': iface_updown.bind(this, true, section_id),
					'title': _('Reconnect this interface'),
					'disabled': dynamic ? 'disabled' : null
				}, _('Restart')),
				E('button', {
					'class': 'cbi-button cbi-button-neutral down',
					'click': iface_updown.bind(this, false, section_id),
					'title': _('Shutdown this interface'),
					'disabled': (dynamic || disabled) ? 'disabled' : null
				}, _('Stop')),
				tdEl.lastChild.firstChild,
				tdEl.lastChild.lastChild
			]);

			if (!dynamic && net && !uci.get('network', net.getName())) {
				tdEl.lastChild.childNodes[0].disabled = true;
				tdEl.lastChild.childNodes[2].disabled = true;
				tdEl.lastChild.childNodes[3].disabled = true;
			}

			return tdEl;
		};

		s.addModalOptions = function(s) {
			var protoval = uci.get('network', s.section, 'proto'),
			    protoclass = protoval ? network.getProtocol(protoval) : null,
			    o, proto_select, proto_switch, type, stp, igmp, ss, so;

			if (!protoval)
				return;

			return network.getNetwork(s.section).then(L.bind(function(ifc) {
				var protocols = network.getProtocols();

				protocols.sort(function(a, b) {
					return L.naturalCompare(a.getProtocol(), b.getProtocol());
				});

				o = s.taboption('general', form.DummyValue, '_ifacestat_modal', _('Status'));
				o.modalonly = true;
				o.cfgvalue = L.bind(function(section_id) {
					var net = this.networks.filter(function(n) { return n.getName() == section_id })[0];

					return render_modal_status(E('div', {
						'id': '%s-ifc-status'.format(section_id),
						'class': 'ifacebadge large'
					}), net);
				}, this);
				o.write = function() {};


				proto_select = s.taboption('general', form.ListValue, 'proto', _('Protocol'));
				proto_select.modalonly = true;

				proto_switch = s.taboption('general', form.Button, '_switch_proto');
				proto_switch.modalonly  = true;
				proto_switch.title      = _('Really switch protocol?');
				proto_switch.inputtitle = _('Switch protocol');
				proto_switch.inputstyle = 'apply';
				proto_switch.onclick = L.bind(function(ev) {
					s.map.save()
						.then(L.bind(m.load, m))
						.then(L.bind(m.render, m))
						.then(L.bind(this.renderMoreOptionsModal, this, s.section));
				}, this);

				o = s.taboption('general', widgets.DeviceSelect, '_net_device', _('Device'));
				o.ucioption = 'device';
				o.nobridges = false;
				o.optional = false;
				o.network = ifc.getName();

				o = s.taboption('general', form.Flag, 'auto', _('Bring up on boot'));
				o.modalonly = true;
				o.default = o.enabled;

				if (L.hasSystemFeature('firewall')) {
					o = s.taboption('firewall', widgets.ZoneSelect, '_zone', _('Create / Assign firewall-zone'), _('Choose the firewall zone you want to assign to this interface. Select <em>unspecified</em> to remove the interface from the associated zone or fill out the <em>custom</em> field to define a new zone and attach the interface to it.'));
					o.network = ifc.getName();
					o.optional = true;

					o.cfgvalue = function(section_id) {
						return firewall.getZoneByNetwork(ifc.getName()).then(function(zone) {
							return (zone != null ? zone.getName() : null);
						});
					};

					o.write = o.remove = function(section_id, value) {
						return Promise.all([
							firewall.getZoneByNetwork(ifc.getName()),
							(value != null) ? firewall.getZone(value) : null
						]).then(function(data) {
							var old_zone = data[0],
							    new_zone = data[1];

							if (old_zone == null && new_zone == null && (value == null || value == ''))
								return;

							if (old_zone != null && new_zone != null && old_zone.getName() == new_zone.getName())
								return;

							if (old_zone != null)
								old_zone.deleteNetwork(ifc.getName());

							if (new_zone != null)
								new_zone.addNetwork(ifc.getName());
							else if (value != null)
								return firewall.addZone(value).then(function(new_zone) {
									new_zone.addNetwork(ifc.getName());
								});
						});
					};
				}

				for (var i = 0; i < protocols.length; i++) {
					proto_select.value(protocols[i].getProtocol(), protocols[i].getI18n());

					if (protocols[i].getProtocol() != uci.get('network', s.section, 'proto'))
						proto_switch.depends('proto', protocols[i].getProtocol());
				}

				if (L.hasSystemFeature('dnsmasq') || L.hasSystemFeature('odhcpd')) {
					o = s.taboption('dhcp', form.SectionValue, '_dhcp', form.TypedSection, 'dhcp');

					ss = o.subsection;
					ss.uciconfig = 'dhcp';
					ss.addremove = false;
					ss.anonymous = true;

					ss.tab('general',  _('General Setup'));
					ss.tab('advanced', _('Advanced Settings'));
					ss.tab('ipv6', _('IPv6 Settings'));
					ss.tab('ipv6-ra', _('IPv6 RA Settings'));

					ss.filter = function(section_id) {
						return (uci.get('dhcp', section_id, 'interface') == ifc.getName());
					};

					ss.renderSectionPlaceholder = function() {
						return E('div', { 'class': 'cbi-section-create' }, [
							E('p', _('No DHCP Server configured for this interface') + ' &#160; '),
							E('button', {
								'class': 'cbi-button cbi-button-add',
								'title': _('Set up DHCP Server'),
								'click': ui.createHandlerFn(this, function(section_id, ev) {
									this.map.save(function() {
										uci.add('dhcp', 'dhcp', section_id);
										uci.set('dhcp', section_id, 'interface', section_id);

										if (protoval == 'static') {
											uci.set('dhcp', section_id, 'start', 100);
											uci.set('dhcp', section_id, 'limit', 150);
											uci.set('dhcp', section_id, 'leasetime', '12h');
										}
										else {
											uci.set('dhcp', section_id, 'ignore', 1);
										}
									});
								}, ifc.getName())
							}, _('Set up DHCP Server'))
						]);
					};

					ss.taboption('general', form.Flag, 'ignore', _('Ignore interface'), _('Disable <abbr title="Dynamic Host Configuration Protocol">DHCP</abbr> for this interface.'));

					if (protoval == 'static') {
						so = ss.taboption('general', form.Value, 'start', _('Start'), _('Lowest leased address as offset from the network address.'));
						so.optional = true;
						so.datatype = 'or(uinteger,ip4addr("nomask"))';
						so.default = '100';

						so = ss.taboption('general', form.Value, 'limit', _('Limit'), _('Maximum number of leased addresses.'));
						so.optional = true;
						so.datatype = 'uinteger';
						so.default = '150';

						so = ss.taboption('general', form.Value, 'leasetime', _('Lease time'), _('Expiry time of leased addresses, minimum is 2 minutes (<code>2m</code>).'));
						so.optional = true;
						so.default = '12h';

						so = ss.taboption('advanced', form.Flag, 'dynamicdhcp', _('Dynamic <abbr title="Dynamic Host Configuration Protocol">DHCP</abbr>'), _('Dynamically allocate DHCP addresses for clients. If disabled, only clients having static leases will be served.'));
						so.default = so.enabled;

						ss.taboption('advanced', form.Flag, 'force', _('Force'), _('Force DHCP on this network even if another server is detected.'));

						// XXX: is this actually useful?
						//ss.taboption('advanced', form.Value, 'name', _('Name'), _('Define a name for this network.'));

						so = ss.taboption('advanced', form.Value, 'netmask', _('<abbr title="Internet Protocol Version 4">IPv4</abbr>-Netmask'), _('Override the netmask sent to clients. Normally it is calculated from the subnet that is served.'));
						so.optional = true;
						so.datatype = 'ip4addr';

						so.render = function(option_index, section_id, in_table) {
							this.placeholder = get_netmask(s, true);
							return form.Value.prototype.render.apply(this, [ option_index, section_id, in_table ]);
						};

						so.validate = function(section_id, value) {
							var uielem = this.getUIElement(section_id);
							if (uielem)
								uielem.setPlaceholder(get_netmask(s, false));
							return form.Value.prototype.validate.apply(this, [ section_id, value ]);
						};

						ss.taboption('advanced', form.DynamicList, 'dhcp_option', _('DHCP-Options'), _('Define additional DHCP options,  for example "<code>6,192.168.2.1,192.168.2.2</code>" which advertises different DNS servers to clients.'));
					}


					var has_other_master = uci.sections('dhcp', 'dhcp').filter(function(s) {
						return (s.interface != ifc.getName() && s.master == '1');
					})[0];

					so = ss.taboption('ipv6', form.Flag , 'master', _('Designated master'));
					so.readonly = has_other_master ? true : false;
					so.description = has_other_master
						? _('Interface "%h" is already marked as designated master.').format(has_other_master.interface || has_other_master['.name'])
						: _('Set this interface as master for RA and DHCPv6 relaying as well as NDP proxying.')
					;

					so.validate = function(section_id, value) {
						var hybrid_downstream_desc = _('Operate in <em>relay mode</em> if a designated master interface is configured and active, otherwise fall back to <em>server mode</em>.'),
						    ndp_downstream_desc = _('Operate in <em>relay mode</em> if a designated master interface is configured and active, otherwise disable <abbr title="Neighbour Discovery Protocol">NDP</abbr> proxying.'),
						    hybrid_master_desc = _('Operate in <em>relay mode</em> if an upstream IPv6 prefix is present, otherwise disable service.'),
						    checked = this.formvalue(section_id),
						    dhcpv6 = this.section.getOption('dhcpv6').getUIElement(section_id),
						    ndp = this.section.getOption('ndp').getUIElement(section_id),
						    ra = this.section.getOption('ra').getUIElement(section_id);

						if (checked == '1' || protoval != 'static') {
							dhcpv6.node.querySelector('li[data-value="server"]').setAttribute('unselectable', '');

							if (dhcpv6.getValue() == 'server')
								dhcpv6.setValue('hybrid');

							ra.node.querySelector('li[data-value="server"]').setAttribute('unselectable', '');

							if (ra.getValue() == 'server')
								ra.setValue('hybrid');
						}

						if (checked == '1') {
							dhcpv6.node.querySelector('li[data-value="hybrid"] > div > span').innerHTML = hybrid_master_desc;
							ra.node.querySelector('li[data-value="hybrid"] > div > span').innerHTML = hybrid_master_desc;
							ndp.node.querySelector('li[data-value="hybrid"] > div > span').innerHTML = hybrid_master_desc;
						}
						else {
							if (protoval == 'static') {
								dhcpv6.node.querySelector('li[data-value="server"]').removeAttribute('unselectable');
								ra.node.querySelector('li[data-value="server"]').removeAttribute('unselectable');
							}

							dhcpv6.node.querySelector('li[data-value="hybrid"] > div > span').innerHTML = hybrid_downstream_desc;
							ra.node.querySelector('li[data-value="hybrid"] > div > span').innerHTML = hybrid_downstream_desc;
							ndp.node.querySelector('li[data-value="hybrid"] > div > span').innerHTML = ndp_downstream_desc ;
						}

						return true;
					};


					so = ss.taboption('ipv6', cbiRichListValue, 'ra', _('<abbr title="Router Advertisement">RA</abbr>-Service'),
						_('Configures the operation mode of the <abbr title="Router Advertisement">RA</abbr> service on this interface.'));
					so.value('', _('disabled'),
						_('Do not send any <abbr title="Router Advertisement, ICMPv6 Type 134">RA</abbr> messages on this interface.'));
					so.value('server', _('server mode'),
						_('Send <abbr title="Router Advertisement, ICMPv6 Type 134">RA</abbr> messages advertising this device as IPv6 router.'));
					so.value('relay', _('relay mode'),
						_('Forward <abbr title="Router Advertisement, ICMPv6 Type 134">RA</abbr> messages received on the designated master interface to downstream interfaces.'));
					so.value('hybrid', _('hybrid mode'), ' ');


					so = ss.taboption('ipv6-ra', cbiRichListValue, 'ra_default', _('Default router'),
						_('Configures the default router advertisement in <abbr title="Router Advertisement">RA</abbr> messages.'));
					so.value('', _('automatic'),
						_('Announce this device as default router if a local IPv6 default route is present.'));
					so.value('1', _('on available prefix'),
						_('Announce this device as default router if a public IPv6 prefix is available, regardless of local default route availability.'));
					so.value('2', _('forced'),
						_('Announce this device as default router regardless of whether a prefix or default route is present.'));
					so.depends('ra', 'server');
					so.depends({ ra: 'hybrid', master: '0' });

					so = ss.taboption('ipv6-ra', form.Flag, 'ra_slaac', _('Enable <abbr title="Stateless Address Auto Config">SLAAC</abbr>'),
						_('Set the autonomous address-configuration flag in the prefix information options of sent <abbr title="Router Advertisement">RA</abbr> messages. When enabled, clients will perform stateless IPv6 address autoconfiguration.'));
					so.default = so.enabled;
					so.depends('ra', 'server');
					so.depends({ ra: 'hybrid', master: '0' });

					so = ss.taboption('ipv6-ra', cbiRichListValue, 'ra_flags', _('<abbr title="Router Advertisement">RA</abbr> Flags'),
						_('Specifies the flags sent in <abbr title="Router Advertisement">RA</abbr> messages, for example to instruct clients to request further information via stateful DHCPv6.'));
					so.value('managed-config', _('managed config (M)'),
						_('The <em>Managed address configuration</em> (M) flag indicates that IPv6 addresses are available via DHCPv6.'));
					so.value('other-config', _('other config (O)'),
						_('The <em>Other configuration</em> (O) flag indicates that other information, such as DNS servers, is available via DHCPv6.'));
					so.value('home-agent', _('mobile home agent (H)'),
						_('The <em>Mobile IPv6 Home Agent</em> (H) flag indicates that the device is also acting as Mobile IPv6 home agent on this link.'));
					so.multiple = true;
					so.select_placeholder = _('none');
					so.depends('ra', 'server');
					so.depends({ ra: 'hybrid', master: '0' });
					so.cfgvalue = function(section_id) {
						var flags = L.toArray(uci.get('dhcp', section_id, 'ra_flags'));
						return flags.length ? flags : [ 'other-config' ];
					};
					so.remove = function(section_id) {
						var existing = L.toArray(uci.get('dhcp', section_id, 'ra_flags'));
						if (this.isActive(section_id)) {
							if (existing.length != 1 || existing[0] != 'none')
								uci.set('dhcp', section_id, 'ra_flags', [ 'none' ]);
						}
						else if (existing.length) {
							uci.unset('dhcp', section_id, 'ra_flags');
						}
					};

					so = ss.taboption('ipv6-ra', form.Value, 'ra_maxinterval', _('Max <abbr title="Router Advertisement">RA</abbr> interval'), _('Maximum time allowed  between sending unsolicited <abbr title="Router Advertisement, ICMPv6 Type 134">RA</abbr>. Default is 600 seconds.'));
					so.optional = true;
					so.datatype = 'uinteger';
					so.placeholder = '600';
					so.depends('ra', 'server');
					so.depends({ ra: 'hybrid', master: '0' });

					so = ss.taboption('ipv6-ra', form.Value, 'ra_mininterval', _('Min <abbr title="Router Advertisement">RA</abbr> interval'), _('Minimum time allowed  between sending unsolicited <abbr title="Router Advertisement, ICMPv6 Type 134">RA</abbr>. Default is 200 seconds.'));
					so.optional = true;
					so.datatype = 'uinteger';
					so.placeholder = '200';
					so.depends('ra', 'server');
					so.depends({ ra: 'hybrid', master: '0' });

					so = ss.taboption('ipv6-ra', form.Value, 'ra_lifetime', _('<abbr title="Router Advertisement">RA</abbr> Lifetime'), _('Router Lifetime published  in <abbr title="Router Advertisement, ICMPv6 Type 134">RA</abbr> messages.  Maximum is 9000 seconds.'));
					so.optional = true;
					so.datatype = 'range(0, 9000)';
					so.placeholder = '1800';
					so.depends('ra', 'server');
					so.depends({ ra: 'hybrid', master: '0' });

					so = ss.taboption('ipv6-ra', form.Value, 'ra_mtu', _('<abbr title="Router Advertisement">RA</abbr> MTU'), _('The <abbr title="Maximum Transmission Unit">MTU</abbr>  to be published in <abbr title="Router Advertisement, ICMPv6 Type 134">RA</abbr> messages. Minimum is 1280 bytes.'));
					so.optional = true;
					so.datatype = 'range(1280, 65535)';
					so.depends('ra', 'server');
					so.depends({ ra: 'hybrid', master: '0' });
					so.load = function(section_id) {
						var dev = ifc.getL3Device(),
						    path = dev ? "/proc/sys/net/ipv6/conf/%s/mtu".format(dev.getName()) : null;

						return Promise.all([
							dev ? L.resolveDefault(fs.read(path), dev.getMTU()) : null,
							this.super('load', [section_id])
						]).then(L.bind(function(res) {
							this.placeholder = +res[0];

							return res[1];
						}, this));
					};

					so = ss.taboption('ipv6-ra', form.Value, 'ra_hoplimit', _('<abbr title="Router Advertisement">RA</abbr> Hop Limit'), _('The maximum hops  to be published in <abbr title="Router Advertisement">RA</abbr> messages. Maximum is 255 hops.'));
					so.optional = true;
					so.datatype = 'range(0, 255)';
					so.depends('ra', 'server');
					so.depends({ ra: 'hybrid', master: '0' });
					so.load = function(section_id) {
						var dev = ifc.getL3Device(),
						    path = dev ? "/proc/sys/net/ipv6/conf/%s/hop_limit".format(dev.getName()) : null;

						return Promise.all([
							dev ? L.resolveDefault(fs.read(path), 64) : null,
							this.super('load', [section_id])
						]).then(L.bind(function(res) {
							this.placeholder = +res[0];

							return res[1];
						}, this));
					};


					so = ss.taboption('ipv6', cbiRichListValue, 'dhcpv6', _('DHCPv6-Service'),
						_('Configures the operation mode of the DHCPv6 service on this interface.'));
					so.value('', _('disabled'),
						_('Do not offer DHCPv6 service on this interface.'));
					so.value('server', _('server mode'),
						_('Provide a DHCPv6 server on this interface and reply to DHCPv6 solicitations and requests.'));
					so.value('relay', _('relay mode'),
						_('Forward DHCPv6 messages between the designated master interface and downstream interfaces.'));
					so.value('hybrid', _('hybrid mode'), ' ');


					so = ss.taboption('ipv6', form.DynamicList, 'dns', _('Announced IPv6 DNS servers'),
						_('Specifies a fixed list of IPv6 DNS server addresses to announce via DHCPv6. If left unspecified, the device will announce itself as IPv6 DNS server unless the <em>Local IPv6 DNS server</em> option is disabled.'));
					so.datatype = 'ip6addr("nomask")'; /* restrict to IPv6 only for now since dnsmasq (DHCPv4) does not honour this option */
					so.depends('ra', 'server');
					so.depends({ ra: 'hybrid', master: '0' });
					so.depends('dhcpv6', 'server');
					so.depends({ dhcpv6: 'hybrid', master: '0' });

					so = ss.taboption('ipv6', form.Flag, 'dns_service', _('Local IPv6 DNS server'),
						_('Announce this device as IPv6 DNS server.'));
					so.default = so.enabled;
					so.depends({ ra: 'server', dns: /^$/ });
					so.depends({ ra: 'hybrid', dns: /^$/, master: '0' });
					so.depends({ dhcpv6: 'server', dns: /^$/ });
					so.depends({ dhcpv6: 'hybrid', dns: /^$/, master: '0' });

					so = ss.taboption('ipv6', form.DynamicList, 'domain', _('Announced DNS domains'),
						_('Specifies a fixed list of DNS search domains to announce via DHCPv6. If left unspecified, the local device DNS search domain will be announced.'));
					so.datatype = 'hostname';
					so.depends('ra', 'server');
					so.depends({ ra: 'hybrid', master: '0' });
					so.depends('dhcpv6', 'server');
					so.depends({ dhcpv6: 'hybrid', master: '0' });


					so = ss.taboption('ipv6', cbiRichListValue, 'ndp', _('<abbr title="Neighbour Discovery Protocol">NDP</abbr>-Proxy'),
						_('Configures the operation mode of the NDP proxy service on this interface.'));
					so.value('', _('disabled'),
						_('Do not proxy any <abbr title="Neighbour Discovery Protocol">NDP</abbr> packets.'));
					so.value('relay', _('relay mode'),
						_('Forward <abbr title="Neighbour Discovery Protocol">NDP</abbr> <abbr title="Neighbour Solicitation, Type 135">NS</abbr> and <abbr title="Neighbour Advertisement, Type 136">NA</abbr> messages between the designated master interface and downstream interfaces.'));
					so.value('hybrid', _('hybrid mode'), ' ');


					so = ss.taboption('ipv6', form.Flag, 'ndproxy_routing', _('Learn routes'), _('Setup routes for proxied IPv6 neighbours.'));
					so.default = so.enabled;
					so.depends('ndp', 'relay');
					so.depends('ndp', 'hybrid');

					so = ss.taboption('ipv6', form.Flag, 'ndproxy_slave', _('NDP-Proxy slave'), _('Set interface as NDP-Proxy external slave. Default is off.'));
					so.depends({ ndp: 'relay', master: '0' });
					so.depends({ ndp: 'hybrid', master: '0' });
				}

				ifc.renderFormOptions(s);

				// Common interface options
				o = nettools.replaceOption(s, 'advanced', form.Flag, 'defaultroute', _('Use default gateway'), _('If unchecked, no default route is configured'));
				o.default = o.enabled;

				if (protoval != 'static') {
					o = nettools.replaceOption(s, 'advanced', form.Flag, 'peerdns', _('Use DNS servers advertised by peer'), _('If unchecked, the advertised DNS server addresses are ignored'));
					o.default = o.enabled;
				}

				o = nettools.replaceOption(s, 'advanced', form.DynamicList, 'dns', _('Use custom DNS servers'));
				if (protoval != 'static')
					o.depends('peerdns', '0');
				o.datatype = 'ipaddr';

				o = nettools.replaceOption(s, 'advanced', form.DynamicList, 'dns_search', _('DNS search domains'));
				if (protoval != 'static')
					o.depends('peerdns', '0');
				o.datatype = 'hostname';

				o = nettools.replaceOption(s, 'advanced', form.Value, 'dns_metric', _('DNS weight'), _('The DNS server entries in the local resolv.conf are primarily sorted by the weight specified here'));
				o.datatype = 'uinteger';
				o.placeholder = '0';

				o = nettools.replaceOption(s, 'advanced', form.Value, 'metric', _('Use gateway metric'));
				o.datatype = 'uinteger';
				o.placeholder = '0';

				o = nettools.replaceOption(s, 'advanced', form.Value, 'ip4table', _('Override IPv4 routing table'));
				o.datatype = 'or(uinteger, string)';
				for (var i = 0; i < rtTables.length; i++)
					o.value(rtTables[i][1], '%s (%d)'.format(rtTables[i][1], rtTables[i][0]));

				o = nettools.replaceOption(s, 'advanced', form.Value, 'ip6table', _('Override IPv6 routing table'));
				o.datatype = 'or(uinteger, string)';
				for (var i = 0; i < rtTables.length; i++)
					o.value(rtTables[i][1], '%s (%d)'.format(rtTables[i][1], rtTables[i][0]));

				if (protoval == 'dhcpv6') {
					o = nettools.replaceOption(s, 'advanced', form.Flag, 'sourcefilter', _('IPv6 source routing'), _('Automatically handle multiple uplink interfaces using source-based policy routing.'));
					o.default = o.enabled;
				}

				o = nettools.replaceOption(s, 'advanced', form.Flag, 'delegate', _('Delegate IPv6 prefixes'), _('Enable downstream delegation of IPv6 prefixes available on this interface'));
				o.default = o.enabled;

				o = nettools.replaceOption(s, 'advanced', form.Value, 'ip6assign', _('IPv6 assignment length'), _('Assign a part of given length of every public IPv6-prefix to this interface'));
				o.value('', _('disabled'));
				o.value('64');
				o.datatype = 'max(128)';

				o = nettools.replaceOption(s, 'advanced', form.Value, 'ip6hint', _('IPv6 assignment hint'), _('Assign prefix parts using this hexadecimal subprefix ID for this interface.'));
				o.placeholder = '0';
				o.validate = function(section_id, value) {
					if (value == null || value == '')
						return true;

					var n = parseInt(value, 16);

					if (!/^(0x)?[0-9a-fA-F]+$/.test(value) || isNaN(n) || n >= 0xffffffff)
						return _('Expecting a hexadecimal assignment hint');

					return true;
				};
				for (var i = 33; i <= 64; i++)
					o.depends('ip6assign', String(i));


				o = nettools.replaceOption(s, 'advanced', form.DynamicList, 'ip6class', _('IPv6 prefix filter'), _('If set, downstream subnets are only allocated from the given IPv6 prefix classes.'));
				o.value('local', 'local (%s)'.format(_('Local ULA')));

				var prefixClasses = {};

				this.networks.forEach(function(net) {
					var prefixes = net._ubus('ipv6-prefix');
					if (Array.isArray(prefixes)) {
						prefixes.forEach(function(pfx) {
							if (L.isObject(pfx) && typeof(pfx['class']) == 'string') {
								prefixClasses[pfx['class']] = prefixClasses[pfx['class']] || {};
								prefixClasses[pfx['class']][net.getName()] = true;
							}
						});
					}
				});

				Object.keys(prefixClasses).sort().forEach(function(c) {
					var networks = Object.keys(prefixClasses[c]).sort().join(', ');
					o.value(c, (c != networks) ? '%s (%s)'.format(c, networks) : c);
				});


				o = nettools.replaceOption(s, 'advanced', form.Value, 'ip6ifaceid', _('IPv6 suffix'), _("Optional. Allowed values: 'eui64', 'random', fixed value like '::1' or '::1:2'. When IPv6 prefix (like 'a:b:c:d::') is received from a delegating server, use the suffix (like '::1') to form the IPv6 address ('a:b:c:d::1') for the interface."));
				o.datatype = 'ip6hostid';
				o.placeholder = '::1';

				o = nettools.replaceOption(s, 'advanced', form.Value, 'ip6weight', _('IPv6 preference'), _('When delegating prefixes to multiple downstreams, interfaces with a higher preference value are considered first when allocating subnets.'));
				o.datatype = 'uinteger';
				o.placeholder = '0';

				for (var i = 0; i < s.children.length; i++) {
					o = s.children[i];

					switch (o.option) {
					case 'proto':
					case 'auto':
					case '_dhcp':
					case '_zone':
					case '_switch_proto':
					case '_ifacestat_modal':
						continue;

					case 'igmp_snooping':
					case 'stp':
					case 'type':
					case '_net_device':
						var deps = [];
						for (var j = 0; j < protocols.length; j++) {
							if (!protocols[j].isVirtual()) {
								if (o.deps.length)
									for (var k = 0; k < o.deps.length; k++)
										deps.push(Object.assign({ proto: protocols[j].getProtocol() }, o.deps[k]));
								else
									deps.push({ proto: protocols[j].getProtocol() });
							}
						}
						o.deps = deps;
						break;

					default:
						if (o.deps.length)
							for (var j = 0; j < o.deps.length; j++)
								o.deps[j].proto = protoval;
						else
							o.depends('proto', protoval);
					}
				}

				this.activeSection = s.section;
			}, this));
		};

		s.handleModalCancel = function(/* ... */) {
			var type = uci.get('network', this.activeSection || this.addedSection, 'type'),
			    device = (type == 'bridge') ? 'br-%s'.format(this.activeSection || this.addedSection) : null;

			uci.sections('network', 'bridge-vlan', function(bvs) {
				if (device != null && bvs.device == device)
					uci.remove('network', bvs['.name']);
			});

			return form.GridSection.prototype.handleModalCancel.apply(this, arguments);
		};

		s.handleAdd = function(ev) {
			var m2 = new form.Map('network'),
			    s2 = m2.section(form.NamedSection, '_new_'),
			    protocols = network.getProtocols(),
			    proto, name, device;

			protocols.sort(function(a, b) {
				return L.naturalCompare(a.getProtocol(), b.getProtocol());
			});

			s2.render = function() {
				return Promise.all([
					{},
					this.renderUCISection('_new_')
				]).then(this.renderContents.bind(this));
			};

			name = s2.option(form.Value, 'name', _('Name'));
			name.rmempty = false;
			name.datatype = 'uciname';
			name.placeholder = _('New interface name…');
			name.validate = function(section_id, value) {
				if (uci.get('network', value) != null)
					return _('The interface name is already used');

				var pr = network.getProtocol(proto.formvalue(section_id), value),
				    ifname = pr.isVirtual() ? '%s-%s'.format(pr.getProtocol(), value) : 'br-%s'.format(value);

				if (value.length > 15)
					return _('The interface name is too long');

				return true;
			};

			proto = s2.option(form.ListValue, 'proto', _('Protocol'));
			proto.validate = name.validate;

			device = s2.option(widgets.DeviceSelect, 'device', _('Device'));
			device.noaliases = false;
			device.optional = false;

			for (var i = 0; i < protocols.length; i++) {
				proto.value(protocols[i].getProtocol(), protocols[i].getI18n());

				if (!protocols[i].isVirtual())
					device.depends('proto', protocols[i].getProtocol());
			}

			m2.render().then(L.bind(function(nodes) {
				ui.showModal(_('Add new interface...'), [
					nodes,
					E('div', { 'class': 'right' }, [
						E('button', {
							'class': 'btn',
							'click': ui.hideModal
						}, _('Cancel')), ' ',
						E('button', {
							'class': 'cbi-button cbi-button-positive important',
							'click': ui.createHandlerFn(this, function(ev) {
								var nameval = name.isValid('_new_') ? name.formvalue('_new_') : null,
								    protoval = proto.isValid('_new_') ? proto.formvalue('_new_') : null,
								    protoclass = protoval ? network.getProtocol(protoval, nameval) : null;

								if (nameval == null || protoval == null || nameval == '' || protoval == '')
									return;

								return protoclass.isCreateable(nameval).then(function(checkval) {
									if (checkval != null) {
										ui.addNotification(null,
												E('p', _('New interface for "%s" can not be created: %s').format(protoclass.getI18n(), checkval)));
										ui.hideModal();
										return;
									}

									return m.save(function() {
										var section_id = uci.add('network', 'interface', nameval);

										protoclass.set('proto', protoval);
										protoclass.addDevice(device.formvalue('_new_'));

										m.children[0].addedSection = section_id;

										ui.hideModal();
										ui.showModal(null, E('p', { 'class': 'spinning' }, [ _('Loading data…') ]));
									}).then(L.bind(m.children[0].renderMoreOptionsModal, m.children[0], nameval));
								});
							})
						}, _('Create interface'))
					])
				], 'cbi-modal');

				nodes.querySelector('[id="%s"] input[type="text"]'.format(name.cbid('_new_'))).focus();
			}, this));
		};

		s.handleRemove = function(section_id, ev) {
			return network.deleteNetwork(section_id).then(L.bind(function(section_id, ev) {
				return form.GridSection.prototype.handleRemove.apply(this, [section_id, ev]);
			}, this, section_id, ev));
		};

		o = s.option(form.DummyValue, '_ifacebox');
		o.modalonly = false;
		o.textvalue = function(section_id) {
			var net = this.section.networks.filter(function(n) { return n.getName() == section_id })[0],
			    zone = net ? this.section.zones.filter(function(z) { return !!z.getNetworks().filter(function(n) { return n == section_id })[0] })[0] : null;

			if (!net)
				return;

			var node = E('div', { 'class': 'ifacebox' }, [
				E('div', {
					'class': 'ifacebox-head',
					'style': firewall.getZoneColorStyle(zone),
					'title': zone ? _('Part of zone %q').format(zone.getName()) : _('No zone assigned')
				}, E('strong', net.getName())),
				E('div', {
					'class': 'ifacebox-body',
					'id': '%s-ifc-devices'.format(section_id),
					'data-network': section_id
				}, [
					E('img', {
						'src': L.resource('icons/ethernet_disabled.png'),
						'style': 'width:16px; height:16px'
					}),
					E('br'), E('small', '?')
				])
			]);

			render_ifacebox_status(node.childNodes[1], net);

			return node;
		};

		o = s.option(form.DummyValue, '_ifacestat');
		o.modalonly = false;
		o.textvalue = function(section_id) {
			var net = this.section.networks.filter(function(n) { return n.getName() == section_id })[0];

			if (!net)
				return;

			var node = E('div', { 'id': '%s-ifc-description'.format(section_id) });

			render_status(node, net, false);

			return node;
		};

		o = s.taboption('advanced', form.Flag, 'delegate', _('Use builtin IPv6-management'));
		o.modalonly = true;
		o.default = o.enabled;

		o = s.taboption('advanced', form.Flag, 'force_link', _('Force link'), _('Set interface properties regardless of the link carrier (If set, carrier sense events do not invoke hotplug handlers).'));
		o.modalonly = true;
		o.defaults = {
			'1': [{ proto: 'static' }],
			'0': []
		};


		// Device configuration
		s = m.section(form.GridSection, 'device', _('Devices'));
		s.addremove = true;
		s.anonymous = true;
		s.addbtntitle = _('Add device configuration…');

		s.cfgsections = function() {
			var sections = uci.sections('network', 'device'),
			    section_ids = sections.sort(function(a, b) { return L.naturalCompare(a.name, b.name) }).map(function(s) { return s['.name'] });

			for (var i = 0; i < netDevs.length; i++) {
				if (sections.filter(function(s) { return s.name == netDevs[i].getName() }).length)
					continue;

				if (netDevs[i].getType() == 'wifi' && !netDevs[i].isUp())
					continue;

				/* Unless http://lists.openwrt.org/pipermail/openwrt-devel/2020-July/030397.html is implemented,
				   we cannot properly redefine bridges as devices, so filter them away for now... */

				var m = netDevs[i].isBridge() ? netDevs[i].getName().match(/^br-([A-Za-z0-9_]+)$/) : null,
				    s = m ? uci.get('network', m[1]) : null;

				if (s && s['.type'] == 'interface' && s.type == 'bridge')
					continue;

				section_ids.push('dev:%s'.format(netDevs[i].getName()));
			}

			return section_ids;
		};

		s.renderMoreOptionsModal = function(section_id, ev) {
			var m = section_id.match(/^dev:(.+)$/);

			if (m) {
				var devtype = getDevType(section_id);

				section_id = uci.add('network', 'device');

				uci.set('network', section_id, 'name', m[1]);
				uci.set('network', section_id, 'type', (devtype != 'ethernet') ? devtype : null);

				this.addedSection = section_id;
			}

			return this.super('renderMoreOptionsModal', [section_id, ev]);
		};

		s.renderRowActions = function(section_id) {
			var trEl = this.super('renderRowActions', [ section_id, _('Configure…') ]),
			    deleteBtn = trEl.querySelector('button:last-child');

			deleteBtn.firstChild.data = _('Unconfigure');
			deleteBtn.setAttribute('title', _('Remove related device settings from the configuration'));
			deleteBtn.disabled = section_id.match(/^dev:/) ? true : null;

			return trEl;
		};

		s.modaltitle = function(section_id) {
			var m = section_id.match(/^dev:(.+)$/),
			    name = m ? m[1] : uci.get('network', section_id, 'name');

			return name ? '%s: %q'.format(getDevTypeDesc(section_id), name) : _('Add device configuration');
		};

		s.addModalOptions = function(s) {
			var isNew = (uci.get('network', s.section, 'name') == null),
			    dev = getDevice(s.section);

			nettools.addDeviceOptions(s, dev, isNew);
		};

		s.handleModalCancel = function(map /*, ... */) {
			var name = uci.get('network', this.addedSection, 'name')

			uci.sections('network', 'bridge-vlan', function(bvs) {
				if (name != null && bvs.device == name)
					uci.remove('network', bvs['.name']);
			});

			if (map.addedVLANs)
				for (var i = 0; i < map.addedVLANs.length; i++)
					uci.remove('network', map.addedVLANs[i]);

			return form.GridSection.prototype.handleModalCancel.apply(this, arguments);
		};

		s.handleRemove = function(section_id /*, ... */) {
			var name = uci.get('network', section_id, 'name'),
			    type = uci.get('network', section_id, 'type');

			if (name != null && type == 'bridge') {
				uci.sections('network', 'bridge-vlan', function(bvs) {
					if (bvs.device == name)
						uci.remove('network', bvs['.name']);
				});
			}

			return form.GridSection.prototype.handleRemove.apply(this, arguments);
		};

		function getDevice(section_id) {
			var m = section_id.match(/^dev:(.+)$/),
			    name = m ? m[1] : uci.get('network', section_id, 'name');

			return netDevs.filter(function(d) { return d.getName() == name })[0];
		}

		function getDevType(section_id) {
			var dev = getDevice(section_id),
			    cfg = uci.get('network', section_id),
			    type = cfg ? (uci.get('network', section_id, 'type') || 'ethernet') : (dev ? dev.getType() : '');

			switch (type) {
			case '':
				return null;

			case 'vlan':
			case '8021q':
				return '8021q';

			case '8021ad':
				return '8021ad';

			case 'bridge':
				return 'bridge';

			case 'tunnel':
				return 'tunnel';

			case 'macvlan':
				return 'macvlan';

			case 'veth':
				return 'veth';

			case 'wifi':
			case 'alias':
			case 'switch':
			case 'ethernet':
			default:
				return 'ethernet';
			}
		}

		function getDevTypeDesc(section_id) {
			switch (getDevType(section_id) || '') {
			case '':
				return E('em', [ _('Device not present') ]);

			case '8021q':
				return _('VLAN (802.1q)');

			case '8021ad':
				return _('VLAN (802.1ad)');

			case 'bridge':
				return _('Bridge device');

			case 'tunnel':
				return _('Tunnel device');

			case 'macvlan':
				return _('MAC VLAN');

			case 'veth':
				return _('Virtual Ethernet');

			default:
				return _('Network device');
			}
		}

		o = s.option(form.DummyValue, 'name', _('Device'));
		o.modalonly = false;
		o.textvalue = function(section_id) {
			var dev = getDevice(section_id),
			    ext = section_id.match(/^dev:/),
			    icon = render_iface(dev);

			if (ext)
				icon.querySelector('img').style.opacity = '.5';

			return E('span', { 'class': 'ifacebadge' }, [
				icon,
				E('span', { 'style': ext ? 'opacity:.5' : null }, [
					dev ? dev.getName() : (uci.get('network', section_id, 'name') || '?')
				])
			]);
		};

		o = s.option(form.DummyValue, 'type', _('Type'));
		o.textvalue = getDevTypeDesc;
		o.modalonly = false;

		o = s.option(form.DummyValue, 'macaddr', _('MAC Address'));
		o.modalonly = false;
		o.textvalue = function(section_id) {
			var dev = getDevice(section_id),
			    val = uci.get('network', section_id, 'macaddr'),
			    mac = dev ? dev.getMAC() : null;

			return val ? E('strong', {
				'data-tooltip': _('The value is overridden by configuration.')
			}, [ val.toUpperCase() ]) : (mac || '-');
		};

		o = s.option(form.DummyValue, 'mtu', _('MTU'));
		o.modalonly = false;
		o.textvalue = function(section_id) {
			var dev = getDevice(section_id),
			    val = uci.get('network', section_id, 'mtu'),
			    mtu = dev ? dev.getMTU() : null;

			return val ? E('strong', {
				'data-tooltip': _('The value is overridden by configuration.')
			}, [ val ]) : (mtu || '-').toString();
		};

		s = m.section(form.TypedSection, 'globals', _('Global network options'));
		s.addremove = false;
		s.anonymous = true;

		o = s.option(form.Value, 'ula_prefix', _('IPv6 ULA-Prefix'), _('Unique Local Address - in the range <code>fc00::/7</code>.  Typically only within the &#8216;local&#8217; half <code>fd00::/8</code>. ULA for IPv6 is analogous to IPv4 private network addressing. This prefix is randomly generated at first install.'));
		o.datatype = 'cidr6';

		o = s.option(form.Flag, 'packet_steering', _('Packet Steering'), _('Enable packet steering across all CPUs. May help or hinder network speed.'));
		o.optional = true;


		if (dslModemType != null) {
			s = m.section(form.TypedSection, 'dsl', _('DSL'));
			s.anonymous = true;

			o = s.option(form.ListValue, 'annex', _('Annex'));
			o.value('a', _('Annex A + L + M (all)'));
			o.value('b', _('Annex B (all)'));
			o.value('j', _('Annex J (all)'));
			o.value('m', _('Annex M (all)'));
			o.value('bdmt', _('Annex B G.992.1'));
			o.value('b2', _('Annex B G.992.3'));
			o.value('b2p', _('Annex B G.992.5'));
			o.value('at1', _('ANSI T1.413'));
			o.value('admt', _('Annex A G.992.1'));
			o.value('alite', _('Annex A G.992.2'));
			o.value('a2', _('Annex A G.992.3'));
			o.value('a2p', _('Annex A G.992.5'));
			o.value('l', _('Annex L G.992.3 POTS 1'));
			o.value('m2', _('Annex M G.992.3'));
			o.value('m2p', _('Annex M G.992.5'));

			o = s.option(form.ListValue, 'tone', _('Tone'));
			o.value('', _('auto'));
			o.value('a', _('A43C + J43 + A43'));
			o.value('av', _('A43C + J43 + A43 + V43'));
			o.value('b', _('B43 + B43C'));
			o.value('bv', _('B43 + B43C + V43'));

			if (dslModemType == 'vdsl') {
				o = s.option(form.ListValue, 'xfer_mode', _('Encapsulation mode'));
				o.value('', _('auto'));
				o.value('atm', _('ATM (Asynchronous Transfer Mode)'));
				o.value('ptm', _('PTM/EFM (Packet Transfer Mode)'));

				o = s.option(form.ListValue, 'line_mode', _('DSL line mode'));
				o.value('', _('auto'));
				o.value('adsl', _('ADSL'));
				o.value('vdsl', _('VDSL'));

				o = s.option(form.ListValue, 'ds_snr_offset', _('Downstream SNR offset'));
				o.default = '0';

				for (var i = -100; i <= 100; i += 5)
					o.value(i, _('%.1f dB').format(i / 10));
			}

			s.option(form.Value, 'firmware', _('Firmware File'));
		}


		// Show ATM bridge section if we have the capabilities
		if (L.hasSystemFeature('br2684ctl')) {
			s = m.section(form.TypedSection, 'atm-bridge', _('ATM Bridges'), _('ATM bridges expose encapsulated ethernet in AAL5 connections as virtual Linux network interfaces which can be used in conjunction with DHCP or PPP to dial into the provider network.'));

			s.addremove = true;
			s.anonymous = true;
			s.addbtntitle = _('Add ATM Bridge');

			s.handleAdd = function(ev) {
				var sections = uci.sections('network', 'atm-bridge'),
				    max_unit = -1;

				for (var i = 0; i < sections.length; i++) {
					var unit = +sections[i].unit;

					if (!isNaN(unit) && unit > max_unit)
						max_unit = unit;
				}

				return this.map.save(function() {
					var sid = uci.add('network', 'atm-bridge');

					uci.set('network', sid, 'unit', max_unit + 1);
					uci.set('network', sid, 'atmdev', 0);
					uci.set('network', sid, 'encaps', 'llc');
					uci.set('network', sid, 'payload', 'bridged');
					uci.set('network', sid, 'vci', 35);
					uci.set('network', sid, 'vpi', 8);
				});
			};

			s.tab('general', _('General Setup'));
			s.tab('advanced', _('Advanced Settings'));

			o = s.taboption('general', form.Value, 'vci', _('ATM Virtual Channel Identifier (VCI)'));
			s.taboption('general', form.Value, 'vpi', _('ATM Virtual Path Identifier (VPI)'));

			o = s.taboption('general', form.ListValue, 'encaps', _('Encapsulation mode'));
			o.value('llc', _('LLC'));
			o.value('vc', _('VC-Mux'));

			s.taboption('advanced', form.Value, 'atmdev', _('ATM device number'));
			s.taboption('advanced', form.Value, 'unit', _('Bridge unit number'));

			o = s.taboption('advanced', form.ListValue, 'payload', _('Forwarding mode'));
			o.value('bridged', _('bridged'));
			o.value('routed', _('routed'));
		}


		return m.render().then(L.bind(function(m, nodes) {
			poll.add(L.bind(function() {
				var section_ids = m.children[0].cfgsections(),
				    tasks = [];

				for (var i = 0; i < section_ids.length; i++) {
					var row = nodes.querySelector('.cbi-section-table-row[data-sid="%s"]'.format(section_ids[i])),
					    dsc = row.querySelector('[data-name="_ifacestat"] > div'),
					    btn1 = row.querySelector('.cbi-section-actions .reconnect'),
					    btn2 = row.querySelector('.cbi-section-actions .down');

					if (dsc.getAttribute('reconnect') == '') {
						dsc.setAttribute('reconnect', '1');
						tasks.push(fs.exec('/sbin/ifup', [section_ids[i]]).catch(function(e) {
							ui.addNotification(null, E('p', e.message));
						}));
					}
					else if (dsc.getAttribute('disconnect') == '') {
						dsc.setAttribute('disconnect', '1');
						tasks.push(fs.exec('/sbin/ifdown', [section_ids[i]]).catch(function(e) {
							ui.addNotification(null, E('p', e.message));
						}));
					}
					else if (dsc.getAttribute('reconnect') == '1') {
						dsc.removeAttribute('reconnect');
						btn1.classList.remove('spinning');
						btn1.disabled = false;
					}
					else if (dsc.getAttribute('disconnect') == '1') {
						dsc.removeAttribute('disconnect');
						btn2.classList.remove('spinning');
						btn2.disabled = false;
					}
				}

				return Promise.all(tasks)
					.then(L.bind(network.getNetworks, network))
					.then(L.bind(this.poll_status, this, nodes));
			}, this), 5);

			return nodes;
		}, this, m));
	}
});
