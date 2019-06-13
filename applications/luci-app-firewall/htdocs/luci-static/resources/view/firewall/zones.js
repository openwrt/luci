'use strict';
'require rpc';
'require uci';
'require form';
'require network';
'require firewall';
'require tools.widgets as widgets';

return L.view.extend({
	callOffloadSupport: rpc.declare({
		object: 'luci',
		method: 'offload_support',
		expect: { offload_support: false }
	}),

	load: function() {
		return this.callOffloadSupport();
	},

	render: function(hasOffloading) {
		var m, s, o, inp, out;

		m = new form.Map('firewall', _('Firewall - Zone Settings'),
			_('The firewall creates zones over your network interfaces to control network traffic flow.'));

		s = m.section(form.TypedSection, 'defaults', _('General Settings'));
		s.anonymous = true;
		s.addremove = false;

		o = s.option(form.Flag, 'syn_flood', _('Enable SYN-flood protection'));
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

		if (hasOffloading) {
			s = m.section(form.TypedSection, 'defaults', _('Routing/NAT Offloading'),
				_('Experimental feature. Not fully compatible with QoS/SQM.'));

			s.anonymous = true;
			s.addremove = false;

			o = s.option(form.Flag, 'flow_offloading',
				_('Software flow offloading'),
				_('Software based offloading for routing/NAT'));
			o.optional = true;

			o = s.option(form.Flag, 'flow_offloading_hw',
				_('Hardware flow offloading'),
				_('Requires hardware NAT support. Implemented at least for mt7621'));
			o.optional = true;
			o.depends('flow_offloading', '1');
		}


		s = m.section(form.GridSection, 'zone', _('Zones'));
		s.addremove = true;
		s.anonymous = true;
		s.sortable  = true;

		s.tab('general', _('General Settings'));
		s.tab('advanced', _('Advanced Settings'));

		o = s.taboption('general', form.DummyValue, '_generalinfo');
		o.rawhtml = true;
		o.modalonly = true;
		o.cfgvalue = function(section_id) {
			var name = uci.get('firewall', section_id, 'name');

			return _('This section defines common properties of %q. The <em>input</em> and <em>output</em> options set the default policies for traffic entering and leaving this zone while the <em>forward</em> option describes the policy for forwarded traffic between different networks within the zone. <em>Covered networks</em> specifies which available networks are members of this zone.')
				.replace(/%s/g, name).replace(/%q/g, '"' + name + '"');
		};

		o = s.taboption('general', form.Value, 'name', _('Name'));
		o.placeholder = _('Unnamed zone');
		o.modalonly = true;
		o.datatype = 'and(uciname,maxlength(11))';
		o.write = function(section_id, formvalue) {
			var cfgvalue = this.cfgvalue(section_id);

			if (cfgvalue != formvalue)
				return firewall.renameZone(cfgvalue, formvalue);
		};

		o = s.option(widgets.ZoneForwards, '_info', _('Zone ⇒ Forwardings'));
		o.editable = true;
		o.modalonly = false;
		o.cfgvalue = function(section_id) {
			return uci.get('firewall', section_id, 'name');
		};

		var p = [
			s.taboption('general', form.ListValue, 'input', _('Input')),
			s.taboption('general', form.ListValue, 'output', _('Output')),
			s.taboption('general', form.ListValue, 'forward', _('Forward'))
		];

		for (var i = 0; i < p.length; i++) {
			p[i].value('REJECT', _('reject'));
			p[i].value('DROP', _('drop'));
			p[i].value('ACCEPT', _('accept'));
			p[i].editable = true;
		}

		o = s.taboption('general', form.Flag, 'masq', _('Masquerading'));
		o.editable = true;

		o = s.taboption('general', form.Flag, 'mtu_fix', _('MSS clamping'));
		o.modalonly = true;

		o = s.taboption('general', widgets.NetworkSelect, 'network', _('Covered networks'));
		o.modalonly = true;
		o.multiple = true;
		o.write = function(section_id, formvalue) {
			var name = uci.get('firewall', section_id, 'name'),
			    cfgvalue = this.cfgvalue(section_id);

			if (typeof(cfgvalue) == 'string' && Array.isArray(formvalue) && (cfgvalue == formvalue.join(' ')))
				return;

			var tasks = [ firewall.getZone(name) ];

			if (Array.isArray(formvalue))
				for (var i = 0; i < formvalue.length; i++) {
					var netname = formvalue[i];
					tasks.push(network.getNetwork(netname).then(function(net) {
						return net || network.addNetwork(netname, { 'proto': 'none' });
					}));
				}

			return Promise.all(tasks).then(function(zone_networks) {
				if (zone_networks[0])
					for (var i = 1; i < zone_networks.length; i++)
						zone_networks[0].addNetwork(zone_networks[i].getName());
			});
		};

		o = s.taboption('advanced', form.DummyValue, '_advancedinfo');
		o.rawhtml = true;
		o.modalonly = true;
		o.cfgvalue = function(section_id) {
			var name = uci.get('firewall', section_id, 'name');

			return _('The options below control the forwarding policies between this zone (%s) and other zones. <em>Destination zones</em> cover forwarded traffic <strong>originating from %q</strong>. <em>Source zones</em> match forwarded traffic from other zones <strong>targeted at %q</strong>. The forwarding rule is <em>unidirectional</em>, e.g. a forward from lan to wan does <em>not</em> imply a permission to forward from wan to lan as well.')
				.format(name);
		};

		o = s.taboption('advanced', form.ListValue, 'family', _('Restrict to address family'));
		o.value('', _('IPv4 and IPv6'));
		o.value('ipv4', _('IPv4 only'));
		o.value('ipv6', _('IPv6 only'));
		o.modalonly = true;

		o = s.taboption('advanced', form.DynamicList, 'masq_src', _('Restrict Masquerading to given source subnets'));
		o.depends('family', '');
		o.depends('family', 'ipv4');
		o.datatype = 'list(neg(or(uciname,hostname,ipmask4)))';
		o.placeholder = '0.0.0.0/0';
		o.modalonly = true;

		o = s.taboption('advanced', form.DynamicList, 'masq_dest', _('Restrict Masquerading to given destination subnets'));
		o.depends('family', '');
		o.depends('family', 'ipv4');
		o.datatype = 'list(neg(or(uciname,hostname,ipmask4)))';
		o.placeholder = '0.0.0.0/0';
		o.modalonly = true;

		o = s.taboption('advanced', form.Flag, 'conntrack', _('Force connection tracking'));
		o.modalonly = true;

		o = s.taboption('advanced', form.Flag, 'log', _('Enable logging on this zone'));
		o.modalonly = true;

		o = s.taboption('advanced', form.Value, 'log_limit', _('Limit log messages'));
		o.depends('log', '1');
		o.placeholder = '10/minute';
		o.modalonly = true;

		o = s.taboption('general', form.DummyValue, '_forwardinfo');
		o.rawhtml = true;
		o.modalonly = true;
		o.cfgvalue = function(section_id) {
			return _('The options below control the forwarding policies between this zone (%s) and other zones. <em>Destination zones</em> cover forwarded traffic <strong>originating from %q</strong>. <em>Source zones</em> match forwarded traffic from other zones <strong>targeted at %q</strong>. The forwarding rule is <em>unidirectional</em>, e.g. a forward from lan to wan does <em>not</em> imply a permission to forward from wan to lan as well.')
				.format(uci.get('firewall', section_id, 'name'));
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
			    fwds = zone.getForwardingsBy(out ? 'src' : 'dest'),
			    value = [];

			for (var i = 0; i < fwds.length; i++)
				value.push(out ? fwds[i].getDestination() : fwds[i].getSource());

			return value;
		};
		o.write = o.remove = function(section_id, formvalue) {
			var out = (this.option == 'out'),
			    zone = this.lookupZone(uci.get('firewall', section_id, 'name')),
			    fwds = zone.getForwardingsBy(out ? 'src' : 'dest');

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
