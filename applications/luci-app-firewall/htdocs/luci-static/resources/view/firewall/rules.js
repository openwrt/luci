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

	load: function() {
		return this.callHostHints().catch(function(e) {
			console.debug('load fail', e);
		});
	},

	render: function(hosts) {
		var m, s, o;

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

		//ft.opt_enabled(s, Button);
		//ft.opt_name(s, Value, _('Name'));


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
