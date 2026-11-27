'use strict';
'require baseclass';
'require rpc';
'require network';
'require view.dashboard.lib.charts as charts';

var callLuciDHCPLeases = rpc.declare({
	object: 'luci-rpc',
	method: 'getDHCPLeases',
	expect: { '': {} }
});

return baseclass.extend({
	title: _('DHCP Devices'),

	params: {},

	widgets: [
		{ id: 'dhcp', slot: 'cards', title: _('DHCP Devices'), order: 50, hidden: true },
		{ id: 'dhcp', slot: 'tabs', title: _('DHCP Devices'), order: 40 }
	],

	available() {
		return L.hasSystemFeature('dnsmasq') || L.hasSystemFeature('odhcpd');
	},

	load() {
		return Promise.all([
			callLuciDHCPLeases(),
		]);
	},

	renderKpi() {
		const lan = this.params.lan;
		const count = lan.devices.length;

		return charts.kpi({
			icon: 'devices',
			title: this.title,
			value: [ String(count) ],
			sub: count ? [
				lan.leases4 ? N_(lan.leases4, '%d DHCPv4 lease', '%d DHCPv4 leases').format(lan.leases4) : null,
				lan.leases6 ? N_(lan.leases6, '%d DHCPv6 lease', '%d DHCPv6 leases').format(lan.leases6) : null
			] : [ _('No active leases') ],
			stacked: true
		});
	},

	renderTable() {
		return charts.table({
			id: 'dashboard-lan-table',
			head: [ _('Hostname'), _('IP Address'), _('MAC') ],
			rows: this.params.lan.devices.map(device => [
				device.hostname,
				device.addresses.length
					? E('div', { 'class': 'dashboard-client-addresses' }, device.addresses.map(address => E('div', {}, [ address ])))
					: '-',
				device.macaddr
			]),
			emptyText: _('No active leases'),
			foot: [ _('Total'), String(this.params.lan.devices.length) ]
		});
	},

	/*
	 * One row per device: DHCPv6 leases are merged with the DHCPv4 leases
	 * of the same MAC address (rpcd derives it from DUID-LL/-LLT DUIDs),
	 * other DHCPv6 leases get a row of their own per DUID.
	 */
	renderUpdateData(leases4, leases6) {
		const devices = new Map();
		const device = (key, macaddr) => {
			if (!devices.has(key))
				devices.set(key, { hostname: null, addresses: [], macaddr: macaddr ?? '-' });

			return devices.get(key);
		};
		const addAddress = (dev, address) => {
			if (address && !dev.addresses.includes(address))
				dev.addresses.push(address);
		};

		for (const lease of leases4) {
			const dev = device(lease.macaddr ?? `ipv4:${lease.ipaddr}`, lease.macaddr);

			dev.hostname = dev.hostname ?? lease.hostname;
			addAddress(dev, lease.ipaddr);
		}

		for (const lease of leases6) {
			const dev = device(lease.macaddr ?? (lease.duid ? `duid:${lease.duid}` : `ipv6:${lease.ip6addr}`), lease.macaddr);

			dev.hostname = dev.hostname ?? lease.hostname;

			/* plain addresses without /128, delegated prefixes with /len */
			for (const address of L.toArray(lease.ip6addrs))
				addAddress(dev, address.replace(/\/128$/, ''));
		}

		this.params.lan = {
			devices: [ ...devices.values() ].map(dev => Object.assign(dev, { hostname: dev.hostname ?? '?' })),
			leases4: leases4.length,
			leases6: leases6.length
		};
	},

	render([leases]) {
		this.renderUpdateData(L.toArray(leases.dhcp_leases), L.toArray(leases.dhcp6_leases));

		return {
			cards: [ { id: 'dhcp', node: () => this.renderKpi() } ],
			tabs: [
				{ id: 'dhcp', title: this.title, count: this.params.lan.devices.length, content: () => this.renderTable() }
			]
		};
	}
});
