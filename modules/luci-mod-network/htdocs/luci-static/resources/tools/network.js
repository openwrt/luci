'use strict';
'require fs';
'require ui';
'require dom';
'require uci';
'require form';
'require network';
'require baseclass';
'require validation';
'require tools.widgets as widgets';

function validateAddr(section_id, value) {
	if (value == '')
		return true;

	var ipv6 = /6$/.test(this.section.formvalue(section_id, 'mode')),
	    addr = ipv6 ? validation.parseIPv6(value) : validation.parseIPv4(value);

	return addr ? true : (ipv6 ? _('Expecting a valid IPv6 address') : _('Expecting a valid IPv4 address'));
}

function validateQoSMap(section_id, value) {
	if (value == '')
		return true;

	var m = value.match(/^(\d+):(\d+)$/);

	if (!m || +m[1] > 0xFFFFFFFF || +m[2] > 0xFFFFFFFF)
		return _('Expecting two priority values separated by a colon');

	return true;
}

function deviceSectionExists(section_id, devname) {
	var exists = false;

	uci.sections('network', 'device', function(ss) {
		exists = exists || (
			ss['.name'] != section_id &&
			ss.name == devname
		);
	});

	return exists;
}

function isBridgePort(dev) {
	if (!dev)
		return false;

	if (dev.isBridgePort())
		return true;

	var isPort = false;

	uci.sections('network', null, function(s) {
		if (s['.type'] != 'interface' && s['.type'] != 'device')
			return;

		if (s.type == 'bridge' && L.toArray(s.ifname).indexOf(dev.getName()) > -1)
			isPort = true;
	});

	return isPort;
}

function updateDevBadge(node, dev) {
	var type = dev.getType(),
	    up = dev.getCarrier();

	dom.content(node, [
		E('img', {
			'class': 'middle',
			'src': L.resource('icons/%s%s.png').format(type, up ? '' : '_disabled')
		}),
		'\x0a', dev.getName()
	]);

	return node;
}

function renderDevBadge(dev) {
	return updateDevBadge(E('span', {
		'class': 'ifacebadge port-status-device',
		'style': 'font-weight:normal',
		'data-device': dev.getName()
	}), dev);
}

function updatePortStatus(node, dev) {
	var carrier = dev.getCarrier(),
	    duplex = dev.getDuplex(),
	    speed = dev.getSpeed(),
	    desc, title;

	if (carrier && speed > 0 && duplex != null) {
		desc = '%d%s'.format(speed, duplex == 'full' ? 'FD' : 'HD');
		title = '%s, %d MBit/s, %s'.format(_('Connected'), speed, duplex == 'full' ? _('full-duplex') : _('half-duplex'));
	}
	else if (carrier) {
		desc = _('Connected');
	}
	else {
		desc = _('no link');
	}

	dom.content(node, [
		E('img', {
			'class': 'middle',
			'src': L.resource('icons/port_%s.png').format(carrier ? 'up' : 'down')
		}),
		'\x0a', desc
	]);

	if (title)
		node.setAttribute('data-tooltip', title);
	else
		node.removeAttribute('data-tooltip');

	return node;
}

function renderPortStatus(dev) {
	return updatePortStatus(E('span', {
		'class': 'ifacebadge port-status-link',
		'data-device': dev.getName()
	}), dev);
}

function updatePlaceholders(opt, section_id) {
	var dev = network.instantiateDevice(opt.getUIElement(section_id).getValue());

	for (var i = 0, co; (co = opt.section.children[i]) != null; i++) {
		if (co !== opt) {
			switch (co.option) {
			case 'mtu':
			case 'mtu6':
				co.getUIElement(section_id).setPlaceholder(dev.getMTU());
				break;

			case 'macaddr':
				co.getUIElement(section_id).setPlaceholder(dev.getMAC());
				break;

			case 'txqueuelen':
				co.getUIElement(section_id).setPlaceholder(dev._devstate('qlen'));
				break;
			}
		}
	}
}

var cbiFlagTristate = form.ListValue.extend({
	__init__: function(/* ... */) {
		this.super('__init__', arguments);
		this.keylist = [ '', '0!', '1!' ];
		this.vallist = [ _('automatic'), _('disabled'), _('enabled') ];
	},

	load: function(section_id) {
		var invert = false, sysfs = this.sysfs;

		if (sysfs) {
			if (sysfs.charAt(0) == '!') {
				invert = true;
				sysfs = sysfs.substring(1);
			}

			return L.resolveDefault(fs.read(sysfs), '').then(L.bind(function(res) {
				res = (res || '').trim();

				if (res == '0')
					this.sysfs_default = invert;
				else if (res == '1')
					this.sysfs_default = !invert;

				return this.super('load', [section_id]);
			}, this));
		}

		return this.super('load', [section_id]);
	},

	write: function(section_id, formvalue) {
		if (formvalue == '1!')
			return this.super('write', [section_id, '1']);
		else if (formvalue == '0!')
			return this.super('write', [section_id, '0']);
		else
			return this.super('remove', [section_id]);
	},

	renderWidget: function(section_id, option_index, cfgvalue) {
		var sysdef = this.sysfs_default;

		if (this.sysfs_default !== null) {
			this.keylist[0] = sysdef ? '1' : '0';
			this.vallist[0] = sysdef ? _('automatic (enabled)') : _('automatic (disabled)');
		}

		return this.super('renderWidget', [section_id, option_index, cfgvalue ? cfgvalue + '!' : null]);
	}
});


var cbiTagValue = form.Value.extend({
	renderWidget: function(section_id, option_index, cfgvalue) {
		var widget = new ui.Dropdown(cfgvalue || ['-'], {
			'-': E([], [
				E('span', { 'class': 'hide-open', 'style': 'font-family:monospace' }, [ '—' ]),
				E('span', { 'class': 'hide-close' }, [ _('Not Member', 'VLAN port state') ])
			]),
			'u': E([], [
				E('span', { 'class': 'hide-open', 'style': 'font-family:monospace' }, [ 'U' ]),
				E('span', { 'class': 'hide-close' }, [ _('Untagged', 'VLAN port state') ])
			]),
			't': E([], [
				E('span', { 'class': 'hide-open', 'style': 'font-family:monospace' }, [ 'T' ]),
				E('span', { 'class': 'hide-close' }, [ _('Tagged', 'VLAN port state') ])
			]),
			'*': E([], [
				E('span', { 'class': 'hide-open', 'style': 'font-family:monospace' }, [ '*' ]),
				E('span', { 'class': 'hide-close' }, [ _('Is Primary VLAN', 'VLAN port state') ])
			])
		}, {
			id: this.cbid(section_id),
			sort: [ '-', 'u', 't', '*' ],
			optional: false,
			multiple: true
		});

		var field = this;

		widget.toggleItem = function(sb, li, force_state) {
			var lis = li.parentNode.querySelectorAll('li'),
			    toggle = ui.Dropdown.prototype.toggleItem;

			toggle.apply(this, [sb, li, force_state]);

			if (force_state != null)
				return;

			switch (li.getAttribute('data-value'))
			{
			case '-':
				if (li.hasAttribute('selected')) {
					for (var i = 0; i < lis.length; i++) {
						switch (lis[i].getAttribute('data-value')) {
						case '-':
							break;

						case '*':
							toggle.apply(this, [sb, lis[i], false]);
							lis[i].setAttribute('unselectable', '');
							break;

						default:
							toggle.apply(this, [sb, lis[i], false]);
						}
					}
				}
				break;

			case 't':
			case 'u':
				if (li.hasAttribute('selected')) {
					for (var i = 0; i < lis.length; i++) {
						switch (lis[i].getAttribute('data-value')) {
						case li.getAttribute('data-value'):
							break;

						case '*':
							lis[i].removeAttribute('unselectable');
							break;

						default:
							toggle.apply(this, [sb, lis[i], false]);
						}
					}
				}
				else {
					toggle.apply(this, [sb, li, true]);
				}
				break;

			case '*':
				if (li.hasAttribute('selected')) {
					var section_ids = field.section.cfgsections();

					for (var i = 0; i < section_ids.length; i++) {
						var other_widget = field.getUIElement(section_ids[i]),
						    other_value = L.toArray(other_widget.getValue());

						if (other_widget === this)
							continue;

						var new_value = other_value.filter(function(v) { return v != '*' });

						if (new_value.length == other_value.length)
							continue;

						other_widget.setValue(new_value);
						break;
					}
				}
			}
		};

		var node = widget.render();

		node.style.minWidth = '4em';

		if (cfgvalue == '-')
			node.querySelector('li[data-value="*"]').setAttribute('unselectable', '');

		return E('div', { 'style': 'display:inline-block' }, node);
	},

	cfgvalue: function(section_id) {
		var ports = L.toArray(uci.get('network', section_id, 'ports'));

		for (var i = 0; i < ports.length; i++) {
			var s = ports[i].split(/:/);

			if (s[0] != this.port)
				continue;

			var t = /t/.test(s[1] || '') ? 't' : 'u';

			return /\x2a/.test(s[1] || '') ? [t, '*'] : [t];
		}

		return ['-'];
	},

	write: function(section_id, value) {
		var ports = [];

		for (var i = 0; i < this.section.children.length; i++) {
			var opt = this.section.children[i];

			if (opt.port) {
				var val = L.toArray(opt.formvalue(section_id)).join('');

				switch (val) {
				case '-':
					break;

				case 'u':
					ports.push(opt.port);
					break;

				default:
					ports.push('%s:%s'.format(opt.port, val));
					break;
				}
			}
		}

		uci.set('network', section_id, 'ports', ports.length ? ports : null);
	},

	remove: function() {}
});

return baseclass.extend({

	protocols: [ // name, proto number, description
		{ n: 'hopopt', i: 0, d: 'HOPOPT' },
		{ n: 'icmp', i: 1, d: 'ICMP' },
		{ n: 'igmp', i: 2, d: 'IGMP' },
		{ n: 'ggp', i: 3, d: 'GGP' },
		{ n: 'ipencap', i: 4, d: 'IP-ENCAP' },
		{ n: 'st', i: 5, d: 'ST' },
		{ n: 'tcp', i: 6, d: 'TCP' },
		{ n: 'egp', i: 8, d: 'EGP' },
		{ n: 'igp', i: 9, d: 'IGP' },
		{ n: 'pup', i: 12, d: 'PUP' },
		{ n: 'udp', i: 17, d: 'UDP' },
		{ n: 'hmp', i: 20, d: 'HMP' },
		{ n: 'xns-idp', i: 22, d: 'XNS-IDP' },
		{ n: 'rdp', i: 27, d: 'RDP' },
		{ n: 'iso-tp4', i: 29, d: 'ISO-TP4' },
		{ n: 'dccp', i: 33, d: 'DCCP' },
		{ n: 'xtp', i: 36, d: 'XTP' },
		{ n: 'ddp', i: 37, d: 'DDP' },
		{ n: 'idpr-cmtp', i: 38, d: 'IDPR-CMTP' },
		{ n: 'ipv6', i: 41, d: 'IPv6' },
		{ n: 'ipv6-route', i: 43, d: 'IPv6-Route' },
		{ n: 'ipv6-frag', i: 44, d: 'IPv6-Frag' },
		{ n: 'idrp', i: 45, d: 'IDRP' },
		{ n: 'rsvp', i: 46, d: 'RSVP' },
		{ n: 'gre', i: 47, d: 'GRE' },
		{ n: 'esp', i: 50, d: 'IPSEC-ESP' },
		{ n: 'ah', i: 51, d: 'IPSEC-AH' },
		{ n: 'skip', i: 57, d: 'SKIP' },
		{ n: 'icmpv6', i: 58, d: 'IPv6-ICMP' },
		{ n: 'ipv6-nonxt', i: 59, d: 'IPv6-NoNxt' },
		{ n: 'ipv6-opts', i: 60, d: 'IPv6-Opts' },
		{ n: 'rspf', i: 73, d: 'CPHB' },
		{ n: 'vmtp', i: 81, d: 'VMTP' },
		{ n: 'eigrp', i: 88, d: 'EIGRP' },
		{ n: 'ospf', i: 89, d: 'OSPFIGP' },
		{ n: 'ax.25', i: 93, d: 'AX.25' },
		{ n: 'ipip', i: 94, d: 'IPIP' },
		{ n: 'etherip', i: 97, d: 'ETHERIP' },
		{ n: 'encap', i: 98, d: 'ENCAP' },
		{ n: 'pim', i: 103, d: 'PIM' },
		{ n: 'ipcomp', i: 108, d: 'IPCOMP' },
		{ n: 'vrrp', i: 112, d: 'VRRP' },
		{ n: 'l2tp', i: 115, d: 'L2TP' },
		{ n: 'isis', i: 124, d: 'ISIS' },
		{ n: 'sctp', i: 132, d: 'SCTP' },
		{ n: 'fc', i: 133, d: 'FC' },
		{ n: 'mobility-header', i: 135, d: 'Mobility-Header' },
		{ n: 'udplite', i: 136, d: 'UDPLite' },
		{ n: 'mpls-in-ip', i: 137, d: 'MPLS-in-IP' },
		{ n: 'manet', i: 138, d: 'MANET' },
		{ n: 'hip', i: 139, d: 'HIP' },
		{ n: 'shim6', i: 140, d: 'Shim6' },
		{ n: 'wesp', i: 141, d: 'WESP' },
		{ n: 'rohc', i: 142, d: 'ROHC' },
	],

	replaceOption: function(s, tabName, optionClass, optionName, optionTitle, optionDescription) {
		var o = s.getOption(optionName);

		if (o) {
			if (o.tab) {
				s.tabs[o.tab].children = s.tabs[o.tab].children.filter(function(opt) {
					return opt.option != optionName;
				});
			}

			s.children = s.children.filter(function(opt) {
				return opt.option != optionName;
			});
		}

		return s.taboption(tabName, optionClass, optionName, optionTitle, optionDescription);
	},

	addDeviceOptions: function(s, dev, isNew) {
		var parent_dev = dev ? dev.getParent() : null,
		    devname = dev ? dev.getName() : null,
		    o, ss;

		s.tab('devgeneral', _('General device options'));
		s.tab('devadvanced', _('Advanced device options'));
		s.tab('brport', _('Bridge port specific options'));
		s.tab('bridgevlan', _('Bridge VLAN filtering'));

		o = this.replaceOption(s, 'devgeneral', form.ListValue, 'type', _('Device type'),
			!L.hasSystemFeature('bonding') && isNew ? '<a href="' + L.url("admin", "system", "package-manager", "?query=kmod-bonding") + '">'+
			 _('For bonding, install %s').format('<code>kmod-bonding</code>') + '</a>' : null);
		o.readonly = !isNew;
		o.value('', _('Network device'));
		if (L.hasSystemFeature('bonding')) {
			o.value('bonding', _('Bonding/Aggregation device'));
		}
		o.value('bridge', _('Bridge device'));
		o.value('8021q', _('VLAN (802.1q)'));
		o.value('8021ad', _('VLAN (802.1ad)'));
		o.value('macvlan', _('MAC VLAN'));
		o.value('veth', _('Virtual Ethernet'));
		o.validate = function(section_id, value) {
			if (value == 'bonding' || value == 'bridge' || value == 'veth')
				updatePlaceholders(this.section.getOption('name_complex'), section_id);

			return true;
		};

		o = this.replaceOption(s, 'devgeneral', widgets.DeviceSelect, 'name_simple', _('Existing device'));
		o.readonly = !isNew;
		o.rmempty = false;
		o.noaliases = true;
		o.default = (dev ? dev.getName() : '');
		o.ucioption = 'name';
		o.filter = function(section_id, value) {
			var dev = network.instantiateDevice(value);
			return !deviceSectionExists(section_id, value) && (dev.getType() != 'wifi' || dev.isUp());
		};
		o.validate = function(section_id, value) {
			updatePlaceholders(this, section_id);

			return deviceSectionExists(section_id, value)
				? _('A configuration for the device "%s" already exists').format(value) : true;
		};
		o.onchange = function(ev, section_id, values) {
			updatePlaceholders(this, section_id);
		};
		o.depends('type', '');

		o = this.replaceOption(s, 'devgeneral', widgets.DeviceSelect, 'ifname_single', _('Base device'));
		o.readonly = !isNew;
		o.rmempty = false;
		o.noaliases = true;
		o.default = (dev ? dev.getName() : '').match(/^.+\.\d+$/) ? dev.getName().replace(/\.\d+$/, '') : '';
		o.ucioption = 'ifname';
		o.filter = function(section_id, value) {
			var dev = network.instantiateDevice(value);
			return (dev.getType() != 'wifi' || dev.isUp());
		};
		o.validate = function(section_id, value) {
			updatePlaceholders(this, section_id);

			if (isNew) {
				var type = this.section.formvalue(section_id, 'type'),
				    name = this.section.getUIElement(section_id, 'name_complex');

				if (type == 'macvlan' && value && name && !name.isChanged()) {
					var i = 0;

					while (deviceSectionExists(section_id, '%smac%d'.format(value, i)))
						i++;

					name.setValue('%smac%d'.format(value, i));
					name.triggerValidation();
				}
			}

			return true;
		};
		o.onchange = function(ev, section_id, values) {
			updatePlaceholders(this, section_id);
		};
		o.depends('type', '8021q');
		o.depends('type', '8021ad');
		o.depends('type', 'macvlan');

		o = this.replaceOption(s, 'devgeneral', form.Value, 'vid', _('VLAN ID'));
		o.readonly = !isNew;
		o.datatype = 'range(1, 4094)';
		o.rmempty = false;
		o.default = (dev ? dev.getName() : '').match(/^.+\.\d+$/) ? dev.getName().replace(/^.+\./, '') : '';
		o.validate = function(section_id, value) {
			var base = this.section.formvalue(section_id, 'ifname_single'),
			    vid = this.section.formvalue(section_id, 'vid'),
			    name = this.section.getUIElement(section_id, 'name_complex');

			if (base && vid && name && !name.isChanged() && isNew) {
				name.setValue('%s.%d'.format(base, vid));
				name.triggerValidation();
			}

			return true;
		};
		o.depends('type', '8021q');
		o.depends('type', '8021ad');

		o = this.replaceOption(s, 'devgeneral', form.ListValue, 'mode', _('Mode'));
		o.value('vepa', _('VEPA (Virtual Ethernet Port Aggregator)', 'MACVLAN mode'));
		o.value('private', _('Private (Prevent communication between MAC VLANs)', 'MACVLAN mode'));
		o.value('bridge', _('Bridge (Support direct communication between MAC VLANs)', 'MACVLAN mode'));
		o.value('passthru', _('Pass-through (Mirror physical device to single MAC VLAN)', 'MACVLAN mode'));
		o.depends('type', 'macvlan');

		o = this.replaceOption(s, 'devgeneral', form.Value, 'name_complex', _('Device name'));
		o.rmempty = false;
		o.datatype = 'maxlength(15)';
		o.readonly = !isNew;
		o.ucioption = 'name';
		o.validate = function(section_id, value) {
			var dev = network.instantiateDevice(value);

			if (deviceSectionExists(section_id, value) || (isNew && (dev.dev || {}).idx))
				return _('The device name "%s" is already taken').format(value);

			return true;
		};
		o.depends({ type: '', '!reverse': true });

		o = this.replaceOption(s, 'devadvanced', form.DynamicList, 'ingress_qos_mapping', _('Ingress QoS mapping'), _('Defines a mapping of VLAN header priority to the Linux internal packet priority on incoming frames'));
		o.rmempty = true;
		o.validate = validateQoSMap;
		o.depends('type', '8021q');
		o.depends('type', '8021ad');

		o = this.replaceOption(s, 'devadvanced', form.DynamicList, 'egress_qos_mapping', _('Egress QoS mapping'), _('Defines a mapping of Linux internal packet priority to VLAN header priority but for outgoing frames'));
		o.rmempty = true;
		o.validate = validateQoSMap;
		o.depends('type', '8021q');
		o.depends('type', '8021ad');

		o = this.replaceOption(s, 'devgeneral', widgets.DeviceSelect, 'ifname_multi-bond', _('Aggregation ports'));
		o.size = 10;
		o.rmempty = true;
		o.multiple = true;
		o.noaliases = true;
		o.nobridges = true;
		o.ucioption = 'ports';
		o.default = L.toArray(dev ? dev.getPorts() : null).filter(function(p) { return p.getType() != 'wifi' }).map(function(p) { return p.getName() });
		o.filter = function(section_id, device_name) {
			var bridge_name = uci.get('network', section_id, 'name'),
				choice_dev = network.instantiateDevice(device_name),
				parent_dev = choice_dev.getParent();

			/* only show wifi networks which are already present in "option ifname" */
			if (choice_dev.getType() == 'wifi') {
				var ifnames = L.toArray(uci.get('network', section_id, 'ports'));

				for (var i = 0; i < ifnames.length; i++)
					if (ifnames[i] == device_name)
						return true;

				return false;
			}

			return (!parent_dev || parent_dev.getName() != bridge_name);
		};
		o.description = _('Specifies the wired ports to attach to this bonding.')
		o.onchange = function(ev, section_id, values) {
			ss.updatePorts(values);

			return ss.parse().then(function() {
				ss.redraw();
			});
		};
		o.depends('type', 'bonding');

		o = this.replaceOption(s, 'devgeneral', form.ListValue, 'policy', _('Bonding Policy'));
		o.default = 'active-backup';
		o.value('active-backup', _('Active backup'));
		o.value('balance-rr', _('Round robin'));
		o.value('balance-xor', _('Transmit hash - balance-xor'));
		o.value('broadcast', _('Broadcast'));
		o.value('802.3ad', _('LACP - 802.3ad'));
		o.value('balance-tlb', _('Adaptive transmit load balancing'));
		o.value('balance-alb', _('Adaptive load balancing'));
		o.cfgvalue = function(/* ... */) {
			var val = form.ListValue.prototype.cfgvalue.apply(this, arguments);

			switch (val || '') {
			case 'active-backup':
			case '0':
				return 'active-backup';

			case 'balance-rr':
			case '1':
				return 'balance-rr';

			case 'balance-xor':
			case '2':
				return 'balance-xor';

			case 'broadcast':
			case '3':
				return 'broadcast';

			case '802.3ad':
			case '4':
				return '802.3ad';

			case 'balance-tlb':
			case '5':
				return 'balance-tlb';

			case 'balance-alb':
			case '6':
				return 'balance-alb';

			default:
				return 'active-backup';
			}
		};
		o.depends('type', 'bonding');

		o = this.replaceOption(s, 'devgeneral', form.Flag, 'all_ports_active', _('All ports active'), _('Allow receiving on inactive ports'));
		o.default = o.disabled;
		o.depends('type', 'bonding');

		o = this.replaceOption(s, 'devgeneral', widgets.DeviceSelect, '_net_device_primary', _('Primary Device'));
		o.ucioption = 'primary';
		o.rmempty = true;
		o.noaliases = true;
		o.nobridges = true;
		o.optional = false;
		o.depends({'type': 'bonding', 'policy': 'active-backup'});

		o = this.replaceOption(s, 'devadvanced', form.ListValue, 'xmit_hash_policy', _('Slave selection hash policy'));
		o.default = '';
		o.value('', '');
		o.value('layer2', _('Layer 2'));
		o.value('layer2+3', _('Layer 2+3'));
		o.value('layer3+4', _('Layer 3+4'));
		o.value('encap2+3', _('Encap 2+3'));
		o.value('encap3+4', _('Encap 3+4'));
		o.cfgvalue = function(/* ... */) {
			var val = form.ListValue.prototype.cfgvalue.apply(this, arguments);

			switch (val || '') {
			case 'layer2':
			case '0':
				return 'layer2';

			case 'layer2+3':
			case '1':
				return 'layer2+3';

			case 'layer3+4':
			case '2':
				return 'layer3+4';

			case 'encap2+3':
			case '4':
				return 'encap2+3';

			case 'encap3+4':
			case '5':
				return 'encap3+4';

			default:
				return '';
			}
		};
		o.depends({'type': 'bonding', 'policy': 'balance-xor'});
		o.depends({'type': 'bonding', 'policy': '802.3ad'});
		o.depends({'type': 'bonding', 'policy': 'balance-tlb'});

		o = this.replaceOption(s, 'devadvanced', form.Value, 'ad_actor_system', _('MAC address for LACPDUs'));
		o.description = _('This specifies the mac-address for the actor in protocol packet exchanges (LACPDUs). The value cannot be NULL or multicast.');
		o.datatype = 'macaddr';
		o.depends({'type': 'bonding', 'policy': '802.3ad'});

		o = this.replaceOption(s, 'devadvanced', form.Value, 'ad_actor_sys_prio', _('Priority'));
		o.description = _('This specifies the AD system priority');
		o.placeholder = '65535';
		o.datatype = 'range(1, 65535)';
		o.depends({'type': 'bonding', 'policy': '802.3ad'});

		o = this.replaceOption(s, 'devadvanced', form.ListValue, 'ad_select', _('802.3ad aggregation logic'));
		o.default = '';
		o.value('', '');
		o.value('stable', _('Stable'));
		o.value('bandwidth', _('Bandwidth'));
		o.value('count', _('Count'));
		o.cfgvalue = function(/* ... */) {
			var val = form.ListValue.prototype.cfgvalue.apply(this, arguments);

			switch (val || '') {
			case 'stable':
			case '0':
				return 'stable';

			case 'bandwidth':
			case '1':
				return 'bandwidth';

			case 'count':
			case '2':
				return 'count';

			default:
				return '';
			}
		};
		o.depends({'type': 'bonding', 'policy': '802.3ad'});

		o = this.replaceOption(s, 'devadvanced', form.ListValue, 'lacp_rate', _('802.3ad LACPDU packet rate'));
		o.default = '';
		o.value('', '');
		o.value('slow', _('Slow (every 30 seconds)'));
		o.value('fast', _('Fast (every second)'));
		o.cfgvalue = function(/* ... */) {
			var val = form.ListValue.prototype.cfgvalue.apply(this, arguments);

			switch (val || '') {
			case 'slow':
			case '0':
				return 'slow';

			case 'fast':
			case '1':
				return 'fast';

			default:
				return '';
			}
		};
		o.depends({'type': 'bonding', 'policy': '802.3ad'});

		o = this.replaceOption(s, 'devadvanced', form.Value, 'min_links', _('Min Links'), _('Minimum number of active links'));
		o.placeholder = '1';
		o.datatype = 'uinteger';
		o.depends({'type': 'bonding', 'policy': '802.3ad'});

		o = this.replaceOption(s, 'devadvanced', form.Value, 'packets_per_slave', _('Packets per slave'));
		o.description = _('Number of packets to transmit through a slave before moving to the next one. Slave is chosen at random when 0.');
		o.placeholder = '1';
		o.datatype = 'range(1, 65535)';
		o.depends({'type': 'bonding', 'policy': 'balance-rr'});

		o = this.replaceOption(s, 'devadvanced', form.Value, 'lp_interval', _('Learning packets Interval'));
		o.description = _('Number of seconds between sent learning packets');
		o.placeholder = '1';
		o.datatype = 'uinteger';
		o.depends({'type': 'bonding', 'policy': 'balance-tlb'});
		o.depends({'type': 'bonding', 'policy': 'balance-alb'});

		o = this.replaceOption(s, 'devgeneral', form.Flag, 'dynamic_lb', _('Dynamic load balance'), _('distribute traffic according to port load'));
		o.default = o.disabled;
		o.depends({'type': 'bonding', 'policy': 'balance-tlb'});

		o = this.replaceOption(s, 'devadvanced', form.Value, 'resend_igmp', _('IGMP reports'));
		o.description = _('Specifies the number of IGMP membership reports to be issued after a failover event');
		o.placeholder = '1';
		o.datatype = 'range(0, 255)';
		o.depends('type', 'bonding');

		o = this.replaceOption(s, 'devadvanced', form.Value, 'num_peer_notif', _('Peer notifications'));
		o.description = _('Specify the number of peer notifications to be issued after a failover event.');
		o.placeholder = '1';
		o.datatype = 'range(0, 255)';
		o.depends('type', 'bonding');		

		o = this.replaceOption(s, 'devadvanced', form.ListValue, 'primary_reselect', _('Primary port reselection policy'));
		o.default = '';
		o.value('', '');
		o.value('always', _('Always'));
		o.value('better', _('Better'));
		o.value('failure', _('Failure'));
		o.cfgvalue = function(/* ... */) {
			var val = form.ListValue.prototype.cfgvalue.apply(this, arguments);

			switch (val || '') {
			case 'always':
			case '0':
				return 'always';

			case 'better':
			case '1':
				return 'better';

			case 'failure':
			case '2':
				return 'failure';

			default:
				return 'always';
			}
		};
		o.depends('type', 'bonding');

		o = this.replaceOption(s, 'devadvanced', form.ListValue, 'failover_mac', _('MAC address selection policy'));
		o.default = '';
		o.value('none', _('none'));
		o.value('active', _('Active'));
		o.value('follow', _('Follow'));
		o.cfgvalue = function(/* ... */) {
			var val = form.ListValue.prototype.cfgvalue.apply(this, arguments);

			switch (val || '') {
			case 'none':
			case '0':
				return 'none';

			case 'active':
			case '1':
				return 'active';

			case 'follow':
			case '2':
				return 'follow';

			default:
				return 'none';
			}
		};
		o.depends('type', 'bonding');

		o = this.replaceOption(s, 'devadvanced', form.ListValue, 'monitor_mode', _('Link monitoring mode'),
			!L.hasSystemFeature('mii_tool') ? '<a href="' + L.url("admin", "system", "package-manager", "?query=mii-tool") + '">'+
			 _('Install %s').format('<code>mii-tool</code>') + '</a>' : null);
		o.default = '';
		o.value('arp', _('ARP link monitoring'));
		o.value('mii', _('MII link monitoring'));
		o.cfgvalue = function(/* ... */) {
			var val = form.ListValue.prototype.cfgvalue.apply(this, arguments);

			switch (val || '') {
			case 'arp':
			case '1':
				return 'arp';

			case 'mii':
			case '2':
				return 'mii';

			default:
				return 'mii';
			}
		};
		o.depends('type', 'bonding');
		
		o = this.replaceOption(s, 'devadvanced', form.Value, 'monitor_interval', _('Monitor Interval'));
		o.description = _('Specifies the link monitoring frequency in milliseconds');
		o.placeholder = '100';
		o.datatype = 'uinteger';
		o.depends('type', 'bonding');

		o = this.replaceOption(s, 'devadvanced', form.DynamicList, 'arp_target', _('ARP monitor target IP address'));
		o.datatype = 'ipaddr';
		o.depends({'type': 'bonding', 'monitor_mode': 'arp'});

		o = this.replaceOption(s, 'devgeneral', form.Flag, 'arp_all_targets', _('All ARP Targets'), _('All ARP targets must be reachable to consider the link valid'));
		o.default = o.disabled;
		o.depends({'type': 'bonding', 'monitor_mode': 'arp'});

		o = this.replaceOption(s, 'devadvanced', form.ListValue, 'arp_validate', _('ARP validation policy'));
		o.default = '';
		o.value('none', _('None'));
		o.value('active', _('Active'));
		o.value('backup', _('Backup'));
		o.value('all', _('All'));
		o.value('filter', _('Filter'));
		o.value('filter_active', _('Filter active'));
		o.value('filter_backup', _('Filter backup'));
		o.cfgvalue = function(/* ... */) {
			var val = form.ListValue.prototype.cfgvalue.apply(this, arguments);

			switch (val || '') {
			case 'none':
			case '0':
				return 'none';

			case 'active':
			case '1':
				return 'active';

			case 'backup':
			case '2':
				return 'backup';

			case 'all':
			case '3':
				return 'all';

			case 'filter':
			case '4':
				return 'filter';

			case 'filter_active':
			case '5':
				return 'filter_active';

			case 'filter_backup':
			case '6':
				return 'filter_backup';

			default:
				return 'none';
			}
		};
		o.depends({'type': 'bonding', 'policy': 'balance-rr' , 'monitor_mode': 'arp'});
		o.depends({'type': 'bonding', 'policy': 'active-backup' , 'monitor_mode': 'arp'});
		o.depends({'type': 'bonding', 'policy': 'balance-xor' , 'monitor_mode': 'arp'});
		o.depends({'type': 'bonding', 'policy': 'broadcast' , 'monitor_mode': 'arp'});

		o = this.replaceOption(s, 'devadvanced', form.Flag, 'use_carrier', _('Use Carrier'), _('Use carrier status instead of MII result'));
		o.default = o.disabled;
		o.depends({'type': 'bonding', 'monitor_mode': 'mii'});

		o = this.replaceOption(s, 'devadvanced', form.Value, 'updelay', _('Monitor link-up delay'));
		o.description = _('Delay before enabling port after MII link up event (msec)');
		o.placeholder = '0';
		o.datatype = 'uinteger';
		o.depends({'type': 'bonding', 'monitor_mode': 'mii'});

		o = this.replaceOption(s, 'devadvanced', form.Value, 'downdelay', _('Monitor link-down delay'));
		o.description = _('Delay before enabling port after MII link down event (msec)');
		o.placeholder = '0';
		o.datatype = 'uinteger';
		o.depends({'type': 'bonding', 'monitor_mode': 'mii'});

		o = this.replaceOption(s, 'devgeneral', widgets.DeviceSelect, 'ifname_multi-bridge', _('Bridge ports'));
		o.size = 10;
		o.rmempty = true;
		o.multiple = true;
		o.noaliases = true;
		o.nobridges = true;
		o.ucioption = 'ports';
		o.default = L.toArray(dev ? dev.getPorts() : null).filter(function(p) { return p.getType() != 'wifi' }).map(function(p) { return p.getName() });
		o.filter = function(section_id, device_name) {
			var bridge_name = uci.get('network', section_id, 'name'),
				choice_dev = network.instantiateDevice(device_name),
				parent_dev = choice_dev.getParent();

			/* only show wifi networks which are already present in "option ifname" */
			if (choice_dev.getType() == 'wifi') {
				var ifnames = L.toArray(uci.get('network', section_id, 'ports'));

				for (var i = 0; i < ifnames.length; i++)
					if (ifnames[i] == device_name)
						return true;

				return false;
			}

			return (!parent_dev || parent_dev.getName() != bridge_name);
		};
		o.description = _('Specifies the wired ports to attach to this bridge. In order to attach wireless networks, choose the associated interface as network in the wireless settings.')
		o.onchange = function(ev, section_id, values) {
			ss.updatePorts(values);

			return ss.parse().then(function() {
				ss.redraw();
			});
		};
		o.depends('type', 'bridge');

		o = this.replaceOption(s, 'devgeneral', form.Flag, 'bridge_empty', _('Bring up empty bridge'), _('Bring up the bridge interface even if no ports are attached'));
		o.default = o.disabled;
		o.depends('type', 'bridge');

		o = this.replaceOption(s, 'devadvanced', form.Value, 'priority', _('Priority'));
		o.placeholder = '32767';
		o.datatype = 'range(0, 65535)';
		o.depends('type', 'bridge');

		o = this.replaceOption(s, 'devadvanced', form.Value, 'ageing_time', _('Ageing time'), _('Timeout in seconds for learned MAC addresses in the forwarding database'));
		o.placeholder = '30';
		o.datatype = 'uinteger';
		o.depends('type', 'bridge');

		o = this.replaceOption(s, 'devadvanced', form.Flag, 'stp', _('Enable <abbr title="Spanning Tree Protocol">STP</abbr>'), _('Enables the Spanning Tree Protocol on this bridge'));
		o.default = o.disabled;
		o.depends('type', 'bridge');

		o = this.replaceOption(s, 'devadvanced', form.Value, 'hello_time', _('Hello interval'), _('Interval in seconds for STP hello packets'));
		o.placeholder = '2';
		o.datatype = 'range(1, 10)';
		o.depends({ type: 'bridge', stp: '1' });

		o = this.replaceOption(s, 'devadvanced', form.Value, 'forward_delay', _('Forward delay'), _('Time in seconds to spend in listening and learning states'));
		o.placeholder = '15';
		o.datatype = 'range(2, 30)';
		o.depends({ type: 'bridge', stp: '1' });

		o = this.replaceOption(s, 'devadvanced', form.Value, 'max_age', _('Maximum age'), _('Timeout in seconds until topology updates on link loss'));
		o.placeholder = '20';
		o.datatype = 'range(6, 40)';
		o.depends({ type: 'bridge', stp: '1' });


		o = this.replaceOption(s, 'devadvanced', form.Flag, 'igmp_snooping', _('Enable <abbr title="Internet Group Management Protocol">IGMP</abbr> snooping'), _('Enables IGMP snooping on this bridge'));
		o.default = o.disabled;
		o.depends('type', 'bridge');

		o = this.replaceOption(s, 'devadvanced', form.Value, 'hash_max', _('Maximum snooping table size'));
		o.placeholder = '512';
		o.datatype = 'uinteger';
		o.depends({ type: 'bridge', igmp_snooping: '1' });

		o = this.replaceOption(s, 'devadvanced', form.Flag, 'multicast_querier', _('Enable multicast querier'));
		o.defaults = { '1': [{'igmp_snooping': '1'}], '0': [{'igmp_snooping': '0'}] };
		o.depends('type', 'bridge');

		o = this.replaceOption(s, 'devadvanced', form.Value, 'robustness', _('Robustness'), _('The robustness value allows tuning for the expected packet loss on the network. If a network is expected to be lossy, the robustness value may be increased. IGMP is robust to (Robustness-1) packet losses'));
		o.placeholder = '2';
		o.datatype = 'min(1)';
		o.depends({ type: 'bridge', multicast_querier: '1' });

		o = this.replaceOption(s, 'devadvanced', form.Value, 'query_interval', _('Query interval'), _('Interval in centiseconds between multicast general queries. By varying the value, an administrator may tune the number of IGMP messages on the subnet; larger values cause IGMP Queries to be sent less often'));
		o.placeholder = '12500';
		o.datatype = 'uinteger';
		o.depends({ type: 'bridge', multicast_querier: '1' });

		o = this.replaceOption(s, 'devadvanced', form.Value, 'query_response_interval', _('Query response interval'), _('The max response time in centiseconds inserted into the periodic general queries. By varying the value, an administrator may tune the burstiness of IGMP messages on the subnet; larger values make the traffic less bursty, as host responses are spread out over a larger interval'));
		o.placeholder = '1000';
		o.datatype = 'uinteger';
		o.validate = function(section_id, value) {
			var qiopt = L.toArray(this.map.lookupOption('query_interval', section_id))[0],
			    qival = qiopt ? (qiopt.formvalue(section_id) || qiopt.placeholder) : '';

			if (value != '' && qival != '' && +value >= +qival)
				return _('The query response interval must be lower than the query interval value');

			return true;
		};
		o.depends({ type: 'bridge', multicast_querier: '1' });

		o = this.replaceOption(s, 'devadvanced', form.Value, 'last_member_interval', _('Last member interval'), _('The max response time in centiseconds inserted into group-specific queries sent in response to leave group messages. It is also the amount of time between group-specific query messages. This value may be tuned to modify the "leave latency" of the network. A reduced value results in reduced time to detect the loss of the last member of a group'));
		o.placeholder = '100';
		o.datatype = 'uinteger';
		o.depends({ type: 'bridge', multicast_querier: '1' });

		o = this.replaceOption(s, 'devgeneral', form.Value, 'mtu', _('MTU'));
		o.datatype = 'range(576, 9200)';
		o.validate = function(section_id, value) {
			var parent_mtu = (dev && dev.getType() == 'vlan') ? (parent_dev ? parent_dev.getMTU() : null) : null;

			if (parent_mtu !== null && +value > parent_mtu)
				return _('The MTU must not exceed the parent device MTU of %d bytes').format(parent_mtu);

			return true;
		};

		o = this.replaceOption(s, 'devgeneral', form.Value, 'macaddr', _('MAC address'));
		o.datatype = 'macaddr';

		o = this.replaceOption(s, 'devgeneral', form.Value, 'peer_name', _('Peer device name'));
		o.rmempty = true;
		o.datatype = 'maxlength(15)';
		o.depends('type', 'veth');
		o.load = function(section_id) {
			var sections = uci.sections('network', 'device'),
			    idx = 0;

			for (var i = 0; i < sections.length; i++)
				if (sections[i]['.name'] == section_id)
					break;
				else if (sections[i].type == 'veth')
					idx++;

			this.placeholder = 'veth%d'.format(idx);

			return form.Value.prototype.load.apply(this, arguments);
		};

		o = this.replaceOption(s, 'devgeneral', form.Value, 'peer_macaddr', _('Peer MAC address'));
		o.rmempty = true;
		o.datatype = 'macaddr';
		o.depends('type', 'veth');

		o = this.replaceOption(s, 'devgeneral', form.Value, 'txqueuelen', _('TX queue length'));
		o.placeholder = dev ? dev._devstate('qlen') : '';
		o.datatype = 'uinteger';

		o = this.replaceOption(s, 'devadvanced', cbiFlagTristate, 'promisc', _('Enable promiscuous mode'));
		o.sysfs_default = (dev && dev.dev && dev.dev.flags) ? dev.dev.flags.promisc : null;

		o = this.replaceOption(s, 'devadvanced', form.ListValue, 'rpfilter', _('Reverse path filter'));
		o.default = '';
		o.value('', _('disabled'));
		o.value('loose', _('Loose filtering'));
		o.value('strict', _('Strict filtering'));
		o.cfgvalue = function(/* ... */) {
			var val = form.ListValue.prototype.cfgvalue.apply(this, arguments);

			switch (val || '') {
			case 'loose':
			case '1':
				return 'loose';

			case 'strict':
			case '2':
				return 'strict';

			default:
				return '';
			}
		};

		o = this.replaceOption(s, 'devadvanced', cbiFlagTristate, 'acceptlocal', _('Accept local'), _('Accept packets with local source addresses'));
		o.sysfs = '/proc/sys/net/ipv4/conf/%s/accept_local'.format(devname || 'default');

		o = this.replaceOption(s, 'devadvanced', cbiFlagTristate, 'sendredirects', _('Send ICMP redirects'));
		o.sysfs = '/proc/sys/net/ipv4/conf/%s/send_redirects'.format(devname || 'default');

		o = this.replaceOption(s, 'devadvanced', cbiFlagTristate, 'arp_accept', _('Honor gratuitous ARP'), _('When enabled, new ARP table entries are added from received gratuitous ARP requests or replies, otherwise only preexisting table entries are updated, but no new hosts are learned.'));
		o.sysfs = '/proc/sys/net/ipv4/conf/%s/arp_accept'.format(devname || 'default');

		o = this.replaceOption(s, 'devadvanced', cbiFlagTristate, 'drop_gratuitous_arp', _('Drop gratuitous ARP'), _('Drop all gratuitous ARP frames, for example if there’s a known good ARP proxy on the network and such frames need not be used or in the case of 802.11, must not be used to prevent attacks.'));
		o.sysfs = '/proc/sys/net/ipv4/conf/%s/drop_gratuitous_arp'.format(devname || 'default');

		o = this.replaceOption(s, 'devadvanced', form.Value, 'neighreachabletime', _('Neighbour cache validity'), _('Time in milliseconds'));
		o.placeholder = '30000';
		o.datatype = 'uinteger';

		o = this.replaceOption(s, 'devadvanced', form.Value, 'neighgcstaletime', _('Stale neighbour cache timeout'), _('Timeout in seconds'));
		o.placeholder = '60';
		o.datatype = 'uinteger';

		o = this.replaceOption(s, 'devadvanced', form.Value, 'neighlocktime', _('Minimum ARP validity time'), _('Minimum required time in seconds before an ARP entry may be replaced. Prevents ARP cache thrashing.'));
		o.placeholder = '0';
		o.datatype = 'uinteger';

		o = this.replaceOption(s, 'devgeneral', cbiFlagTristate, 'ipv6', _('Enable IPv6'));
		o.sysfs = '!/proc/sys/net/ipv6/conf/%s/disable_ipv6'.format(devname || 'default');

		o = this.replaceOption(s, 'devadvanced', cbiFlagTristate, 'ip6segmentrouting', _('Enable IPv6 segment routing'));
		o.sysfs = '/proc/sys/net/ipv6/conf/%s/seg6_enabled'.format(devname || 'default');
		o.depends('ipv6', /1/);

		o = this.replaceOption(s, 'devadvanced', cbiFlagTristate, 'drop_unsolicited_na', _('Drop unsolicited NA'), _('Drop all unsolicited neighbor advertisements, for example if there’s a known good NA proxy on the network and such frames need not be used or in the case of 802.11, must not be used to prevent attacks.'));
		o.sysfs = '/proc/sys/net/ipv6/conf/%s/drop_unsolicited_na'.format(devname || 'default');
		o.depends('ipv6', /1/);

		o = this.replaceOption(s, 'devgeneral', form.Value, 'mtu6', _('IPv6 MTU'));
		o.datatype = 'max(9200)';
		o.depends('ipv6', /1/);

		o = this.replaceOption(s, 'devgeneral', form.Value, 'dadtransmits', _('DAD transmits'), _('Amount of Duplicate Address Detection probes to send'));
		o.placeholder = '1';
		o.datatype = 'uinteger';
		o.depends('ipv6', /1/);


		o = this.replaceOption(s, 'devadvanced', cbiFlagTristate, 'multicast', _('Enable multicast support'));
		o.sysfs_default = (dev && dev.dev && dev.dev.flags) ? dev.dev.flags.multicast : null;

		o = this.replaceOption(s, 'devadvanced', form.ListValue, 'igmpversion', _('Force IGMP version'));
		o.value('', _('No enforcement'));
		o.value('1', _('Enforce IGMPv1'));
		o.value('2', _('Enforce IGMPv2'));
		o.value('3', _('Enforce IGMPv3'));
		o.depends('multicast', /1/);

		o = this.replaceOption(s, 'devadvanced', form.ListValue, 'mldversion', _('Force MLD version'));
		o.value('', _('No enforcement'));
		o.value('1', _('Enforce MLD version 1'));
		o.value('2', _('Enforce MLD version 2'));
		o.depends('multicast', /1/);

		if (isBridgePort(dev)) {
			o = this.replaceOption(s, 'brport', cbiFlagTristate, 'learning', _('Enable MAC address learning'));
			o.sysfs = '/sys/class/net/%s/brport/learning'.format(devname || 'default');

			o = this.replaceOption(s, 'brport', cbiFlagTristate, 'unicast_flood', _('Enable unicast flooding'));
			o.sysfs = '/sys/class/net/%s/brport/unicast_flood'.format(devname || 'default');

			o = this.replaceOption(s, 'brport', cbiFlagTristate, 'isolate', _('Port isolation'), _('Only allow communication with non-isolated bridge ports when enabled'));
			o.sysfs = '/sys/class/net/%s/brport/isolated'.format(devname || 'default');

			o = this.replaceOption(s, 'brport', form.ListValue, 'multicast_router', _('Multicast routing'));
			o.value('', _('Never'));
			o.value('1', _('Learn'));
			o.value('2', _('Always'));
			o.depends('multicast', /1/);

			o = this.replaceOption(s, 'brport', cbiFlagTristate, 'multicast_to_unicast', _('Multicast to unicast'), _('Forward multicast packets as unicast packets on this device.'));
			o.sysfs = '/sys/class/net/%s/brport/multicast_to_unicast'.format(devname || 'default');
			o.depends('multicast', /1/);

			o = this.replaceOption(s, 'brport', cbiFlagTristate, 'multicast_fast_leave', _('Enable multicast fast leave'));
			o.sysfs = '/sys/class/net/%s/brport/multicast_fast_leave'.format(devname || 'default');
			o.depends('multicast', /1/);

			o = this.replaceOption(s, 'brport', cbiFlagTristate, 'drop_v4_unicast_in_l2_multicast', _('Drop nested IPv4 unicast'), _('Drop layer 2 multicast frames containing IPv4 unicast packets.'));
			o.sysfs = '/proc/sys/net/ipv4/conf/%s/drop_unicast_in_l2_multicast'.format(devname || 'default');
			o.depends('multicast', /1/);

			o = this.replaceOption(s, 'brport', cbiFlagTristate, 'drop_v6_unicast_in_l2_multicast', _('Drop nested IPv6 unicast'), _('Drop layer 2 multicast frames containing IPv6 unicast packets.'));
			o.sysfs = '/proc/sys/net/ipv6/conf/%s/drop_unicast_in_l2_multicast'.format(devname || 'default');
			o.depends('multicast', /1/);
		}

		o = this.replaceOption(s, 'bridgevlan', form.Flag, 'vlan_filtering', _('Enable VLAN filtering'));
		o.depends('type', 'bridge');
		o.updateDefaultValue = function(section_id) {
			var device = uci.get('network', s.section, 'name'),
			    uielem = this.getUIElement(section_id),
			    has_vlans = false;

			uci.sections('network', 'bridge-vlan', function(bvs) {
				has_vlans = has_vlans || (bvs.device == device);
			});

			this.default = has_vlans ? this.enabled : this.disabled;

			if (uielem && !uielem.isChanged())
				uielem.setValue(this.default);
		};

		o = this.replaceOption(s, 'bridgevlan', form.SectionValue, 'bridge-vlan', form.TableSection, 'bridge-vlan');
		o.depends('type', 'bridge');

		ss = o.subsection;
		ss.addremove = true;
		ss.anonymous = true;

		ss.renderHeaderRows = function(/* ... */) {
			var node = form.TableSection.prototype.renderHeaderRows.apply(this, arguments);

			node.querySelectorAll('.th').forEach(function(th) {
				th.classList.add('left');
				th.classList.add('middle');
			});

			return node;
		};

		ss.filter = function(section_id) {
			var devname = uci.get('network', s.section, 'name');
			return (uci.get('network', section_id, 'device') == devname);
		};

		ss.render = function(/* ... */) {
			return form.TableSection.prototype.render.apply(this, arguments).then(L.bind(function(node) {
				node.style.overflow = 'auto hidden';
				node.style.paddingTop = '1em';

				if (this.node)
					this.node.parentNode.replaceChild(node, this.node);

				this.node = node;

				return node;
			}, this));
		};

		ss.redraw = function() {
			return this.load().then(L.bind(this.render, this));
		};

		ss.updatePorts = function(ports) {
			var devices = ports.map(function(port) {
				return network.instantiateDevice(port)
			}).filter(function(dev) {
				return dev.getType() != 'wifi' || dev.isUp();
			}).sort(function(a, b) {
				return L.naturalCompare(a.getName(), b.getName());
			});

			this.children = this.children.filter(function(opt) { return !opt.option.match(/^port_/) });

			for (var i = 0; i < devices.length; i++) {
				o = ss.option(cbiTagValue, 'port_%s'.format(sfh(devices[i].getName())), renderDevBadge(devices[i]), renderPortStatus(devices[i]));
				o.port = devices[i].getName();
			}

			var section_ids = this.cfgsections(),
			    device_names = devices.reduce(function(names, dev) { names[dev.getName()] = true; return names }, {});

			for (var i = 0; i < section_ids.length; i++) {
				var old_spec = L.toArray(uci.get('network', section_ids[i], 'ports')),
				    new_spec = old_spec.filter(function(spec) { return device_names[spec.replace(/:[ut*]+$/, '')] });

				if (old_spec.length != new_spec.length)
					uci.set('network', section_ids[i], 'ports', new_spec.length ? new_spec : null);
			}
		};

		ss.handleAdd = function(ev) {
			return s.parse().then(L.bind(function() {
				var device = uci.get('network', s.section, 'name'),
				    section_ids = this.cfgsections(),
				    section_id = null,
				    max_vlan_id = 0;

				if (!device)
					return;

				for (var i = 0; i < section_ids.length; i++) {
					var vid = +uci.get('network', section_ids[i], 'vlan');

					if (vid > max_vlan_id)
						max_vlan_id = vid;
				}

				section_id = uci.add('network', 'bridge-vlan');
				uci.set('network', section_id, 'device', device);
				uci.set('network', section_id, 'vlan', max_vlan_id + 1);

				s.children.forEach(function(opt) {
					switch (opt.option) {
					case 'type':
					case 'name_complex':
						var input = opt.map.findElement('id', 'widget.%s'.format(opt.cbid(s.section)));
						if (input)
							input.disabled = true;
						break;
					}
				});

				s.getOption('vlan_filtering').updateDefaultValue(s.section);

				s.map.addedVLANs = s.map.addedVLANs || [];
				s.map.addedVLANs.push(section_id);

				return this.redraw();
			}, this));
		};

		ss.handleRemove = function(section_id) {
			this.map.data.remove('network', section_id);
			s.map.addedVLANs = (s.map.addedVLANs || []).filter(function(sid) {
				return sid != section_id;
			});

			return this.redraw();
		};

		o = ss.option(form.Value, 'vlan', _('VLAN ID'));
		o.datatype = 'range(1, 4094)';

		o.renderWidget = function(/* ... */) {
			var node = form.Value.prototype.renderWidget.apply(this, arguments);

			node.style.width = '5em';

			return node;
		};

		o.validate = function(section_id, value) {
			var section_ids = this.section.cfgsections();

			for (var i = 0; i < section_ids.length; i++) {
				if (section_ids[i] == section_id)
					continue;

				if (uci.get('network', section_ids[i], 'vlan') == value)
					return _('The VLAN ID must be unique');
			}

			return true;
		};

		o = ss.option(form.Flag, 'local', _('Local'));
		o.default = o.enabled;

		var ports = [];

		var seen_ports = {};

		L.toArray(uci.get('network', s.section, 'ports')).forEach(function(port) {
			seen_ports[port] = true;
		});

		uci.sections('network', 'bridge-vlan', function(bvs) {
			if (uci.get('network', s.section, 'name') != bvs.device)
				return;

			L.toArray(bvs.ports).forEach(function(portspec) {
				var m = portspec.match(/^([^:]+)(?::[ut*]+)?$/);

				if (m)
					seen_ports[m[1]] = true;
			});
		});

		for (var port_name in seen_ports)
			ports.push(port_name);

		ss.updatePorts(ports);
	},

	updateDevBadge: updateDevBadge,
	updatePortStatus: updatePortStatus
});
