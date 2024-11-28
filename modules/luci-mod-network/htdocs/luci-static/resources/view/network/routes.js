'use strict';
'require view';
'require fs';
'require uci';
'require form';
'require network';
'require tools.widgets as widgets';

return view.extend({
	load: function() {
		return Promise.all([
			network.getDevices(),
			fs.lines('/etc/iproute2/rt_tables')
		]);
	},

	render: function(data) {
		var netDevs = data[0],
		    m, s, o;

		var rtTables = data[1].map(function(l) {
			var m = l.trim().match(/^(\d+)\s+(\S+)$/);
			return m ? [ +m[1], m[2] ] : null;
		}).filter(function(e) {
			return e && e[0] > 0;
		});

		m = new form.Map('network', _('Routing'), _('Routing defines over which interface and gateway a certain host or network can be reached.') +
			'<br/>' + _('Routes go in routing tables and define the specific path to reach destinations.') +
			'<br/>' + _('Rules determine which routing table to use, based on conditions like source address or interface.'));
		m.tabbed = true;

		for (var family = 4; family <= 6; family += 2) {
			s = m.section(form.GridSection, (family == 6) ? 'route6' : 'route', (family == 6) ? _('Static IPv6 Routes') : _('Static IPv4 Routes'));
			s.anonymous = true;
			s.addremove = true;
			s.sortable = true;
			s.cloneable = true;
			s.nodescriptions = true;

			s.tab('general', _('General Settings'));
			s.tab('advanced', _('Advanced Settings'));

			o = s.taboption('general', widgets.NetworkSelect, 'interface', _('Interface'), _('Specifies the logical interface name of the parent (or master) interface this route belongs to'));
			o.loopback = true;
			o.nocreate = true;
			o.rmempty = true;

			o = s.taboption('general', form.ListValue, 'type', _('Route type'), _('Specifies the route type to be created'));
			o.modalonly = true;
			o.value('', 'unicast');
			o.value('local');
			o.value('broadcast');
			o.value('multicast');
			o.value('unreachable');
			o.value('prohibit');
			o.value('blackhole');
			o.value('anycast');
			o.value('throw');

			o = s.taboption('general', form.Value, 'target', _('Target'), _('Network address'));
			o.rmempty = false;
			o.datatype = (family == 6) ? 'cidr6' : 'cidr4';
			o.placeholder = (family == 6) ? '::/0' : '0.0.0.0/0';
			o.cfgvalue = function(section_id) {
				var section_type = uci.get('network', section_id, '.type'),
				    target = uci.get('network', section_id, 'target'),
				    mask = uci.get('network', section_id, 'netmask'),
				    v6 = (section_type == 'route6') ? true : false,
				    bits = mask ? network.maskToPrefix(mask, v6) : (v6 ? 128 : 32);
				if (target) {
					return target.split('/')[1] ? target : target + '/' + bits;
				}
			}
			o.write = function(section_id, formvalue) {
				uci.set('network', section_id, 'target', formvalue);
				uci.unset('network', section_id, 'netmask');
			}

			o = s.taboption('general', form.Value, 'gateway', _('Gateway'), _('Specifies the network gateway. If omitted, the gateway from the parent interface is taken if any, otherwise creates a link scope route. If set to 0.0.0.0 no gateway will be specified for the route'));
			o.datatype = (family == 6) ? 'ip6addr("nomask")' : 'ip4addr("nomask")';
			o.placeholder = (family == 6) ? 'fe80::1' : '192.168.0.1';

			o = s.taboption('advanced', form.Value, 'metric', _('Metric'), _('Ordinal: routes with the lowest metric match first'));
			o.datatype = 'uinteger';
			o.placeholder = 0;
			o.textvalue = function(section_id) {
				return this.cfgvalue(section_id) || E('em', _('auto'));
			};

			o = s.taboption('advanced', form.Value, 'mtu', _('MTU'), _('Packets exceeding this value may be fragmented'));
			o.modalonly = true;
			o.datatype = 'and(uinteger,range(64,9000))';
			o.placeholder = 1500;

			o = s.taboption('advanced', form.Value, 'table', _('Table'), _('Routing table into which to insert this rule.') + '<br/>' +
				_('A numeric table index, or symbol alias declared in %s. Special aliases local (255), main (254) and default (253) are also valid').format('<code>/etc/iproute2/rt_tables</code>')
				+ '<br/>' + _('Only interfaces using this table (via override) will use this route.'));
			o.datatype = 'or(uinteger, string)';
			for (var i = 0; i < rtTables.length; i++)
				o.value(rtTables[i][1], '%s (%d)'.format(rtTables[i][1], rtTables[i][0]));
			o.textvalue = function(section_id) {
				return this.cfgvalue(section_id) || E('em', _('auto'));
			};

			o = s.taboption('advanced', form.Value, 'source', _('Source'), _('Specifies the preferred source address when sending to destinations covered by the target')
				+ '<br/>' + _('This is only used if no default route matches the destination gateway'));
			o.modalonly = true;
			o.datatype = (family == 6) ? 'ip6addr' : 'ip4addr';
			for (var i = 0; i < netDevs.length; i++) {
				var addrs = (family == 6) ? netDevs[i].getIP6Addrs() : netDevs[i].getIPAddrs();
				for (var j = 0; j < addrs.length; j++)
					o.value(addrs[j].split('/')[0]);
			}

			o = s.taboption('advanced', form.Flag, 'onlink', _('On-link'), _('When enabled, gateway is on-link even if the gateway does not match any interface prefix'));
			o.modalonly = true;
			o.default = o.disabled;

			o = s.taboption('advanced', form.Flag, 'disabled', _('Disable'));
			o.modalonly = false;
			o.editable = true;
			o.default = o.disabled;
		}

		for (var family = 4; family <= 6; family += 2) {
			s = m.section(form.GridSection, (family == 6) ? 'rule6' : 'rule', (family == 6) ? _('IPv6 Rules') : _('IPv4 Rules'));
			s.anonymous = true;
			s.addremove = true;
			s.sortable = true;
			s.cloneable = true;
			s.nodescriptions = true;

			s.tab('general', _('General Settings'));
			s.tab('advanced', _('Advanced Settings'));

			o = s.taboption('general', form.Value, 'priority', _('Priority'), _('Execution order of this IP rule: lower numbers go first'));
			o.datatype = 'uinteger';
			o.placeholder = 30000;
			o.textvalue = function(section_id) {
				return this.cfgvalue(section_id) || E('em', _('auto'));
			};

			o = s.taboption('general', form.ListValue, 'action', _('Rule type'), _('Specifies the rule target routing action'));
			o.modalonly = true;
			o.value('', 'unicast');
			o.value('unreachable');
			o.value('prohibit');
			o.value('blackhole');
			o.value('throw');

			o = s.taboption('general', widgets.NetworkSelect, 'in', _('Incoming interface'), _('Match traffic from this interface'));
			o.loopback = true;
			o.nocreate = true;

			o = s.taboption('general', form.Value, 'src', _('Source'), _('Match traffic from this source subnet (CIDR notation)'));
			o.datatype = (family == 6) ? 'cidr6' : 'cidr4';
			o.placeholder = (family == 6) ? '::/0' : '0.0.0.0/0';
			o.textvalue = function(section_id) {
				return this.cfgvalue(section_id) || E('em', _('any'));
			};

			o = s.taboption('general', widgets.NetworkSelect, 'out', _('Outgoing interface'), _('Match traffic destined to this interface'));
			o.loopback = true;
			o.nocreate = true;

			o = s.taboption('general', form.Value, 'dest', _('Destination'), _('Match traffic destined to this subnet (CIDR notation)'));
			o.datatype = (family == 6) ? 'cidr6' : 'cidr4';
			o.placeholder = (family == 6) ? '::/0' : '0.0.0.0/0';
			o.textvalue = function(section_id) {
				return this.cfgvalue(section_id) || E('em', _('any'));
			};

			o = s.taboption('advanced', form.Value, 'lookup', _('Table'), _('Routing table to use for traffic matching this rule.') + '<br/>' +
				_('A numeric table index, or symbol alias declared in %s. Special aliases local (255), main (254) and default (253) are also valid').format('<code>/etc/iproute2/rt_tables</code>')
				+ '<br/>' + _('Matched traffic re-targets to an interface using this table.'));
			o.datatype = 'or(uinteger, string)';
			for (var i = 0; i < rtTables.length; i++)
				o.value(rtTables[i][1], '%s (%d)'.format(rtTables[i][1], rtTables[i][0]));

			o = s.taboption('advanced', form.Value, 'goto', _('Jump to rule'), _('Jumps to another rule specified by its priority value'));
			o.modalonly = true;
			o.datatype = 'uinteger';
			o.placeholder = 80000;

			o = s.taboption('advanced', form.Value, 'mark', _('Firewall mark'), _('Specifies the fwmark and optionally its mask to match, e.g. 0xFF to match mark 255 or 0x0/0x1 to match any even mark value'));
			o.modalonly = true;
			o.datatype = 'string';
			o.placeholder = '0x1/0xf';

			o = s.taboption('advanced', form.Value, 'tos', _('Type of service'), _('Specifies the TOS value to match in IP headers'));
			o.modalonly = true;
			o.datatype = 'uinteger';
			o.placeholder = 10;

			o = s.taboption('advanced', form.Value, 'uidrange', _('User identifier'), _('Specifies an individual UID or range of UIDs to match, e.g. 1000 to match corresponding UID or 1000-1005 to inclusively match all UIDs within the corresponding range'));
			o.modalonly = true;
			o.datatype = 'string';
			o.placeholder = '1000-1005';

			o = s.taboption('advanced', form.Value, 'suppress_prefixlength', _('Prefix suppressor'), _('Reject routing decisions that have a prefix length less than or equal to the specified value')
				+ '<br/>' + _('Prevents overly broad routes being considered. Setting 16 would consider /17, /24, /28 or more specific routes yet ignore /16, /8, /0 (default) routes'));
			o.modalonly = true;
			o.datatype = (family == 6) ? 'ip6prefix' : 'ip4prefix';
			o.placeholder = (family == 6) ? 64 : 24;

			o = s.taboption('advanced', form.Flag, 'invert', _('Invert match'), _('If set, the meaning of the match options is inverted'));
			o.modalonly = true;
			o.default = o.disabled;

			o = s.taboption('advanced', form.Flag, 'disabled', _('Disable'));
			o.modalonly = false;
			o.editable = true;
			o.default = o.disabled;
		}

		return m.render();
	}
});
