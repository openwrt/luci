'use strict';
'require fs';
'require rpc';
'require tools.network as tn';
'require ui';
'require validation';
'require view';

const callNetworkInterfaceDump = rpc.declare({
	object: 'network.interface',
	method: 'dump',
	expect: { interface: [] }
});

const callUfpList = rpc.declare({
	object: 'fingerprint',
	method: 'fingerprint',
	expect: { '': {} }
});

function applyMask(addr, mask, v6) {
	const words = v6 ? validation.parseIPv6(addr) : validation.parseIPv4(addr);
	const bword = v6 ? 0xffff : 0xff;
	const bwlen = v6 ? 16 : 8;

	if (!words || mask < 0 || mask > (v6 ? 128 : 32))
		return null;

	for (let i = 0; i < words.length; i++) {
		const b = Math.min(mask, bwlen);
		words[i] &= (bword << (bwlen - b)) & bword;
		mask -= b;
	}

	return String.prototype.format.apply(
		v6 ? '%x:%x:%x:%x:%x:%x:%x:%x' : '%d.%d.%d.%d', words);
}

return view.extend({
	load() {
		return Promise.all([
			callNetworkInterfaceDump(),
			L.resolveDefault(fs.exec('/sbin/ip', [ '-4', '-j', 'neigh', 'show' ]), {}),
			L.resolveDefault(fs.exec('/sbin/ip', [ '-4', '-j', 'route', 'show', 'table', 'all' ]), {}),
			L.resolveDefault(fs.exec('/sbin/ip', [ '-4', '-j', 'rule', 'show' ]), {}),
			L.resolveDefault(fs.exec('/sbin/ip', [ '-6', '-j', 'neigh', 'show' ]), {}),
			L.resolveDefault(fs.exec('/sbin/ip', [ '-6', '-j', 'route', 'show', 'table', 'all' ]), {}),
			L.resolveDefault(fs.exec('/sbin/ip', [ '-6', '-j', 'rule', 'show' ]), {}),
			L.hasSystemFeature('ufpd') ? callUfpList() : null,
		]);
	},

	getNetworkByDevice(networks, dev, addr, mask, v6) {
		const addr_arrays = [ 'ipv4-address', 'ipv6-address', 'ipv6-prefix', 'ipv6-prefix-assignment', 'route' ];
		let matching_iface = null;
		let matching_prefix = -1;

		for (const net of networks) {
			if (!L.isObject(net) || (net.l3_device !== dev && net.device !== dev))
				continue;

			for (const key of addr_arrays) {
				const list = net[key];
				if (!Array.isArray(list)) continue;

				for (const { address, target, mask: cmp_mask } of list) {
					const cmp_addr = address || target;
					if (!cmp_addr) continue;

					if (applyMask(cmp_addr, cmp_mask, v6) !== applyMask(addr, cmp_mask, v6) || mask < cmp_mask)
						continue;

					if (cmp_mask > matching_prefix) {
						matching_iface = net.interface;
						matching_prefix = cmp_mask;
					}
				}
			}
		}

		return matching_iface;
	},

	parseJSON(string) {
		try {
			return JSON.parse(string);
		} catch (e) {
			return [];
		}
	},

	parseNeighbs(nbs, macs, networks, v6) {
		const res = [];

		for (const n of this.parseJSON(nbs)) {
			let vendor;
			if (n.dst.match(/^fe[89a-f][0-9a-f]:/))
				continue;

			if (n.state.find(f => {return f == 'FAILED'}))
				continue;

			for (let mac in macs) {
				if (n?.lladdr === mac)
					vendor = macs[mac].vendor;
	 		}

			const net = this.getNetworkByDevice(networks, n?.dev, n?.dst, v6 ? 128 : 32, v6);

			res.push([
				E('div', { 'data-tooltip': JSON.stringify(n) }, [
					'#',
					n?.nud ? `; ${_('NUD')}: ${n?.nud}` : '',
					n?.proxy === null ? `; ${_('Proxy')}: ✅` : '',
					n?.nomaster === null ? `;  ${_('No master')} : ✅` : '',
					n?.vrf ? `; ${_('VRF')}: ${n?.vrf}` : '',
				]),

				n?.dst,
				n?.lladdr?.toUpperCase() + (vendor ? ` (${vendor})` : ''),
				E('span', { 'class': 'ifacebadge' }, [ net ? net : '(%s)'.format(n?.dev) ]),
			]);
		}

		return res;
	},

	parseRoutes(routes, networks, v6) {
		const res = [];

		for (const rt of this.parseJSON(routes)) {
			const dest = rt.dst == 'default' ? (v6 ? '::/0' : '0.0.0.0/0') : rt.dst;
			if (dest == 'fe80::/64' || dest == 'ff00::/8')
				continue;

			const [addr, bits = (v6 ? 128 : 32)] = dest.split('/');
			const net = this.getNetworkByDevice(networks, rt.dev, addr, bits, v6);

			res.push([
				E('span', { 'class': 'ifacebadge' }, [ net ? net : '(%s)'.format(rt.dev) ]),
				dest,
				rt?.gateway || '-',
				rt?.prefsrc || rt?.from || '-',
				String(rt?.metric || '-'),
				rt?.table || 'main',
				rt?.protocol,
			]);
		}

		return res;
	},

	parseRules(rules) {
		const r = [];
		for (const rl of this.parseJSON(rules)) {
			r.push([
				E('div', { 'data-tooltip': JSON.stringify(rl) }, [
					'#',
					rl?.not === null ? `; ${_('Not')}: ✅` : '',
					rl?.nop === null ? `; ${_('No-op')}: ✅` : '',
					rl?.l3mdev === null ? `; ${_('L3Mdev')}: ✅` : '',
					rl?.fwmark ? `; ${_('Fwmark')}:${rl?.fwmark}` : '',
					rl?.from ? `; ${_('From')}:${rl?.from}` : '',
					rl?.to ? `; ${_('To')}:${rl?.to}` : '',
					rl?.tos ? `; ${_('ToS')}:${rl?.tos}` : '',
					rl?.dsfield ? `; ${_('DSCP')}:${rl?.dsfield}` : '',
					rl?.uidrange ? `; ${_('UID-range')}:${rl?.uidrange}` : '',
					rl?.goto ? `; ${_('goto')}:${rl?.goto}` : '',
					rl?.nat ? `; ${_('NAT')}:${rl?.nat}` : '',
				]),

				rl?.priority,
				rl?.iif ? E('span', { 'class': 'ifacebadge' }, [ rl?.iif ]) : '-',
				rl?.src ? (rl?.srclen ? rl?.src + '/' + rl?.srclen : rl?.src) : _('any'),
				rl?.sport || '-',
				rl?.action || '-',
				tn.protocols.find(f => {return f.i == rl?.ipproto?.split?.('-')[1] })?.d || '-',
				rl?.oif ? E('span', { 'class': 'ifacebadge' }, [ rl?.oif ]) : '-',
				rl?.dst ? (rl?.dstlen ? rl?.dst + '/' + rl?.dstlen : rl?.dst) : _('any'),
				rl?.dport || '-',
				rl?.table || '-',
			]);
		}
		return r;
	},

	render([
		networks,
		{ stdout: ip4neighbs = '' } = {},
		{ stdout: ip4routes = '' } = {},
		{ stdout: ip4rules = '' } = {},
		{ stdout: ip6neighbs = '' } = {},
		{ stdout: ip6routes = '' } = {},
		{ stdout: ip6rules = '' } = {},
		macdata,
	]) {

		const device_title = _('Which is used to access this %s').format(_('Target'));
		const target_title = _('Network and its mask that define the size of the destination');
		const gateway_title = _('The address through which this %s is reachable').format(_('Target'));
		const metric_title = _('Quantifies the cost or distance to a destination in a way that allows routers to make informed decisions about the optimal path to forward data packets');
		const table_title = _('Common name or numeric ID of the %s in which this route is found').format(_('Table'));
		const proto_title = _('The routing protocol identifier of this route');
		const source_title = _('Network and its mask that define which source addresses use this route');

		const neigh4tbl = E('table', { 'class': 'table' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th' }, [ _('Entry') ]),
				E('th', { 'class': 'th' }, [ _('IP address') ]),
				E('th', { 'class': 'th' }, [ _('MAC address') ]),
				E('th', { 'class': 'th' }, [ _('Interface') ]),
			])
		]);

		const route4tbl = E('table', { 'class': 'table' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th', 'title': device_title }, [ _('Device') ]),
				E('th', { 'class': 'th', 'title': target_title }, [ _('Target') ]),
				E('th', { 'class': 'th', 'title': gateway_title }, [ _('Gateway') ]),
				E('th', { 'class': 'th', 'title': source_title }, [ _('Source') ]),
				E('th', { 'class': 'th', 'title': metric_title }, [ _('Metric') ]),
				E('th', { 'class': 'th', 'title': table_title }, [ _('Table') ]),
				E('th', { 'class': 'th', 'title': proto_title }, [ _('Protocol') ]),
			])
		]);

		const rule4tbl = E('table', { 'class': 'table' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th' }, [ _('Rule') ]),
				E('th', { 'class': 'th' }, [ _('Priority') ]),
				E('th', { 'class': 'th' }, [ _('Ingress') ]),
				E('th', { 'class': 'th' }, [ _('Source') ]),
				E('th', { 'class': 'th' }, [ _('Src Port') ]),
				E('th', { 'class': 'th' }, [ _('Action') ]),
				E('th', { 'class': 'th' }, [ _('IP Protocol') ]),
				E('th', { 'class': 'th' }, [ _('Egress') ]),
				E('th', { 'class': 'th' }, [ _('Destination') ]),
				E('th', { 'class': 'th' }, [ _('Dest Port') ]),
				E('th', { 'class': 'th' }, [ _('Table') ]),
			])
		]);

		const neigh6tbl = E('table', { 'class': 'table' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th' }, [ _('Entry') ]),
				E('th', { 'class': 'th' }, [ _('IP address') ]),
				E('th', { 'class': 'th' }, [ _('MAC address') ]),
				E('th', { 'class': 'th' }, [ _('Interface') ]),
			])
		]);

		const route6tbl = E('table', { 'class': 'table' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th', 'title': device_title }, [ _('Device') ]),
				E('th', { 'class': 'th', 'title': target_title }, [ _('Target') ]),
				E('th', { 'class': 'th', 'title': gateway_title }, [ _('Gateway') ]),
				E('th', { 'class': 'th', 'title': source_title }, [ _('Source') ]),
				E('th', { 'class': 'th', 'title': metric_title }, [ _('Metric') ]),
				E('th', { 'class': 'th', 'title': table_title }, [ _('Table') ]),
				E('th', { 'class': 'th', 'title': proto_title }, [ _('Protocol') ]),
			])
		]);

		const rule6tbl = E('table', { 'class': 'table' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th' }, [ _('Rule') ]),
				E('th', { 'class': 'th' }, [ _('Priority') ]),
				E('th', { 'class': 'th' }, [ _('Ingress') ]),
				E('th', { 'class': 'th' }, [ _('Source') ]),
				E('th', { 'class': 'th' }, [ _('Src Port') ]),
				E('th', { 'class': 'th' }, [ _('Action') ]),
				E('th', { 'class': 'th' }, [ _('IP Protocol') ]),
				E('th', { 'class': 'th' }, [ _('Egress') ]),
				E('th', { 'class': 'th' }, [ _('Destination') ]),
				E('th', { 'class': 'th' }, [ _('Dest Port') ]),
				E('th', { 'class': 'th' }, [ _('Table') ]),
			])
		]);

		cbi_update_table(neigh4tbl, this.parseNeighbs(ip4neighbs, macdata, networks, false),
			E('em', _('No entries available'))
		);
		cbi_update_table(route4tbl, this.parseRoutes(ip4routes, networks, false),
			E('em', _('No entries available'))
		);
		cbi_update_table(rule4tbl, this.parseRules(ip4rules),
			E('em', _('No entries available'))
		);
		cbi_update_table(neigh6tbl, this.parseNeighbs(ip6neighbs, macdata, networks, true),
			E('em', _('No entries available'))
		);
		cbi_update_table(route6tbl, this.parseRoutes(ip6routes, networks, true),
			E('em', _('No entries available'))
		);
		cbi_update_table(rule6tbl, this.parseRules(ip6rules),
			E('em', _('No entries available'))
		);

		const view = E([], [
			E('h2', {}, [ _('Routing') ]),
			E('p', {}, [ _('The following rules are currently active on this system.') ]),
			E('div', {}, [
				E('div', { 'class': 'cbi-section', 'data-tab': 'ipv4routing', 'data-tab-title': _('IPv4 Routing') }, [
					E('h3', {}, [ _('IPv4 Neighbours') ]),
					neigh4tbl,

					E('h3', {}, [ _('Active IPv4 Routes') ]),
					route4tbl,

					E('h3', {}, [ _('Active IPv4 Rules') ]),
					rule4tbl,
				]),
				E('div', { 'class': 'cbi-section', 'data-tab': 'ipv6routing', 'data-tab-title': _('IPv6 Routing') }, [
					E('h3', {}, [ _('IPv6 Neighbours') ]),
					neigh6tbl,

					E('h3', {}, [ _('Active IPv6 Routes') ]),
					route6tbl,

					E('h3', {}, [ _('Active IPv6 Rules') ]),
					rule6tbl,
				])
			])
		]);

		ui.tabs.initTabGroup(view.lastElementChild.childNodes);

		return view;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
