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

function formatRate(bytesPerSecond) {
	const mbit = Math.round(bytesPerSecond * 8 / 1e6);

	return (mbit >= 1000) ? (mbit / 1000) + '\u202fGbit/s' : mbit + '\u202fMbit/s';
}

/* one row per port with the limits tc reports */
function limitRows(tc, ports) {
	return ports.map((port) => {
		const police = L.toArray(tc[port]?.ingress).map((f) => [ f, L.toArray(f.options?.actions).find((a) => a.kind == 'police') ]).find(([ f, a ]) => a);
		const tbf = L.toArray(tc[port]?.qdisc).find((q) => q.kind == 'tbf' && q.root);
		const state = (inHw) => inHw ? _('in hardware') : _('not offloaded');

		return [
			port,
			/* tc -j omits the police rate, so show the configured one next to the hardware state */
			police ? '%s (%s)'.format(formatRate((uci.sections('switchdev', 'ratelimit').find((s) => s.port == port)?.ingress ?? 0) * 125000), state(police[0].options.in_hw)) : _('none'),
			tbf ? '%s (%s)'.format(formatRate(tbf.options.rate), state(tbf.offloaded)) : _('none')
		];
	});
}

return view.extend({
	load() {
		return L.resolveDefault(callGetBuiltinEthernetPorts(), []).then((builtin) => {
			const ports = builtin.map((p) => p.device).sort(L.naturalCompare);

			return Promise.all([ ports, L.resolveDefault(callGetTc(ports), {}), uci.load('switchdev') ]);
		});
	},

	render([ ports, tc ]) {
		const m = new form.Map('switchdev', _('Rate limiting'),
			_('Limit the traffic a port accepts (incoming) or sends (outgoing). The switch enforces the limits; a limit it cannot offload is not applied.'));

		let s = m.section(form.GridSection, 'ratelimit', _('Port limits'));
		s.anonymous = true;
		s.addremove = true;
		s.nodescriptions = true;

		let o = s.option(form.Flag, 'enabled', _('Enabled'));
		o.default = o.enabled;
		o.editable = true;

		o = s.option(form.ListValue, 'port', _('Port'));
		ports.forEach((p) => o.value(p));
		o.rmempty = false;
		o.validate = (section_id, value) => {
			/* the edit modal holds only this section, so compare against the stored ones */
			const dup = uci.sections('switchdev', 'ratelimit').some((s) => s['.name'] != section_id && s.port == value);

			return dup ? _('This port already has a limit') : true;
		};

		o = s.option(form.Value, 'ingress', _('Incoming limit (Mbit/s)'));
		o.datatype = 'range(1,10000)';
		o.placeholder = _('none');

		o = s.option(form.Value, 'egress', _('Outgoing limit (Mbit/s)'));
		o.datatype = 'range(1,10000)';
		o.placeholder = _('none');

		o = s.option(form.Value, 'burst', _('Burst size'));
		o.placeholder = '32k';
		o.validate = (section_id, value) => (!value || /^\d+k?$/.test(value)) ? true : _('Expecting a byte count with an optional k suffix');
		o.modalonly = true;
		o.description = _('Bucket size in bytes, with an optional k suffix. The switch caps it at about 64 KiB.');

		const table = E('table', { 'class': 'table' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th' }, _('Port')),
				E('th', { 'class': 'th' }, _('Incoming limit')),
				E('th', { 'class': 'th' }, _('Outgoing limit'))
			])
		]);

		cbi_update_table(table, limitRows(tc, ports));
		poll.add(() => L.resolveDefault(callGetTc(ports), {}).then((t) => cbi_update_table(table, limitRows(t, ports))), 10);

		return m.render().then((mapEl) => E([], [
			mapEl,
			E('div', { 'class': 'cbi-section' }, [
				E('h3', _('Active limits')),
				table
			])
		]));
	}
});
