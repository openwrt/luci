'use strict';
'require baseclass';
'require network';
'require rpc';
'require uci';
'require view.dashboard.lib.charts as charts';

// WifiNetwork.getAssocList() maps some ubus errors to an empty list. Here an
// unavailable sample must stay distinct from a successful zero-client sample.
const callAssocList = rpc.declare({ object: 'iwinfo', method: 'assoclist', params: [ 'device' ], reject: true });

async function readAssociations(net) {
	const lists = await Promise.allSettled([ ...net.getVlans(), net ].map(async dev => {
		const reply = await callAssocList(dev.getIfname());
		if (!Array.isArray(reply?.results))
			throw new Error('Missing iwinfo association list');
		return dev === net ? reply.results : reply.results.map(peer => ({ ...peer, vlan: dev }));
	}));
	return {
		complete: lists.every(list => list.status === 'fulfilled'),
		peers: lists.flatMap(list => list.status === 'fulfilled' ? list.value : [])
	};
}

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
	topologySource: 'wifi',

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
		return L.resolveDefault(uci.load('wireless').then(() => {
			return uci.sections('wireless', 'wifi-device').length > 0;
		}), false);
	},

	load() {
		return Promise.all([
			network.getWifiDevices(),
			network.getWifiNetworks(),
			network.getHostHints()
		]).then(radios_networks_hints => {
			const tasks = [];

			for (const net of radios_networks_hints[1]) {
				const sample = net.isDisabled() ? Promise.resolve({ complete: true, peers: [] }) : readAssociations(net);
				tasks.push(sample.then(({ complete, peers }) => {
					net.assoclistKnown = complete;
					net.assoclist = peers.filter(peer => typeof(peer?.mac) === 'string').sort((a, b) => a.mac.localeCompare(b.mac));
				}));
			}

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
			title: this.associationTitle(),
			value: [ radios.some(radio => radio.clientsKnown === false) ? '?' : String(this.params.wifi.devices.length) ],
			sub: [ _('%d of %d SSIDs active').format(active, radios.length) ]
		});
	},

	associationTitle() {
		return this.params.wifi.radios.some(radio => radio.mode !== 'ap' && radio.mode !== 'ap-wds')
			? _('Wireless peers and clients') : _('Wireless clients');
	},

	unavailableChart(title) {
		return this.params.wifi.radios.some(radio => radio.clientsKnown === false)
			? charts.card({ title, body: charts.empty(_('Wireless association data unavailable.')) }) : null;
	},

	renderDistributionChart() {
		const unavailable = this.unavailableChart(_('Wireless client distribution'));
		if (unavailable)
			return unavailable;
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
		const unavailable = this.unavailableChart(_('Signal Strength'));
		if (unavailable)
			return unavailable;
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
		const unavailable = this.unavailableChart(_('Wireless client data usage'));
		if (unavailable)
			return unavailable;
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
						title: '%s · %s %s · %s %s'.format(device.hostname.value, _('Download'), device.transferred.value.tx, _('Upload'), device.transferred.value.rx)
							+ (device.connected.value ? ' · %s %s'.format(_('Connected'), device.connected.value) : ''),
						values: [
							{ value: device.transferred.value.bytes.tx, className: 'dashboard-bar-down' },
							{ value: device.transferred.value.bytes.rx, className: 'dashboard-bar-up' }
						]
					}))
				}),
				charts.legend([
					{ className: 'dashboard-bar-down', label: _('Download') },
					{ className: 'dashboard-bar-up', label: _('Upload') }
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

		return E('div', {
			'class': 'ifacebox', 'data-dashboard-network-card': radio.network,
			'aria-current': this.selectedNetwork === radio.network ? 'true' : null
		}, [
			E('div', { 'class': 'ifacebox-head' }, [
				E('div', { 'class': 'dashboard-net-title' }, [
					E('strong', {}, [ radio.ssid.value ]),
					radio.band ? E('span', { 'class': 'dashboard-net-band' }, [ radio.band ]) : ''
				]),
				charts.badge(active ? _('Active') : (radio.disabled ? _('Disabled') : _('Link down')), active ? 'success' : '')
			]),
			E('div', { 'class': 'ifacebox-body' }, [
				E('div', { 'class': 'dashboard-net-count' }, [
					E('b', {}, [ String(radio.associations.value) ]),
					E('small', {}, [ radio.associations.title ])
				]),
				active
					? E('div', { 'class': 'dashboard-net-fields' }, fields)
					: E('div', { 'class': 'dashboard-net-note' }, [ radio.disabled ? _('Interface is disabled') : _('Link down') ])
			])
		]);
	},

	getTopologyData() {
		if (!this.params.wifi)
			return null;

		const radios = this.params.wifi.radios.filter(radio => radio.mode !== 'monitor');
		const networks = new Set(radios.map(radio => radio.network));
		return {
			networks: radios.map(radio => ({
				id: radio.network,
				device: radio.device,
				name: radio.ssid.value,
				band: radio.band,
				mode: radio.mode,
				interfaces: radio.interfaces,
				clientsKnown: radio.clientsKnown,
				active: radio.isactive.value
			})),
			clients: this.params.wifi.devices.filter(device => networks.has(device.network)).map(device => ({
				network: device.network,
				mac: device.mac,
				interfaces: device.interfaces,
				associated: device.associated,
				name: device.hostname.value && device.hostname.value !== '?' ? device.hostname.value : device.mac,
				addresses: device.addresses.value
			}))
		};
	},

	renderClientTable() {
		const devices = this.params.wifi.devices;
		const locateNetworks = this.topologyEnabled ? new Set(this.params.wifi.radios
			.filter(radio => radio.mode !== 'monitor')
			.map(radio => radio.network)) : null;
		const clientName = device => device.hostname.value && device.hostname.value !== '?' ? device.hostname.value : device.mac;
		const selected = device => !!this.selectedNetwork && device.network === this.selectedNetwork &&
			(!this.selectedClient || device.mac === this.selectedClient);
		const stack = (primary, secondary) => E('div', { 'class': 'dashboard-client-stack' }, [
			E('div', { 'class': 'dashboard-client-primary' }, [ primary ]),
			secondary ? E('div', { 'class': 'dashboard-client-secondary' }, [ secondary ]) : ''
		]);

		return charts.table({
			id: 'dashboard-wifi-table',
			head: [
				_('Device / peer'),
				_('Network'),
				_('Signal'),
				_('Transferred'),
				_('Connected')
			],
			rowKeys: devices.map(device => device.network + '/' + device.mac),
			rowAttrs: devices.map(device => ({
				'data-dashboard-client-row': device.mac,
				'data-dashboard-network': device.network,
				'class': selected(device) ? 'dashboard-client-located' : '',
				'aria-current': selected(device) ? 'true' : null
			})),
			rows: devices.map(device => [
				stack(locateNetworks?.has(device.network) ? E('button', {
					type: 'button', 'class': 'dashboard-client-locate',
					'data-dashboard-locate': device.mac,
					'data-dashboard-network': device.network,
					'aria-label': _('Locate %s in network topology').format(clientName(device))
				}, clientName(device)) : clientName(device),
					device.addresses.value.length
						? E('div', { 'class': 'dashboard-client-addresses' }, device.addresses.value.map(address => E('div', {}, [ address ])))
						: '-'),
				stack(device.ssid.value, [ device.band.value, device.associated === false ? _('Peer state unknown') : device.peer ? _('Peer') : null ].filter(Boolean).join(' · ') || '-'),
				stack(
					charts.badge((device.signal.value.rssi != null) ? '%d %s'.format(device.signal.value.rssi, _('dBm')) : _('No RX signal'), signalGrade(device.signal.value.rssi).kind),
					(device.signal.value.noise != null)
						? '%s: %d %s'.format(_('Noise floor'), device.signal.value.noise, _('dBm'))
						: null),
				E('div', { 'class': 'dashboard-client-stack dashboard-client-transfer' }, [
					E('span', { 'title': _('Download'), 'aria-label': '%s: %s'.format(_('Download'), device.transferred.value.tx) }, [ '↓ ', device.transferred.value.tx ]),
					E('span', { 'title': _('Upload'), 'aria-label': '%s: %s'.format(_('Upload'), device.transferred.value.rx) }, [ '↑ ', device.transferred.value.rx ])
				]),
				device.connected.value || '-'
			]),
			emptyText: this.params.wifi.radios.some(radio => radio.clientsKnown === false) ? _('Wireless association data unavailable.') : _('No wireless associations reported.')
		});
	},

	navigate(selection) {
		this.selectClient(selection);
		if (selection.network && !selection.client && selection.section === 'networks') {
			const card = Array.from(this.tabNode?.querySelectorAll('[data-dashboard-network-card]') || [])
				.find(node => node.dataset.dashboardNetworkCard === selection.network);
			if (card) {
				card.closest('details').open = true;
				return card;
			}
		}
	},

	selectClient({ network, client }) {
		this.selectedClient = client ? String(client).toUpperCase() : null;
		this.selectedNetwork = network || (this.selectedClient
			? this.params.wifi.devices.find(device => device.mac === this.selectedClient)?.network : null) || null;
		this.clearStaleSelection();
		this.tabNode?.querySelectorAll('[data-dashboard-client-row]').forEach(row => {
			const active = !!this.selectedNetwork && row.dataset.dashboardNetwork === this.selectedNetwork &&
				(!this.selectedClient || row.dataset.dashboardClientRow === this.selectedClient);
			row.classList.toggle('dashboard-client-located', active);
			if (active)
				row.setAttribute('aria-current', 'true');
			else
				row.removeAttribute('aria-current');
		});
		this.tabNode?.querySelectorAll('[data-dashboard-network-card]').forEach(card => {
			if (card.dataset.dashboardNetworkCard === this.selectedNetwork)
				card.setAttribute('aria-current', 'true');
			else
				card.removeAttribute('aria-current');
		});
		this.notifyClientSelection();
	},

	clearStaleSelection() {
		const present = this.selectedClient
			? this.params.wifi.devices.some(device => device.mac === this.selectedClient && device.network === this.selectedNetwork)
			: !this.selectedNetwork || this.params.wifi.radios.some(radio => radio.network === this.selectedNetwork);
		if (present)
			return false;
		this.selectedClient = null;
		this.selectedNetwork = null;
		return true;
	},

	notifyClientSelection() {
		this.tabNode?.dispatchEvent(new CustomEvent('dashboard-client-selection', {
			bubbles: true, detail: {
				network: this.selectedNetwork || null,
				client: this.selectedClient || null
			}
		}));
	},

	updateClientSummary() {
		const failed = this.params.wifi.radios.filter(radio => radio.clientsKnown === false);
		const text = failed.length ? '?' : String(this.params.wifi.devices.length);
		if (this.clientCount.textContent !== text)
			this.clientCount.textContent = text;
		const summary = _('Wireless networks (%d)').format(this.params.wifi.radios.length);
		if (this.networkSummary.textContent !== summary)
			this.networkSummary.textContent = summary;
		this.clientHeadingText.textContent = this.associationTitle();
		this.dataNote.hidden = !failed.length;
		this.dataNote.textContent = failed.length ? _('Wireless association data is unavailable for: %s').format(failed.map(radio => radio.ssid.value).join(', ')) : '';
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

	networkBand(net) {
		const band = this.frequencyBand(net.getFrequency());
		if (band)
			return band;
		// An inactive radio has no runtime frequency. Use its explicit band,
		// never the radio index or a channel number shared by several bands.
		const configured = uci.get('wireless', net.getWifiDeviceName(), 'band');
		const bands = { '2g': '2.4', '5g': '5', '6g': '6', '60g': '60' };
		return Object.hasOwn(bands, configured) ? '%s %s'.format(bands[configured], _('GHz')) : null;
	},

	renderTab() {
		const netGrid = E('div', { 'class': 'dashboard-net-grid' }, this.params.wifi.radios.map(radio => this.renderNetworkCard(radio)));
		const clientTable = this.renderClientTable();

		if (this.tabNode && this.tabNode.parentNode) {
			const oldGrid = this.tabNode.querySelector('.dashboard-net-grid');
			if (oldGrid)
				oldGrid.replaceWith(netGrid);
			this.updateClientSummary();
			return this.tabNode;
		}

		this.clientCount = E('span', { 'class': 'dashboard-client-count', 'role': 'status' });
		this.clientHeadingText = E('span');
		this.dataNote = E('p', { 'class': 'dashboard-net-note' });
		this.networkSummary = E('summary');
		this.tabNode = E('div', {}, [
			E('div', { 'data-dashboard-section': 'clients' }, [
				E('div', { 'class': 'dashboard-client-heading' }, [
					E('h3', {}, [ this.clientHeadingText, this.clientCount ])
				]),
				this.dataNote,
				clientTable
			]),
			E('details', { 'class': 'dashboard-network-details', 'data-dashboard-section': 'networks' }, [ this.networkSummary, netGrid ])
		]);
		this.updateClientSummary();

		return this.tabNode;
	},

	clientAddresses(ipv4, hint) {
		const ipv6 = L.toArray(hint?.ip6addrs || hint?.ipv6)
			.find(address => address && !(/^fe[89ab][0-9a-f]:/i).test(address));

		return [ ipv4, ipv6 ].filter(Boolean);
	},

	renderUpdateData(radios, networks, hosthints) {
		for (let i = 0; i < radios.sort((a, b) => a.getName().localeCompare(b.getName())).length; i++) {
			const network_items = networks.filter(net => { return net.getWifiDeviceName() == radios[i].getName() });

			for (let j = 0; j < network_items.length; j++) {
				const net = network_items[j];
				const disabled = net.isDisabled();
				const active = !disabled && net.isUp();
				const is_assoc = (net.getBSSID() != '00:00:00:00:00:00' && net.getChannel() && active);
				const chan = net.getChannel();
				const freq = net.getFrequency();
				const rate = net.getBitRate();

				this.params.wifi.radios.push(
					{
						network: net.getName(),
						device: net.getIfname(),
						mode: net.getMode(),
						interfaces: net.getNetworkNames(),
						clientsKnown: net.assoclistKnown,
						band: this.networkBand(net),
						disabled,
						ssid : {
							title: _('SSID'),
							visible: true,
							value: net.getActiveSSID() || net.getMeshID() || net.getName()
						},

						isactive : {
							title: _('Active'),
							visible: true,
							value: active
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
							title: _('Reported associations'),
							visible: true,
							value: net.assoclistKnown === false ? '?' : net.assoclist.length
						}
					}
				);
			}
		}

		for (let i = 0; i < networks.length; i++) {
			const band = this.networkBand(networks[i]);

			for (let k = 0; k < networks[i].assoclist.length; k++) {
				const bss = networks[i].assoclist[k];
				const mac = bss.mac.toUpperCase();
				const name = hosthints.getHostnameByMACAddr(mac);
				const rx = Number.isFinite(bss.rx?.bytes) && bss.rx.bytes >= 0 ? bss.rx.bytes : null;
				const tx = Number.isFinite(bss.tx?.bytes) && bss.tx.bytes >= 0 ? bss.tx.bytes : null;

				this.params.wifi.devices.push(
					{
						network: networks[i].getName(),
						peer: networks[i].getMode() !== 'ap' && networks[i].getMode() !== 'ap-wds',
						// A dynamic VLAN's network overrides the parent SSID binding.
						interfaces: bss.vlan ? L.toArray(bss.vlan.getNetwork()) : networks[i].getNetworkNames(),
						associated: networks[i].getMode() !== 'mesh' || (/^(ESTAB|ESTABLISHED)$/i).test(bss['mesh plink'] || ''),
						mac,
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
							value: networks[i].getActiveSSID() || networks[i].getMeshID() || networks[i].getName()
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
								rx: rx != null ? '%1024.2mB'.format(rx) : '-',
								tx: tx != null ? '%1024.2mB'.format(tx) : '-',
								bytes: { rx, tx }
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
		if (this.clearStaleSelection())
			this.notifyClientSelection();

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
				{ id: 'wifi', title: this.title, count: this.params.wifi.radios.some(radio => radio.clientsKnown === false) ? null : this.params.wifi.devices.length, content: () => this.renderTab() }
			]
		};
	}
});
