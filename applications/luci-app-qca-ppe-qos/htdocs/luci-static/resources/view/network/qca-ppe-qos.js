'use strict';
'require view';
'require form';
'require network';
'require uci';
'require tools.widgets as widgets';

/* The class keywords the qca-ppe-qos init accepts, with their DSCP values. */
const CLASSES = [
	[ 'cs0',  0,  _('Best effort') ],
	[ 'le',   1,  _('Lower effort') ],
	[ 'cs1',  8,  _('Scavenger, bulk') ],
	[ 'af11', 10, _('High-throughput data') ],
	[ 'af12', 12 ],
	[ 'af13', 14 ],
	[ 'cs2',  16, _('Operations, administration') ],
	[ 'af21', 18, _('Low-latency data') ],
	[ 'af22', 20 ],
	[ 'af23', 22 ],
	[ 'cs3',  24, _('Broadcast video') ],
	[ 'af31', 26, _('Multimedia streaming') ],
	[ 'af32', 28 ],
	[ 'af33', 30 ],
	[ 'cs4',  32, _('Real-time interactive, games') ],
	[ 'af41', 34, _('Multimedia conferencing, calls') ],
	[ 'af42', 36 ],
	[ 'af43', 38 ],
	[ 'cs5',  40, _('Signalling, DNS') ],
	[ 'va',   44, _('Voice admit') ],
	[ 'ef',   46, _('Telephony, voice') ],
	[ 'cs6',  48, _('Network control') ],
	[ 'cs7',  56, _('Reserved') ]
];

/* A shaped port serves priorities 4 to 7 ahead of its bulk band, 0 to 3. */
const PRIO_BAND = 4;

function class_dscp(value) {
	const c = CLASSES.find((c) => c[0] == value);

	if (c)
		return c[1];

	if (/^[0-9]{1,2}$/.test(value) && +value <= 63)
		return +value;

	return null;
}

function class_label(dscp) {
	const c = CLASSES.find((c) => c[1] == dscp);

	return c ? c[0].toUpperCase() : String(dscp);
}

function prio_label(prio) {
	return (prio >= PRIO_BAND)
		? _('%d - priority band').format(prio)
		: _('%d - bulk band').format(prio);
}

function prio_values(o) {
	for (let i = 0; i <= 7; i++)
		o.value(i, prio_label(i));
}

/* The priority the DSCP map gives a mark; null leaves it in the bulk band. */
function dscp_prio(dscp) {
	const s = uci.sections('qca-ppe-qos', 'dscp').find((s) => s.dscp != null && +s.dscp == dscp);

	return s ? +s.prio : null;
}

function vars(values) {
	const nodes = [];

	values.forEach((v, i) => {
		if (i > 0)
			nodes.push(', ');
		nodes.push(E('var', v));
	});

	return nodes;
}

function rule_match_txt(section_id) {
	const get = (opt) => L.toArray(uci.get('qca-ppe-qos', section_id, opt));
	const proto = uci.get('qca-ppe-qos', section_id, 'proto') || 'tcpudp';
	const src_ip = get('src_ip'), src_port = get('src_port');
	const dest_ip = get('dest_ip'), dest_port = get('dest_port');
	const lines = [];

	lines.push(vars(proto == 'tcpudp' ? [ 'TCP', 'UDP' ] : [ proto.toUpperCase() ]));

	if (src_ip.length || src_port.length) {
		const from = [ _('From') + ' ' ];

		from.push(...(src_ip.length ? vars(src_ip) : [ _('any host') ]));
		if (src_port.length)
			from.push(', ' + _('port') + ' ', ...vars(src_port));
		lines.push(from);
	}

	const to = [ _('To') + ' ' ];

	to.push(...(dest_ip.length ? vars(dest_ip) : [ _('any host') ]));
	if (dest_port.length)
		to.push(', ' + _('port') + ' ', ...vars(dest_port));
	lines.push(to);

	return E('small', lines.reduce((acc, l, i) => acc.concat(i ? [ E('br') ] : [], l), []));
}

function rule_class_txt(section_id) {
	const dscp = class_dscp(uci.get('qca-ppe-qos', section_id, 'class'));

	if (dscp == null)
		return E('em', _('Invalid class'));

	const prio = dscp_prio(dscp);

	return E('span', [
		E('var', class_label(dscp)), ' (%d)'.format(dscp), E('br'),
		E('small', (prio != null) ? _('Priority %s').format(prio_label(prio)) : _('Unmapped - bulk band'))
	]);
}

return view.extend({
	load() {
		return Promise.all([
			network.getDevices(),
			uci.load('qca-ppe-qos')
		]);
	},

	render([ devices ]) {
		/* DSA user ports; the conduit is a switch device too, but has no parent. */
		const switch_ports = devices
			.filter((d) => d.getType() == 'switch' && d.getParent())
			.map((d) => d.getName());
		let m, s, o;

		m = new form.Map('qca-ppe-qos', _('PPE Hardware QoS'),
			_('Sorts traffic into the egress queues of the switch. Marking rules put a DSCP on a flow, the DSCP map turns a DSCP into a priority, and priorities 4 to 7 are served ahead of the bulk band of a shaped port. The switch does all of this itself, so it covers flows the PPE has offloaded. Shaper rates belong to SQM.'));

		s = m.section(form.NamedSection, 'global', 'global');
		s.tab('general', _('General Settings'));
		s.tab('advanced', _('Advanced Settings'));

		o = s.taboption('general', form.Flag, 'enabled', _('Enable marking rules'),
			_('The DSCP map and the small packet priority stay in effect either way.'));
		o.default = o.enabled;
		o.rmempty = false;

		o = s.taboption('general', form.Value, 'small_pkt_len', _('Small packet length'),
			_('Packets up to this IP length take the small packet priority whatever their marking: ACKs, DNS, VoIP and game traffic. Keep it below a full-size segment. 0 disables.'));
		o.datatype = 'and(uinteger,range(0,1500))';
		o.placeholder = '1000';

		o = s.taboption('general', form.ListValue, 'small_pkt_prio', _('Small packet priority'));
		prio_values(o);
		o.default = '5';

		o = s.taboption('advanced', widgets.DeviceSelect, 'wan_port', _('Uplink switch port'),
			_('The switch port the download half of each rule is installed on. Left empty, it is taken from the WAN interface.'));
		o.noaliases = true;
		o.nocreate = true;
		o.optional = true;
		o.filter = (section_id, name) => switch_ports.includes(name);

		o = s.taboption('advanced', form.Flag, 'mark_upload', _('Mark upload'),
			_('Also installs each rule on every client-facing port. This costs a classifier entry per port, and small upload packets are prioritized without it.'));

		s = m.section(form.GridSection, 'rule', _('Marking Rules'),
			_('A rule marks the download direction of the flows it matches. The switch matches addresses and ports only, not domain names.'));
		s.addremove = true;
		s.anonymous = true;
		s.sortable = true;
		s.cloneable = true;
		s.nodescriptions = true;
		s.tab('general', _('General Settings'));
		s.tab('advanced', _('Advanced Settings'));
		s.modaltitle = (section_id) => _('Marking Rules') + ' » ' + (uci.get('qca-ppe-qos', section_id, 'name') || _('Unnamed rule'));
		s.sectiontitle = (section_id) => uci.get('qca-ppe-qos', section_id, 'name') || _('Unnamed rule');

		o = s.taboption('general', form.Value, 'name', _('Name'));
		o.placeholder = _('Unnamed rule');
		o.modalonly = true;

		o = s.option(form.DummyValue, '_match', _('Match'));
		o.modalonly = false;
		o.textvalue = rule_match_txt;

		o = s.option(form.DummyValue, '_class', _('Class'));
		o.modalonly = false;
		o.textvalue = rule_class_txt;

		o = s.taboption('general', form.Flag, 'enabled', _('Enable'));
		o.default = o.enabled;
		o.rmempty = false;
		o.editable = true;

		o = s.taboption('general', form.ListValue, 'proto', _('Protocol'));
		o.value('tcpudp', 'TCP+UDP');
		o.value('tcp', 'TCP');
		o.value('udp', 'UDP');
		o.default = 'tcpudp';
		o.modalonly = true;

		o = s.taboption('general', form.DynamicList, 'dest_ip', _('Destination address'),
			_('IPv4 and IPv6 addresses or subnets.'));
		o.datatype = 'ipmask';
		o.placeholder = _('any');
		o.modalonly = true;

		o = s.taboption('general', form.DynamicList, 'dest_port', _('Destination port'),
			_('Ports or port ranges, such as 5000-5500.'));
		o.datatype = 'portrange';
		o.placeholder = _('any');
		o.modalonly = true;

		o = s.taboption('general', form.Value, 'class', _('Class'),
			_('The DSCP to mark with, as a class name or a number from 0 to 63. It picks the switch queue through the DSCP map below and the Wi-Fi access category directly.'));
		CLASSES.forEach(([ name, dscp, desc ]) =>
			o.value(name, '%s (%d)%s'.format(name.toUpperCase(), dscp, desc ? ' - ' + desc : '')));
		o.rmempty = false;
		o.modalonly = true;
		o.validate = function(section_id, value) {
			if (class_dscp(value) == null)
				return _('Expecting a class name or a DSCP value from 0 to 63');

			const matches = [ 'src_ip', 'src_port', 'dest_ip', 'dest_port' ]
				.some((opt) => L.toArray(this.section.formvalue(section_id, opt)).length);

			if (!matches)
				return _('A rule needs an address or a port, or it would mark all traffic');

			return true;
		};

		o = s.taboption('advanced', form.DynamicList, 'src_ip', _('Source address'),
			_('IPv4 and IPv6 addresses or subnets.'));
		o.datatype = 'ipmask';
		o.placeholder = _('any');
		o.modalonly = true;

		o = s.taboption('advanced', form.DynamicList, 'src_port', _('Source port'),
			_('Ports or port ranges, such as 5000-5500.'));
		o.datatype = 'portrange';
		o.placeholder = _('any');
		o.modalonly = true;

		s = m.section(form.TableSection, 'dscp', _('DSCP Map'),
			_('What a DSCP is worth once the switch reads it, for traffic these rules mark and traffic that arrives marked alike. Unlisted values stay in the bulk band.'));
		s.addremove = true;
		s.anonymous = true;
		s.nodescriptions = true;

		o = s.option(form.Value, 'dscp', _('DSCP'));
		CLASSES.forEach(([ name, dscp ]) => o.value(String(dscp), '%d (%s)'.format(dscp, name.toUpperCase())));
		o.datatype = 'and(uinteger,range(0,63))';
		o.rmempty = false;
		o.validate = function(section_id, value) {
			const dup = this.section.cfgsections().some((sid) =>
				sid != section_id && value !== '' && this.formvalue(sid) == value);

			return dup ? _('This DSCP is already mapped') : true;
		};

		o = s.option(form.ListValue, 'prio', _('Priority'));
		prio_values(o);
		o.rmempty = false;

		return m.render();
	}
});
