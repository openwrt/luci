'use strict';
'require view';
'require rpc';
'require uci';
'require form';
'require network';
'require firewall';
'require tools.firewall as fwtool';
'require tools.widgets as widgets';

return view.extend({
	callConntrackHelpers: rpc.declare({
		object: 'luci',
		method: 'getConntrackHelpers',
		expect: { result: [] }
	}),

	load: function() {
		return Promise.all([
			this.callConntrackHelpers(),
			firewall.getDefaults()
		]);
	},

	render: function(data) {
		if (fwtool.checkLegacySNAT())
			return fwtool.renderMigration();
		else
			return this.renderZones(data);
	},

	renderZones: function(data) {
		var ctHelpers = data[0],
		    fwDefaults = data[1],
		    m, s, o, inp, out;
		var fw4 = L.hasSystemFeature('firewall4');

		m = new form.Map('firewall', _('Firewall - Zone Settings'),
			_('The firewall creates zones over your network interfaces to control network traffic flow.'));

		s = m.section(form.TypedSection, 'defaults', _('General Settings'));
		s.anonymous = true;
		s.addremove = false;

		o = s.option(form.Flag, 'synflood_protect', _('Enable SYN-flood protection'));
		o.cfgvalue = function(section_id) {
			var val = uci.get('firewall', section_id, 'synflood_protect');
			return (val != null) ? val : uci.get('firewall', section_id, 'syn_flood');
		};
		o.write = function(section_id, value) {
			uci.unset('firewall', section_id, 'syn_flood');
			uci.set('firewall', section_id, 'synflood_protect', value);
		};
		o.remove = function(section_id) {
			uci.unset('firewall', section_id, 'syn_flood');
			uci.unset('firewall', section_id, 'synflood_protect');
		};

		o = s.option(form.Flag, 'drop_invalid', _('Drop invalid packets'));

		var p = [
			s.option(form.ListValue, 'input', _('Input')),
			s.option(form.ListValue, 'output', _('Output')),
			s.option(form.ListValue, 'forward', _('Forward'))
		];

		for (var i = 0; i < p.length; i++) {
			p[i].value('REJECT', _('reject'));
			p[i].value('DROP', _('drop'));
			p[i].value('ACCEPT', _('accept'));
		}

		/* Netfilter flow offload support */

		if (L.hasSystemFeature('offloading')) {
			s = m.section(form.TypedSection, 'defaults', _('Routing/NAT Offloading'),
				_('Not fully compatible with QoS/SQM.'));

			s.anonymous = true;
			s.addremove = false;

			o = s.option(form.RichListValue, "offloading_type", _("Flow offloading type"));
			o.value('0', _("None"));
			o.value('1', _("Software flow offloading"), _('Software based offloading for routing/NAT.'));
			o.value('2', _("Hardware flow offloading"), _('Hardware based offloading for routing with/without NAT.') + ' ' + _(' Requires hardware NAT support.'));
			o.optional = false;
			o.load = function (section_id) {
				var flow_offloading = uci.get('firewall', section_id, 'flow_offloading');
				var flow_offloading_hw = uci.get('firewall', section_id, 'flow_offloading_hw');
				return (flow_offloading === '1')
					? (flow_offloading_hw === '1' ? '2' : '1')
					: '0';
			};
			o.write = function(section_id, value) {
				uci.set('firewall', section_id, 'flow_offloading', value === '0' ? null : '1');
				uci.set('firewall', section_id, 'flow_offloading_hw', value === '2' ? '1' : null);
			};
		}


		s = m.section(form.GridSection, 'zone', _('Zones'));
		s.addremove = true;
		s.anonymous = true;
		s.sortable  = true;
		s.nodescriptions = true;

		s.handleRemove = function(section_id, ev) {
			return firewall.deleteZone(section_id).then(L.bind(function() {
				return this.super('handleRemove', [section_id, ev]);
			}, this));
		};

		s.tab('general', _('General Settings'));
		s.tab('advanced', _('Advanced Settings'));
		s.tab('conntrack', _('Conntrack Settings'));
		s.tab('extra', _('Extra iptables arguments'));

		o = s.taboption('general', form.DummyValue, '_generalinfo');
		o.rawhtml = true;
		o.modalonly = true;
		o.cfgvalue = function(section_id) {
			var name = uci.get('firewall', section_id, 'name');
			if (name == null)
				name = _("this new zone");
			return _('This section defines common properties of %q. The <em>input</em> and <em>output</em> options set the default policies for traffic entering and leaving this zone while the <em>forward</em> option describes the policy for forwarded traffic between different networks within the zone. <em>Covered networks</em> specifies which available networks are members of this zone.')
				.replace(/%s/g, name).replace(/%q/g, '"' + name + '"');
		};

		o = s.taboption('general', form.Value, 'name', _('Name'));
		o.placeholder = _('Unnamed zone');
		o.modalonly = true;
		o.rmempty = false;
		o.datatype = L.hasSystemFeature('firewall4') ? 'uciname' : 'and(uciname,maxlength(11))';
		o.write = function(section_id, formvalue) {
			var cfgvalue = this.cfgvalue(section_id);

			if (cfgvalue == null || cfgvalue == '')
				return uci.set('firewall', section_id, 'name', formvalue);
			else if (cfgvalue != formvalue)
				return firewall.renameZone(cfgvalue, formvalue);
		};

		o = s.option(widgets.ZoneForwards, '_info', _('Zone ⇒ Forwards'));
		o.editable = true;
		o.modalonly = false;
		o.cfgvalue = function(section_id) {
			return uci.get('firewall', section_id, 'name');
		};

		var p = [
			s.taboption('general', form.ListValue, 'input', _('Input')),
			s.taboption('general', form.ListValue, 'output', _('Output')),
			s.taboption('general', form.ListValue, 'forward', _('Intra zone forward'))
		];

		for (var i = 0; i < p.length; i++) {
			p[i].value('REJECT', _('reject'));
			p[i].value('DROP', _('drop'));
			p[i].value('ACCEPT', _('accept'));
			p[i].editable = true;
		}

		p[0].default = fwDefaults.getInput();
		p[1].default = fwDefaults.getOutput();
		p[2].default = fwDefaults.getForward();

		o = s.taboption('general', form.Flag, 'masq', _('Masquerading'),
			_('Enable network address and port translation IPv4 (NAT4 or NAPT4) for outbound traffic on this zone. This is typically enabled on the <em>wan</em> zone.'));
		o.editable = true;
		o.tooltip = function(section_id) {
			var family = uci.get('firewall', section_id, 'family')
			var masq_src = uci.get('firewall', section_id, 'masq_src')
			var masq_dest = uci.get('firewall', section_id, 'masq_dest')
			if ((!family || family.indexOf('6') == -1) && (masq_src || masq_dest))
				return _('Limited masquerading enabled');

			return null;
		};

		o = s.taboption('general', form.Flag, 'mtu_fix', _('MSS clamping'));
		o.modalonly = true;

		o = s.taboption('general', widgets.NetworkSelect, 'network', _('Covered networks'));
		o.modalonly = true;
		o.multiple = true;
		o.cfgvalue = function(section_id) {
			return uci.get('firewall', section_id, 'network');
		};
		o.write = function(section_id, formvalue) {
			var name = uci.get('firewall', section_id, 'name'),
			    cfgvalue = this.cfgvalue(section_id),
			    oldNetworks = L.toArray(cfgvalue),
			    newNetworks = L.toArray(formvalue);

			oldNetworks.sort();
			newNetworks.sort();

			if (oldNetworks.join(' ') == newNetworks.join(' '))
				return;

			var tasks = [ firewall.getZone(name) ];

			if (Array.isArray(formvalue))
				for (var i = 0; i < newNetworks.length; i++) {
					var netname = newNetworks[i];
					tasks.push(network.getNetwork(netname).then(L.bind(function(netname, net) {
						return net || network.addNetwork(netname, { 'proto': 'none' });
					}, this, netname)));
				}

			return Promise.all(tasks).then(function(zone_networks) {
				if (zone_networks[0]) {
					zone_networks[0].clearNetworks();
					for (var i = 1; i < zone_networks.length; i++)
						zone_networks[0].addNetwork(zone_networks[i].getName());
				}
			});
		};

		o = s.taboption('advanced', form.DummyValue, '_advancedinfo');
		o.rawhtml = true;
		o.modalonly = true;
		o.cfgvalue = function(section_id) {
			var name = uci.get('firewall', section_id, 'name');
			if (name == null)
				name = _("this new zone");
			return _('The options below control the forwarding policies between this zone (%s) and other zones. <em>Destination zones</em> cover forwarded traffic <strong>originating from %q</strong>. <em>Source zones</em> match forwarded traffic from other zones <strong>targeted at %q</strong>. The forwarding rule is <em>unidirectional</em>, e.g. a forward from lan to wan does <em>not</em> imply a permission to forward from wan to lan as well.')
				.format(name);
		};

		o = s.taboption('advanced', widgets.DeviceSelect, 'device', _('Covered devices'), _('Use this option to classify zone traffic by raw, non-<em>uci</em> managed network devices.'));
		o.modalonly = true;
		o.noaliases = true;
		o.multiple = true;

		o = s.taboption('advanced', form.DynamicList, 'subnet', _('Covered subnets'), _('Use this option to classify zone traffic by source or destination subnet instead of networks or devices.'));
		o.datatype = 'neg(cidr("true"))';
		o.modalonly = true;
		o.multiple = true;

		if (fw4) {
			o = s.taboption('advanced', form.Flag, 'masq6', _('IPv6 Masquerading'),
				_('Enable network address and port translation IPv6 (NAT6 or NAPT6) for outbound traffic on this zone.'));
			o.modalonly = true;
			o.tooltip = function(section_id) {
				var family = uci.get('firewall', section_id, 'family')
				var masq_src = uci.get('firewall', section_id, 'masq_src')
				var masq_dest = uci.get('firewall', section_id, 'masq_dest')
				if ((!family || family.indexOf('6') >= 0) && (masq_src || masq_dest))
					return _('Limited masquerading enabled');
				return null;
			};
		}

		o = s.taboption('advanced', form.ListValue, 'family', _('Restrict to address family'));
		o.value('', _('IPv4 and IPv6'));
		o.value('ipv4', _('IPv4 only'));
		o.value('ipv6', _('IPv6 only'));
		o.modalonly = true;

		o = s.taboption('advanced', form.DynamicList, 'masq_src', _('Restrict Masquerading to given source subnets'));
		if (fw4) {
			o.datatype = 'list(neg(or(uciname,hostname,ipmask)))';
		} else {
			o.depends('family', '');
			o.depends('family', 'ipv4');
			o.datatype = 'list(neg(or(uciname,hostname,ipmask4)))';
		}
		o.placeholder = '0.0.0.0/0';
		o.modalonly = true;

		o = s.taboption('advanced', form.DynamicList, 'masq_dest', _('Restrict Masquerading to given destination subnets'));
		if (fw4) {
			o.datatype = 'list(neg(or(uciname,hostname,ipmask)))';
		} else {
			o.depends('family', '');
			o.depends('family', 'ipv4');
			o.datatype = 'list(neg(or(uciname,hostname,ipmask4)))';
		}
		o.placeholder = '0.0.0.0/0';
		o.modalonly = true;

		o = s.taboption('conntrack', form.Flag, 'masq_allow_invalid', _('Allow "invalid" traffic'), _('Do not install extra rules to reject forwarded traffic with conntrack state <em>invalid</em>. This may be required for complex asymmetric route setups.'));
		o.modalonly = true;

		o = s.taboption('conntrack', form.Flag, 'auto_helper', _('Automatic helper assignment'), _('Automatically assign conntrack helpers based on traffic protocol and port'));
		o.default = o.enabled;
		o.modalonly = true;

		o = s.taboption('conntrack', form.MultiValue, 'helper', _('Conntrack helpers'), _('Explicitly choses allowed connection tracking helpers for zone traffic'));
		o.depends('auto_helper', '0');
		o.modalonly = true;
		for (var i = 0; i < ctHelpers.length; i++)
			o.value(ctHelpers[i].name, E('<span><span class="hide-close">%s (%s)</span><span class="hide-open">%s</span></span>'.format(ctHelpers[i].description, ctHelpers[i].name.toUpperCase(), ctHelpers[i].name.toUpperCase())));

		o = s.taboption('advanced', form.Flag, 'log', _('Enable logging on this zone'));
		o.modalonly = true;

		o = s.taboption('advanced', form.Value, 'log_limit', _('Limit log messages'));
		o.depends('log', '1');
		o.placeholder = '10/minute';
		o.modalonly = true;

		if (!L.hasSystemFeature('firewall4')) {
			o = s.taboption('extra', form.DummyValue, '_extrainfo');
			o.rawhtml = true;
			o.modalonly = true;
			o.cfgvalue = function(section_id) {
				return _('Passing raw iptables arguments to source and destination traffic classification rules allows to match packets based on other criteria than interfaces or subnets. These options should be used with extreme care as invalid values could render the firewall ruleset broken, completely exposing all services.');
			};

			o = s.taboption('extra', form.Value, 'extra_src', _('Extra source arguments'), _('Additional raw <em>iptables</em> arguments to classify zone source traffic, e.g. <code>-p tcp --sport 443</code> to only match inbound HTTPS traffic.'));
			o.modalonly = true;
			o.cfgvalue = function(section_id) {
				return uci.get('firewall', section_id, 'extra_src') || uci.get('firewall', section_id, 'extra');
			};
			o.write = function(section_id, value) {
				uci.unset('firewall', section_id, 'extra');
				uci.set('firewall', section_id, 'extra_src', value);
			};

			o = s.taboption('extra', form.Value, 'extra_dest', _('Extra destination arguments'), _('Additional raw <em>iptables</em> arguments to classify zone destination traffic, e.g. <code>-p tcp --dport 443</code> to only match outbound HTTPS traffic.'));
			o.modalonly = true;
			o.cfgvalue = function(section_id) {
				return uci.get('firewall', section_id, 'extra_dest') || uci.get('firewall', section_id, 'extra_src') || uci.get('firewall', section_id, 'extra');
			};
			o.write = function(section_id, value) {
				uci.unset('firewall', section_id, 'extra');
				uci.set('firewall', section_id, 'extra_dest', value);
			};
		}

		o = s.taboption('general', form.DummyValue, '_forwardinfo');
		o.rawhtml = true;
		o.modalonly = true;
		o.cfgvalue = function(section_id) {
			var name = uci.get('firewall', section_id, 'name');
			if (name == null)
				name = _("this new zone");
			return _('The options below control the forwarding policies between this zone (%s) and other zones. <em>Destination zones</em> cover forwarded traffic <strong>originating from %q</strong>. <em>Source zones</em> match forwarded traffic from other zones <strong>targeted at %q</strong>. The forwarding rule is <em>unidirectional</em>, e.g. a forward from lan to wan does <em>not</em> imply a permission to forward from wan to lan as well.')
				.format(name);
		};

		out = o = s.taboption('general', widgets.ZoneSelect, 'out', _('Allow forward to <em>destination zones</em>:'));
		o.nocreate = true;
		o.multiple = true;
		o.modalonly = true;
		o.filter = function(section_id, value) {
			return (uci.get('firewall', section_id, 'name') != value);
		};
		o.cfgvalue = function(section_id) {
			var out = (this.option == 'out'),
			    zone = this.lookupZone(uci.get('firewall', section_id, 'name')),
			    fwds = zone ? zone.getForwardingsBy(out ? 'src' : 'dest') : [],
			    value = [];

			for (var i = 0; i < fwds.length; i++)
				value.push(out ? fwds[i].getDestination() : fwds[i].getSource());

			return value;
		};
		o.write = o.remove = function(section_id, formvalue) {
			var out = (this.option == 'out'),
			    zone = this.lookupZone(uci.get('firewall', section_id, 'name')),
			    fwds = zone ? zone.getForwardingsBy(out ? 'src' : 'dest') : [];

			if (formvalue == null)
				formvalue = [];

			if (Array.isArray(formvalue)) {
				for (var i = 0; i < fwds.length; i++) {
					var cmp = out ? fwds[i].getDestination() : fwds[i].getSource();
					if (!formvalue.filter(function(d) { return d == cmp }).length)
						zone.deleteForwarding(fwds[i]);
				}

				for (var i = 0; i < formvalue.length; i++)
					if (out)
						zone.addForwardingTo(formvalue[i]);
					else
						zone.addForwardingFrom(formvalue[i]);
			}
		};

		inp = o = s.taboption('general', widgets.ZoneSelect, 'in', _('Allow forward from <em>source zones</em>:'));
		o.nocreate = true;
		o.multiple = true;
		o.modalonly = true;
		o.write = o.remove = out.write;
		o.filter = out.filter;
		o.cfgvalue = out.cfgvalue;

		return m.render();
	}
});
