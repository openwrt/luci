'use strict';
'require baseclass';
'require dom';
'require network';
'require rpc';
'require uci';
'require view.dashboard.lib.charts as charts';

/* -67 dBm is the minimum RSSI Cisco specifies for voice-grade coverage;
   below it the client is still usable, just not at that level. */
const GRADES = [
	{ min: -67, className: 'dashboard-bar-ok', kind: 'success' },
	{ min: -Infinity, className: 'dashboard-bar-mid', kind: 'warning' }
];

const NO_SIGNAL = { className: 'dashboard-bar-none', kind: '' };

function signalGrade(rssi) {
	return (rssi != null) ? GRADES.find(grade => rssi >= grade.min) : NO_SIGNAL;
}

function rssiOf(device) {
	return device.signal.value.rssi ?? -Infinity;
}

return baseclass.extend({

	title: _('Wireless'),

	params: [],

	widgets: [
		{ id: 'wifi', slot: 'cards', title: _('Wireless clients'), order: 60, hidden: true },
		{ id: 'distribution', slot: 'charts', title: _('Wireless client distribution'), order: 30, hidden: true },
		{ id: 'signal', slot: 'charts', title: _('Signal Strength'), order: 40, hidden: true },
		{ id: 'traffic', slot: 'charts', title: _('Wireless client data usage'), order: 50, hidden: true },
		{ id: 'wifi', slot: 'tabs', title: _('Wireless'), order: 50, hidden: true }
	],

	// The "wifi" system feature only says /sbin/wifi exists.
	available() {
		return uci.load('wireless').then(() => uci.sections('wireless', 'wifi-device').length > 0);
	},

	load() {
		return Promise.all([
			network.getWifiDevices(),
			network.getWifiNetworks(),
			network.getHostHints()
		]).then(radios_networks_hints => {
			const tasks = [];

			for (let i = 0; i < radios_networks_hints[1].length; i++)
				tasks.push(L.resolveDefault(radios_networks_hints[1][i].getAssocList(), []).then(L.bind((net, list) => {
					net.assoclist = list.sort((a, b) => a.mac.localeCompare(b.mac));
				}, this, radios_networks_hints[1][i])));

			return Promise.all(tasks).then(() => {
				return radios_networks_hints;
			});
		});
	},

	renderKpi() {
		const radios = this.params.wifi.radios;
		const active = radios.filter(radio => radio.isactive.value === true).length;

		return charts.kpi({
			icon: 'wireless',
			title: _('Wireless clients'),
			value: [ String(this.params.wifi.devices.length) ],
			sub: [ _('%d of %d SSIDs active').format(active, radios.length) ]
		});
	},

	renderDistributionChart() {
		const devices = this.params.wifi.devices;
		const series = this.params.wifi.radios.map(radio => ({
			label: [ radio.ssid.value, ' ', E('small', {}, [ radio.chan.value ]) ],
			value: (radio.isactive.value === true) ? (parseInt(radio.associations.value) || 0) : 0
		}));

		return charts.card({
			title: _('Wireless client distribution'),
			desc: _('by SSID'),
			body: devices.length
				? charts.donut({ series: series, centerLabel: _('clients'), ariaLabel: _('Wireless client distribution') })
				: charts.empty(_('No wireless clients connected'))
		});
	},

	renderSignalChart() {
		const devices = this.params.wifi.devices.slice().sort((a, b) => rssiOf(b) - rssiOf(a));

		return charts.card({
			title: _('Signal Strength'),
			desc: devices.length ? '%s · %s'.format(_('%d clients').format(devices.length), _('dBm')) : '',
			body: devices.length ? [ charts.barChart({
				id: 'signal',
				// iwinfo's nl80211 backend clamps the signal to -110..-40 dBm
				// (the cfg80211 wext compat range) before deriving quality.
				min: -110,
				max: -40,
				ticks: [ -110, -100, -90, -80, -70, -60, -50, -40 ].map(v => ({ value: v, label: '%d'.format(v) })),
				items: devices.map(device => ({
					label: device.hostname.value,
					title: [ device.hostname.value, device.ssid.value, this.signalText(device) ].join(' · '),
					values: [ { value: device.signal.value.rssi, className: signalGrade(device.signal.value.rssi).className } ]
				}))
			}), charts.legend([
				{ className: 'dashboard-bar-ok', label: '%s ≥ -67 %s'.format(_('Good'), _('dBm')) },
				{ className: 'dashboard-bar-mid', label: '%s < -67 %s'.format(_('Weak'), _('dBm')) }
			]) ] : charts.empty(_('No wireless clients connected'))
		});
	},

	signalText(device) {
		if (device.signal.value.rssi == null)
			return _('No RX signal');

		const rssi = '%d %s'.format(device.signal.value.rssi, _('dBm'));

		if (device.signal.value.noise != null)
			return '%d / %d %s'.format(device.signal.value.rssi, device.signal.value.noise, _('dBm'));

		return rssi;
	},

	// Fixed five ticks in the unit the peak falls into; the interval is the
	// smallest 1-2-5 step whose fourth multiple covers the peak.
	byteScale(peak) {
		const units = [ 'B', 'KiB', 'MiB', 'GiB', 'TiB' ];
		let exp = 0;

		while (peak >= 1024 && exp < units.length - 1) {
			peak /= 1024;
			exp++;
		}

		const raw = peak / 4;
		const magnitude = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-9))));
		const step = [ 1, 2, 5, 10 ].map(n => n * magnitude).find(candidate => candidate >= raw) * Math.pow(1024, exp);
		const unit = Math.pow(1024, exp);
		const decimals = (step / unit < 1) ? 1 : 0;

		return {
			step: step,
			format: value => '%s %s'.format((value / unit).toFixed(decimals), units[exp])
		};
	},

	renderTrafficChart() {
		const devices = this.params.wifi.devices.slice().sort((a, b) =>
			(b.transferred.value.bytes.rx + b.transferred.value.bytes.tx) - (a.transferred.value.bytes.rx + a.transferred.value.bytes.tx));
		const peak = Math.max(1, ...devices.map(device => Math.max(device.transferred.value.bytes.rx, device.transferred.value.bytes.tx)));
		const scale = this.byteScale(peak);

		return charts.card({
			title: _('Wireless client data usage'),
			desc: devices.length ? _('Transferred') : '',
			body: devices.length ? [
				charts.barChart({
					id: 'traffic',
					max: scale.step * 4,
					ticks: [ 0, 1, 2, 3, 4 ].map(n => ({ value: scale.step * n, label: scale.format(scale.step * n) })),
					items: devices.map(device => ({
						label: device.hostname.value,
						title: '%s · %s %s · %s %s'.format(device.hostname.value, _('Up.'), device.transferred.value.rx, _('Down.'), device.transferred.value.tx)
							+ (device.connected.value ? ' · %s %s'.format(_('Connected'), device.connected.value) : ''),
						values: [
							{ value: device.transferred.value.bytes.rx, className: 'dashboard-bar-up' },
							{ value: device.transferred.value.bytes.tx, className: 'dashboard-bar-down' }
						]
					}))
				}),
				charts.legend([
					{ className: 'dashboard-bar-up', label: _('Up.') },
					{ className: 'dashboard-bar-down', label: _('Down.') }
				])
			] : charts.empty(_('No wireless clients connected'))
		});
	},

	renderNetworkCard(radio) {
		const active = radio.isactive.value === true;
		const fields = [];

		for (const key of [ 'chan', 'rate', 'encryption', 'bssid' ])
			if (radio[key].visible)
				fields.push(E('div', {}, [
					E('span', {}, [ radio[key].title ]),
					E('b', {}, [ radio[key].value ])
				]));

		return E('div', { 'class': 'ifacebox' }, [
			E('div', { 'class': 'ifacebox-head' + (active ? ' active' : '') }, [
				E('strong', {}, [ radio.ssid.value ])
			]),
			E('div', { 'class': 'ifacebox-body' }, [
				E('div', { 'class': 'dashboard-net-count' }, [
					E('b', {}, [ String(active ? radio.associations.value : 0) ]),
					E('small', {}, [ radio.associations.title ])
				]),
				active
					? E('div', { 'class': 'dashboard-net-fields' }, fields)
					: E('div', { 'class': 'dashboard-net-note' }, [ _('Interface is disabled') ])
			])
		]);
	},

	renderClientTable() {
		return charts.table({
			head: [
				_('Hostname'),
				_('IP Address'),
				_('SSID'),
				_('Band'),
				'%s / %s'.format(_('Signal'), _('Noise floor')),
				'%s / %s'.format(_('Up.'), _('Down.')),
				_('Connected')
			],
			rows: this.params.wifi.devices.map(device => [
				device.hostname.value,
				device.addresses.value.length
					? E('div', { 'class': 'dashboard-client-addresses' }, device.addresses.value.map(address => E('div', {}, [ address ])))
					: '-',
				device.ssid.value,
				device.band.value || '-',
				E('span', {}, [
					charts.badge((device.signal.value.rssi != null) ? '%d %s'.format(device.signal.value.rssi, _('dBm')) : _('No RX signal'), signalGrade(device.signal.value.rssi).kind),
					' ',
					(device.signal.value.noise != null)
						? E('small', {}, [ '/ %d %s'.format(device.signal.value.noise, _('dBm')) ])
						: ''
				]),
				E('span', {}, [
					E('span', { 'title': _('Up.') }, [ device.transferred.value.rx ]),
					' / ',
					E('span', { 'title': _('Down.') }, [ device.transferred.value.tx ])
				]),
				device.connected.value || '-'
			]),
			emptyText: _('No wireless clients connected'),
			foot: [ _('Total'), String(this.params.wifi.devices.length) ]
		});
	},

	frequencyBand(frequency) {
		const freq = Number(frequency);
		let band = null;

		// Wi-Fi frequency band boundaries (GHz):
		// - Sub-1 GHz: < 1 GHz (NL80211_BAND_S1GHZ, covers 802.11ah HaLow / 802.11af)
		// - 2.4 GHz: 2.312-2.484 GHz (down to ch -19 in ath9k/ath5k; ch 14 upper bound)
		// - 5 GHz: 4.91-5.925 GHz (802.11j public safety through U-NII-4)
		// - 6 GHz: 5.925-7.125 GHz (U-NII-5 through U-NII-8)
		// - 60 GHz: 58.32-70.2 GHz (802.11ad/ay DMG band)
		// 5/6/60 GHz and ch 14 follow Linux kernel ieee80211_freq_khz_to_channel():
		// https://github.com/torvalds/linux/blob/165768bb70265b5c38cf0b73fafd75be235f8b14/net/wireless/util.c#L114-L132
		if (freq > 0 && freq < 1)
			band = 'Sub-1';
		else if (freq >= 2.312 && freq <= 2.484)
			band = '2.4';
		else if (freq >= 4.91 && freq < 5.925)
			band = '5';
		else if (freq >= 5.925 && freq <= 7.125)
			band = '6';
		else if (freq >= 58.32 && freq <= 70.2)
			band = '60';

		return band ? '%s %s'.format(band, _('GHz')) : null;
	},

	renderTab() {
		return E('div', {}, [
			E('div', { 'class': 'dashboard-net-grid' }, this.params.wifi.radios.map(radio => this.renderNetworkCard(radio))),
			E('h3', {}, [ _('Wireless clients') ]),
			this.renderClientTable()
		]);
	},

	clientAddresses(ipv4, hint) {
		const ipv6 = L.toArray(hint?.ip6addrs || hint?.ipv6)
			.find(address => address && !/^fe[89ab][0-9a-f]:/i.test(address));

		return [ ipv4, ipv6 ].filter(Boolean);
	},

	renderUpdateData(radios, networks, hosthints) {
		for (let i = 0; i < radios.sort((a, b) => a.getName().localeCompare(b.getName())).length; i++) {
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
			const band = this.frequencyBand(networks[i].getFrequency());

			for (let k = 0; k < networks[i].assoclist.length; k++) {
				const bss = networks[i].assoclist[k];
				const mac = bss.mac.toUpperCase();
				const name = hosthints.getHostnameByMACAddr(mac);

				this.params.wifi.devices.push(
					{
						band : {
							title: _('Band'),
							visible: true,
							value: band
						},

						hostname : {
							title: _('Hostname'),
							visible: true,
							value: name || '?'
						},

						addresses: {
							title: _('IP Address'),
							visible: true,
							value: this.clientAddresses(hosthints.getIPAddrByMACAddr(mac), hosthints.hosts[mac])
						},

						ssid : {
							title: _('SSID'),
							visible: true,
							value: networks[i].getActiveSSID()
						},

						signal : {
							title: _('Signal Strength'),
							visible: true,
							value: {
								rssi: (typeof(bss.signal) == 'number' && bss.signal < 0) ? bss.signal : null,
								noise: (typeof(bss.noise) == 'number' && bss.noise != 0) ? bss.noise : null
							}
						},

						// AP-side station counters: rx = received from the client (its
						// upload), tx = sent to the client (its download)
						transferred : {
							title: _('Transferred'),
							visible: true,
							value: {
								rx: '%s'.format('%1024.2mB'.format(bss.rx.bytes)),
								tx: '%s'.format('%1024.2mB'.format(bss.tx.bytes)),
								bytes: { rx: bss.rx.bytes || 0, tx: bss.tx.bytes || 0 }
							}
						},

						// Connection duration is not reported by every driver.
						connected: {
							title: _('Connected'),
							visible: true,
							value: (typeof(bss.connected_time) == 'number') ? '%t'.format(bss.connected_time) : null
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

		if (!this.params.wifi.radios.length)
			return null;

		return {
			cards: [ { id: 'wifi', node: () => this.renderKpi() } ],
			charts: [
				{ id: 'distribution', node: () => this.renderDistributionChart() },
				{ id: 'signal', node: () => this.renderSignalChart() },
				{ id: 'traffic', node: () => this.renderTrafficChart() }
			],
			tabs: [
				{ id: 'wifi', title: this.title, count: this.params.wifi.devices.length, content: () => this.renderTab() }
			]
		};
	}
});
