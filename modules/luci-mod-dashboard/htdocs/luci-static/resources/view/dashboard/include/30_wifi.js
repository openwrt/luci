'use strict';
'require baseclass';
'require dom';
'require network';
'require rpc';

return baseclass.extend({

	title: _('Wireless'),

	params: [],

	load() {
		return Promise.all([
			network.getWifiDevices(),
			network.getWifiNetworks(),
			network.getHostHints()
		]).then(radios_networks_hints => {
			const tasks = [];

			for (let i = 0; i < radios_networks_hints[1].length; i++)
				tasks.push(L.resolveDefault(radios_networks_hints[1][i].getAssocList(), []).then(L.bind((net, list) => {
					net.assoclist = list.sort((a, b) => { return a.mac > b.mac });
				}, this, radios_networks_hints[1][i])));

			return Promise.all(tasks).then(() => {
				return radios_networks_hints;
			});
		});
	},

	renderHtml() {

		const container_wapper = E('div', { 'class': 'router-status-wifi dashboard-bg box-s1' });
		const container_box = E('div', { 'class': 'wifi-info devices-list' });
		const container_radio = E('div', { 'class': 'settings-info' });

		container_box.appendChild(E('div', { 'class': 'title'}, [
			E('img', {
				'src': L.resource('view/dashboard/icons/wireless.svg'),
				'width': 55,
				'title': this.title,
				'class': 'middle svgmonotone'
			}),
			E('h3', this.title)
		]));

		for (let i = 0; i < this.params.wifi.radios.length; i++) {

			const container_radio_item = E('div', { 'class': 'radio-info' })

			for(let idx in this.params.wifi.radios[i]) {
				let classname = idx;
				const radio = this.params.wifi.radios[i];

				if (!radio[idx].visible) {
					continue;
				}

				if ('isactive' === idx) {
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

		const container_devices = E('table', { 'class': 'table assoclist devices-info' }, [
			E('thead', { 'class': 'thead dashboard-bg' }, [
			E('tr', { 'class': 'tr dashboard-bg' }, [
				E('th', { 'class': 'th nowrap' },[ _('Hostname') ]),
				E('th', { 'class': 'th' }, [ _('SSID') ]),
				E('th', { 'class': 'th', 'width': '45%' }, [ _('Signal Strength') ]),
				E('th', { 'class': 'th' }, [ _('Transferred') + ' %s / %s'.format( _('Up.'), _('Down.')) ])
			])
			])
		]);

		for (let i = 0; i < this.params.wifi.devices.length; i++) {
			const container_devices_item = E('tr', { 'class': i % 2 ? 'tr cbi-rowstyle-2' : 'tr cbi-rowstyle-1' });

			for(let idx in this.params.wifi.devices[i]) {
				const device = this.params.wifi.devices[i];

				if (!device[idx].visible) {
					continue;
				}

				if ('progress' == idx) {
					container_devices_item.appendChild(E('td', { 'class' : 'td device-info' }, [
						E('div', { 'class': 'cbi-progressbar', 'title': 'RSSI: ' + parseInt(device[idx].value.qualite) + '% (' + device[idx].value.rssi + 'dBm)'  }, [
							E('div', { 'style': 'width: '+device[idx].value.qualite+'%'}),
						])
					]));
				} else if ('transferred' == idx) {
					container_devices_item.appendChild(E('td', { 'class': 'td device-info'  }, [
						E('p', {}, [
							E('span', { 'class': ''}, [ device[idx].value.rx ]),
							E('br'),
							E('span', { 'class': ''}, [ device[idx].value.tx ])
						])
					]));
				} else {
					container_devices_item.appendChild(E('td', { 'class': 'td device-info'}, [
						E('p', {}, [
							E('span', { 'class': ''}, [ device[idx].value ]),
						])
					]));
				}

			}

			container_devices.appendChild(container_devices_item);
		}

		container_devices.appendChild(E('tfoot', { 'class': 'tfoot dashboard-bg' }, [
				E('td', { 'class': 'td nowrap' }, [ ]),
				E('td', { 'class': 'td' }, [ _('Total') + '：' ]),
				E('td', { 'class': 'td' }, [ this.params.wifi.devices.length ]),
				E('td', { 'class': 'td' }, [] ),
			]));

		container_box.appendChild(container_devices);
		container_wapper.appendChild(container_box);

		return container_wapper;
	},

	renderUpdateData(radios, networks, hosthints) {

		for (let i = 0; i < radios.sort((a, b) => { a.getName() > b.getName() }).length; i++) {
			const network_items = networks.filter(net => { return net.getWifiDeviceName() == radios[i].getName() });

			for (let j = 0; j < network_items.length; j++) {
				const net = network_items[j];
				const is_assoc = (net.getBSSID() != '00:00:00:00:00:00' && net.getChannel() && !net.isDisabled());
				const chan = net.getChannel();
				const freq = net.getFrequency();
				const rate = net.getBitRate();

				this.params.wifi.radios.push(
					{
						ssid : {
							title: _('SSID'),
							visible: true,
							value: net.getActiveSSID() || '?'
						},

						isactive : {
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

		for (let i = 0; i < networks.length; i++) {
			for (let k = 0; k < networks[i].assoclist.length; k++) {
				const bss = networks[i].assoclist[k];
				const name = hosthints.getHostnameByMACAddr(bss.mac);

				let progress_style;
				const defaultNF = -90; // default noise floor for devices that do not report it
				const defaultCeil = -30;
				// const q = Math.min((bss.signal + 110) / 70 * 100, 100);
				const q = 100 * ((bss.signal - (bss.noise ? bss.noise: defaultNF) ) / (defaultCeil - (bss.noise ? bss.noise : defaultNF)));

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
							title: _('Strength'),
							visible: true,
							value: {
								qualite: q,
								rssi: bss.signal,
								style: progress_style
							}
						},

						transferred : {
							title: _('Transferred'),
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

	render([radios, networks, hosthints]) {

		this.params.wifi = {
			radios: [],
			devices: []
		};

		this.renderUpdateData(radios, networks, hosthints);

		if (this.params.wifi.radios.length)
			return this.renderHtml();
		return E([]);
	}
});
