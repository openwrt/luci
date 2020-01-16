'use strict';
'require ui';
'require rpc';
'require uci';
'require form';
'require tools.firewall as fwtool';
'require tools.widgets as widgets';

function fmt(fmt /*, ...*/) {
	var repl = [], wrap = false;

	for (var i = 1; i < arguments.length; i++) {
		if (L.dom.elem(arguments[i])) {
			switch (arguments[i].nodeType) {
			case 1:
				repl.push(arguments[i].outerHTML);
				wrap = true;
				break;

			case 3:
				repl.push(arguments[i].data);
				break;

			case 11:
				var span = E('span');
				span.appendChild(arguments[i]);
				repl.push(span.innerHTML);
				wrap = true;
				break;

			default:
				repl.push('');
			}
		}
		else {
			repl.push(arguments[i]);
		}
	}

	var rv = fmt.format.apply(fmt, repl);
	return wrap ? E('span', rv) : rv;
}

function forward_proto_txt(s) {
	return fmt('%s-%s',
		fwtool.fmt_family(uci.get('firewall', s, 'family')),
		fwtool.fmt_proto(uci.get('firewall', s, 'proto'),
		                 uci.get('firewall', s, 'icmp_type')) || 'TCP+UDP');
}

function rule_src_txt(s) {
	var z = fwtool.fmt_zone(uci.get('firewall', s, 'src')),
	    p = fwtool.fmt_port(uci.get('firewall', s, 'src_port')),
	    m = fwtool.fmt_mac(uci.get('firewall', s, 'src_mac'));

	// Forward/Input
	if (z) {
		var a = fwtool.fmt_ip(uci.get('firewall', s, 'src_ip'), _('any host'));
		if (p && m)
			return fmt(_('From %s in %s with source %s and %s'), a, z, p, m);
		else if (p || m)
			return fmt(_('From %s in %s with source %s'), a, z, p || m);
		else
			return fmt(_('From %s in %s'), a, z);
	}

	// Output
	else {
		var a = fwtool.fmt_ip(uci.get('firewall', s, 'src_ip'), _('any router IP'));
		if (p && m)
			return fmt(_('From %s on <var>this device</var> with source %s and %s'), a, p, m);
		else if (p || m)
			return fmt(_('From %s on <var>this device</var> with source %s'), a, p || m);
		else
			return fmt(_('From %s on <var>this device</var>'), a);
	}
}

function rule_dest_txt(s) {
	var z = fwtool.fmt_zone(uci.get('firewall', s, 'dest')),
	    p = fwtool.fmt_port(uci.get('firewall', s, 'dest_port'));

    // Forward
	if (z) {
		var a = fwtool.fmt_ip(uci.get('firewall', s, 'dest_ip'), _('any host'));
		if (p)
			return fmt(_('To %s, %s in %s'), a, p, z);
		else
			return fmt(_('To %s in %s'), a, z);
	}

	// Input
	else {
		var a = fwtool.fmt_ip(uci.get('firewall', s, 'dest_ip'), _('any router IP'));
		if (p)
			return fmt(_('To %s at %s on <var>this device</var>'), a, p);
		else
			return fmt(_('To %s on <var>this device</var>'), a);
	}
}

function rule_target_txt(s) {
	var t = fwtool.fmt_target(uci.get('firewall', s, 'target'), uci.get('firewall', s, 'src'), uci.get('firewall', s, 'dest')),
	    l = fwtool.fmt_limit(uci.get('firewall', s, 'limit'), uci.get('firewall', s, 'limit_burst'));

	if (l)
		return fmt(_('<var>%s</var> and limit to %s'), t, l);
	else
		return fmt('<var>%s</var>', t);
}

function update_ip_hints(map, section_id, family, hosts) {
	var elem_src_ip = map.lookupOption('src_ip', section_id)[0].getUIElement(section_id),
	    elem_dst_ip = map.lookupOption('dest_ip', section_id)[0].getUIElement(section_id),
	    choice_values = [], choice_labels = {};

	elem_src_ip.clearChoices();
	elem_dst_ip.clearChoices();

	if (!family || family == 'ipv4') {
		L.sortedKeys(hosts, 'ipv4', 'addr').forEach(function(mac) {
			var val = hosts[mac].ipv4,
			    txt = '%s (<strong>%s</strong>)'.format(val, hosts[mac].name || mac);

			choice_values.push(val);
			choice_labels[val] = txt;
		});
	}

	if (!family || family == 'ipv6') {
		L.sortedKeys(hosts, 'ipv6', 'addr').forEach(function(mac) {
			var val = hosts[mac].ipv6,
			    txt = '%s (<strong>%s</strong>)'.format(val, hosts[mac].name || mac);

			choice_values.push(val);
			choice_labels[val] = txt;
		});
	}

	elem_src_ip.addChoices(choice_values, choice_labels);
	elem_dst_ip.addChoices(choice_values, choice_labels);
}

return L.view.extend({
	callHostHints: rpc.declare({
		object: 'luci-rpc',
		method: 'getHostHints',
		expect: { '': {} }
	}),

	callConntrackHelpers: rpc.declare({
		object: 'luci',
		method: 'getConntrackHelpers',
		expect: { result: [] }
	}),

	load: function() {
		return Promise.all([
			this.callHostHints(),
			this.callConntrackHelpers()
		]);
	},

	render: function(data) {
		var hosts = data[0],
		    ctHelpers = data[1],
		    m, s, o;

		m = new form.Map('firewall', _('Firewall - Traffic Rules'),
			_('Traffic rules define policies for packets traveling between different zones, for example to reject traffic between certain hosts or to open WAN ports on the router.'));

		s = m.section(form.GridSection, 'rule', _('Traffic Rules'));
		s.addremove = true;
		s.anonymous = true;
		s.sortable  = true;

		s.tab('general', _('General Settings'));
		s.tab('advanced', _('Advanced Settings'));
		s.tab('timed', _('Time Restrictions'));

		s.filter = function(section_id) {
			return (uci.get('firewall', section_id, 'target') != 'SNAT');
		};

		s.sectiontitle = function(section_id) {
			return uci.get('firewall', section_id, 'name') || _('Unnamed rule');
		};

		s.handleAdd = function(ev) {
			var config_name = this.uciconfig || this.map.config,
			    section_id = uci.add(config_name, this.sectiontype),
			    opt1, opt2;

			for (var i = 0; i < this.children.length; i++)
				if (this.children[i].option == 'src')
					opt1 = this.children[i];
				else if (this.children[i].option == 'dest')
					opt2 = this.children[i];

			opt1.default = 'wan';
			opt2.default = 'lan';

			this.addedSection = section_id;
			this.renderMoreOptionsModal(section_id);

			delete opt1.default;
			delete opt2.default;
		};

		o = s.taboption('general', form.Value, 'name', _('Name'));
		o.placeholder = _('Unnamed rule');
		o.modalonly = true;

		o = s.option(form.DummyValue, '_match', _('Match'));
		o.modalonly = false;
		o.textvalue = function(s) {
			return E('small', [
				forward_proto_txt(s), E('br'),
				rule_src_txt(s), E('br'),
				rule_dest_txt(s)
			]);
		};

		o = s.option(form.ListValue, '_target', _('Action'));
		o.modalonly = false;
		o.textvalue = function(s) {
			return rule_target_txt(s);
		};

		o = s.option(form.Flag, 'enabled', _('Enable'));
		o.modalonly = false;
		o.default = o.enabled;
		o.editable = true;


		o = s.taboption('advanced', form.ListValue, 'direction', _('Match device'));
		o.modalonly = true;
		o.value('', _('unspecified'));
		o.value('in', _('Inbound device'));
		o.value('out', _('Outbound device'));
		o.cfgvalue = function(section_id) {
			var val = uci.get('firewall', section_id, 'direction');
			switch (val) {
				case 'in':
				case 'ingress':
					return 'in';

				case 'out':
				case 'egress':
					return 'out';
			}

			return null;
		};

		o = s.taboption('advanced', widgets.DeviceSelect, 'device', _('Device name'),
			_('Specifies whether to tie this traffic rule to a specific inbound or outbound network device.'));
		o.modalonly = true;
		o.noaliases = true;
		o.rmempty = false;
		o.depends('direction', 'in');
		o.depends('direction', 'out');

		o = s.taboption('advanced', form.ListValue, 'family', _('Restrict to address family'));
		o.modalonly = true;
		o.rmempty = true;
		o.value('', _('IPv4 and IPv6'));
		o.value('ipv4', _('IPv4 only'));
		o.value('ipv6', _('IPv6 only'));
		o.validate = function(section_id, value) {
			update_ip_hints(this.map, section_id, value, hosts);
			return true;
		};

		o = s.taboption('general', form.Value, 'proto', _('Protocol'));
		o.modalonly = true;
		o.default = 'tcp udp';
		o.value('all', _('Any'));
		o.value('tcp udp', 'TCP+UDP');
		o.value('tcp', 'TCP');
		o.value('udp', 'UDP');
		o.value('icmp', 'ICMP');
		o.cfgvalue = function(/* ... */) {
			var v = this.super('cfgvalue', arguments);
			return (v == 'tcpudp') ? 'tcp udp' : v;
		};

		o = s.taboption('advanced', form.MultiValue, 'icmp_type', _('Match ICMP type'));
		o.modalonly = true;
		o.multiple = true;
		o.custom = true;
		o.cast = 'table';
		o.placeholder = _('any');
		o.value('', 'any');
		o.value('address-mask-reply');
		o.value('address-mask-request');
		o.value('communication-prohibited');
		o.value('destination-unreachable');
		o.value('echo-reply');
		o.value('echo-request');
		o.value('fragmentation-needed');
		o.value('host-precedence-violation');
		o.value('host-prohibited');
		o.value('host-redirect');
		o.value('host-unknown');
		o.value('host-unreachable');
		o.value('ip-header-bad');
		o.value('neighbour-advertisement');
		o.value('neighbour-solicitation');
		o.value('network-prohibited');
		o.value('network-redirect');
		o.value('network-unknown');
		o.value('network-unreachable');
		o.value('parameter-problem');
		o.value('port-unreachable');
		o.value('precedence-cutoff');
		o.value('protocol-unreachable');
		o.value('redirect');
		o.value('required-option-missing');
		o.value('router-advertisement');
		o.value('router-solicitation');
		o.value('source-quench');
		o.value('source-route-failed');
		o.value('time-exceeded');
		o.value('timestamp-reply');
		o.value('timestamp-request');
		o.value('TOS-host-redirect');
		o.value('TOS-host-unreachable');
		o.value('TOS-network-redirect');
		o.value('TOS-network-unreachable');
		o.value('ttl-zero-during-reassembly');
		o.value('ttl-zero-during-transit');
		o.depends('proto', 'icmp');

		o = s.taboption('general', widgets.ZoneSelect, 'src', _('Source zone'));
		o.modalonly = true;
		o.nocreate = true;
		o.allowany = true;
		o.allowlocal = 'src';

		o = s.taboption('advanced', form.Value, 'src_mac', _('Source MAC address'));
		o.modalonly = true;
		o.datatype = 'list(macaddr)';
		o.placeholder = _('any');
		L.sortedKeys(hosts).forEach(function(mac) {
			o.value(mac, '%s (%s)'.format(
				mac,
				hosts[mac].name || hosts[mac].ipv4 || hosts[mac].ipv6 || '?'
			));
		});

		o = s.taboption('general', form.Value, 'src_ip', _('Source address'));
		o.modalonly = true;
		o.datatype = 'list(neg(ipmask))';
		o.placeholder = _('any');
		o.transformChoices = function() { return {} }; /* force combobox rendering */

		o = s.taboption('general', form.Value, 'src_port', _('Source port'));
		o.modalonly = true;
		o.datatype = 'list(neg(portrange))';
		o.placeholder = _('any');
		o.depends('proto', 'tcp');
		o.depends('proto', 'udp');
		o.depends('proto', 'tcp udp');
		o.depends('proto', 'tcpudp');

		o = s.taboption('general', widgets.ZoneSelect, 'dest', _('Destination zone'));
		o.modalonly = true;
		o.nocreate = true;
		o.allowany = true;
		o.allowlocal = true;

		o = s.taboption('general', form.Value, 'dest_ip', _('Destination address'));
		o.modalonly = true;
		o.datatype = 'list(neg(ipmask))';
		o.placeholder = _('any');
		o.transformChoices = function() { return {} }; /* force combobox rendering */

		o = s.taboption('general', form.Value, 'dest_port', _('Destination port'));
		o.modalonly = true;
		o.datatype = 'list(neg(portrange))';
		o.placeholder = _('any');
		o.depends('proto', 'tcp');
		o.depends('proto', 'udp');
		o.depends('proto', 'tcp udp');
		o.depends('proto', 'tcpudp');

		o = s.taboption('general', form.ListValue, 'target', _('Action'));
		o.modalonly = true;
		o.default = 'ACCEPT';
		o.value('DROP', _('drop'));
		o.value('ACCEPT', _('accept'));
		o.value('REJECT', _('reject'));
		o.value('NOTRACK', _("don't track"));
		o.value('HELPER', _('assign conntrack helper'));
		o.value('MARK_SET', _('apply firewall mark'));
		o.value('MARK_XOR', _('XOR firewall mark'));
		o.value('DSCP', _('DSCP classification'));
		o.cfgvalue = function(section_id) {
			var t = uci.get('firewall', section_id, 'target'),
			    m = uci.get('firewall', section_id, 'set_mark');

			if (t == 'MARK')
				return m ? 'MARK_SET' : 'MARK_XOR';

			return t;
		};
		o.write = function(section_id, value) {
			return this.super('write', [section_id, (value == 'MARK_SET' || value == 'MARK_XOR') ? 'MARK' : value]);
		};

		o = s.taboption('general', form.Value, 'set_mark', _('Set mark'), _('Set the given mark value on established connections. Format is value[/mask]. If a mask is specified then only those bits set in the mask are modified.'));
		o.modalonly = true;
		o.rmempty = false;
		o.depends('target', 'MARK_SET');
		o.validate = function(section_id, value) {
			var m = String(value).match(/^(0x[0-9a-f]{1,8}|[0-9]{1,10})(?:\/(0x[0-9a-f]{1,8}|[0-9]{1,10}))?$/i);

			if (!m || +m[1] > 0xffffffff || (m[2] != null && +m[2] > 0xffffffff))
				return _('Expecting: %s').format(_('valid firewall mark'));

			return true;
		};

		o = s.taboption('general', form.Value, 'set_xmark', _('XOR mark'), _('Apply a bitwise XOR of the given value and the existing mark value on established connections. Format is value[/mask]. If a mask is specified then those bits set in the mask are zeroed out.'));
		o.modalonly = true;
		o.rmempty = false;
		o.depends('target', 'MARK_XOR');
		o.validate = function(section_id, value) {
			var m = String(value).match(/^(0x[0-9a-f]{1,8}|[0-9]{1,10})(?:\/(0x[0-9a-f]{1,8}|[0-9]{1,10}))?$/i);

			if (!m || +m[1] > 0xffffffff || (m[2] != null && +m[2] > 0xffffffff))
				return _('Expecting: %s').format(_('valid firewall mark'));

			return true;
		};

		o = s.taboption('general', form.Value, 'set_dhcp', _('DSCP mark'), _('Apply the given DSCP class or value to established connections.'));
		o.modalonly = true;
		o.rmempty = false;
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
				return _('DSCP mark required');

			var m = String(value).match(/^(?:CS[0-7]|BE|AF[1234][123]|EF|(0x[0-9a-f]{1,2}|[0-9]{1,2}))$/);

			if (!m || (m[1] != null && +m[1] > 0x3f))
				return _('Invalid DSCP mark');

			return true;
		};

		o = s.taboption('general', form.ListValue, 'set_helper', _('Tracking helper'), _('Assign the specified connection tracking helper to matched traffic.'));
		o.modalonly = true;
		o.placeholder = _('any');
		o.depends('target', 'HELPER');
		for (var i = 0; i < ctHelpers.length; i++)
			o.value(ctHelpers[i].name, '%s (%s)'.format(ctHelpers[i].description, ctHelpers[i].name.toUpperCase()));

		o = s.taboption('advanced', form.Value, 'helper', _('Match helper'), _('Match traffic using the specified connection tracking helper.'));
		o.modalonly = true;
		o.placeholder = _('any');
		for (var i = 0; i < ctHelpers.length; i++)
			o.value(ctHelpers[i].name, '%s (%s)'.format(ctHelpers[i].description, ctHelpers[i].name.toUpperCase()));
		o.validate = function(section_id, value) {
			if (value == '' || value == null)
				return true;

			value = value.replace(/^!\s*/, '');

			for (var i = 0; i < ctHelpers.length; i++)
				if (value == ctHelpers[i].name)
					return true;

			return _('Unknown or not installed conntrack helper "%s"').format(value);
		};

		o = s.taboption('advanced', form.Value, 'mark', _('Match mark'),
			_('Matches a specific firewall mark or a range of different marks.'));
		o.modalonly = true;
		o.rmempty = true;
		o.validate = function(section_id, value) {
			if (value == '')
				return true;

			var m = String(value).match(/^(?:!\s*)?(0x[0-9a-f]{1,8}|[0-9]{1,10})(?:\/(0x[0-9a-f]{1,8}|[0-9]{1,10}))?$/i);

			if (!m || +m[1] > 0xffffffff || (m[2] != null && +m[2] > 0xffffffff))
				return _('Expecting: %s').format(_('valid firewall mark'));

			return true;
		};

		o = s.taboption('advanced', form.Value, 'dscp', _('Match DSCP'),
			_('Matches traffic carrying the specified DSCP marking.'));
		o.modalonly = true;
		o.rmempty = true;
		o.placeholder = _('any');
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
				return true;

			value = String(value).replace(/^!\s*/, '');

			var m = value.match(/^(?:CS[0-7]|BE|AF[1234][123]|EF|(0x[0-9a-f]{1,2}|[0-9]{1,2}))$/);

			if (!m || +m[1] > 0xffffffff || (m[2] != null && +m[2] > 0xffffffff))
				return _('Invalid DSCP mark');

			return true;
		};

		o = s.taboption('advanced', form.Value, 'limit', _('Limit matching'),
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

			var m = String(value).toLowerCase().match(/^(?:0x[0-9a-f]{1,8}|[0-9]{1,10})\/([a-z]+)$/),
			    u = ['second', 'minute', 'hour', 'day'],
			    i = 0;

			if (m)
				for (i = 0; i < u.length; i++)
					if (u[i].indexOf(m[1]) == 0)
						break;

			if (!m || i >= u.length)
				return _('Invalid limit value');

			return true;
		};

		o = s.taboption('advanced', form.Value, 'limit_burst', _('Limit burst'),
			_('Maximum initial number of packets to match: this number gets recharged by one every time the limit specified above is not reached, up to this number.'));
		o.modalonly = true;
		o.rmempty = true;
		o.placeholder = '5';
		o.datatype = 'uinteger';
		o.depends({ limit: null, '!reverse': true });

		o = s.taboption('advanced', form.Value, 'extra', _('Extra arguments'),
			_('Passes additional arguments to iptables. Use with care!'));
		o.modalonly = true;

		o = s.taboption('timed', form.MultiValue, 'weekdays', _('Week Days'));
		o.modalonly = true;
		o.multiple = true;
		o.display = 5;
		o.placeholder = _('Any day');
		o.value('Sun', _('Sunday'));
		o.value('Mon', _('Monday'));
		o.value('Tue', _('Tuesday'));
		o.value('Wed', _('Wednesday'));
		o.value('Thu', _('Thursday'));
		o.value('Fri', _('Friday'));
		o.value('Sat', _('Saturday'));
		o.write = function(section_id, value) {
			return this.super('write', [ section_id, L.toArray(value).join(' ') ]);
		};

		o = s.taboption('timed', form.MultiValue, 'monthdays', _('Month Days'));
		o.modalonly = true;
		o.multiple = true;
		o.display_size = 15;
		o.placeholder = _('Any day');
		o.write = function(section_id, value) {
			return this.super('write', [ section_id, L.toArray(value).join(' ') ]);
		};
		for (var i = 1; i <= 31; i++)
			o.value(i);

		o = s.taboption('timed', form.Value, 'start_time', _('Start Time (hh.mm.ss)'));
		o.modalonly = true;
		o.datatype = 'timehhmmss';

		o = s.taboption('timed', form.Value, 'stop_time', _('Stop Time (hh.mm.ss)'));
		o.modalonly = true;
		o.datatype = 'timehhmmss';

		o = s.taboption('timed', form.Value, 'start_date', _('Start Date (yyyy-mm-dd)'));
		o.modalonly = true;
		o.datatype = 'dateyyyymmdd';

		o = s.taboption('timed', form.Value, 'stop_date', _('Stop Date (yyyy-mm-dd)'));
		o.modalonly = true;
		o.datatype = 'dateyyyymmdd';

		o = s.taboption('timed', form.Flag, 'utc_time', _('Time in UTC'));
		o.modalonly = true;
		o.default = o.disabled;

		return m.render();
	}
});
