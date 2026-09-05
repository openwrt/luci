'use strict';
'require view';
'require form';

var CLASSES = [
	[ 'cs0',  _('CS0 - best effort') ],
	[ 'cs1',  _('CS1 - scavenger / bulk') ],
	[ 'cs3',  _('CS3 - broadcast video') ],
	[ 'af31', _('AF31 - multimedia streaming') ],
	[ 'cs4',  _('CS4 - real-time interactive (games)') ],
	[ 'af41', _('AF41 - multimedia conferencing (calls)') ],
	[ 'cs5',  _('CS5 - signalling, DNS') ],
	[ 'ef',   _('EF - voice bearer') ],
	[ 'cs6',  _('CS6 - network control') ]
];

function prio_options(o) {
	for (var i = 0; i <= 7; i++)
		o.value(i, i >= 4 ? _('Priority %d (served past the bulk queue)').format(i)
				  : _('Priority %d (bulk queue)').format(i));
}

return view.extend({
	render: function() {
		var m, s, o;

		m = new form.Map('ppe-qos', _('PPE Hardware QoS'),
			_('Which egress queue of the switch a flow rides. A marking rule puts a DSCP on the flow, ' +
			  'a map turns that DSCP into an internal priority, and the priority picks the queue: ' +
			  'priorities 4 and up are served past the bulk queue of a shaped port, so marked traffic ' +
			  'keeps idle latency while the bulk queue stays deep enough for full throughput. ' +
			  'Marking is done by the switch itself, so it reaches flows the PPE has offloaded. ' +
			  'Shaper rates and the bulk queue depth belong to SQM (hw_ppe.qos).'));

		s = m.section(form.NamedSection, 'global', 'global', _('Global'));

		o = s.option(form.Flag, 'enabled', _('Enable marking rules'),
			_('Turns the rules below off without deleting them. The DSCP maps and the small-packet ' +
			  'priority stay in effect either way.'));
		o.default = '1';
		o.rmempty = false;

		o = s.option(form.Value, 'small_packet_len', _('Small packet: maximum L3 length'),
			_('Frames up to this IP length take the priority below whatever their marking: ' +
			  'ACKs, handshakes, DNS, VoIP and game traffic jump the bulk queue. 0 disables. ' +
			  'A value just under the MTU means "everything that is not a full-size bulk frame".'));
		o.datatype = 'and(uinteger,range(0,1500))';
		o.placeholder = '128';

		o = s.option(form.ListValue, 'small_packet_prio', _('Small packet: priority'));
		prio_options(o);
		o.default = '5';

		o = s.option(form.Value, 'wan_port', _('Uplink switch port'),
			_('Left empty this is taken from the WAN interface, with any VLAN id stripped, ' +
			  'since the switch knows only the port. Set it if that guess is wrong.'));
		o.datatype = 'netdevname';
		o.placeholder = _('auto');
		o.optional = true;

		/* Marking rules. */
		s = m.section(form.GridSection, 'rule', _('Marking rules'),
			_('Each rule is applied in both directions: as written on the ports your clients sit ' +
			  'behind, and mirrored on the uplink port so the returning half of the same connection ' +
			  'is marked too. Ports may be single or a range (5000-5500), and several may be listed. ' +
			  'The switch matches addresses and ports only - there is no matching by domain name.'));
		s.addremove = true;
		s.anonymous = true;
		s.sortable = true;
		s.nodescriptions = true;

		o = s.option(form.Flag, 'enabled', _('Enable'));
		o.editable = true;
		o.default = '1';

		o = s.option(form.Value, 'name', _('Name'));
		o.rmempty = false;

		o = s.option(form.ListValue, 'proto', _('Protocol'));
		o.value('tcpudp', _('TCP and UDP'));
		o.value('tcp', 'TCP');
		o.value('udp', 'UDP');
		o.default = 'tcpudp';

		o = s.option(form.Value, 'src_ip', _('Source address'),
			_('Optional. Addresses or CIDRs, space separated; IPv4 and IPv6 may be mixed.'));
		o.datatype = 'list(ipmask)';
		o.optional = true;
		o.modalonly = true;

		o = s.option(form.Value, 'dest_ip', _('Destination address'),
			_('Optional, same syntax as the source address.'));
		o.datatype = 'list(ipmask)';
		o.optional = true;
		o.modalonly = true;

		o = s.option(form.Value, 'src_port', _('Source port'),
			_('Optional. A port, a range, or several separated by spaces.'));
		o.datatype = 'list(portrange)';
		o.optional = true;
		o.modalonly = true;

		o = s.option(form.Value, 'dest_port', _('Destination port'),
			_('Optional, same syntax as the source port. This is the usual way to name a service.'));
		o.datatype = 'list(portrange)';
		o.optional = true;

		o = s.option(form.ListValue, 'class', _('Class'),
			_('A class only changes the queue if the map below turns it into a priority of 4 or more. ' +
			  'It also reaches Wi-Fi, which reads the DSCP for its own access categories.'));
		CLASSES.forEach(function(c) { o.value(c[0], c[1]); });
		o.rmempty = false;

		/* DSCP to priority. */
		s = m.section(form.GridSection, 'dscp', _('DSCP to priority'),
			_('What a mark is worth once the switch reads it. Applied with dcb app on every switch ' +
			  'port, so it classifies traffic marked by these rules and traffic that arrives already ' +
			  'marked alike. Anything unlisted stays at priority 0 and rides the bulk queue.'));
		s.addremove = true;
		s.anonymous = true;

		o = s.option(form.Value, 'dscp', _('DSCP'));
		o.datatype = 'and(uinteger,range(0,63))';
		o.rmempty = false;
		o.value('32', _('32 (CS4 - games)'));
		o.value('34', _('34 (AF41 - calls)'));
		o.value('40', _('40 (CS5 - signalling, DNS)'));
		o.value('46', _('46 (EF - voice)'));
		o.value('48', _('48 (CS6 - control)'));

		o = s.option(form.ListValue, 'prio', _('Priority'));
		prio_options(o);
		o.rmempty = false;

		return m.render();
	}
});
