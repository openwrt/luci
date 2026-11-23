'use strict';
'require view';
'require dom';
'require poll';
'require rpc';
'require uci';
'require ui';

const callStatus = rpc.declare({
	object: 'luci.sf21-dpns',
	method: 'getStatus',
	params: [ 'voltage' ],
	expect: { '': {} }
});

const VOLTAGE_EVERY = 10;	/* polls; every voltage read takes ~140 ms */

function fmtRate(bps) {
	if (bps == null || bps < 0)
		return '-';

	return (bps >= 1e6) ? '%.1f Mbit/s'.format(bps / 1e6) : '%.0f kbit/s'.format(bps / 1e3);
}

function fmtBytes(n) {
	return (n != null) ? '%1024.2mB'.format(n) : '-';
}

function row(label, value) {
	return E('tr', { 'class': 'tr' }, [
		E('td', { 'class': 'td left', 'width': '33%' }, [ label ]),
		E('td', { 'class': 'td left' }, [ value ])
	]);
}

function modeText(name, on) {
	switch (name) {
	case 'lf4_offload':
		return on ? _('routed IPv4 (no NAT) in hardware, NAT44 in software')
		          : _('NAT44 in hardware, routed IPv4 (no NAT) in software');
	case 'lf_offload':
		return on ? _('routed IPv6 (no NAT) in hardware, NAT66 in software')
		          : _('NAT66 in hardware, routed IPv6 (no NAT) in software');
	case 'l2_bridge_iso':
		return on ? _('on (hardware L2 forwarding only within a bridge)') : _('off');
	}
}

return view.extend({
	prev: null,
	polls: 0,
	voltage: {},

	load() {
		return Promise.all([
			callStatus(true),
			uci.load('firewall'),
			uci.load('network')
		]);
	},

	/* port or bridge device -> logical interface name ("lan", "wan") */
	netName(port) {
		const dev = port.master || port.name;
		const names = [];

		uci.sections('network', 'interface', (s) => {
			if (s.device == dev)
				names.push(s['.name']);
		});

		return names.length ? '%s (%s)'.format(names.join(', '), dev) : (port.master || '-');
	},

	renderOffload(st) {
		const fw = uci.get_first('firewall', 'defaults');
		const sw = fw && fw.flow_offloading == '1';
		const hw = sw && fw.flow_offloading_hw == '1';
		const table = E('table', { 'class': 'table' });
		let pending = false;

		table.appendChild(row(_('Hardware flow offloading'), hw
			? E('strong', {}, _('enabled'))
			: E('span', {}, [
				E('strong', {}, sw ? _('disabled (software offloading only)') : _('disabled')), ' ',
				E('a', { 'href': L.url('admin/network/firewall') }, _('enable in Firewall settings'))
			])));

		table.appendChild(row(_('NPU driver'), st.loaded ? _('loaded') : _('not loaded')));

		for (let [ name, label ] of [
			[ 'lf4_offload', _('IPv4') ],
			[ 'lf_offload', _('IPv6') ],
			[ 'l2_bridge_iso', _('Bridge isolation') ]
		]) {
			const rt = st.runtime?.[name], cf = st.configured?.[name];
			let text = (rt != null) ? modeText(name, rt) : '-';

			if (rt != null && cf != null && rt != cf) {
				pending = true;
				text = E('span', {}, [ text, ' ', E('em', {}, _('(after reboot: %s)').format(modeText(name, cf))) ]);
			}

			table.appendChild(row(label, text));
		}

		const nodes = [ table ];

		if (pending)
			nodes.unshift(E('div', { 'class': 'alert-message warning' }, [
				_('Changed offload settings take effect after a reboot.'), ' ',
				E('a', { 'href': L.url('admin/system/reboot') }, _('Reboot'))
			]));

		return nodes;
	},

	renderFlows(st, cpu) {
		const f = st.flows || {};
		const hw = (f.hw4 || 0) + (f.hw6 || 0), sw = (f.sw4 || 0) + (f.sw6 || 0);

		return E('table', { 'class': 'table' }, [
			row(_('Offloaded to the NPU'), '%d (IPv4 %d, IPv6 %d)'.format(hw, f.hw4 || 0, f.hw6 || 0)),
			row(_('Software flowtable'), '%d (IPv4 %d, IPv6 %d)'.format(sw, f.sw4 || 0, f.sw6 || 0)),
			row(_('All tracked connections'), (f.count != null) ? '%d / %d'.format(f.count, f.max) : '-'),
			row(_('CPU load'), (cpu != null) ? '%.1f %%'.format(cpu) : '-')
		]);
	},

	renderSensors(st) {
		const s = st.sensors || {};
		const v = this.voltage;

		return E('table', { 'class': 'table' }, [
			row(_('SoC temperature'), (s.temp != null) ? '%.1f °C'.format(s.temp / 1000) : '-'),
			row(_('Voltage monitor 1'), (v.in1 != null) ? '%d mV'.format(v.in1) : '-'),
			row(_('Voltage monitor 2'), (v.in2 != null) ? '%d mV'.format(v.in2) : '-')
		]);
	},

	renderPorts(st, rates) {
		const table = E('table', { 'class': 'table' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th' }, _('Port')),
				E('th', { 'class': 'th' }, _('Network')),
				E('th', { 'class': 'th' }, _('Link')),
				E('th', { 'class': 'th' }, _('RX rate')),
				E('th', { 'class': 'th' }, _('TX rate')),
				E('th', { 'class': 'th' }, _('RX total')),
				E('th', { 'class': 'th' }, _('TX total'))
			])
		]);

		for (let p of (st.ports || [])) {
			const r = rates[p.name] || {};

			table.appendChild(E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td' }, E('strong', {}, p.name)),
				E('td', { 'class': 'td' }, this.netName(p)),
				E('td', { 'class': 'td' }, p.up
					? ((p.speed > 0) ? '%d Mbit/s %s'.format(p.speed, p.duplex == 'full' ? _('full duplex') : _('half duplex')) : _('up'))
					: _('no link')),
				E('td', { 'class': 'td' }, fmtRate(r.rx)),
				E('td', { 'class': 'td' }, fmtRate(r.tx)),
				E('td', { 'class': 'td' }, fmtBytes(p.rx_bytes)),
				E('td', { 'class': 'td' }, fmtBytes(p.tx_bytes))
			]));
		}

		return table;
	},

	update(st) {
		const now = Date.now();
		const rates = {};
		let cpu = null;

		if (st.sensors && st.sensors.in1 !== undefined)
			this.voltage = { in1: st.sensors.in1, in2: st.sensors.in2 };

		if (this.prev) {
			const dt = (now - this.prev.time) / 1000;
			const prevPorts = {};

			for (let p of (this.prev.st.ports || []))
				prevPorts[p.name] = p;

			for (let p of (st.ports || [])) {
				const o = prevPorts[p.name];

				if (o && dt > 0)
					rates[p.name] = {
						rx: (p.rx_bytes - o.rx_bytes) * 8 / dt,
						tx: (p.tx_bytes - o.tx_bytes) * 8 / dt
					};
			}

			const c0 = this.prev.st.cpu, c1 = st.cpu;
			if (c0 && c1 && c1.total > c0.total)
				cpu = 100 * (1 - (c1.idle - c0.idle) / (c1.total - c0.total));
		}

		this.prev = { time: now, st };

		const box = (id, content) => {
			const el = document.getElementById(id);
			if (el)
				dom.content(el, content);
		};

		box('dpns-offload', this.renderOffload(st));
		box('dpns-flows', this.renderFlows(st, cpu));
		box('dpns-sensors', this.renderSensors(st));
		box('dpns-ports', this.renderPorts(st, rates));
	},

	render([ st ]) {
		const view = E('div', {}, [
			E('h2', {}, _('NPU offload')),
			E('div', { 'class': 'cbi-map-descr' },
				_('Status of the Siflower DPNS network processor. Offloaded connections are forwarded by the NPU without using the CPU; port rates include offloaded traffic.')),
			E('div', { 'class': 'cbi-section' }, [ E('h3', {}, _('Offload')), E('div', { 'id': 'dpns-offload' }) ]),
			E('div', { 'class': 'cbi-section' }, [ E('h3', {}, _('Connections')), E('div', { 'id': 'dpns-flows' }) ]),
			E('div', { 'class': 'cbi-section' }, [ E('h3', {}, _('Ports')), E('div', { 'id': 'dpns-ports' }) ]),
			E('div', { 'class': 'cbi-section' }, [ E('h3', {}, _('SoC sensors')), E('div', { 'id': 'dpns-sensors' }) ])
		]);

		requestAnimationFrame(() => this.update(st));

		poll.add(() => {
			const voltage = (++this.polls % VOLTAGE_EVERY) == 0;
			return callStatus(voltage).then((s) => this.update(s));
		}, 3);

		return view;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
