'use strict';
'require view';
'require form';
'require uci';

const PORTS = [ 'eth0', 'eth1', 'eth2', 'eth3', 'eth4', 'eth5' ];

function validateDscp(section_id, value) {
	if (value == null || value === '')
		return true;

	if (/^(EF|CS[0-7]|AF[1-4][1-3])$/i.test(value))
		return true;

	if (/^[0-9]+$/.test(value) && +value <= 63)
		return true;

	return _('Expecting a DSCP name (EF, CS0-CS7, AF11-AF43) or a number 0-63');
}

function validateWeights(section_id, value) {
	if (value == null || value === '')
		return true;

	const w = value.trim().split(/\s+/);

	if (w.length == 4 && w.every((x) => /^[0-9]+$/.test(x) && +x >= 1 && +x <= 255))
		return true;

	return _('Expecting four weights 1-255 for queues 0-3, e.g. "1 2 4 8"');
}

/* show "any" instead of "none" for empty match fields in the table */
function anyText(section_id) {
	const v = this.cfgvalue(section_id);
	return (v != null && v !== '') ? this.textvalue_orig(section_id) : E('em', {}, _('any'));
}

function matchField(o) {
	o.textvalue_orig = o.textvalue;
	o.textvalue = anyText;
	return o;
}

return view.extend({
	load() {
		return uci.load('network');
	},

	/* "eth4 (wan)" style labels */
	portLabel(port) {
		const names = [];
		let bridge = null;

		uci.sections('network', 'device', (s) => {
			if (s.type == 'bridge' && L.toArray(s.ports).indexOf(port) >= 0)
				bridge = s.name;
		});

		uci.sections('network', 'interface', (s) => {
			if (s.device == port || (bridge && s.device == bridge))
				names.push(s['.name']);
		});

		return names.length ? '%s (%s)'.format(port, names.join(', ')) : port;
	},

	render() {
		let m, s, o;

		m = new form.Map('dpns-qos', _('Hardware QoS'),
			_('Traffic shaping, queue scheduling and classification done by the NPU. It works for offloaded and CPU forwarded traffic alike, without CPU load.') + '<br />' +
			_('Every egress port has 8 queues. Queues 4-7 are strict priority (7 highest) above queues 0-3, which share the remaining bandwidth by the selected scheduler. Classified packets use the queue of their priority, other packets queue 0. 802.1p priorities of VLAN tagged packets are used automatically.'));

		s = m.section(form.NamedSection, 'globals', 'globals', _('General'));
		s.addremove = false;

		o = s.option(form.Flag, 'enabled', _('Enable hardware QoS'));
		o.rmempty = false;

		s = m.section(form.GridSection, 'port', _('Ports'),
			_('Egress shaping and scheduling of a port. Use the WAN port to shape the upload to the line rate.'));
		s.addremove = true;
		s.anonymous = false;
		s.nodescriptions = true;
		s.addbtntitle = _('Add port');

		o = s.option(form.ListValue, 'device', _('Port'));
		for (let p of PORTS)
			o.value(p, this.portLabel(p));
		o.rmempty = false;

		o = s.option(form.Value, 'rate', _('Rate limit (Mbit/s)'),
			_('Egress rate limit of the port, 0 = no limit'));
		o.datatype = 'range(0,10000)';
		o.placeholder = '0';
		o.default = '0';

		o = s.option(form.ListValue, 'sched', _('Scheduler (queues 0-3)'));
		o.value('pq', _('Strict priority (PQ)'));
		o.value('rr', _('Round robin (RR)'));
		o.value('wrr', _('Weighted round robin (WRR)'));
		o.value('dwrr', _('Deficit weighted round robin (DWRR)'));
		o.default = 'dwrr';

		o = s.option(form.Value, 'weights', _('Weights (queues 0-3)'),
			_('Relative weights of queues 0-3 for WRR and DWRR'));
		o.placeholder = '1 2 4 8';
		o.default = '1 2 4 8';
		o.validate = validateWeights;
		o.depends('sched', 'wrr');
		o.depends('sched', 'dwrr');

		s = m.section(form.GridSection, 'class', _('Classes'),
			_('Packets matching all given fields get the priority (= egress queue). Fields left empty match anything. Addresses are IPv4 only.'));
		s.addremove = true;
		s.anonymous = false;
		s.sortable = true;
		s.nodescriptions = true;
		s.addbtntitle = _('Add class');

		o = s.option(form.Flag, 'enabled', _('Enabled'));
		o.default = o.enabled;
		o.editable = true;

		o = s.option(form.ListValue, 'priority', _('Priority / queue'));
		for (let i = 7; i >= 0; i--)
			o.value(String(i), (i >= 4) ? _('%d (strict priority)').format(i) : String(i));
		o.default = '4';
		o.rmempty = false;

		o = matchField(s.option(form.Value, 'dscp', _('DSCP'),
			_('DSCP name or number. The NPU matches the DSCP class (the upper 3 bits), e.g. AF41 also matches AF42 and AF43.')));
		o.placeholder = _('any');
		o.validate = validateDscp;

		o = matchField(s.option(form.ListValue, 'proto', _('Protocol')));
		o.value('', _('any'));
		o.value('tcp', 'TCP');
		o.value('udp', 'UDP');
		o.value('icmp', 'ICMP');

		o = matchField(s.option(form.Value, 'sport', _('Source port')));
		o.datatype = 'port';
		o.placeholder = _('any');
		o.depends('proto', 'tcp');
		o.depends('proto', 'udp');

		o = matchField(s.option(form.Value, 'dport', _('Destination port')));
		o.datatype = 'port';
		o.placeholder = _('any');
		o.depends('proto', 'tcp');
		o.depends('proto', 'udp');

		o = matchField(s.option(form.Value, 'src', _('Source address')));
		o.datatype = 'or(ip4addr("nomask"),cidr4)';
		o.placeholder = _('any');

		o = matchField(s.option(form.Value, 'dest', _('Destination address')));
		o.datatype = 'or(ip4addr("nomask"),cidr4)';
		o.placeholder = _('any');

		return m.render();
	}
});
