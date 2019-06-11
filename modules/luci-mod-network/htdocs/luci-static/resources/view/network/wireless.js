function wifi_delete(ev) {
	if (!confirm(_('Really delete this wireless network? The deletion cannot be undone! You might lose access to this device if you are connected via this network.'))) {
		ev.preventDefault();
		return false;
	}

	ev.target.previousElementSibling.value = '1';
	return true;
}

function wifi_restart(ev) {
	L.halt();

	findParent(ev.target, '.table').querySelectorAll('[data-disabled="false"]').forEach(function(s) {
		L.dom.content(s, E('em', _('Wireless is restarting...')));
	});

	L.post(L.url('admin/network/wireless_reconnect', ev.target.getAttribute('data-radio')), L.run);
}

var networks = [ ];

document.querySelectorAll('[data-network]').forEach(function(n) {
	networks.push(n.getAttribute('data-network'));
});

L.poll(5, L.url('admin/network/wireless_status', networks.join(',')), null,
	function(x, st) {
		if (st) {
			var rowstyle = 1;
			var radiostate = { };

			st.forEach(function(s) {
				var r = radiostate[s.device.device] || (radiostate[s.device.device] = {});

				s.is_assoc = (s.bssid && s.bssid != '00:00:00:00:00:00' && s.channel && s.mode != 'Unknown' && !s.disabled);

				r.up        = r.up        || s.is_assoc;
				r.channel   = r.channel   || s.channel;
				r.bitrate   = r.bitrate   || s.bitrate;
				r.frequency = r.frequency || s.frequency;
			});

			for (var i = 0; i < st.length; i++) {
				var iw = st[i],
				    sig = document.getElementById(iw.id + '-iw-signal'),
				    info = document.getElementById(iw.id + '-iw-status'),
				    disabled = (info && info.getAttribute('data-disabled') === 'true');

				var p = iw.quality;
				var q = disabled ? -1 : p;

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

				L.dom.content(sig, E('span', {
					class: 'ifacebadge',
					title: '%s %d %s / %s: %d %s'.format(_('Signal'), iw.signal, _('dBm'), _('Noise'), iw.noise, _('dBm'))
				}, [ E('img', { src: icon }), ' %d%%'.format(p) ]));

				L.itemlist(info, [
					_('SSID'),       iw.ssid || '?',
					_('Mode'),       iw.mode,
					_('BSSID'),      iw.is_assoc ? iw.bssid : null,
					_('Encryption'), iw.is_assoc ? iw.encryption || _('None') : null,
					null,            iw.is_assoc ? null : E('em', disabled ? _('Wireless is disabled') : _('Wireless is not associated'))
				], [ ' | ', E('br') ]);
			}

			for (var dev in radiostate) {
				var img = document.getElementById(dev + '-iw-upstate');
				if (img) img.src = L.resource('icons/wifi' + (radiostate[dev].up ? '' : '_disabled') + '.png');

				var stat = document.getElementById(dev + '-iw-devinfo');
				L.itemlist(stat, [
					_('Channel'), '%s (%s %s)'.format(radiostate[dev].channel || '?', radiostate[dev].frequency || '?', _('GHz')),
					_('Bitrate'), '%s %s'.format(radiostate[dev].bitrate || '?', _('Mbit/s'))
				], ' | ');
			}
		}
	}
);
