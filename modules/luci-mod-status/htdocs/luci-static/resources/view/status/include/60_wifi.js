'use strict';
'require rpc';
'require network';

function renderbox(radio) {
	var chan = null,
	    freq = null,
	    rate = null,
	    badges = [];

	for (var i = 0; i < radio.networks.length; i++) {
		var net = radio.networks[i],
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

		var badge = renderBadge(
			icon,
			'%s: %d dBm / %s: %d%%'.format(_('Signal'), net.getSignal(), _('Quality'), quality),
			_('SSID'), net.getActiveSSID() || '?',
			_('Mode'), net.getActiveMode(),
			_('BSSID'), is_assoc ? (net.getActiveBSSID() || '-') : null,
			_('Encryption'), is_assoc ? net.getActiveEncryption() : null,
			_('Associations'), is_assoc ? (net.assoclist.length || '-') : null,
			null, is_assoc ? null : E('em', net.isDisabled() ? _('Wireless is disabled') : _('Wireless is not associated')));

		badge.lastElementChild.style.overflow = 'hidden';
		badge.lastElementChild.style.textOverflow = 'ellipsis';

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
				_('Bitrate'), rate ? '%d %s'.format(rate, _('Mbit/s')) : '-'
			]),
			E('div', {}, badges)
		])
	]);
}

function wifirate(rt) {
	var s = '%.1f %s, %d%s'.format(rt.rate / 1000, _('Mbit/s'), rt.mhz, _('MHz')),
	    ht = rt.ht, vht = rt.vht,
		mhz = rt.mhz, nss = rt.nss,
		mcs = rt.mcs, sgi = rt.short_gi;

	if (ht || vht) {
		if (vht) s += ', VHT-MCS %d'.format(mcs);
		if (nss) s += ', VHT-NSS %d'.format(nss);
		if (ht)  s += ', MCS %s'.format(mcs);
		if (sgi) s += ', ' + _('Short GI');
	}

	return s;
}

return L.Class.extend({
	title: _('Wireless'),

	handleDelClient: function(ifname, mac, ev) {
		ev.currentTarget.classList.add('spinning');
		ev.currentTarget.disabled = true;
		ev.currentTarget.blur();

		return rpc.declare({
			object: 'hostapd.%s'.format(ifname),
			method: 'del_client',
			params: [ 'addr', 'deauth', 'reason', 'ban_time' ]
		})(mac, true, 5, 60000);
	},

	load: function() {
		return L.resolveDefault(network.getWifiDevices(), []).then(function(devices) {
			var tasks = [];

			for (var i = 0; i < devices.length; i++)
				tasks.push(L.resolveDefault(devices[i].getWifiNetworks(), []).then(L.bind(function(r, l) {
					r.networks = l;
				}, this, devices[i])));

			return Promise.all(tasks).then(function() {
				return devices;
			});
		}).then(function(devices) {
			var tasks = [], deauth = {};

			for (var i = 0; i < devices.length; i++) {
				for (var j = 0; j < devices[i].networks.length; j++) {
					tasks.push(L.resolveDefault(devices[i].networks[j].getAssocList(), []).then(L.bind(function(n, l) {
						n.assoclist = l.sort(function(a, b) { return a.mac > b.mac });
					}, this, devices[i].networks[j])));

					tasks.push(L.resolveDefault(rpc.list('hostapd.%s'.format(devices[i].networks[j].getIfname())), {}).then(L.bind(function(n, l) {
						for (var k in L.isObject(l) ? l : {})
							n.supports_deauth = l[k].hasOwnProperty('del_client');
					}, this, devices[i].networks[j])));
				}
			}

			return Promise.all(tasks).then(function() {
				return network.getHostHints().then(function(hosthints) {
					return [ devices, hosthints ];
				});
			});
		});
	},

	render: function(data) {
		var devices = data[0],
		    hosthints = data[1];

		var table = E('div', { 'class': 'network-status-table' });

		for (var i = 0; i < devices.length; i++)
			table.appendChild(renderbox(devices[i]));

		if (!table.lastElementChild)
			return null;

		var supports_deauth = false;

		for (var i = 0; i < devices.length; i++)
			for (var j = 0; j < devices[i].networks.length; j++)
				supports_deauth = supports_deauth || devices[i].networks[j].supports_deauth;

		var assoclist = E('div', { 'class': 'table' }, [
			E('div', { 'class': 'tr table-titles' }, [
				E('div', { 'class': 'th nowrap' }, _('Network')),
				E('div', { 'class': 'th hide-xs' }, _('MAC-Address')),
				E('div', { 'class': 'th' }, _('Host')),
				E('div', { 'class': 'th nowrap' }, '%s / %s'.format(_('Signal'), _('Noise'))),
				E('div', { 'class': 'th nowrap' }, '%s / %s'.format(_('RX Rate'), _('TX Rate'))),
				supports_deauth ? E('div', { 'class': 'th nowrap right' }, _('Disconnect')) : E([])
			])
		]);

		var rows = [];

		for (var i = 0; i < devices.length; i++) {
			for (var j = 0; j < devices[i].networks.length; j++) {
				for (var k = 0; k < devices[i].networks[j].assoclist.length; k++) {
					var bss = devices[i].networks[j].assoclist[k],
					    name = hosthints.getHostnameByMACAddr(bss.mac),
					    ipv4 = hosthints.getIPAddrByMACAddr(bss.mac),
					    ipv6 = hosthints.getIP6AddrByMACAddr(bss.mac);

					var icon;
					var q = (-1 * (bss.noise - bss.signal)) / 5;
					if (q < 1)
						icon = L.resource('icons/signal-0.png');
					else if (q < 2)
						icon = L.resource('icons/signal-0-25.png');
					else if (q < 3)
						icon = L.resource('icons/signal-25-50.png');
					else if (q < 4)
						icon = L.resource('icons/signal-50-75.png');
					else
						icon = L.resource('icons/signal-75-100.png');

					var sig_title, sig_value;

					if (bss.noise) {
						sig_value = '%d / %d %s'.format(bss.signal, bss.noise, _('dBm'));
						sig_title = '%s: %d %s / %s: %d %s / %s %d'.format(
							_('Signal'), bss.signal, _('dBm'),
							_('Noise'), bss.noise, _('dBm'),
							_('SNR'), bss.signal - bss.noise);
					}
					else {
						sig_value = '%d %s'.format(bss.signal, _('dBm'));
						sig_title = '%s: %d %s'.format(_('Signal'), bss.signal, _('dBm'));
					}

					var hint;

					if (name && ipv4 && ipv6)
						hint = '%s (%s, %s)'.format(name, ipv4, ipv6);
					else if (name && (ipv4 || ipv6))
						hint = '%s (%s)'.format(name, ipv4 || ipv6);
					else
						hint = name || ipv4 || ipv6 || '?';

					rows.push([
						E('span', { 'class': 'ifacebadge', 'title': devices[i].networks[j].getI18n() }, [
							E('img', { 'src': L.resource('icons/wifi.png') }),
							' ', devices[i].networks[j].getShortName(),
							E('small', {}, [ ' (', devices[i].networks[j].getIfname(), ')' ])
						]),
						bss.mac,
						hint,
						E('span', { 'class': 'ifacebadge', 'title': sig_title }, [
							E('img', { 'src': icon }),
							' ', sig_value
						]),
						E('span', {}, [
							E('span', wifirate(bss.rx)),
							E('br'),
							E('span', wifirate(bss.tx))
						]),
						devices[i].networks[j].supports_deauth ? E('button', {
							'class': 'cbi-button cbi-button-remove',
							'click': L.bind(this.handleDelClient, this, devices[i].networks[j].getIfname(), bss.mac)
						}, [ _('Disconnect') ]) : '-'
					]);
				}
			}
		}

		cbi_update_table(assoclist, rows, E('em', _('No information available')));

		return E([
			table,
			E('h3', _('Associated Stations')),
			assoclist
		]);
	}
});
