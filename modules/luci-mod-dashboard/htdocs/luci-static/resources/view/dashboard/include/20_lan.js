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

	load: function() {
		return Promise.all([
			callLuciDHCPLeases(),
			network.getDevices()
		]);
	},

	renderHtml: function() {

		var container_wapper = E('div', { 'class': 'router-status-lan dashboard-bg box-s1' });
		var container_box = E('div', { 'class': 'lan-info devices-list' });
		var container_devices = E('table', { 'class': 'table assoclist devices-info' }, [
			E('tr', { 'class': 'tr table-titles  dashboard-bg' }, [
				E('th', { 'class': 'th nowrap' }, _('Hostname')),
				E('th', { 'class': 'th' }, _('IP Address')),
				E('th', { 'class': 'th' }, _('MAC')),
			])
		]);

		var container_deviceslist = E('table', { 'class': 'table assoclist devices-info' });

		container_box.appendChild(E('div', { 'class': 'title'}, [
			E('img', {
				'src': L.resource('view/dashboard/icons/devices.svg'),
				'width': 55,
				'title': this.title,
				'class': 'middle'
			}),
			E('h3', this.title)
		]));

		for(var idx in this.params.lan.devices) {
			var deivce = this.params.lan.devices[idx];

			container_deviceslist.appendChild(E('tr', { 'class': 'tr cbi-rowstyle-1'}, [

				E('td', { 'class': 'td device-info'}, [
					E('p', {}, [
						E('span', { 'class': 'd-inline-block'}, [ deivce.hostname ]),
					]),
				]),

				E('td', { 'class': 'td device-info'}, [
					E('p', {}, [
						E('span', { 'class': 'd-inline-block'}, [ deivce.ipv4 ]),
					]),
				]),

				E('td', { 'class': 'td device-info'}, [
					E('p', {}, [
						E('span', { 'class': 'd-inline-block'}, [ deivce.macaddr ]),
					]),
				])
			]));
		}

		container_box.appendChild(E('hr'));
		container_box.appendChild(container_devices);
		container_box.appendChild(E('hr'));
		container_box.appendChild(container_deviceslist);
		container_wapper.appendChild(container_box);

		return container_wapper;
	},

	renderUpdateData: function(data, leases) {

		for(var item in data) {
			if (/lan|br-lan/ig.test(data[item].ifname) && (typeof data[item].dev == 'object' && !data[item].dev.wireless)) {
				var lan_device = data[item];
				var ipv4addr = lan_device.dev.ipaddrs.toString().split('/');

				this.params.lan.ipv4 = ipv4addr[0] || '?';
				this.params.lan.ipv6 = ipv4addr[0] || '?';
				this.params.lan.macaddr = lan_device.dev.macaddr || '00:00:00:00:00:00';
				this.params.lan.rx_bytes = lan_device.dev.stats.rx_bytes ? '%.2mB'.format(lan_device.dev.stats.rx_bytes)  : '-';
				this.params.lan.tx_bytes = lan_device.dev.stats.tx_bytes ? '%.2mB'.format(lan_device.dev.stats.tx_bytes)  : '-';
			}
		}

		var devices = [];
		leases.map(function(lease) {
			devices[lease.expires] = {
				hostname: lease.hostname || '?',
				ipv4: lease.ipaddr || '-',
				macaddr: lease.macaddr || '00:00:00:00:00:00',
			};
		});
		this.params.lan.devices = devices;
	},

	renderLeases: function(data) {

		var leases = Array.isArray(data[0].dhcp_leases) ? data[0].dhcp_leases : [];

		this.params.lan = {
			ipv4: {
				title:  _('IPv4'),
				value: '?'
			},

			macaddr: {
				title: _('Mac'),
				value: '00:00:00:00:00:00'
			},

			rx_bytes: {
				title: _('Upload'),
				value: '-'
			},

			tx_bytes: {
				title: _('Download'),
				value: '-'
			},

			devices: {
				title: _('Devices'),
				value: []
			}
		};

		this.renderUpdateData(data[1], leases);

		return this.renderHtml();
	},

	render: function(data) {
		if (L.hasSystemFeature('dnsmasq') || L.hasSystemFeature('odhcpd'))
			return this.renderLeases(data);

		return E([]);
	}
});
