'use strict';
'require view';
'require form';
'require poll';
'require rpc';
'require uci';

const callGetFdb = rpc.declare({
	object: 'luci.switchdev',
	method: 'getFdb',
	expect: { result: [] }
});

const callGetBuiltinEthernetPorts = rpc.declare({
	object: 'luci',
	method: 'getBuiltinEthernetPorts',
	expect: { result: [] }
});

function fdbRows(fdb, ports) {
	/* "self" entries on a switch port come from the switch's own table, not the bridge's software copy */
	return fdb.filter((e) => ports.includes(e.ifname) && !e.master && L.toArray(e.flags).includes('self'))
		.sort((a, b) => L.naturalCompare(a.ifname, b.ifname) || a.mac.localeCompare(b.mac))
		.map((e) => [
			e.mac.toUpperCase(),
			e.ifname,
			e.vlan ?? '-',
			(e.state == 'static' || e.state == 'permanent') ? _('Static') : _('Learned')
		]);
}

return view.extend({
	load() {
		return Promise.all([
			L.resolveDefault(callGetBuiltinEthernetPorts(), []),
			L.resolveDefault(callGetFdb(), []),
			uci.load('switchdev')
		]);
	},

	render([ builtinPorts, fdb ]) {
		const ports = builtinPorts.map((p) => p.device).sort(L.naturalCompare);
		const m = new form.Map('switchdev', _('MAC address table'),
			_('The switch hardware address table, per port and VLAN. Static entries pin an address to a port; they are applied by the switchdev service.'));

		let s = m.section(form.GridSection, 'fdb', _('Static entries'));
		s.anonymous = true;
		s.addremove = true;
		s.nodescriptions = true;

		let o = s.option(form.Value, 'mac', _('MAC address'));
		o.datatype = 'macaddr';
		o.rmempty = false;

		o = s.option(form.ListValue, 'port', _('Port'));
		ports.forEach((p) => o.value(p));
		o.rmempty = false;

		o = s.option(form.Value, 'vlan', _('VLAN'));
		o.datatype = 'range(1,4094)';
		o.placeholder = _('any');

		const table = E('table', { 'class': 'table' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th' }, _('MAC address')),
				E('th', { 'class': 'th' }, _('Port')),
				E('th', { 'class': 'th' }, _('VLAN')),
				E('th', { 'class': 'th' }, _('Type'))
			])
		]);

		cbi_update_table(table, fdbRows(fdb, ports), E('em', _('No entries')));
		poll.add(() => L.resolveDefault(callGetFdb(), []).then((f) => cbi_update_table(table, fdbRows(f, ports), E('em', _('No entries')))), 10);

		return m.render().then((mapEl) => E([], [
			mapEl,
			E('div', { 'class': 'cbi-section' }, [
				E('h3', _('Current entries')),
				table
			])
		]));
	}
});
