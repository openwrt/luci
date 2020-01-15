'use strict';
'require ui';
'require rpc';
'require uci';
'require form';
'require tools.firewall as fwtool';
'require tools.widgets as widgets';

function fmt(fmtstr, args) {
	var repl = [], wrap = false;
	var tokens = [];

	for (var i = 0, last = 0; i <= fmtstr.length; i++) {
		if (fmtstr.charAt(i) == '%' && fmtstr.charAt(i + 1) == '{') {
			if (i > last)
				tokens.push(fmtstr.substring(last, i));

			var j = i + 1,  nest = 0;

			var subexpr = [];

			for (var off = j + 1, esc = false; j <= fmtstr.length; j++) {
				if (esc) {
					esc = false;
				}
				else if (fmtstr.charAt(j) == '\\') {
					esc = true;
				}
				else if (fmtstr.charAt(j) == '{') {
					nest++;
				}
				else if (fmtstr.charAt(j) == '}') {
					if (--nest == 0) {
						subexpr.push(fmtstr.substring(off, j));
						break;
					}
				}
				else if (fmtstr.charAt(j) == '?' || fmtstr.charAt(j) == ':') {
					if (nest == 1) {
						subexpr.push(fmtstr.substring(off, j));
						subexpr.push(fmtstr.charAt(j));
						off = j + 1;
					}
				}
			}

			var varname  = subexpr[0].trim(),
			    op1      = (subexpr[1] != null) ? subexpr[1] : '?',
			    if_set   = (subexpr[2] != null && subexpr[2] != '') ? subexpr[2] : '%{' + varname + '}',
			    op2      = (subexpr[3] != null) ? subexpr[3] : ':',
			    if_unset = (subexpr[4] != null) ? subexpr[4] : '';

			/* Invalid expression */
			if (nest != 0 || subexpr.length > 5 || varname == '' || op1 != '?' || op2 != ':')
				return fmtstr;

			if (subexpr.length == 1)
				tokens.push(args[varname] != null ? args[varname] : '');
			else if (args[varname] != null)
				tokens.push(fmt(if_set.replace(/\\(.)/g, '$1'), args));
			else
				tokens.push(fmt(if_unset.replace(/\\(.)/g, '$1'), args));

			last = j + 1;
			i = last;
		}
		else if (i >= fmtstr.length) {
			if (i > last)
				tokens.push(fmtstr.substring(last, i));
		}
	}

	for (var i = 0; i < tokens.length; i++)
		if (typeof(tokens[i]) == 'object')
			return E('span', {}, tokens);

	return tokens.join('');
}

function snat_proto_txt(s) {
	var m = uci.get('firewall', s, 'mark'),
	    p = uci.get('firewall', s, 'proto');

	return fmt(_('Match %{protocol?%{family} %{protocol} traffic:any %{family} traffic} %{mark?with firewall mark %{mark}}'), {
		protocol: (p && p != 'all' && p != 'any' && p != '*') ? fwtool.fmt_proto(uci.get('firewall', s, 'proto')) : null,
		family:   fwtool.fmt_family('ipv4'),
		mark:     m ? E('var', {}, fwtool.fmt_neg(m)) : null
	});
}

function snat_src_txt(s) {
	return fmt(_('From %{ipaddr?:any host} %{port?with source %{port}}'), {
		ipaddr: fwtool.fmt_ip(uci.get('firewall', s, 'src_ip')),
		port:   fwtool.fmt_port(uci.get('firewall', s, 'src_port'))
	});
}

function snat_dest_txt(s) {
	var z = uci.get('firewall', s, 'src'),
	    d = uci.get('firewall', s, 'device');

	return fmt(_('To %{ipaddr?:any destination} %{port?at %{port}} %{zone?via zone %{zone}} %{device?egress device %{device}}'), {
		port:   fwtool.fmt_port(uci.get('firewall', s, 'dest_port')),
		ipaddr: fwtool.fmt_ip(uci.get('firewall', s, 'dest_ip')),
		zone:   (z != '*') ? fwtool.fmt_zone(z) : null,
		device: d ? E('var', {}, [d]) : null
	});
}

function snat_rewrite_txt(s) {
	var t = uci.get('firewall', s, 'target'),
	    l = fwtool.fmt_limit(uci.get('firewall', s, 'limit'), uci.get('firewall', s, 'limit_burst'));

	if (t == 'SNAT') {
		return fmt(_('Rewrite to %{ipaddr?%{port?%{ipaddr}, %{port}:%{ipaddr}}:%{port}}'), {
			ipaddr: fwtool.fmt_ip(uci.get('firewall', s, 'snat_ip')),
			port:   fwtool.fmt_port(uci.get('firewall', s, 'snat_port'))
		});
	}
	else if (t == 'MASQUERADE') {
		return _('Rewrite to outbound device IP');
	}
	else if (t == 'ACCEPT') {
		return _('Do not rewrite');
	}
}

return L.view.extend({
	callHostHints: rpc.declare({
		object: 'luci-rpc',
		method: 'getHostHints',
		expect: { '': {} }
	}),

	callNetworkDevices: rpc.declare({
		object: 'luci-rpc',
		method: 'getNetworkDevices',
		expect: { '': {} }
	}),

	load: function() {
		return Promise.all([
			this.callHostHints(),
			this.callNetworkDevices()
		]);
	},

	render: function(data) {
		var hosts = data[0],
		    devs = data[1],
		    m, s, o;

		m = new form.Map('firewall', _('Firewall - NAT Rules'),
			_('NAT rules allow fine grained control over the source IP to use for outbound or forwarded traffic.'));

		s = m.section(form.GridSection, 'nat', _('NAT Rules'));
		s.addremove = true;
		s.anonymous = true;
		s.sortable  = true;

		s.tab('general', _('General Settings'));
		s.tab('advanced', _('Advanced Settings'));
		s.tab('timed', _('Time Restrictions'));

		s.sectiontitle = function(section_id) {
			return uci.get('firewall', section_id, 'name') || _('Unnamed NAT');
		};

		o = s.taboption('general', form.Value, 'name', _('Name'));
		o.placeholder = _('Unnamed NAT');
		o.modalonly = true;

		o = s.option(form.DummyValue, '_match', _('Match'));
		o.modalonly = false;
		o.textvalue = function(s) {
			return E('small', [
				snat_proto_txt(s), E('br'),
				snat_src_txt(s), E('br'),
				snat_dest_txt(s)
			]);
		};

		o = s.option(form.ListValue, '_dest', _('Rewrite to'));
		o.modalonly = false;
		o.textvalue = function(s) {
			return snat_rewrite_txt(s);
		};

		o = s.option(form.Flag, 'enabled', _('Enable'));
		o.modalonly = false;
		o.default = o.enabled;
		o.editable = true;

		o = s.taboption('general', form.Value, 'proto', _('Protocol'));
		o.modalonly = true;
		o.default = 'all';
		o.value('all', _('Any'));
		o.value('tcp udp', 'TCP+UDP');
		o.value('tcp', 'TCP');
		o.value('udp', 'UDP');
		o.cfgvalue = function(/* ... */) {
			var v = this.super('cfgvalue', arguments);
			return (v == 'tcpudp') ? 'tcp udp' : v;
		};

		o = s.taboption('general', widgets.ZoneSelect, 'src', _('Outbound zone'));
		o.modalonly = true;
		o.rmempty = false;
		o.nocreate = true;
		o.allowany = true;
		o.default = 'lan';

		o = s.taboption('general', form.Value, 'src_ip', _('Source IP address'),
			_('Match forwarded traffic from this IP or range.'));
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

		o = s.taboption('general', form.Value, 'src_port', _('Source port'),
			_('Match forwarded traffic originating from the given source port or port range.'));
		o.modalonly = true;
		o.rmempty = true;
		o.datatype = 'neg(portrange)';
		o.placeholder = _('any');
		o.depends('proto', 'tcp');
		o.depends('proto', 'udp');
		o.depends('proto', 'tcp udp');
		o.depends('proto', 'tcpudp');

		o = s.taboption('general', form.Value, 'dest_ip', _('Destination IP address'),
			_('Match forwarded traffic directed at the given IP address.'));
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

		o = s.taboption('general', form.Value, 'dest_port', _('Destination port'),
			_('Match forwarded traffic directed at the given destination port or port range.'));
		o.modalonly = true;
		o.rmempty = true;
		o.placeholder = _('any');
		o.datatype = 'neg(portrange)';
		o.depends('proto', 'tcp');
		o.depends('proto', 'udp');
		o.depends('proto', 'tcp udp');
		o.depends('proto', 'tcpudp');

		o = s.taboption('general', form.ListValue, 'target', _('Action'));
		o.modalonly = true;
		o.default = 'SNAT';
		o.value('SNAT', _('SNAT - Rewrite to specific source IP or port'));
		o.value('MASQUERADE', _('MASQUERADE - Automatically rewrite to outbound interface IP'));
		o.value('ACCEPT', _('ACCEPT - Disable address rewriting'));

		o = s.taboption('general', form.Value, 'snat_ip', _('Rewrite IP address'),
			_('Rewrite matched traffic to the specified source IP address.'));
		o.modalonly = true;
		o.rmempty = true;
		o.placeholder = _('do not rewrite');
		o.datatype = 'ip4addr("nomask")';
		o.validate = function(section_id, value) {
			var port = this.map.lookupOption('snat_port', section_id),
			    p = port ? port[0].formvalue(section_id) : null;

			if ((value == null || value == '') && (p == null || p == ''))
				return _('A rewrite IP must be specified!');

			return true;
		};
		o.depends('target', 'SNAT');
		L.sortedKeys(devs, 'name').forEach(function(dev) {
			var ip4addrs = devs[dev].ipaddrs;

			if (!L.isObject(devs[dev].flags) || !Array.isArray(ip4addrs) || devs[dev].flags.loopback)
				return;

			for (var i = 0; i < ip4addrs.length; i++) {
				if (!L.isObject(ip4addrs[i]) || !ip4addrs[i].address)
					continue;

				o.value(ip4addrs[i].address, '%s (%s)'.format(ip4addrs[i].address, dev));
			}
		});

		o = s.taboption('general', form.Value, 'snat_port', _('Rewrite port'),
			_('Rewrite matched traffic to the specified source port or port range.'));
		o.modalonly = true;
		o.rmempty = true;
		o.placeholder = _('do not rewrite');
		o.datatype = 'portrange';
		o.depends({ target: 'SNAT', proto: 'tcp' });
		o.depends({ target: 'SNAT', proto: 'udp' });
		o.depends({ target: 'SNAT', proto: 'tcp udp' });
		o.depends({ target: 'SNAT', proto: 'tcpudp' });

		o = s.taboption('advanced', widgets.DeviceSelect, 'device', _('Outbound device'),
			_('Matches forwarded traffic using the specified outbound network device.'));
		o.noaliases = true;
		o.modalonly = true;
		o.rmempty = true;

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

		o = s.taboption('advanced', form.Value, 'extra', _('Extra arguments'),
			_('Passes additional arguments to iptables. Use with care!'));
		o.modalonly = true;
		o.rmempty = true;

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
