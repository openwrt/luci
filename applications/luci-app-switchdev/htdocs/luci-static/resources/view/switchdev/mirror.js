'use strict';
'require view';
'require form';
'require poll';
'require rpc';
'require uci';

const callGetTc = rpc.declare({
	object: 'luci.switchdev',
	method: 'getTc',
	params: [ 'devices' ],
	expect: { result: {} }
});

const callGetBuiltinEthernetPorts = rpc.declare({
	object: 'luci',
	method: 'getBuiltinEthernetPorts',
	expect: { result: [] }
});

/* one row per active mirror rule as tc reports it */
function mirrorRows(tc, ports) {
	const rows = [];

	for (let port of ports) {
		for (let dir of [ 'ingress', 'egress' ]) {
			for (let f of L.toArray(tc[port]?.[dir])) {
				const opts = f.options ?? {};
				const act = L.toArray(opts.actions).find((a) => a.kind == 'mirred');

				if (f.kind != 'matchall' || !act)
					continue;

				rows.push([
					port,
					(dir == 'ingress') ? _('Incoming') : _('Outgoing'),
					act.to_dev ?? '-',
					opts.in_hw ? _('Yes') : _('No')
				]);
			}
		}
	}

	return rows;
}

return view.extend({
	load() {
		return L.resolveDefault(callGetBuiltinEthernetPorts(), []).then((builtin) => {
			const ports = builtin.map((p) => p.device).sort(L.naturalCompare);

			return Promise.all([ ports, L.resolveDefault(callGetTc(ports), {}), uci.load('switchdev') ]);
		});
	},

	render([ ports, tc ]) {
		const m = new form.Map('switchdev', _('Port mirroring'),
			_('Copy the traffic of one or more ports to a monitoring port. The switch does the copying; a rule it cannot offload is not applied.'));

		let s = m.section(form.GridSection, 'mirror', _('Mirror sessions'));
		s.anonymous = true;
		s.addremove = true;
		s.nodescriptions = true;

		let o = s.option(form.Flag, 'enabled', _('Enabled'));
		o.default = o.enabled;
		o.editable = true;

		o = s.option(form.MultiValue, 'source', _('Source ports'));
		ports.forEach((p) => o.value(p));
		o.rmempty = false;

		o = s.option(form.ListValue, 'direction', _('Direction'));
		o.value('both', _('Incoming and outgoing'));
		o.value('ingress', _('Incoming'));
		o.value('egress', _('Outgoing'));
		o.default = 'both';
		o.textvalue = function(section_id) {
			return this.vallist[this.keylist.indexOf(this.cfgvalue(section_id) ?? 'both')];
		};

		o = s.option(form.ListValue, 'target', _('Monitoring port'));
		ports.forEach((p) => o.value(p));
		o.rmempty = false;
		o.validate = function(section_id, value) {
			const sources = L.toArray(this.section.formvalue(section_id, 'source'));

			return sources.includes(value) ? _('The monitoring port cannot also be a source port') : true;
		};

		const table = E('table', { 'class': 'table' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th' }, _('Source port')),
				E('th', { 'class': 'th' }, _('Direction')),
				E('th', { 'class': 'th' }, _('Monitoring port')),
				E('th', { 'class': 'th' }, _('In hardware'))
			])
		]);

		cbi_update_table(table, mirrorRows(tc, ports), E('em', _('No active mirror rules')));
		poll.add(() => L.resolveDefault(callGetTc(ports), {}).then((t) => cbi_update_table(table, mirrorRows(t, ports), E('em', _('No active mirror rules')))), 10);

		return m.render().then((mapEl) => E([], [
			mapEl,
			E('div', { 'class': 'cbi-section' }, [
				E('h3', _('Active rules')),
				table
			])
		]));
	}
});
