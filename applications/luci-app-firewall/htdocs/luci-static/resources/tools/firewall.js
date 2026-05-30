'use strict';
'require baseclass';
'require dom';
'require ui';
'require uci';
'require form';
'require network';
'require firewall';
'require validation';
'require tools.prng as random';

const protocols = [
	'ip', 0, 'IP',
	'hopopt', 0, 'HOPOPT',
	'icmp', 1, 'ICMP',
	'igmp', 2, 'IGMP',
	'ggp', 3 , 'GGP',
	'ipencap', 4, 'IP-ENCAP',
	'st', 5, 'ST',
	'tcp', 6, 'TCP',
	'egp', 8, 'EGP',
	'igp', 9, 'IGP',
	'pup', 12, 'PUP',
	'udp', 17, 'UDP',
	'hmp', 20, 'HMP',
	'xns-idp', 22, 'XNS-IDP',
	'rdp', 27, 'RDP',
	'iso-tp4', 29, 'ISO-TP4',
	'dccp', 33, 'DCCP',
	'xtp', 36, 'XTP',
	'ddp', 37, 'DDP',
	'idpr-cmtp', 38, 'IDPR-CMTP',
	'ipv6', 41, 'IPv6',
	'ipv6-route', 43, 'IPv6-Route',
	'ipv6-frag', 44, 'IPv6-Frag',
	'idrp', 45, 'IDRP',
	'rsvp', 46, 'RSVP',
	'gre', 47, 'GRE',
	'esp', 50, 'IPSEC-ESP',
	'ah', 51, 'IPSEC-AH',
	'skip', 57, 'SKIP',
	'icmpv6', 58, 'IPv6-ICMP',
	'ipv6-icmp', 58, 'IPv6-ICMP',
	'ipv6-nonxt', 59, 'IPv6-NoNxt',
	'ipv6-opts', 60, 'IPv6-Opts',
	'rspf', 73, 'RSPF',
	'rspf', 73, 'CPHB',
	'vmtp', 81, 'VMTP',
	'eigrp', 88, 'EIGRP',
	'ospf', 89, 'OSPFIGP',
	'ax.25', 93, 'AX.25',
	'ipip', 94, 'IPIP',
	'etherip', 97, 'ETHERIP',
	'encap', 98, 'ENCAP',
	'pim', 103, 'PIM',
	'ipcomp', 108, 'IPCOMP',
	'vrrp', 112, 'VRRP',
	'l2tp', 115, 'L2TP',
	'isis', 124, 'ISIS',
	'sctp', 132, 'SCTP',
	'fc', 133, 'FC',
	'mh', 135, 'Mobility-Header',
	'ipv6-mh', 135, 'Mobility-Header',
	'mobility-header', 135, 'Mobility-Header',
	'udplite', 136, 'UDPLite',
	'mpls-in-ip', 137, 'MPLS-in-IP',
	'manet', 138, 'MANET',
	'hip', 139, 'HIP',
	'shim6', 140, 'Shim6',
	'wesp', 141, 'WESP',
	'rohc', 142, 'ROHC',
];

function lookupProto(x) {
	if (x == null || x === '')
		return null;

	const s = String(x).toLowerCase();

	for (let i = 0; i < protocols.length; i += 3)
		if (s == protocols[i] || s == protocols[i+1])
			return [ protocols[i+1], protocols[i+2], protocols[i] ];

	return [ -1, x, x ];
}

return baseclass.extend({
	fmt(fmtstr, args, values) {
		let wrap = false;
		const tokens = [];

		if (values == null) {
			values = [];
			wrap = true;
		}

		const get = function(args, key) {
			const names = key.trim().split(/\./);
			let obj = args;
			let ctx = obj;

			for (let n of names) {
				if (!L.isObject(obj))
					return null;

				ctx = obj;
				obj = obj[n];
			}

			if (typeof(obj) == 'function')
				return obj.call(ctx);

			return obj;
		};

		const isset = function(val) {
			if (L.isObject(val) && !dom.elem(val)) {
				for (let k in val)
					if (val.hasOwnProperty(k))
						return true;

				return false;
			}
			else if (Array.isArray(val)) {
				return (val.length > 0);
			}
			else {
				return (val !== null && val !== undefined && val !== '' && val !== false);
			}
		};

		const parse = function(tokens, text) {
			if (dom.elem(text)) {
				tokens.push('<span data-fmt-placeholder="%d"></span>'.format(values.length));
				values.push(text);
			}
			else {
				tokens.push(String(text).replace(/\\(.)/g, '$1'));
			}
		};

		for (let i = 0, last = 0; i <= fmtstr.length; i++) {
			if (fmtstr.charAt(i) == '%' && fmtstr.charAt(i + 1) == '{') {
				if (i > last)
					parse(tokens, fmtstr.substring(last, i));

				let j = i + 1,  nest = 0;

				const subexpr = [];

				for (let off = j + 1, esc = false; j <= fmtstr.length; j++) {
					const ch = fmtstr.charAt(j);

					if (esc) {
						esc = false;
					}
					else if (ch == '\\') {
						esc = true;
					}
					else if (ch == '{') {
						nest++;
					}
					else if (ch == '}') {
						if (--nest == 0) {
							subexpr.push(fmtstr.substring(off, j));
							break;
						}
					}
					else if (ch == '?' || ch == ':' || ch == '#') {
						if (nest == 1) {
							subexpr.push(fmtstr.substring(off, j));
							subexpr.push(ch);
							off = j + 1;
						}
					}
				}

				const varname  = subexpr[0].trim();
				const op1      = (subexpr[1] != null) ? subexpr[1] : '?';
				const if_set   = (subexpr[2] != null && subexpr[2] != '') ? subexpr[2] : '%{' + varname + '}';
				const op2      = (subexpr[3] != null) ? subexpr[3] : ':';
				const if_unset = (subexpr[4] != null) ? subexpr[4] : '';

				/* Invalid expression */
				if (nest != 0 || subexpr.length > 5 || varname == '') {
					return fmtstr;
				}

				/* enumeration */
				else if (op1 == '#' && subexpr.length == 3) {
					const items = L.toArray(get(args, varname));

					for (let k = 0; k < items.length; k++) {
						tokens.push.apply(tokens, this.fmt(if_set, Object.assign({}, args, {
							first: k == 0,
							next:  k > 0,
							last:  (k + 1) == items.length,
							item:  items[k]
						}), values));
					}
				}

				/* ternary expression */
				else if (op1 == '?' && op2 == ':' && (subexpr.length == 1 || subexpr.length == 3 || subexpr.length == 5)) {
					const val = get(args, varname);

					if (subexpr.length == 1)
						parse(tokens, isset(val) ? val : '');
					else if (isset(val))
						tokens.push.apply(tokens, this.fmt(if_set, args, values));
					else
						tokens.push.apply(tokens, this.fmt(if_unset, args, values));
				}

				/* unrecognized command */
				else {
					return fmtstr;
				}

				last = j + 1;
				i = j;
			}
			else if (i >= fmtstr.length) {
				if (i > last)
					parse(tokens, fmtstr.substring(last, i));
			}
		}

		if (wrap) {
			const node = E('span', {}, tokens.join(''));
			const repl = node.querySelectorAll('span[data-fmt-placeholder]');

			for (let r of repl)
				r.parentNode.replaceChild(values[r.getAttribute('data-fmt-placeholder')], r);

			return node;
		}
		else {
			return tokens;
		}
	},

	map_invert(v, fn) {
		return L.toArray(v).map(function(v) {
			v = String(v);

			if (fn != null && typeof(v[fn]) == 'function')
				v = v[fn].call(v);

			return {
				ival: v,
				inv: v.charAt(0) == '!',
				val: v.replace(/^!\s*/, '')
			};
		});
	},

	lookupProto: lookupProto,

	addDSCPOption(s, is_target) {
		const o = s.taboption(is_target ? 'general' : 'advanced', form.Value, is_target ? 'set_dscp' : 'dscp',
			is_target ? _('DSCP mark') : _('Match DSCP'),
			is_target ? _('Apply the given DSCP class or value to established connections.') : _('Matches traffic carrying the specified DSCP marking.'));

		o.modalonly = true;
		o.rmempty = !is_target;
		o.placeholder = _('any');

		if (is_target)
			o.depends('target', 'DSCP');

		o.value('CS0');
		o.value('CS1');
		o.value('CS2');
		o.value('CS3');
		o.value('CS4');
		o.value('CS5');
		o.value('CS6');
		o.value('CS7');
		o.value('BE');
		o.value('AF11');
		o.value('AF12');
		o.value('AF13');
		o.value('AF21');
		o.value('AF22');
		o.value('AF23');
		o.value('AF31');
		o.value('AF32');
		o.value('AF33');
		o.value('AF41');
		o.value('AF42');
		o.value('AF43');
		o.value('EF');
		o.validate = function(section_id, value) {
			if (value == '')
				return is_target ? _('DSCP mark required') : true;

			if (!is_target)
				value = String(value).replace(/^!\s*/, '');

			const m = value.match(/^(?:CS[0-7]|BE|AF[1234][123]|EF|(0x[0-9a-f]{1,2}|[0-9]{1,2}))$/);

			if (!m || (m[1] != null && +m[1] > 0x3f))
				return _('Invalid DSCP mark');

			return true;
		};

		return o;
	},

	addMarkOption(s, is_target) {
		const o = s.taboption(is_target ? 'general' : 'advanced', form.Value,
			(is_target > 1) ? 'set_xmark' : (is_target ? 'set_mark' : 'mark'),
			(is_target > 1) ? _('XOR mark') : (is_target ? _('Set mark') : _('Match mark')),
			(is_target > 1) ? _('Apply a bitwise XOR of the given value and the existing mark value on established connections. Format is value[/mask]. If a mask is specified then those bits set in the mask are zeroed out.') :
				(is_target ? _('Set the given mark value on established connections. Format is value[/mask]. If a mask is specified then only those bits set in the mask are modified.') :
						_('Matches a specific firewall mark or a range of different marks.')));

		o.modalonly = true;
		o.rmempty = true;

		if (is_target > 1)
			o.depends('target', 'MARK_XOR');
		else if (is_target)
			o.depends('target', 'MARK_SET');

		o.validate = function(section_id, value) {
			if (value == '')
				return is_target ? _('Valid firewall mark required') : true;

			if (!is_target)
				value = String(value).replace(/^!\s*/, '');

			const m = value.match(/^(0x[0-9a-f]{1,8}|[0-9]{1,10})(?:\/(0x[0-9a-f]{1,8}|[0-9]{1,10}))?$/i);

			if (!m || +m[1] > 0xffffffff || (m[2] != null && +m[2] > 0xffffffff))
				return _('Expecting: %s').format(_('valid firewall mark'));

			return true;
		};

		return o;
	},

	addLimitOption(s) {
		const o = s.taboption('advanced', form.Value, 'limit',
			_('Limit matching'),
			_('Limits traffic matching to the specified rate.'));

		o.modalonly = true;
		o.rmempty = true;
		o.placeholder = _('unlimited');
		o.value('10/second');
		o.value('60/minute');
		o.value('3/hour');
		o.value('500/day');
		o.validate = function(section_id, value) {
			if (value == '')
				return true;

			const m = String(value).toLowerCase().match(/^(?:0x[0-9a-f]{1,8}|[0-9]{1,10})\/([a-z]+)$/),
			    u = ['second', 'minute', 'hour', 'day'],
			    i = 0;

			if (m)
				for (let i = 0; i < u.length; i++)
					if (u[i].indexOf(m[1]) == 0)
						break;

			if (!m || i >= u.length)
				return _('Invalid limit value');

			return true;
		};

		return o;
	},

	addLimitBurstOption(s) {
		const o = s.taboption('advanced', form.Value, 'limit_burst',
			_('Limit burst'),
			_('Maximum initial number of packets to match: this number gets recharged by one every time the limit specified above is not reached, up to this number.'));

		o.modalonly = true;
		o.rmempty = true;
		o.placeholder = '5';
		o.datatype = 'uinteger';
		o.depends({ limit: null, '!reverse': true });

		return o;
	},

	transformHostHints(family, hosts) {
		const choice_values = [];
		const choice_labels = {};
		const ip6addrs = {};
		const ipaddrs = {};

		for (let mac in hosts) {
			L.toArray(hosts[mac].ipaddrs || hosts[mac].ipv4).forEach(function(ip) {
				ipaddrs[ip] = mac;
			});

			L.toArray(hosts[mac].ip6addrs || hosts[mac].ipv6).forEach(function(ip) {
				ip6addrs[ip] = mac;
			});
		}

		if (!family || family == 'ipv4') {
			L.sortedKeys(ipaddrs, null, 'addr').forEach(function(ip) {
				const val = ip;
				const txt = hosts[ipaddrs[ip]].name || ipaddrs[ip];

				choice_values.push(val);
				choice_labels[val] = E([], [ val, ' (', E('strong', {}, [txt]), ')' ]);
			});
		}

		if (!family || family == 'ipv6') {
			L.sortedKeys(ip6addrs, null, 'addr').forEach(function(ip) {
				const val = ip;
				const txt = hosts[ip6addrs[ip]].name || ip6addrs[ip];

				choice_values.push(val);
				choice_labels[val] = E([], [ val, ' (', E('strong', {}, [txt]), ')' ]);
			});
		}

		return [choice_values, choice_labels];
	},

	updateHostHints(map, section_id, option, family, hosts) {
		const opt = map.lookupOption(option, section_id)[0].getUIElement(section_id);
		const choices = this.transformHostHints(family, hosts);

		opt.clearChoices();
		opt.addChoices(choices[0], choices[1]);
	},

	CBIDynamicMultiValueList: form.DynamicList.extend({
		renderWidget(/* ... */) {
			const dl = form.DynamicList.prototype.renderWidget.apply(this, arguments);
			const inst = dom.findClassInstance(dl);

			inst.addItem = function(dl, value, text, flash) {
				const values = L.toArray(value);
				for (let val of values)
					ui.DynamicList.prototype.addItem.call(this, dl, val, null, true);
			};

			return dl;
		}
	}),

	addIPOption(s, tab, name, label, description, family, hosts, multiple) {
		const o = s.taboption(tab, multiple ? this.CBIDynamicMultiValueList : form.Value, name, label, description);
		const fw4 = L.hasSystemFeature('firewall4');

		o.modalonly = true;
		o.datatype = (fw4 && validation.types.iprange) ? 'list(neg(or(ipmask("true"),iprange)))' : 'list(neg(ipmask("true")))';
		o.placeholder = multiple ? _('-- add IP --') : _('any');

		if (family != null) {
			const choices = this.transformHostHints(family, hosts);

			for (let ch of choices[0])
				o.value(ch, choices[1][ch]);
		}

		/* force combobox rendering */
		o.transformChoices = function() {
			return this.super('transformChoices', []) || {};
		};

		return o;
	},

	addLocalIPOption(s, tab, name, label, description, devices) {
		const o = s.taboption(tab, form.Value, name, label, description);
		const fw4 = L.hasSystemFeature('firewall4');

		o.modalonly = true;
		o.datatype = !fw4?'ip4addr("nomask")':'ipaddr("nomask")';
		o.placeholder = _('any');

		L.sortedKeys(devices, 'name').forEach(function(dev) {
			const ip4addrs = devices[dev].ipaddrs;
			const ip6addrs = devices[dev].ip6addrs;

			if (!L.isObject(devices[dev].flags) || devices[dev].flags.loopback)
				return;

			for (let i = 0; Array.isArray(ip4addrs) && i < ip4addrs.length; i++) {
				if (!L.isObject(ip4addrs[i]) || !ip4addrs[i].address)
					continue;

				o.value(ip4addrs[i].address, E([], [
					ip4addrs[i].address, ' (', E('strong', {}, [dev]), ')'
				]));
			}
			for (let i = 0; fw4 && Array.isArray(ip6addrs) && i < ip6addrs.length; i++) {
				if (!L.isObject(ip6addrs[i]) || !ip6addrs[i].address)
					continue;

				o.value(ip6addrs[i].address, E([], [
					ip6addrs[i].address, ' (', E('strong', {}, [dev]), ')'
				]));
			}
		});

		return o;
	},

	addMACOption(s, tab, name, label, description, hosts) {
		const o = s.taboption(tab, this.CBIDynamicMultiValueList, name, label, description);

		o.modalonly = true;
		o.datatype = 'list(macaddr)';
		o.placeholder = _('-- add MAC --');

		L.sortedKeys(hosts).forEach(function(mac) {
			o.value(mac, E([], [ mac, ' (', E('strong', {}, [
				hosts[mac].name ||
				L.toArray(hosts[mac].ipaddrs || hosts[mac].ipv4)[0] ||
				L.toArray(hosts[mac].ip6addrs || hosts[mac].ipv6)[0] ||
				'?'
			]), ')' ]));
		});

		return o;
	},

	CBIProtocolSelect: form.MultiValue.extend({
		__name__: 'CBI.ProtocolSelect',

		addChoice(value, label) {
			if (!Array.isArray(this.keylist) || this.keylist.indexOf(value) == -1)
				this.value(value, label);
		},

		load(section_id) {
			let cfgvalue = L.toArray(this.super('load', [section_id]) || this.default).sort();
			let m, p;

			['all', 'tcp', 'udp', 'icmp'].concat(cfgvalue).forEach(L.bind(function(value) {
				switch (value) {
				case 'all':
				case 'any':
				case '*':
					this.addChoice('all', _('Any'));
					break;

				case 'tcpudp':
					this.addChoice('tcp', 'TCP');
					this.addChoice('udp', 'UDP');
					break;

				default:
					m = value.match(/^(0x[0-9a-f]{1,2}|[0-9]{1,3})$/);
					p = lookupProto(m ? +m[1] : value);

					this.addChoice(p[2], p[1]);
					break;
				}
			}, this));

			if (cfgvalue == '*' || cfgvalue == 'any' || cfgvalue == 'all')
				cfgvalue = 'all';

			return cfgvalue;
		},

		renderWidget(section_id, option_index, cfgvalue) {
			const value = (cfgvalue != null) ? cfgvalue : this.default;
			const choices = this.transformChoices();

			const widget = new ui.Dropdown(L.toArray(value), choices, {
				id: this.cbid(section_id),
				sort: this.keylist,
				multiple: true,
				optional: false,
				display_items: 10,
				dropdown_items: -1,
				create: true,
				disabled: (this.readonly != null) ? this.readonly : this.map.readonly,
				validate(value) {
					const vals = L.toArray(value);

					for (let v of vals) {
						if (v == 'all')
							continue;

						const m = v.match(/^(0x[0-9a-f]{1,2}|[0-9]{1,3})$/);

						if (m ? (+m[1] > 255) : (lookupProto(v)[0] == -1))
							return _('Unrecognized protocol');
					}

					return true;
				}
			});

			widget.createChoiceElement = function(sb, value) {
				const p = lookupProto(value);

				return ui.Dropdown.prototype.createChoiceElement.call(this, sb, p[2], p[1]);
			};

			widget.createItems = function(sb, value) {
				const values = L.toArray(value).map(function(value) {
					const m = value.match(/^(0x[0-9a-f]{1,2}|[0-9]{1,3})$/);
					const p = lookupProto(m ? +m[1] : value);

					return (p[0] > -1) ? p[2] : p[1];
				});

				values.sort();

				return ui.Dropdown.prototype.createItems.call(this, sb, values.join(' '));
			};

			widget.toggleItem = function(sb, li) {
				const value = li.getAttribute('data-value');
				const toggleFn = ui.Dropdown.prototype.toggleItem;

				toggleFn.call(this, sb, li);

				if (value == 'all') {
					const items = li.parentNode.querySelectorAll('li[data-value]');

					for (let i of items)
						if (i !== li)
							toggleFn.call(this, sb, i, false);
				}
				else {
					toggleFn.call(this, sb, li.parentNode.querySelector('li[data-value="all"]'), false);
				}
			};

			return widget.render();
		}
	}),

	checkLegacySNAT() {
		const redirects = uci.sections('firewall', 'redirect');

		for (let red of redirects)
			if ((red['target'] || '').toLowerCase() == 'snat')
				return true;

		return false;
	},

	handleMigration(ev) {
		const redirects = uci.sections('firewall', 'redirect');

		const mapping = {
			dest: 'src',
			reflection: null,
			reflection_src: null,
			src_dip: 'snat_ip',
			src_dport: 'snat_port',
			src: null
		};

		for (let red of redirects) {
			if ((red['target'] || '').toLowerCase() != 'snat')
				continue;

			const sid = uci.add('firewall', 'nat');

			for (let opt in red) {
				if (opt.charAt(0) == '.')
					continue;

				if (mapping[opt] === null)
					continue;

				uci.set('firewall', sid, mapping[opt] || opt, red[opt]);
			}

			uci.remove('firewall', red['.name']);
		}

		return uci.save()
			.then(L.bind(ui.changes.init, ui.changes))
			.then(L.bind(ui.changes.apply, ui.changes));
	},

	renderMigration() {
		ui.showModal(_('Firewall configuration migration'), [
			E('p', _('The existing firewall configuration needs to be changed for LuCI to function properly.')),
			E('p', _('Upon pressing "Continue", "redirect" sections with target "SNAT" will be converted to "nat" sections and the firewall will be restarted to apply the updated configuration.')),
			E('div', { 'class': 'right' },
				E('button', {
					'class': 'btn cbi-button-action important',
					'click': ui.createHandlerFn(this, 'handleMigration')
				}, _('Continue')))
		]);
	},
});
