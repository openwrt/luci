'use strict';
'require ui';
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

function setIfActive(section_id, value) {
	if (this.isActive(section_id)) {
		uci.set('network', section_id, this.ucioption, value);

		/* Requires http://lists.openwrt.org/pipermail/openwrt-devel/2020-July/030397.html */
		if (false && this.option == 'ifname_multi') {
			var devname = this.section.formvalue(section_id, 'name_complex'),
			    m = devname ? devname.match(/^br-([A-Za-z0-9_]+)$/) : null;

			if (m && uci.get('network', m[1], 'type') == 'bridge') {
				uci.set('network', m[1], 'ifname', devname);
				uci.unset('network', m[1], 'type');
			}
		}
	}
}

function validateQoSMap(section_id, value) {
	if (value == '')
		return true;

	var m = value.match(/^(\d+):(\d+)$/);

	if (!m || +m[1] > 0xFFFFFFFF || +m[2] > 0xFFFFFFFF)
		return _('Expecting two priority values separated by a colon');

	return true;
}

function deviceSectionExists(section_id, devname, devtype) {
	var exists = false;

	uci.sections('network', 'device', function(ss) {
		exists = exists || (ss['.name'] != section_id && ss.name == devname && (!devtype || devtype == ss.type));
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

function renderDevBadge(dev) {
	var type = dev.getType(), up = dev.isUp();

	return E('span', { 'class': 'ifacebadge', 'style': 'font-weight:normal' }, [
		E('img', {
			'class': 'middle',
			'src': L.resource('icons/%s%s.png').format(type, up ? '' : '_disabled')
		}),
		'\x0a', dev.getName()
	]);
}

function lookupDevName(s, section_id) {
	var typeui = s.getUIElement(section_id, 'type'),
	    typeval = typeui ? typeui.getValue() : s.cfgvalue(section_id, 'type'),
	    ifnameui = s.getUIElement(section_id, 'ifname_single'),
	    ifnameval = ifnameui ? ifnameui.getValue() : s.cfgvalue(section_id, 'ifname_single');

	return (typeval == 'bridge') ? 'br-%s'.format(section_id) : ifnameval;
}

function lookupDevSection(s, section_id, autocreate) {
	var devname = lookupDevName(s, section_id),
	    devsection = null;

	uci.sections('network', 'device', function(ds) {
		if (ds.name == devname)
			devsection = ds['.name'];
	});

	if (autocreate && !devsection) {
		devsection = uci.add('network', 'device');
		uci.set('network', devsection, 'name', devname);
	}

	return devsection;
}

function getDeviceValue(dev, method) {
	if (dev && dev.getL3Device)
		dev = dev.getL3Device();

	if (dev && typeof(dev[method]) == 'function')
		return dev[method].apply(dev);

	return '';
}

function deviceCfgValue(section_id) {
	if (arguments.length == 2)
		return;

	var ds = lookupDevSection(this.section, section_id, false);

	return (ds ? uci.get('network', ds, this.option) : null) ||
		uci.get('network', section_id, this.option) ||
		this.default;
}

function deviceWrite(section_id, formvalue) {
	var ds = lookupDevSection(this.section, section_id, true);

	uci.set('network', ds, this.option, formvalue);
	uci.unset('network', section_id, this.option);
}

function deviceRemove(section_id) {
	var ds = lookupDevSection(this.section, section_id, false),
	    sv = ds ? uci.get('network', ds) : null;

	if (sv) {
		var empty = true;

		for (var opt in sv) {
			if (opt.charAt(0) == '.' || opt == 'name' || opt == this.option)
				continue;

			empty = false;
		}

		if (empty)
			uci.remove('network', ds);
		else
			uci.unset('network', ds, this.option);
	}

	uci.unset('network', section_id, this.option);
}

function deviceRefresh(section_id) {
	var dev = network.instantiateDevice(lookupDevName(this.section, section_id)),
	    uielem = this.getUIElement(section_id);

	if (uielem) {
		switch (this.option) {
		case 'mtu':
		case 'mtu6':
			uielem.setPlaceholder(dev.getMTU());
			break;

		case 'macaddr':
			uielem.setPlaceholder(dev.getMAC());
			break;
		}

		uielem.setValue(this.cfgvalue(section_id));
	}
}


var cbiTagValue = form.Value.extend({
	renderWidget: function(section_id, option_index, cfgvalue) {
		var widget = new ui.Dropdown(cfgvalue || ['-'], {
			'-': E([], [
				E('span', { 'class': 'hide-open', 'style': 'font-family:monospace' }, [ '—' ]),
				E('span', { 'class': 'hide-close' }, [ _('Do not participate', 'VLAN port state') ])
			]),
			'u': E([], [
				E('span', { 'class': 'hide-open', 'style': 'font-family:monospace' }, [ 'u' ]),
				E('span', { 'class': 'hide-close' }, [ _('Egress untagged', 'VLAN port state') ])
			]),
			't': E([], [
				E('span', { 'class': 'hide-open', 'style': 'font-family:monospace' }, [ 't' ]),
				E('span', { 'class': 'hide-close' }, [ _('Egress tagged', 'VLAN port state') ])
			]),
			'*': E([], [
				E('span', { 'class': 'hide-open', 'style': 'font-family:monospace' }, [ '*' ]),
				E('span', { 'class': 'hide-close' }, [ _('Primary VLAN ID', 'VLAN port state') ])
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
		var pname = this.port,
		    spec = L.toArray(uci.get('network', section_id, 'ports')).filter(function(p) { return p.replace(/:[ut*]+$/, '') == pname })[0];

		if (spec && spec.match(/t/))
			return spec.match(/\*/) ? ['t', '*'] : ['t'];
		else if (spec)
			return spec.match(/\*/) ? ['u', '*'] : ['u'];
		else
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

		uci.set('network', section_id, 'ports', ports);
	},

	remove: function() {}
});

return baseclass.extend({
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

	addOption: function(s, tabName, optionClass, optionName, optionTitle, optionDescription) {
		var o = this.replaceOption(s, tabName, optionClass, optionName, optionTitle, optionDescription);

		if (s.sectiontype == 'interface' && optionName != 'type' && optionName != 'vlan_filtering') {
			o.cfgvalue = deviceCfgValue;
			o.write = deviceWrite;
			o.remove = deviceRemove;
			o.refresh = deviceRefresh;
		}

		return o;
	},

	addDeviceOptions: function(s, dev, isNew) {
		var isIface = (s.sectiontype == 'interface'),
		    ifc = isIface ? network.instantiateNetwork(s.section) : null,
		    gensection = ifc ? 'physical' : 'devgeneral',
		    advsection = ifc ? 'physical' : 'devadvanced',
		    simpledep = ifc ? { type: '', ifname_single: /^[^@]/ } : { type: '' },
		    disableLegacyBridging = isIface && deviceSectionExists(null, 'br-%s'.format(ifc.getName()), 'bridge'),
		    o, ss;

		/* If an externally configured br-xxx interface already exists,
		 * then disable legacy bridge configuration */
		if (disableLegacyBridging) {
			o = this.addOption(s, gensection, form.HiddenValue, 'type');
			o.cfgvalue = function() { return '' };
		}
		else if (isIface) {
			var type;

			type = this.addOption(s, gensection, form.Flag, 'type', _('Bridge interfaces'), _('Creates a bridge over specified interface(s)'));
			type.modalonly = true;
			type.disabled = '';
			type.enabled = 'bridge';
			type.write = type.remove = function(section_id, value) {
				var protoname = this.section.formvalue(section_id, 'proto'),
				    protocol = network.getProtocol(protoname),
				    new_ifnames = this.isActive(section_id) ? L.toArray(this.section.formvalue(section_id, value ? 'ifname_multi' : 'ifname_single')) : [];

				if (!protocol.isVirtual() && !this.isActive(section_id))
					return;

				var old_ifnames = [],
				    devs = ifc.getDevices() || L.toArray(ifc.getDevice());

				for (var i = 0; i < devs.length; i++)
					old_ifnames.push(devs[i].getName());

				if (!value)
					new_ifnames.length = Math.max(new_ifnames.length, 1);

				old_ifnames.sort();
				new_ifnames.sort();

				for (var i = 0; i < Math.max(old_ifnames.length, new_ifnames.length); i++) {
					if (old_ifnames[i] != new_ifnames[i]) {
						// backup_ifnames()
						for (var j = 0; j < old_ifnames.length; j++)
							ifc.deleteDevice(old_ifnames[j]);

						for (var j = 0; j < new_ifnames.length; j++)
							ifc.addDevice(new_ifnames[j]);

						break;
					}
				}

				if (value)
					uci.set('network', section_id, 'type', 'bridge');
				else
					uci.unset('network', section_id, 'type');
			};
		}
		else {
			s.tab('devgeneral', _('General device options'));
			s.tab('devadvanced', _('Advanced device options'));
			s.tab('brport', _('Bridge port specific options'));
			s.tab('bridgevlan', _('Bridge VLAN filtering'));

			o = this.addOption(s, gensection, form.ListValue, 'type', _('Device type'));
			o.readonly = !isNew;
			o.value('', _('Network device'));
			o.value('bridge', _('Bridge device'));
			o.value('8021q', _('VLAN (802.1q)'));
			o.value('8021ad', _('VLAN (802.1ad)'));
			o.value('macvlan', _('MAC VLAN'));
			o.value('veth', _('Virtual Ethernet'));

			o = this.addOption(s, gensection, widgets.DeviceSelect, 'name_simple', _('Existing device'));
			o.readonly = !isNew;
			o.rmempty = false;
			o.noaliases = true;
			o.default = (dev ? dev.getName() : '');
			o.ucioption = 'name';
			o.write = o.remove = setIfActive;
			o.filter = function(section_id, value) {
				return !deviceSectionExists(section_id, value);
			};
			o.validate = function(section_id, value) {
				return deviceSectionExists(section_id, value) ? _('A configuration for the device "%s" already exists').format(value) : true;
			};
			o.depends('type', '');
		}

		o = this.addOption(s, gensection, widgets.DeviceSelect, 'ifname_single', isIface ? _('Interface') : _('Base device'));
		o.readonly = !isNew;
		o.rmempty = false;
		o.noaliases = !isIface;
		o.default = (dev ? dev.getName() : '').match(/^.+\.\d+$/) ? dev.getName().replace(/\.\d+$/, '') : '';
		o.ucioption = 'ifname';
		o.validate = function(section_id, value) {
			var type = this.section.formvalue(section_id, 'type'),
			    name = this.section.getUIElement(section_id, 'name_complex');

			if (type == 'macvlan' && value && name && !name.isChanged()) {
				var i = 0;

				while (deviceSectionExists(section_id, '%smac%d'.format(value, i)))
					i++;

				name.setValue('%smac%d'.format(value, i));
				name.triggerValidation();
			}

			return true;
		};
		if (isIface) {
			o.write = o.remove = function() {};
			o.cfgvalue = function(section_id) {
				return (ifc.getDevices() || L.toArray(ifc.getDevice())).map(function(dev) {
					return dev.getName();
				});
			};
			o.onchange = function(ev, section_id, values) {
				for (var i = 0, co; (co = this.section.children[i]) != null; i++)
					if (co !== this && co.refresh)
						co.refresh(section_id);

			};
			o.depends('type', '');
		}
		else {
			o.write = o.remove = setIfActive;
			o.depends('type', '8021q');
			o.depends('type', '8021ad');
			o.depends('type', 'macvlan');
		}

		o = this.addOption(s, gensection, form.Value, 'vid', _('VLAN ID'));
		o.readonly = !isNew;
		o.datatype = 'range(1, 4094)';
		o.rmempty = false;
		o.default = (dev ? dev.getName() : '').match(/^.+\.\d+$/) ? dev.getName().replace(/^.+\./, '') : '';
		o.validate = function(section_id, value) {
			var base = this.section.formvalue(section_id, 'ifname_single'),
			    vid = this.section.formvalue(section_id, 'vid'),
			    name = this.section.getUIElement(section_id, 'name_complex');

			if (base && vid && name && !name.isChanged()) {
				name.setValue('%s.%d'.format(base, vid));
				name.triggerValidation();
			}

			return true;
		};
		o.depends('type', '8021q');
		o.depends('type', '8021ad');

		o = this.addOption(s, gensection, form.ListValue, 'mode', _('Mode'));
		o.value('vepa', _('VEPA (Virtual Ethernet Port Aggregator)', 'MACVLAN mode'));
		o.value('private', _('Private (Prevent communication between MAC VLANs)', 'MACVLAN mode'));
		o.value('bridge', _('Bridge (Support direct communication between MAC VLANs)', 'MACVLAN mode'));
		o.value('passthru', _('Pass-through (Mirror physical device to single MAC VLAN)', 'MACVLAN mode'));
		o.depends('type', 'macvlan');

		if (!isIface) {
			o = this.addOption(s, gensection, form.Value, 'name_complex', _('Device name'));
			o.rmempty = false;
			o.datatype = 'maxlength(15)';
			o.readonly = !isNew;
			o.ucioption = 'name';
			o.write = o.remove = setIfActive;
			o.validate = function(section_id, value) {
				return deviceSectionExists(section_id, value) ? _('The device name "%s" is already taken').format(value) : true;
			};
			o.depends({ type: '', '!reverse': true });
		}

		o = this.addOption(s, advsection, form.DynamicList, 'ingress_qos_mapping', _('Ingress QoS mapping'), _('Defines a mapping of VLAN header priority to the Linux internal packet priority on incoming frames'));
		o.rmempty = true;
		o.validate = validateQoSMap;
		o.depends('type', '8021q');
		o.depends('type', '8021ad');

		o = this.addOption(s, advsection, form.DynamicList, 'egress_qos_mapping', _('Egress QoS mapping'), _('Defines a mapping of Linux internal packet priority to VLAN header priority but for outgoing frames'));
		o.rmempty = true;
		o.validate = validateQoSMap;
		o.depends('type', '8021q');
		o.depends('type', '8021ad');

		o = this.addOption(s, gensection, widgets.DeviceSelect, 'ifname_multi', _('Bridge ports'));
		o.size = 10;
		o.rmempty = true;
		o.multiple = true;
		o.noaliases = true;
		o.nobridges = true;
		o.ucioption = 'ifname';
		if (isIface) {
			o.write = o.remove = function() {};
			o.cfgvalue = function(section_id) {
				return (ifc.getDevices() || L.toArray(ifc.getDevice())).map(function(dev) { return dev.getName() });
			};
		}
		else {
			o.write = o.remove = setIfActive;
			o.default = L.toArray(dev ? dev.getPorts() : null).filter(function(p) { return p.getType() != 'wifi' }).map(function(p) { return p.getName() });
			o.filter = function(section_id, device_name) {
				var bridge_name = uci.get('network', section_id, 'name'),
				    choice_dev = network.instantiateDevice(device_name),
				    parent_dev = choice_dev.getParent();

				/* only show wifi networks which are already present in "option ifname" */
				if (choice_dev.getType() == 'wifi') {
					var ifnames = L.toArray(uci.get('network', section_id, 'ifname'));

					for (var i = 0; i < ifnames.length; i++)
						if (ifnames[i] == device_name)
							return true;

					return false;
				}

				return (!parent_dev || parent_dev.getName() != bridge_name);
			};
			o.description = _('Specifies the wired ports to attach to this bridge. In order to attach wireless networks, choose the associated interface as network in the wireless settings.')
		}
		o.onchange = function(ev, section_id, values) {
			ss.updatePorts(values);

			return ss.parse().then(function() {
				ss.redraw();
			});
		};
		o.depends('type', 'bridge');

		o = this.replaceOption(s, gensection, form.Flag, 'bridge_empty', _('Bring up empty bridge'), _('Bring up the bridge interface even if no ports are attached'));
		o.default = o.disabled;
		o.depends('type', 'bridge');

		o = this.replaceOption(s, advsection, form.Value, 'priority', _('Priority'));
		o.placeholder = '32767';
		o.datatype = 'range(0, 65535)';
		o.depends('type', 'bridge');

		o = this.replaceOption(s, advsection, form.Value, 'ageing_time', _('Ageing time'), _('Timeout in seconds for learned MAC addresses in the forwarding database'));
		o.placeholder = '30';
		o.datatype = 'uinteger';
		o.depends('type', 'bridge');

		o = this.replaceOption(s, advsection, form.Flag, 'stp', _('Enable <abbr title="Spanning Tree Protocol">STP</abbr>'), _('Enables the Spanning Tree Protocol on this bridge'));
		o.default = o.disabled;
		o.depends('type', 'bridge');

		o = this.replaceOption(s, advsection, form.Value, 'hello_time', _('Hello interval'), _('Interval in seconds for STP hello packets'));
		o.placeholder = '2';
		o.datatype = 'range(1, 10)';
		o.depends({ type: 'bridge', stp: '1' });

		o = this.replaceOption(s, advsection, form.Value, 'forward_delay', _('Forward delay'), _('Time in seconds to spend in listening and learning states'));
		o.placeholder = '15';
		o.datatype = 'range(2, 30)';
		o.depends({ type: 'bridge', stp: '1' });

		o = this.replaceOption(s, advsection, form.Value, 'max_age', _('Maximum age'), _('Timeout in seconds until topology updates on link loss'));
		o.placeholder = '20';
		o.datatype = 'range(6, 40)';
		o.depends({ type: 'bridge', stp: '1' });


		o = this.replaceOption(s, advsection, form.Flag, 'igmp_snooping', _('Enable <abbr title="Internet Group Management Protocol">IGMP</abbr> snooping'), _('Enables IGMP snooping on this bridge'));
		o.default = o.disabled;
		o.depends('type', 'bridge');

		o = this.replaceOption(s, advsection, form.Value, 'hash_max', _('Maximum snooping table size'));
		o.placeholder = '512';
		o.datatype = 'uinteger';
		o.depends({ type: 'bridge', igmp_snooping: '1' });

		o = this.replaceOption(s, advsection, form.Flag, 'multicast_querier', _('Enable multicast querier'));
		o.defaults = { '1': [{'igmp_snooping': '1'}], '0': [{'igmp_snooping': '0'}] };
		o.depends('type', 'bridge');

		o = this.replaceOption(s, advsection, form.Value, 'robustness', _('Robustness'), _('The robustness value allows tuning for the expected packet loss on the network. If a network is expected to be lossy, the robustness value may be increased. IGMP is robust to (Robustness-1) packet losses'));
		o.placeholder = '2';
		o.datatype = 'min(1)';
		o.depends({ type: 'bridge', multicast_querier: '1' });

		o = this.replaceOption(s, advsection, form.Value, 'query_interval', _('Query interval'), _('Interval in centiseconds between multicast general queries. By varying the value, an administrator may tune the number of IGMP messages on the subnet; larger values cause IGMP Queries to be sent less often'));
		o.placeholder = '12500';
		o.datatype = 'uinteger';
		o.depends({ type: 'bridge', multicast_querier: '1' });

		o = this.replaceOption(s, advsection, form.Value, 'query_response_interval', _('Query response interval'), _('The max response time in centiseconds inserted into the periodic general queries. By varying the value, an administrator may tune the burstiness of IGMP messages on the subnet; larger values make the traffic less bursty, as host responses are spread out over a larger interval'));
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

		o = this.replaceOption(s, advsection, form.Value, 'last_member_interval', _('Last member interval'), _('The max response time in centiseconds inserted into group-specific queries sent in response to leave group messages. It is also the amount of time between group-specific query messages. This value may be tuned to modify the "leave latency" of the network. A reduced value results in reduced time to detect the loss of the last member of a group'));
		o.placeholder = '100';
		o.datatype = 'uinteger';
		o.depends({ type: 'bridge', multicast_querier: '1' });

		o = this.addOption(s, gensection, form.Value, 'mtu', _('MTU'));
		o.placeholder = getDeviceValue(ifc || dev, 'getMTU');
		o.datatype = 'max(9200)';
		o.depends(simpledep);

		o = this.addOption(s, gensection, form.Value, 'macaddr', _('MAC address'));
		o.placeholder = getDeviceValue(ifc || dev, 'getMAC');
		o.datatype = 'macaddr';
		o.depends(simpledep);
		o.depends('type', 'macvlan');
		o.depends('type', 'veth');

		o = this.addOption(s, gensection, form.Value, 'peer_name', _('Peer device name'));
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

		o = this.addOption(s, gensection, form.Value, 'peer_macaddr', _('Peer MAC address'));
		o.rmempty = true;
		o.datatype = 'macaddr';
		o.depends('type', 'veth');

		o = this.addOption(s, gensection, form.Value, 'txqueuelen', _('TX queue length'));
		o.placeholder = dev ? dev._devstate('qlen') : '';
		o.datatype = 'uinteger';
		o.depends(simpledep);

		o = this.addOption(s, advsection, form.Flag, 'promisc', _('Enable promiscious mode'));
		o.default = o.disabled;
		o.depends(simpledep);

		o = this.addOption(s, advsection, form.ListValue, 'rpfilter', _('Reverse path filter'));
		o.default = '';
		o.value('', _('disabled'));
		o.value('loose', _('Loose filtering'));
		o.value('strict', _('Strict filtering'));
		o.cfgvalue = function(section_id) {
			var val = form.ListValue.prototype.cfgvalue.apply(this, [section_id]);

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
		o.depends(simpledep);

		o = this.addOption(s, advsection, form.Flag, 'acceptlocal', _('Accept local'), _('Accept packets with local source addresses'));
		o.default = o.disabled;
		o.depends(simpledep);

		o = this.addOption(s, advsection, form.Flag, 'sendredirects', _('Send ICMP redirects'));
		o.default = o.enabled;
		o.depends(simpledep);

		o = this.addOption(s, advsection, form.Value, 'neighreachabletime', _('Neighbour cache validity'), _('Time in milliseconds'));
		o.placeholder = '30000';
		o.datatype = 'uinteger';
		o.depends(simpledep);

		o = this.addOption(s, advsection, form.Value, 'neighgcstaletime', _('Stale neighbour cache timeout'), _('Timeout in seconds'));
		o.placeholder = '60';
		o.datatype = 'uinteger';
		o.depends(simpledep);

		o = this.addOption(s, advsection, form.Value, 'neighlocktime', _('Minimum ARP validity time'), _('Minimum required time in seconds before an ARP entry may be replaced. Prevents ARP cache thrashing.'));
		o.placeholder = '0';
		o.datatype = 'uinteger';
		o.depends(simpledep);

		o = this.addOption(s, gensection, form.Flag, 'ipv6', _('Enable IPv6'));
		o.default = o.enabled;
		o.depends(simpledep);

		o = this.addOption(s, gensection, form.Value, 'mtu6', _('IPv6 MTU'));
		o.placeholder = getDeviceValue(ifc || dev, 'getMTU');
		o.datatype = 'max(9200)';
		o.depends(Object.assign({ ipv6: '1' }, simpledep));

		o = this.addOption(s, gensection, form.Value, 'dadtransmits', _('DAD transmits'), _('Amount of Duplicate Address Detection probes to send'));
		o.placeholder = '1';
		o.datatype = 'uinteger';
		o.depends(Object.assign({ ipv6: '1' }, simpledep));


		o = this.addOption(s, advsection, form.Flag, 'multicast', _('Enable multicast support'));
		o.default = o.enabled;
		o.depends(simpledep);

		o = this.addOption(s, advsection, form.ListValue, 'igmpversion', _('Force IGMP version'));
		o.value('', _('No enforcement'));
		o.value('1', _('Enforce IGMPv1'));
		o.value('2', _('Enforce IGMPv2'));
		o.value('3', _('Enforce IGMPv3'));
		o.depends(Object.assign({ multicast: '1' }, simpledep));

		o = this.addOption(s, advsection, form.ListValue, 'mldversion', _('Force MLD version'));
		o.value('', _('No enforcement'));
		o.value('1', _('Enforce MLD version 1'));
		o.value('2', _('Enforce MLD version 2'));
		o.depends(Object.assign({ multicast: '1' }, simpledep));

		if (isBridgePort(dev)) {
			o = this.addOption(s, 'brport', form.Flag, 'learning', _('Enable MAC address learning'));
			o.default = o.enabled;
			o.depends(simpledep);

			o = this.addOption(s, 'brport', form.Flag, 'unicast_flood', _('Enable unicast flooding'));
			o.default = o.enabled;
			o.depends(simpledep);

			o = this.addOption(s, 'brport', form.Flag, 'isolated', _('Port isolation'), _('Only allow communication with non-isolated bridge ports when enabled'));
			o.default = o.disabled;
			o.depends(simpledep);

			o = this.addOption(s, 'brport', form.ListValue, 'multicast_router', _('Multicast routing'));
			o.value('', _('Never'));
			o.value('1', _('Learn'));
			o.value('2', _('Always'));
			o.depends(Object.assign({ multicast: '1' }, simpledep));

			o = this.addOption(s, 'brport', form.Flag, 'multicast_to_unicast', _('Multicast to unicast'), _('Forward multicast packets as unicast packets on this device.'));
			o.default = o.disabled;
			o.depends(Object.assign({ multicast: '1' }, simpledep));

			o = this.addOption(s, 'brport', form.Flag, 'multicast_fast_leave', _('Enable multicast fast leave'));
			o.default = o.disabled;
			o.depends(Object.assign({ multicast: '1' }, simpledep));
		}

		o = this.addOption(s, 'bridgevlan', form.Flag, 'vlan_filtering', _('Enable VLAN filterering'));
		o.depends('type', 'bridge');
		o.updateDefaultValue = function(section_id) {
			var device = isIface ? 'br-%s'.format(s.section) : uci.get('network', s.section, 'name'),
			    uielem = this.getUIElement(section_id),
			    has_vlans = false;

			uci.sections('network', 'bridge-vlan', function(bvs) {
				has_vlans = has_vlans || (bvs.device == device);
			});

			this.default = has_vlans ? this.enabled : this.disabled;

			if (uielem && !uielem.isChanged())
				uielem.setValue(this.default);
		};

		o = this.addOption(s, 'bridgevlan', form.SectionValue, 'bridge-vlan', form.TableSection, 'bridge-vlan');
		o.depends('type', 'bridge');
		o.renderWidget = function(/* ... */) {
			return form.SectionValue.prototype.renderWidget.apply(this, arguments).then(L.bind(function(node) {
				node.style.overflowX = 'auto';
				node.style.overflowY = 'visible';
				node.style.paddingBottom = '100px';
				node.style.marginBottom = '-100px';

				return node;
			}, this));
		};

		ss = o.subsection;
		ss.addremove = true;
		ss.anonymous = true;

		ss.renderHeaderRows = function(/* ... */) {
			var node = form.TableSection.prototype.renderHeaderRows.apply(this, arguments);

			node.querySelectorAll('.th').forEach(function(th) {
				th.classList.add('middle');
			});

			return node;
		};

		ss.filter = function(section_id) {
			var devname = isIface ? 'br-%s'.format(s.section) : uci.get('network', s.section, 'name');
			return (uci.get('network', section_id, 'device') == devname);
		};

		ss.render = function(/* ... */) {
			return form.TableSection.prototype.render.apply(this, arguments).then(L.bind(function(node) {
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
			});

			this.children = this.children.filter(function(opt) { return !opt.option.match(/^port_/) });

			for (var i = 0; i < devices.length; i++) {
				o = ss.option(cbiTagValue, 'port_%s'.format(sfh(devices[i].getName())), renderDevBadge(devices[i]));
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
				var device = isIface ? 'br-%s'.format(s.section) : uci.get('network', s.section, 'name'),
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

				return this.redraw();
			}, this));
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

		/* Do not touch bridge port state from interface config if legacy
		 * bridge config is disabled due to explicitely declared br-xxx
		 * device section... */
		if (disableLegacyBridging)
			return;

		var ports = [];

		if (isIface) {
			Array.prototype.push.apply(ports, L.toArray(ifc.getDevices() || ifc.getDevice()).map(function(dev) {
				return dev.getName();
			}));
		}
		else {
			var seen_ports = {};

			L.toArray(uci.get('network', s.section, 'ifname')).forEach(function(ifname) {
				seen_ports[ifname] = true;
			});

			uci.sections('network', 'bridge-vlan', function(bvs) {
				L.toArray(bvs.ports).forEach(function(portspec) {
					var m = portspec.match(/^([^:]+)(?::[ut*]+)?$/);

					if (m)
						seen_ports[m[1]] = true;
				});
			});

			for (var port_name in seen_ports)
				ports.push(port_name);
		}

		ports.sort();

		ss.updatePorts(ports);
	}
});
