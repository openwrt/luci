'use strict';
'require baseclass';
'require dom';
'require network';
'require rpc';

return baseclass.extend({

	title: _('Wireless'),

	params: [],

	load: function() {
		return Promise.all([
			network.getWifiDevices(),
			network.getWifiNetworks(),
			network.getHostHints()
		]).then(function(radios_networks_hints) {
			var tasks = [];

			for (var i = 0; i < radios_networks_hints[1].length; i++)
				tasks.push(L.resolveDefault(radios_networks_hints[1][i].getAssocList(), []).then(L.bind(function(net, list) {
					net.assoclist = list.sort(function(a, b) { return a.mac > b.mac });
				}, this, radios_networks_hints[1][i])));

			return Promise.all(tasks).then(function() {
				return radios_networks_hints;
			});
		});
	},

	renderHtml: function() {

		var container_wapper = E('div', { 'class': 'router-status-wifi dashboard-bg box-s1' });
		var container_box = E('div', { 'class': 'wifi-info devices-list' });
		var container_radio = E('div', { 'class': 'settings-info' });
		var container_radio_item;

		container_box.appendChild(E('div', { 'class': 'title'}, [
			E('img', {
				'src': L.resource('view/dashboard/icons/wireless.svg'),
				'width': 55,
				'title': this.title,
				'class': 'middle'
			}),
			E('h3', this.title)
		]));

		container_box.appendChild(E('hr'));

		for (var i =0; i < this.params.wifi.radios.length; i++) {

			container_radio_item = E('div', { 'class': 'radio-info' })

			for(var idx in this.params.wifi.radios[i]) {
				var classname = idx,
					radio = this.params.wifi.radios[i];

				if (!radio[idx].visible) {
					continue;
				}

				if ('actived' === idx) {
					classname = radio[idx].value ? 'label label-success' : 'label label-danger';
					radio[idx].value = radio[idx].value ? _('yes') : _('no');
				}

				container_radio_item.appendChild(
					E('p', {}, [
						E('span', { 'class': ''}, [ radio[idx].title + '：']),
						E('span', { 'class': classname }, [ radio[idx].value ]),
					])
				);
			}

			container_radio.appendChild(container_radio_item);
		}

		container_box.appendChild(container_radio);

		var container_devices = E('table', { 'class': 'table assoclist devices-info' }, [
			E('tr', { 'class': 'tr table-titles  dashboard-bg' }, [
				E('th', { 'class': 'th nowrap' }, _('Hostname')),
				E('th', { 'class': 'th' }, _('Wireless')),
				E('th', { 'class': 'th' }, _('Signal')),
				E('th', { 'class': 'th' }, '%s / %s'.format( _('Up.'), _('Down.')))
			])
		]);

		var container_devices_item;
		var container_devices_list = E('table', { 'class': 'table assoclist devices-info' });

		for (var i =0; i < this.params.wifi.devices.length; i++) {
			container_devices_item = E('tr', { 'class': 'tr cbi-rowstyle-1' });

			for(var idx in this.params.wifi.devices[i]) {
				var device = this.params.wifi.devices[i];

				if (!device[idx].visible) {
					continue;
				}

				var container_content;

				if ('progress' == idx) {
					container_content = E('div', { 'class' : 'td device-info' }, [
						E('div', { 'class': 'progress' }, [
							E('div', { 'class': 'progress-bar ' + device[idx].value.style, role: 'progressbar', style: 'width:'+device[idx].value.qualite+'%', 'aria-valuenow': device[idx].value.qualite, 'aria-valuemin': 0, 'aria-valuemax': 100 }),
						])
					]);
				} else if ('rate' == idx) {
					container_content = E('td', { 'class': 'td device-info'  }, [
						E('p', {}, [
							E('span', { 'class': ''}, [ device[idx].value.rx ]),
							E('br'),
							E('span', { 'class': ''}, [ device[idx].value.tx ])
						])
					]);
				} else {
					container_content = E('td', { 'class': 'td device-info'}, [
						E('p', {}, [
							E('span', { 'class': ''}, [ device[idx].value ]),
						])
					]);
				}

				container_devices_item.appendChild(container_content);
			}

			container_devices_list.appendChild(container_devices_item);
		}

		container_devices.appendChild(container_devices_list);
		container_box.appendChild(E('hr'));
		container_box.appendChild(container_devices);
		container_box.appendChild(container_devices_list);
		container_wapper.appendChild(container_box);

		return container_wapper;
	},

	renderUpdateData: function(radios, networks, hosthints) {

		for (var i = 0; i < radios.sort(function(a, b) { a.getName() > b.getName() }).length; i++) {
			var network_items = networks.filter(function(net) { return net.getWifiDeviceName() == radios[i].getName() });

			for (var j = 0; j < network_items.length; j++) {
				 var net = network_items[j],
					 is_assoc = (net.getBSSID() != '00:00:00:00:00:00' && net.getChannel() && !net.isDisabled()),
					 chan = net.getChannel(),
					 freq = net.getFrequency(),
					 rate = net.getBitRate();

				 this.params.wifi.radios.push(
					{
						ssid : {
							title: _('SSID'),
							visible: true,
							value: net.getActiveSSID() || '?'
						},

						actived : {
							title: _('Active'),
							visible: true,
							value: !net.isDisabled()
						},

						chan : {
							title: _('Channel'),
							visible: true,
							value: chan ? '%d (%.3f %s)'.format(chan, freq, _('GHz')) : '-'
						},

						rate : {
							title: _('Bitrate'),
							visible: true,
							value: rate ? '%d %s'.format(rate, _('Mbit/s')) : '-'
						},

						bssid : {
							title: _('BSSID'),
							visible: true,
							value: is_assoc ? (net.getActiveBSSID() || '-') : '-'
						},

						encryption : {
							title: _('Encryption'),
							visible: true,
							value: is_assoc ? net.getActiveEncryption() : '-'
						},

						associations : {
							title: _('Devices Connected'),
							visible: true,
							value: is_assoc ? (net.assoclist.length || '0') : 0
						}
					}
				);
			}
		}

		for (var i = 0; i < networks.length; i++) {
			for (var k = 0; k < networks[i].assoclist.length; k++) {
				var bss = networks[i].assoclist[k],
					name = hosthints.getHostnameByMACAddr(bss.mac);

				var progress_style;
				var q = Math.min((bss.signal + 110) / 70 * 100, 100);

				if (q == 0 || q < 25)
					progress_style = 'bg-danger';
				else if (q < 50)
					progress_style = 'bg-warning';
				else if (q < 75)
					progress_style = 'bg-success';
				else
					progress_style = 'bg-success';

				this.params.wifi.devices.push(
					{
						hostname : {
							title: _('Hostname'),
							visible: true,
							value: name || '?'
						},

						ssid : {
							title: _('SSID'),
							visible: true,
							value: networks[i].getActiveSSID()
						},

						progress : {
							title: _('Channel'),
							visible: true,
							value: {
								qualite: q,
								style: progress_style
							}
						},

						rate : {
							title: _('Bitrate'),
							visible: true,
							value: {
								rx: '%s'.format('%.2mB'.format(bss.rx.bytes)),
								tx: '%s'.format('%.2mB'.format(bss.tx.bytes)),
							}
						}
					}
				);
			}
		}
	},

	render: function(data) {

		this.params.wifi = {
			radios: [],
			devices: []
		};

		this.renderUpdateData(data[0], data[1], data[2]);

		if (this.params.wifi.radios.length)
			return this.renderHtml();
		return E([]);
	}
});
