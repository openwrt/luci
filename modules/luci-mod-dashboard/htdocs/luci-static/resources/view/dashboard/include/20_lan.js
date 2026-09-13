'use strict';
'require baseclass';
'require rpc';
'require network';

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

	renderHtml() {

		const container_wapper = E('div', { 'class': 'router-status-lan dashboard-bg box-s1' });
		const container_box = E('div', { 'class': 'lan-info devices-list' });
		container_box.appendChild(E('div', { 'class': 'title'}, [
			E('img', {
				'src': L.resource('view/dashboard/icons/devices.svg'),
				'width': 55,
				'title': this.title,
				'class': 'middle svgmonotone'
			}),
			E('h3', this.title)
		]));

		const container_devices = E('table', { 'class': 'table assoclist devices-info' }, [
			E('thead', { 'class': 'thead dashboard-bg' }, [
				E('th', { 'class': 'th nowrap' }, _('Hostname')),
				E('th', { 'class': 'th' }, _('IP Address')),
				E('th', { 'class': 'th' }, _('MAC')),
			])
		]);

		for(let idx in this.params.lan.devices) {
			const device = this.params.lan.devices[idx];

			container_devices.appendChild(E('tr', { 'class': idx % 2 ? 'tr cbi-rowstyle-2' : 'tr cbi-rowstyle-1' }, [

				E('td', { 'class': 'td device-info'}, [
					E('p', {}, [
						E('span', { 'class': 'd-inline-block'}, [ device.hostname ]),
					]),
				]),

				E('td', { 'class': 'td device-info'}, [
					E('p', {}, [
						E('span', { 'class': 'd-inline-block'}, [ device.ipv4 ]),
					]),
				]),

				E('td', { 'class': 'td device-info'}, [
					E('p', {}, [
						E('span', { 'class': 'd-inline-block'}, [ device.macaddr ]),
					]),
				]),
			]));
		}

		container_devices.appendChild(E('tfoot', { 'class': 'tfoot dashboard-bg' }, [
			E('tr', { 'class': 'tr cbi-rowstyle-1' }, [
				E('td', { 'class': 'td device-info'}, [
					E('p', {}, [
						E('span', { 'class': 'd-inline-block'}, [ ]),
					]),
				]),

				E('td', { 'class': 'td device-info'}, [
					E('p', {}, [
						E('span', { 'class': 'd-inline-block'}, [ _('Total') + '：' ]),
					]),
				]),

				E('td', { 'class': 'td device-info'}, [
					E('p', {}, [
						E('span', { 'class': 'd-inline-block'}, [ this.params.lan.devices.length ]),
					]),
				]),

			])
		]));

		container_box.appendChild(container_devices);
		container_wapper.appendChild(container_box);

		return container_wapper;
	},

	renderUpdateData(leases) {
		const dev_arr = [];

		leases.forEach(({ hostname = '?', ipaddr: ipv4 = '-', macaddr = '00:00:00:00:00:00' }) => {
			dev_arr.push({ hostname, ipv4, macaddr });
		});

		this.params.lan = { devices: dev_arr };
	},

	renderLeases(leases) {
		this.renderUpdateData([...leases.dhcp_leases]);

		return this.renderHtml();
	},

	render([leases]) {
		if (L.hasSystemFeature('dnsmasq') || L.hasSystemFeature('odhcpd'))
			return this.renderLeases(leases);

		return E([]);
	}
});
