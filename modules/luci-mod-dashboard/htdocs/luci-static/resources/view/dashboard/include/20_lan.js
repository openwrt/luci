'use strict';
'require baseclass';
'require rpc';
'require view.dashboard.lib.charts as charts';

const callLuciDHCPLeases = rpc.declare({
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
		if (L.hasSystemFeature('dnsmasq') || L.hasSystemFeature('odhcpd'))
			return true;
		// Some firmware builds omit service flags despite providing leases.
		return L.resolveDefault(callLuciDHCPLeases(), null).then(data => {
			if (!Array.isArray(data?.dhcp_leases))
				return false;
			this.initialLeases = data;
			return true;
		});
	},

	load() {
		const cached = this.initialLeases;
		this.initialLeases = null;
		return Promise.all([ cached ? Promise.resolve(cached) : callLuciDHCPLeases() ]);
	},

	renderKpi() {
		const count = this.params.lan.devices.length;

		return charts.kpi({
			icon: 'devices',
			title: this.title,
			value: [ String(count) ],
			sub: [ count ? _('Active leases') : _('No active leases') ]
		});
	},

	renderTable() {
		return charts.table({
			id: 'dashboard-lan-table',
			head: [ _('Hostname'), _('IP Address'), _('MAC') ],
			rows: this.params.lan.devices.map(device => [
				device.hostname,
				device.ipv4,
				device.macaddr
			]),
			emptyText: _('No active leases')
		});
	},

	renderUpdateData(leases) {
		const dev_arr = [];

		leases.forEach(({ hostname = '?', ipaddr: ipv4 = '-', macaddr = '00:00:00:00:00:00' }) => {
			dev_arr.push({ hostname, ipv4, macaddr });
		});

		this.params.lan = { devices: dev_arr };
	},

	render([leases]) {
		this.renderUpdateData(Array.isArray(leases?.dhcp_leases) ? leases.dhcp_leases : []);

		return {
			cards: [ { id: 'dhcp', node: () => this.renderKpi() } ],
			tabs: [
				{ id: 'dhcp', title: this.title, count: this.params.lan.devices.length, content: () => this.renderTable() }
			]
		};
	}
});
