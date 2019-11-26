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

function forward_src_txt(s) {
	var z = fwtool.fmt_zone(uci.get('firewall', s, 'src'), _('any zone')),
	    a = fwtool.fmt_ip(uci.get('firewall', s, 'src_ip'), _('any host')),
	    p = fwtool.fmt_port(uci.get('firewall', s, 'src_port')),
	    m = fwtool.fmt_mac(uci.get('firewall', s, 'src_mac'));

	if (p && m)
		return fmt(_('From %s in %s with source %s and %s'), a, z, p, m);
	else if (p || m)
		return fmt(_('From %s in %s with source %s'), a, z, p || m);
	else
		return fmt(_('From %s in %s'), a, z);
}

function forward_via_txt(s) {
	var a = fwtool.fmt_ip(uci.get('firewall', s, 'src_dip'), _('any router IP')),
	    p = fwtool.fmt_port(uci.get('firewall', s, 'src_dport'));

	if (p)
		return fmt(_('Via %s at %s'), a, p);
	else
		return fmt(_('Via %s'), a);
}

return L.view.extend({
	callHostHints: rpc.declare({
		object: 'luci-rpc',
		method: 'getHostHints',
		expect: { '': {} }
	}),

	load: function() {
		return Promise.all([
			this.callHostHints()
		]);
	},

	render: function(data) {
		var hosts = data[0],
		    m, s, o;

		m = new form.Map('firewall', _('Firewall - Port Forwards'),
			_('Port forwarding allows remote computers on the Internet to connect to a specific computer or service within the private LAN.'));

		s = m.section(form.GridSection, 'redirect', _('Port Forwards'));
		s.addremove = true;
		s.anonymous = true;
		s.sortable  = true;

		s.tab('general', _('General Settings'));
		s.tab('advanced', _('Advanced Settings'));

		s.filter = function(section_id) {
			return (uci.get('firewall', section_id, 'target') != 'SNAT');
		};

		s.sectiontitle = function(section_id) {
			return uci.get('firewall', section_id, 'name') || _('Unnamed forward');
		};

		s.handleAdd = function(ev) {
			var config_name = this.uciconfig || this.map.config,
			    section_id = uci.add(config_name, this.sectiontype);

			uci.set(config_name, section_id, 'target', 'DNAT');

			this.addedSection = section_id;
			this.renderMoreOptionsModal(section_id);
		};

		o = s.taboption('general', form.Value, 'name', _('Name'));
		o.placeholder = _('Unnamed forward');
		o.modalonly = true;

		o = s.option(form.DummyValue, '_match', _('Match'));
		o.modalonly = false;
		o.textvalue = function(s) {
			return E('small', [
				forward_proto_txt(s), E('br'),
				forward_src_txt(s), E('br'),
				forward_via_txt(s)
			]);
		};

		o = s.option(form.ListValue, '_dest', _('Forward to'));
		o.modalonly = false;
		o.textvalue = function(s) {
			var z = fwtool.fmt_zone(uci.get('firewall', s, 'dest'), _('any zone')),
			    a = fwtool.fmt_ip(uci.get('firewall', s, 'dest_ip'), _('any host')),
			    p = fwtool.fmt_port(uci.get('firewall', s, 'dest_port')) ||
			        fwtool.fmt_port(uci.get('firewall', s, 'src_dport'));

			if (p)
				return fmt(_('%s, %s in %s'), a, p, z);
			else
				return fmt(_('%s in %s'), a, z);
		};

		o = s.option(form.Flag, 'enabled', _('Enable'));
		o.modalonly = false;
		o.default = o.enabled;
		o.editable = true;

		o = s.taboption('general', form.Value, 'proto', _('Protocol'));
		o.modalonly = true;
		o.default = 'tcp udp';
		o.value('tcp udp', 'TCP+UDP');
		o.value('tcp', 'TCP');
		o.value('udp', 'UDP');
		o.value('icmp', 'ICMP');

		o.cfgvalue = function(/* ... */) {
			var v = this.super('cfgvalue', arguments);
			return (v == 'tcpudp') ? 'tcp udp' : v;
		};

		o = s.taboption('general', widgets.ZoneSelect, 'src', _('Source zone'));
		o.modalonly = true;
		o.rmempty = false;
		o.nocreate = true;
		o.default = 'wan';

		o = s.taboption('advanced', form.Value, 'src_mac', _('Source MAC address'),
			_('Only match incoming traffic from these MACs.'));
		o.modalonly = true;
		o.rmempty = true;
		o.datatype = 'neg(macaddr)';
		o.placeholder = E('em', _('any'));
		L.sortedKeys(hosts).forEach(function(mac) {
			o.value(mac, '%s (%s)'.format(
				mac,
				hosts[mac].name || hosts[mac].ipv4 || hosts[mac].ipv6 || '?'
			));
		});

		o = s.taboption('advanced', form.Value, 'src_ip', _('Source IP address'),
			_('Only match incoming traffic from this IP or range.'));
		o.modalonly = true;
		o.rmempty = true;
		o.datatype = 'neg(ipmask4)';
		o.placeholder = E('em', _('any'));
		L.sortedKeys(hosts, 'ipv4', 'addr').forEach(function(mac) {
			o.value(hosts[mac].ipv4, '%s (%s)'.format(
				hosts[mac].ipv4,
				hosts[mac].name || mac
			));
		});

		o = s.taboption('advanced', form.Value, 'src_port', _('Source ports'),
			_('Only match incoming traffic originating from the given source port or port range on the client host'));
		o.modalonly = true;
		o.rmempty = true;
		o.datatype = 'neg(portrange)';
		o.placeholder = _('any');
		o.depends('proto', 'tcp');
		o.depends('proto', 'udp');
		o.depends('proto', 'tcp udp');
		o.depends('proto', 'tcpudp');

		o = s.taboption('advanced', form.Value, 'src_dip', _('External IP address'),
			_('Only match incoming traffic directed at the given IP address.'));
		o.modalonly = true;
		o.rmempty = true;
		o.datatype = 'neg(ipmask4)';
		o.placeholder = E('em', _('any'));
		L.sortedKeys(hosts, 'ipv4', 'addr').forEach(function(mac) {
			o.value(hosts[mac].ipv4, '%s (%s)'.format(
				hosts[mac].ipv4,
				hosts[mac].name || mac
			));
		});

		o = s.taboption('general', form.Value, 'src_dport', _('External ports'),
			_('Match incoming traffic directed at the given destination port or port range on this host'));
		o.modalonly = true;
		o.rmempty = false;
		o.datatype = 'neg(portrange)';
		o.depends('proto', 'tcp');
		o.depends('proto', 'udp');
		o.depends('proto', 'tcp udp');
		o.depends('proto', 'tcpudp');

		o = s.taboption('general', widgets.ZoneSelect, 'dest', _('Internal zone'));
		o.modalonly = true;
		o.rmempty = true;
		o.nocreate = true;
		o.default = 'lan';

		o = s.taboption('general', form.Value, 'dest_ip', _('Internal IP address'),
			_('Redirect matched incoming traffic to the specified internal host'));
		o.modalonly = true;
		o.rmempty = true;
		o.datatype = 'ipmask4';
		L.sortedKeys(hosts, 'ipv4', 'addr').forEach(function(mac) {
			o.value(hosts[mac].ipv4, '%s (%s)'.format(
				hosts[mac].ipv4,
				hosts[mac].name || mac
			));
		});

		o = s.taboption('general', form.Value, 'dest_port', _('Internal ports'),
			_('Redirect matched incoming traffic to the given port on the internal host'));
		o.modalonly = true;
		o.rmempty = true;
		o.placeholder = _('any');
		o.datatype = 'portrange';
		o.depends('proto', 'tcp');
		o.depends('proto', 'udp');
		o.depends('proto', 'tcp udp');
		o.depends('proto', 'tcpudp');

		o = s.taboption('advanced', form.Flag, 'reflection', _('Enable NAT Loopback'));
		o.modalonly = true;
		o.rmempty = true;
		o.default = o.enabled;

		o = s.taboption('advanced', form.Value, 'extra', _('Extra arguments'),
			_('Passes additional arguments to iptables. Use with care!'));
		o.modalonly = true;
		o.rmempty = true;

		return m.render();
	}
});
