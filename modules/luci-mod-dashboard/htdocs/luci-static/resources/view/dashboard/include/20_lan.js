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

	load() {
		return Promise.all([
			callLuciDHCPLeases(),
		]);
	},

	renderKpi() {
		const count = this.params.lan.devices.length;

		return charts.kpi({
			className: 'router-status-lan',
			icon: 'devices',
			title: this.title,
			value: [ String(count) ],
			sub: [ count ? _('Active leases') : _('No active leases') ]
		});
	},

	renderTable() {
		return charts.table({
			className: 'assoclist devices-info',
			head: [ _('Hostname'), _('IP Address'), _('MAC') ],
			rows: this.params.lan.devices.map(device => [
				device.hostname,
				{ text: device.ipv4, className: 'dashboard-mono' },
				{ text: device.macaddr, className: 'dashboard-mono' }
			]),
			emptyText: _('No active leases'),
			foot: [ '', _('Total'), String(this.params.lan.devices.length) ]
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
		if (!L.hasSystemFeature('dnsmasq') && !L.hasSystemFeature('odhcpd'))
			return null;

		this.renderUpdateData([...leases.dhcp_leases]);

		return {
			kpi: [ this.renderKpi() ],
			tabs: [
				{ id: 'dhcp', title: this.title, count: this.params.lan.devices.length, content: this.renderTable() }
			]
		};
	}
});
