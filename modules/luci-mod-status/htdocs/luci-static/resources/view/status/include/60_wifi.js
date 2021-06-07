'use strict';
'require baseclass';
'require dom';
'require network';
'require uci';
'require fs';
'require rpc';

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

	wifirate: function(rt) {
		var s = '%.1f\xa0%s, %d\xa0%s'.format(rt.rate / 1000, _('Mbit/s'), rt.mhz, _('MHz')),
		    ht = rt.ht, vht = rt.vht,
			mhz = rt.mhz, nss = rt.nss,
			mcs = rt.mcs, sgi = rt.short_gi;

		if (ht || vht) {
			if (vht) s += ', VHT-MCS\xa0%d'.format(mcs);
			if (nss) s += ', VHT-NSS\xa0%d'.format(nss);
			if (ht)  s += ', MCS\xa0%s'.format(mcs);
			if (sgi) s += ', ' + _('Short GI').replace(/ /g, '\xa0');
		}

		return s;
	},

	handleDelClient: function(wifinet, mac, ev, cmd) {
		var exec = cmd || 'disconnect';

		dom.parent(ev.currentTarget, '.tr').style.opacity = 0.5;
		ev.currentTarget.classList.add('spinning');
		ev.currentTarget.disabled = true;
		ev.currentTarget.blur();

		if (exec == 'addlist') {
			var macs = [ mac ]

			for (var mac in this.iface_maclist) {
				macs.push(mac)
			}

			uci.set('wireless', wifinet.sid, 'maclist', macs);

			return uci.save()
				.then(L.bind(L.ui.changes.init, L.ui.changes))
				.then(L.bind(L.ui.changes.displayChanges, L.ui.changes));
		}

		wifinet.disconnectClient(mac, true, 5, 60000);
	},

	handleGetWPSStatus: function(wifinet) {
		return rpc.declare({
			object: 'hostapd.%s'.format(wifinet),
			method: 'wps_status',
		})()
	},

	handleCallWPS: function(wifinet, ev) {
		ev.currentTarget.classList.add('spinning');
		ev.currentTarget.disabled = true;
		ev.currentTarget.blur();

		return rpc.declare({
			object: 'hostapd.%s'.format(wifinet),
			method: 'wps_start',
		})();
	},

	handleCancelWPS: function(wifinet, ev) {
		ev.currentTarget.classList.add('spinning');
		ev.currentTarget.disabled = true;
		ev.currentTarget.blur();

		return rpc.declare({
			object: 'hostapd.%s'.format(wifinet),
			method: 'wps_cancel',
		})();
	},

	renderbox: function(radio, networks) {
		var chan = null,
		    freq = null,
		    rate = null,
		    badges = [];

		for (var i = 0; i < networks.length; i++) {
			var net = networks[i],
			    is_assoc = (net.getBSSID() != '00:00:00:00:00:00' && net.getChannel() && !net.isDisabled()),
			    quality = net.getSignalPercent();

			var icon;
			if (net.isDisabled())
				icon = L.resource('icons/signal-none.png');
			else if (quality <= 0)
				icon = L.resource('icons/signal-0.png');
			else if (quality < 25)
				icon = L.resource('icons/signal-0-25.png');
			else if (quality < 50)
				icon = L.resource('icons/signal-25-50.png');
			else if (quality < 75)
				icon = L.resource('icons/signal-50-75.png');
			else
				icon = L.resource('icons/signal-75-100.png');

			var WPS_button = null;

			if (this.isWPSEnabled[net.sid]) {
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

			var badge = renderBadge(
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
			freq = (freq != null) ? freq : net.getFrequency();
			rate = (rate != null) ? rate : net.getBitRate();
		}

		return E('div', { class: 'ifacebox' }, [
			E('div', { class: 'ifacebox-head center ' + (radio.isUp() ? 'active' : '') },
				E('strong', radio.getName())),
			E('div', { class: 'ifacebox-body left' }, [
				L.itemlist(E('span'), [
					_('Type'), radio.getI18n().replace(/^Generic | Wireless Controller .+$/g, ''),
					_('Channel'), chan ? '%d (%.3f %s)'.format(chan, freq, _('GHz')) : '-',
					_('Bitrate'), rate ? '%d %s'.format(rate, _('Mbit/s')) : '-',
				]),
				E('div', {}, badges)
			])
		]);
	},

	isWPSEnabled: {},

	load: function() {
		return Promise.all([
			network.getWifiDevices(),
			network.getWifiNetworks(),
			network.getHostHints(),
			this.callSessionAccess('access-group', 'luci-mod-status-index-wifi', 'read'),
			this.callSessionAccess('access-group', 'luci-mod-status-index-wifi', 'write'),
			uci.load('wireless')
		]).then(L.bind(function(data) {
			var tasks = [],
			    radios_networks_hints = data[1],
			    hasWPS = L.hasSystemFeature('hostapd', 'wps');

			for (var i = 0; i < radios_networks_hints.length; i++) {
				tasks.push(L.resolveDefault(radios_networks_hints[i].getAssocList(), []).then(L.bind(function(net, list) {
					net.assoclist = list.sort(function(a, b) { return a.mac > b.mac });
				}, this, radios_networks_hints[i])));

				if (hasWPS && uci.get('wireless', radios_networks_hints[i].sid, 'wps_pushbutton') == '1') {
					this.isWPSEnabled[radios_networks_hints[i].sid] = true;
					tasks.push(L.resolveDefault(this.handleGetWPSStatus(radios_networks_hints[i].getIfname()), null)
						.then(L.bind(function(net, data) {
							net.wps_status = data ? data.pbc_status : _('No Data');
					}, this, radios_networks_hints[i])));
				}
			}

			return Promise.all(tasks).then(function() {
				return data;
			});
		}, this));
	},

	isDeviceAdded: {},

	render: function(data) {
		var seen = {},
		    radios = data[0],
		    networks = data[1],
		    hosthints = data[2],
		    hasReadPermission = data[3],
		    hasWritePermission = data[4];

		var table = E('div', { 'class': 'network-status-table' });

		for (var i = 0; i < radios.sort(function(a, b) { a.getName() > b.getName() }).length; i++)
			table.appendChild(this.renderbox(radios[i],
				networks.filter(function(net) { return net.getWifiDeviceName() == radios[i].getName() })));

		if (!table.lastElementChild)
			return null;

		var assoclist = E('table', { 'class': 'table assoclist' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th nowrap' }, _('Network')),
				E('th', { 'class': 'th hide-xs' }, _('MAC address')),
				E('th', { 'class': 'th' }, _('Host')),
				E('th', { 'class': 'th' }, '%s / %s'.format(_('Signal'), _('Noise'))),
				E('th', { 'class': 'th' }, '%s / %s'.format(_('RX Rate'), _('TX Rate')))
			])
		]);

		var rows = [];

		for (var i = 0; i < networks.length; i++) {
			var macfilter = uci.get('wireless', networks[i].sid, 'macfilter');

			if (macfilter != null && macfilter != 'disable') {
				this.isDeviceAdded = {};
				var macs = L.toArray(uci.get('wireless', networks[i].sid, 'maclist'));
				for (var j = 0; j < macs.length; j++) {
					var mac = macs[j].toUpperCase();
					this.isDeviceAdded[mac] = true;
				}
			}

			for (var k = 0; k < networks[i].assoclist.length; k++) {
				var bss = networks[i].assoclist[k],
				    name = hosthints.getHostnameByMACAddr(bss.mac),
				    ipv4 = hosthints.getIPAddrByMACAddr(bss.mac),
				    ipv6 = hosthints.getIP6AddrByMACAddr(bss.mac);

				var icon;
				var q = Math.min((bss.signal + 110) / 70 * 100, 100);
				if (q == 0)
					icon = L.resource('icons/signal-0.png');
				else if (q < 25)
					icon = L.resource('icons/signal-0-25.png');
				else if (q < 50)
					icon = L.resource('icons/signal-25-50.png');
				else if (q < 75)
					icon = L.resource('icons/signal-50-75.png');
				else
					icon = L.resource('icons/signal-75-100.png');

				var sig_title, sig_value;

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

				var hint;

				if (name && ipv4 && ipv6)
					hint = '%s <span class="hide-xs">(%s, %s)</span>'.format(name, ipv4, ipv6);
				else if (name && (ipv4 || ipv6))
					hint = '%s <span class="hide-xs">(%s)</span>'.format(name, ipv4 || ipv6);
				else
					hint = name || ipv4 || ipv6 || '?';

				var row = [
					E('span', {
						'class': 'ifacebadge',
						'title': networks[i].getI18n(),
						'data-ifname': networks[i].getIfname(),
						'data-ssid': networks[i].getActiveSSID()
					}, [
						E('img', { 'src': L.resource('icons/wifi.png') }),
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

				if (networks[i].isClientDisconnectSupported() && hasWritePermission) {
					if (assoclist.firstElementChild.childNodes.length < 6)
						assoclist.firstElementChild.appendChild(E('th', { 'class': 'th cbi-section-actions' }));

					if (macfilter != null && macfilter != 'disable' && !this.isDeviceAdded[bss.mac]) {
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
