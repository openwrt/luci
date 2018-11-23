var poll = null;

function format_signal(bss) {
	var qval = bss.quality || 0,
	    qmax = bss.quality_max || 100,
	    scale = 100 / qmax * qval,
	    range = 'none';

	if (!bss.bssid || bss.bssid == '00:00:00:00:00:00')
		range = 'none';
	else if (scale < 15)
		range = '0';
	else if (scale < 35)
		range = '0-25';
	else if (scale < 55)
		range = '25-50';
	else if (scale < 75)
		range = '50-75';
	else
		range = '75-100';

	return E('span', {
		class: 'ifacebadge',
		title: '%s: %d%s / %s: %d/%d'.format(_('Signal'), bss.signal, _('dB'), _('Quality'), qval, qmax)
	}, [
		E('img', { src: L.resource('icons/signal-%s.png').format(range) }),
		' %d%%'.format(scale)
	]);
}

function format_encryption(bss) {
	var enc = bss.encryption || { }

	if (enc.wep === true)
		return 'WEP';
	else if (enc.wpa > 0)
		return E('abbr', {
			title: 'Pairwise: %h / Group: %h'.format(
				enc.pair_ciphers.join(', '),
				enc.group_ciphers.join(', '))
			},
			'%h - %h'.format(
				(enc.wpa === 3) ? _('mixed WPA/WPA2') : (enc.wpa === 2 ? 'WPA2' : 'WPA'),
				enc.auth_suites.join(', ')));
	else
		return E('em', enc.enabled ? _('unknown') : _('open'));
}

function format_actions(dev, type, bss) {
	var enc = bss.encryption || { },
	    input = [
			E('input', { type: 'submit', class: 'cbi-button cbi-button-action important', value: _('Join Network') }),
			E('input', { type: 'hidden', name: 'token',    value: L.env.token }),
			E('input', { type: 'hidden', name: 'device',   value: dev }),
			E('input', { type: 'hidden', name: 'join',     value: bss.ssid }),
			E('input', { type: 'hidden', name: 'mode',     value: bss.mode }),
			E('input', { type: 'hidden', name: 'bssid',    value: bss.bssid }),
			E('input', { type: 'hidden', name: 'channel',  value: bss.channel }),
			E('input', { type: 'hidden', name: 'clbridge', value: type === 'wl' ? 1 : 0 }),
			E('input', { type: 'hidden', name: 'wep',      value: enc.wep ? 1 : 0 })
		];

	if (enc.wpa) {
		input.push(E('input', { type: 'hidden', name: 'wpa_version', value: enc.wpa }));

		enc.auth_suites.forEach(function(s) {
			input.push(E('input', { type: 'hidden', name: 'wpa_suites', value: s }));
		});

		enc.group_ciphers.forEach(function(s) {
			input.push(E('input', { type: 'hidden', name: 'wpa_group', value: s }));
		});

		enc.pair_ciphers.forEach(function(s) {
			input.push(E('input', { type: 'hidden', name: 'wpa_pairwise', value: s }));
		});
	}

	return E('form', {
		class: 'inline',
		method: 'post',
		action: L.url('admin/network/wireless_join')
	}, input);
}

function fade(bss, content) {
	if (bss.stale)
		return E('span', { style: 'opacity:0.5' }, content);
	else
		return content;
}

function flush() {
	L.stop(poll);
	L.halt();

	scan();
}

function scan() {
	var tbl = document.querySelector('[data-wifi-scan]'),
	    dev = tbl.getAttribute('data-wifi-scan'),
	    type = tbl.getAttribute('data-wifi-type');

	cbi_update_table(tbl, [], E('em', { class: 'spinning' }, _('Starting wireless scan...')));

	L.post(L.url('admin/network/wireless_scan_trigger', dev), null, function(s) {
		if (s.status !== 204) {
			cbi_update_table(tbl, [], E('em', _('Scan request failed')));
			return;
		}

		var count = 0;

		poll = L.poll(3, L.url('admin/network/wireless_scan_results', dev), null, function(s, results) {
			if (Array.isArray(results)) {
				var bss = [];

				results.sort(function(a, b) {
					var diff = (b.quality - a.quality) || (a.channel - b.channel);

					if (diff)
						return diff;

					if (a.ssid < b.ssid)
						return -1;
					else if (a.ssid > b.ssid)
						return 1;

					if (a.bssid < b.bssid)
						return -1;
					else if (a.bssid > b.bssid)
						return 1;
				}).forEach(function(res) {
					bss.push([
						fade(res, format_signal(res)),
						fade(res, res.ssid ? '%h'.format(res.ssid) : E('em', {}, _('hidden'))),
						fade(res, res.channel),
						fade(res, res.mode),
						fade(res, res.bssid),
						fade(res, format_encryption(res)),
						format_actions(dev, type, res)
					]);
				});

				cbi_update_table(tbl, bss, E('em', { class: 'spinning' }, _('No scan results available yet...')));
			}

			if (count++ >= 3) {
				count = 0;
				L.post(L.url('admin/network/wireless_scan_trigger', dev, 1), null, function() {});
			}
		});

		L.run();
	});
}

document.addEventListener('DOMContentLoaded', scan);
