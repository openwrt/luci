'use strict';
'require fs';
'require rpc';
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
			L.resolveDefault(fs.exec('/sbin/ip', [ '-4', 'neigh', 'show' ]), { stdout: '' }),
			L.resolveDefault(fs.exec('/sbin/ip', [ '-4', 'route', 'show', 'table', 'all' ]), { stdout: '' }),
			L.resolveDefault(fs.exec('/sbin/ip', [ '-4', 'rule', 'show' ]), { stdout: '' }),
			L.resolveDefault(fs.exec('/sbin/ip', [ '-6', 'neigh', 'show' ]), { stdout: '' }),
			L.resolveDefault(fs.exec('/sbin/ip', [ '-6', 'route', 'show', 'table', 'all' ]), { stdout: '' }),
			L.resolveDefault(fs.exec('/sbin/ip', [ '-6', 'rule', 'show' ]), { stdout: '' }),
			L.hasSystemFeature('ufpd') ? callUfpList() : null
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

	parseNeighbs(nbs, macs, networks, v6) {
		if (!nbs) return [];
		const res = [];

		for (const line of nbs.trim().split(/\n/)) {
			const [, addr = null, f = [], state = null] = line.match(/^([0-9a-f:.]+) (.+) (\S+) *$/);
			const flags = f?.trim?.().split?.(/\s+/);
			let vendor;

			if (!addr || !state || addr.match(/^fe[89a-f][0-9a-f]:/))
				continue;

			for (let j = 0; j < flags.length; j += 2)
				flags[flags[j]] = flags[j + 1];

			if (!flags.lladdr)
				continue;
			
			for (let mac in macs) {
				if (flags.lladdr === mac)
					vendor = macs[mac].vendor;
	 		}

			const net = this.getNetworkByDevice(networks, flags.dev, addr, v6 ? 128 : 32, v6);

			res.push([
				addr,
				vendor ? flags.lladdr.toUpperCase() + ` (${vendor})` : flags.lladdr.toUpperCase(),
				E('span', { 'class': 'ifacebadge' }, [ net ? net : '(%s)'.format(flags.dev) ]),
			]);
		}

		return res;
	},

	parseRoutes(routes, networks, v6) {
		if (!routes) return [];
		const res = [];

		for (const line of routes.trim().split(/\n/)) {
			const [, type = 'unicast', d, f = [] ] = line.match(/^(?:([a-z_]+|\d+) )?(default|[0-9a-f:.\/]+) (.+)$/);
			const dest = d == 'default' ? (v6 ? '::/0' : '0.0.0.0/0') : d;
			const flags = f?.trim?.().split?.(/\s+/);

			if (!dest || type != 'unicast' || dest == 'fe80::/64' || dest == 'ff00::/8')
				continue;

			for (let j = 0; j < flags.length; j += 2)
				flags[flags[j]] = flags[j + 1];

			const [addr, bits = (v6 ? 128 : 32)] = dest.split('/');
			const net = this.getNetworkByDevice(networks, flags.dev, addr, bits, v6);

			res.push([
				E('span', { 'class': 'ifacebadge' }, [ net ? net : '(%s)'.format(flags.dev) ]),
				dest,
				flags.via || '-',
				flags.src || flags.from || '-',
				String(flags.metric || 0),
				flags.table || 'main',
				flags.proto,
			]);
		}

		return res;
	},

	parseRules: rules => rules?.trim()?.split('\n')?.map(l => {
		const [, prio=null, rule=null] = l.match(/^(\d+):\s+(.+)$/) || [];
		return [prio, rule];
	}),

	render([
		networks,
		{ stdout: ip4neigh = '' } = {},
		{ stdout: ip4route = '' } = {},
		{ stdout: ip4rule = '' } = {},
		{ stdout: ip6neigh = '' } = {},
		{ stdout: ip6route = '' } = {},
		{ stdout: ip6rule = '' } = {},
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
				E('th', { 'class': 'th' }, [ _('Priority') ]),
				E('th', { 'class': 'th' }, [ _('Rule') ]),
			])
		]);

		const neigh6tbl = E('table', { 'class': 'table' }, [
			E('tr', { 'class': 'tr table-titles' }, [
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
				E('th', { 'class': 'th' }, [ _('Priority') ]),
				E('th', { 'class': 'th' }, [ _('Rule') ]),
			])
		]);

		cbi_update_table(neigh4tbl, this.parseNeighbs(ip4neigh, macdata, networks, false),
			E('em', _('No entries available'))
		);
		cbi_update_table(route4tbl, this.parseRoutes(ip4route, networks, false),
			E('em', _('No entries available'))
		);
		cbi_update_table(rule4tbl, this.parseRules(ip4rule),
			E('em', _('No entries available'))
		);
		cbi_update_table(neigh6tbl, this.parseNeighbs(ip6neigh, macdata, networks, true),
			E('em', _('No entries available'))
		);
		cbi_update_table(route6tbl, this.parseRoutes(ip6route, networks, true),
			E('em', _('No entries available'))
		);
		cbi_update_table(rule6tbl, this.parseRules(ip6rule),
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
