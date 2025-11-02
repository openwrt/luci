'use strict';
'require baseclass';
'require dom';
'require network';
'require uci';
'require fs';
'require rpc';
'require firewall';

return baseclass.extend({
	title: _('Wireless'),

	WPSTranslateTbl: {
		Disabled: _('Disabled'),
		Active: _('Active'),
		'Timed-out': _('Timed-out'),
		Overlap: _('Overlap'),
		Unknown: _('Unknown')
	},

	callSessionAccess: rpc.declare({
		object: 'session',
		method: 'access',
		params: [ 'scope', 'object', 'function' ],
		expect: { 'access': false }
	}),

	wifirate(rate) {
		let s = `${rate.rate / 1000}\xa0${_('Mbit/s')}, ${rate.mhz}\xa0${_('MHz')}`;

		if (rate?.ht || rate?.vht) s += [
			rate?.vht && `, VHT-MCS\xa0${rate?.mcs}`,
			rate?.nss && `, VHT-NSS\xa0${rate?.nss}`,
			rate?.ht  && `, MCS\xa0${rate?.mcs}`,
			rate?.short_gi && ', ' + _('Short GI').replace(/ /g, '\xa0')
		].filter(Boolean).join('');

		if (rate?.he) s += [
			`, HE-MCS\xa0${rate?.mcs}`,
			rate?.nss    && `, HE-NSS\xa0${rate?.nss}`,
			rate?.he_gi  && `, HE-GI\xa0${rate?.he_gi}`,
			rate?.he_dcm && `, HE-DCM\xa0${rate?.he_dcm}`
		].filter(Boolean).join('');

		if (rate?.eht) s += [
			`, EHT-MCS\xa0${rate?.mcs}`,
			rate?.nss    && `, EHT-NSS\xa0${rate?.nss}`,
			rate?.eht_gi  && `, EHT-GI\xa0${rate?.eht_gi}`,
			rate?.eht_dcm && `, EHT-DCM\xa0${rate?.eht_dcm}`
		].filter(Boolean).join('');

		return s;
	},

	handleDelClient(wifinet, mac, ev, cmd) {
		const exec = cmd || 'disconnect';

		dom.parent(ev.currentTarget, '.tr').style.opacity = 0.5;
		ev.currentTarget.classList.add('spinning');
		ev.currentTarget.disabled = true;
		ev.currentTarget.blur();

		/* Disconnect client before adding to maclist */
		wifinet.disconnectClient(mac, true, 5, 60000);

		if (exec == 'addlist') {
			wifinet.maclist.push(mac);

			uci.set('wireless', wifinet.sid, 'maclist', wifinet.maclist);

			return uci.save()
				.then(L.bind(L.ui.changes.init, L.ui.changes))
				.then(L.bind(L.ui.changes.displayChanges, L.ui.changes));
		}
	},

	handleGetWPSStatus(wifinet) {
		return rpc.declare({
			object: 'hostapd.%s'.format(wifinet),
			method: 'wps_status',
		})()
	},

	handleCallWPS(wifinet, ev) {
		ev.currentTarget.classList.add('spinning');
		ev.currentTarget.disabled = true;
		ev.currentTarget.blur();

		return rpc.declare({
			object: 'hostapd.%s'.format(wifinet),
			method: 'wps_start',
		})();
	},

	handleCancelWPS(wifinet, ev) {
		ev.currentTarget.classList.add('spinning');
		ev.currentTarget.disabled = true;
		ev.currentTarget.blur();

		return rpc.declare({
			object: 'hostapd.%s'.format(wifinet),
			method: 'wps_cancel',
		})();
	},

	renderbox(radio, networks) {
		let chan = null;
		let freq = null;
		let rate = null;
		let coco = null;
		let noise = null;
		let tx_power = null;
		const badges = [];

		for (let i = 0; i < networks.length; i++) {
			const net = networks[i];
			const is_assoc = (net.getBSSID() != '00:00:00:00:00:00' && net.getChannel() && !net.isDisabled());
			const quality = net.getSignalPercent();

			let icon;
			if (net.isDisabled())
				icon = L.resource('icons/signal-none.svg');
			else if (quality <= 0)
				icon = L.resource('icons/signal-000-000.svg');
			else if (quality < 25)
				icon = L.resource('icons/signal-000-025.svg');
			else if (quality < 50)
				icon = L.resource('icons/signal-025-050.svg');
			else if (quality < 75)
				icon = L.resource('icons/signal-050-075.svg');
			else
				icon = L.resource('icons/signal-075-100.svg');

			let WPS_button = null;

			if (net.isWPSEnabled) {
				if (net.wps_status == 'Active') {
					WPS_button = E('button', {
						'class' : 'cbi-button cbi-button-remove',
						'click': L.bind(this.handleCancelWPS, this, net.getIfname()),
					}, [ _('Stop WPS') ])
				} else {
					WPS_button = E('button', {
						'class' : 'cbi-button cbi-button-apply',
						'click': L.bind(this.handleCallWPS, this, net.getIfname()),
					}, [ _('Start WPS') ])
				}
			}

			const badge = renderBadge(
				icon,
				'%s: %d dBm / %s: %d%%'.format(_('Signal'), net.getSignal(), _('Quality'), quality),
				_('SSID'), net.getActiveSSID() || '?',
				_('Mode'), net.getActiveMode(),
				_('BSSID'), is_assoc ? (net.getActiveBSSID() || '-') : null,
				_('Encryption'), is_assoc ? net.getActiveEncryption() : null,
				_('Associations'), is_assoc ? (net.assoclist.length || '-') : null,
				null, is_assoc ? null : E('em', net.isDisabled() ? _('Wireless is disabled') : _('Wireless is not associated')),
				_('WPS status'), this.WPSTranslateTbl[net.wps_status],
				'', WPS_button
			);

			badges.push(badge);

			chan = (chan != null) ? chan : net.getChannel();
			coco = (coco != null) ? coco : net.getCountryCode();
			freq = (freq != null) ? freq : net.getFrequency();
			rate = (rate != null) ? rate : net.getBitRate();
			noise = (noise != null) ? noise : net.getNoise();
			tx_power = (tx_power != null) ? tx_power : net.getTXPower();
		}

		return E('div', { class: 'ifacebox' }, [
			E('div', { class: 'ifacebox-head center ' + (radio.isUp() ? 'active' : '') },
				E('strong', radio.getName())),
			E('div', { class: 'ifacebox-body left' }, [
				L.itemlist(E('span'), [
					_('Type'), radio.getI18n().replace(/^Generic | Wireless Controller .+$/g, ''),
					_('Bitrate'), rate ? '%d %s'.format(rate, _('Mbit/s')) : null,
					_('Channel'), chan ? '%d (%.3f %s)'.format(chan, freq, _('GHz')) : null,
					_('Country Code'), coco ? '%s'.format(coco) : null,
					_('Noise'), noise ? '%.2f %s'.format(noise, _('dBm')) : null,
					_('TX Power'), tx_power ? '%.2f %s'.format(tx_power, _('dBm')): null,
				]),
				E('div', {}, badges)
			])
		]);
	},

	isWPSEnabled: {},

	load() {
		return Promise.all([
			network.getWifiDevices(),
			network.getWifiNetworks(),
			network.getHostHints(),
			this.callSessionAccess('access-group', 'luci-mod-status-index-wifi', 'read'),
			this.callSessionAccess('access-group', 'luci-mod-status-index-wifi', 'write'),
			firewall.getZones(),
			L.hasSystemFeature('wifi') ? L.resolveDefault(uci.load('wireless')) : L.resolveDefault(),
		]).then(L.bind(data => {
			const tasks = [];
			const radios_networks_hints = data[1];
			const hasWPS = L.hasSystemFeature('hostapd', 'wps');

			for (let i = 0; i < radios_networks_hints.length; i++) {
				tasks.push(L.resolveDefault(radios_networks_hints[i].getAssocList(), []).then(L.bind((net, list) => {
					net.assoclist = list.sort((a, b) => { return a.mac > b.mac });
				}, this, radios_networks_hints[i])));

				if (hasWPS && uci.get('wireless', radios_networks_hints[i].sid, 'wps_pushbutton') == '1') {
					radios_networks_hints[i].isWPSEnabled = true;
					tasks.push(L.resolveDefault(this.handleGetWPSStatus(radios_networks_hints[i].getIfname()), null)
						.then(L.bind((net, data) => {
							net.wps_status = data ? data.pbc_status : _('No Data');
					}, this, radios_networks_hints[i])));
				}
			}

			return Promise.all(tasks).then(() => {
				return data;
			});
		}, this));
	},

	render(data) {
		const seen = {};
		const radios = data[0];
		const networks = data[1];
		const hosthints = data[2];
		const hasReadPermission = data[3];
		const hasWritePermission = data[4];
		const zones = data[5];

		const table = E('div', { 'class': 'network-status-table' });

		for (let i = 0; i < radios.sort((a, b) => { a.getName() > b.getName() }).length; i++)
			table.appendChild(this.renderbox(radios[i],
				networks.filter(net => { return net.getWifiDeviceName() == radios[i].getName() })));

		if (!table.lastElementChild)
			return null;

		const assoclist = E('table', { 'class': 'table assoclist', 'id': 'wifi_assoclist_table' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th nowrap' }, _('Network')),
				E('th', { 'class': 'th hide-xs' }, _('MAC address')),
				E('th', { 'class': 'th' }, _('Host')),
				E('th', { 'class': 'th' }, '%s / %s'.format(_('Signal'), _('Noise'))),
				E('th', { 'class': 'th' }, '%s / %s'.format(_('RX Rate'), _('TX Rate')))
			])
		]);

		const rows = [];

		for (let i = 0; i < networks.length; i++) {
			const macfilter = uci.get('wireless', networks[i].sid, 'macfilter');
			const maclist = {};

			if (macfilter != null && macfilter != 'disable') {
				networks[i].maclist = L.toArray(uci.get('wireless', networks[i].sid, 'maclist'));
				for (let j = 0; j < networks[i].maclist.length; j++) {
					const mac = networks[i].maclist[j].toUpperCase();
					maclist[mac] = true;
				}
			}

			for (let k = 0; k < networks[i].assoclist.length; k++) {
				const bss = networks[i].assoclist[k];
				const name = hosthints.getHostnameByMACAddr(bss.mac);
				const ipv4 = hosthints.getIPAddrByMACAddr(bss.mac);
				const ipv6 = hosthints.getIP6AddrByMACAddr(bss.mac);

				let icon;
				const q = Math.min((bss.signal + 110) / 70 * 100, 100);
				if (q == 0)
					icon = L.resource('icons/signal-000-000.svg');
				else if (q < 25)
					icon = L.resource('icons/signal-000-025.svg');
				else if (q < 50)
					icon = L.resource('icons/signal-025-050.svg');
				else if (q < 75)
					icon = L.resource('icons/signal-050-075.svg');
				else
					icon = L.resource('icons/signal-075-100.svg');

				let sig_title, sig_value;

				if (bss.noise) {
					sig_value = '%d/%d\xa0%s'.format(bss.signal, bss.noise, _('dBm'));
					sig_title = '%s: %d %s / %s: %d %s / %s %d'.format(
						_('Signal'), bss.signal, _('dBm'),
						_('Noise'), bss.noise, _('dBm'),
						_('SNR'), bss.signal - bss.noise);
				}
				else {
					sig_value = '%d\xa0%s'.format(bss.signal, _('dBm'));
					sig_title = '%s: %d %s'.format(_('Signal'), bss.signal, _('dBm'));
				}

				let hint;

				if (name && ipv4 && ipv6)
					hint = '%s <span class="hide-xs">(%s, %s)</span>'.format(name, ipv4, ipv6);
				else if (name && (ipv4 || ipv6))
					hint = '%s <span class="hide-xs">(%s)</span>'.format(name, ipv4 || ipv6);
				else
					hint = name || ipv4 || ipv6 || '?';

				const row = [
					E('span', {
						'class': 'ifacebadge',
						'title': networks[i].getI18n(),
						'data-ifname': networks[i].getIfname(),
						'data-ssid': networks[i].getActiveSSID()
					}, [
						E('img', { 'src': L.resource('icons/wifi.svg'), 'style': 'width:32px;height:32px' }),
						E('span', {}, [
							' ', networks[i].getShortName(),
							E('small', {}, [ ' (', networks[i].getIfname(), ')' ])
						])
					]),
					bss.mac,
					hint,
					E('span', {
						'class': 'ifacebadge',
						'title': sig_title,
						'data-signal': bss.signal,
						'data-noise': bss.noise
					}, [
						E('img', { 'src': icon }),
						E('span', {}, [
							' ', sig_value
						])
					]),
					E('span', {}, [
						E('span', this.wifirate(bss.rx)),
						E('br'),
						E('span', this.wifirate(bss.tx))
					])
				];

				if (bss.vlan) {
					const desc = bss.vlan.getI18n();
					const vlan_network = bss.vlan.getNetwork();
					let vlan_zone;

					if (vlan_network)
						for (let zone of zones)
							if (zone.getNetworks().includes(vlan_network))
								vlan_zone = zone;

					row[0].insertBefore(
						E('div', {
							'class' : 'zonebadge',
							'title' : desc,
							'style' : firewall.getZoneColorStyle(vlan_zone)
						}, [ desc ]), row[0].firstChild);
				}

				if (networks[i].isClientDisconnectSupported() && hasWritePermission) {
					if (assoclist.firstElementChild.childNodes.length < 6)
						assoclist.firstElementChild.appendChild(E('th', { 'class': 'th cbi-section-actions' }));

					if (macfilter != null && macfilter != 'disable' && !maclist[bss.mac]) {
						row.push(new L.ui.ComboButton('button', {
								'addlist': macfilter == 'allow' ?  _('Add to Whitelist') : _('Add to Blacklist'),
								'disconnect': _('Disconnect')
							}, {
								'click': L.bind(this.handleDelClient, this, networks[i], bss.mac),
								'sort': [ 'disconnect', 'addlist' ],
								'classes': {
									'addlist': 'btn cbi-button cbi-button-remove',
									'disconnect': 'btn cbi-button cbi-button-remove'
								}
							}).render()
						)
					}
					else {
						row.push(E('button', {
							'class': 'cbi-button cbi-button-remove',
							'click': L.bind(this.handleDelClient, this, networks[i], bss.mac)
						}, [ _('Disconnect') ]));
					}
				}
				else {
					row.push('-');
				}

				rows.push(row);
			}
		}

		cbi_update_table(assoclist, rows, E('em', _('No information available')));

		return E([
			table,
			hasReadPermission ? E('h3', _('Associated Stations')) : E([]),
			hasReadPermission ? assoclist : E([])
		]);
	}
});
