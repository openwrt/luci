requestAnimationFrame(function() {
	document.querySelectorAll('[data-wifi-status]').forEach(function(container) {
		var ifname = container.getAttribute('data-wifi-status'),
		    small = container.querySelector('small'),
		    info = container.querySelector('span');

		L.poll(5, L.url('admin/network/wireless_status', ifname), null, function(xhr, iws) {
			var iw = Array.isArray(iws) ? iws[0] : null;
			if (!iw)
				return;

			var is_assoc = (iw.bssid && iw.bssid != '00:00:00:00:00:00' && iw.channel && !iw.disabled);
			var p = iw.quality;
			var q = iw.disabled ? -1 : p;

			var icon;
			if (q < 0)
				icon = L.resource('icons/signal-none.png');
			else if (q == 0)
				icon = L.resource('icons/signal-0.png');
			else if (q < 25)
				icon = L.resource('icons/signal-0-25.png');
			else if (q < 50)
				icon = L.resource('icons/signal-25-50.png');
			else if (q < 75)
				icon = L.resource('icons/signal-50-75.png');
			else
				icon = L.resource('icons/signal-75-100.png');

			L.dom.content(small, [
				E('img', {
					src: icon,
					title: '%s: %d %s / %s: %d %s'.format(
						_('Signal'), iw.signal, _('dBm'),
						_('Noise'), iw.noise, _('dBm'))
				}),
				'\u00a0', E('br'), '%d%%\u00a0'.format(p)
			]);

			L.itemlist(info, [
				_('Mode'),       iw.mode,
				_('SSID'),       iw.ssid || '?',
				_('BSSID'),      is_assoc ? iw.bssid : null,
				_('Encryption'), is_assoc ? iw.encryption || _('None') : null,
				_('Channel'),    is_assoc ? '%d (%.3f %s)'.format(iw.channel, iw.frequency || 0, _('GHz')) : null,
				_('Tx-Power'),   is_assoc ? '%d %s'.format(iw.txpower, _('dBm')) : null,
				_('Signal'),     is_assoc ? '%d %s'.format(iw.signal, _('dBm')) : null,
				_('Noise'),      is_assoc ? '%d %s'.format(iw.noise, _('dBm')) : null,
				_('Bitrate'),    is_assoc ? '%.1f %s'.format(iw.bitrate || 0, _('Mbit/s')) : null,
				_('Country'),    is_assoc ? iw.country : null
			], [ ' | ', E('br'), E('br'), E('br'), E('br'), E('br'), ' | ', E('br'), ' | ' ]);

			if (!is_assoc)
				L.dom.append(info, E('em', iw.disabled ? _('Wireless is disabled') : _('Wireless is not associated')));
		});

		L.run();
	});
});
