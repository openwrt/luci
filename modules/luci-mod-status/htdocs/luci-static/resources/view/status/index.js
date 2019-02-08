function progressbar(query, value, max, byte)
{
	var pg = document.querySelector(query),
	    vn = parseInt(value) || 0,
	    mn = parseInt(max) || 100,
	    fv = byte ? String.format('%1024.2mB', value) : value,
	    fm = byte ? String.format('%1024.2mB', max) : max,
	    pc = Math.floor((100 / mn) * vn);

	if (pg) {
		pg.firstElementChild.style.width = pc + '%';
		pg.setAttribute('title', '%s / %s (%d%%)'.format(fv, fm, pc));
	}
}

function renderBox(title, active, childs) {
	childs = childs || [];
	childs.unshift(L.itemlist(E('span'), [].slice.call(arguments, 3)));

	return E('div', { class: 'ifacebox' }, [
		E('div', { class: 'ifacebox-head center ' + (active ? 'active' : '') },
			E('strong', title)),
		E('div', { class: 'ifacebox-body left' }, childs)
	]);
}

function renderBadge(icon, title) {
	return E('span', { class: 'ifacebadge' }, [
		E('img', { src: icon, title: title || '' }),
		L.itemlist(E('span'), [].slice.call(arguments, 2))
	]);
}

L.poll(5, L.location(), { status: 1 },
	function(x, info)
	{
		var us = document.getElementById('upstream_status_table');

		while (us.lastElementChild)
			us.removeChild(us.lastElementChild);

		var wan_list = info.wan || [];

		for (var i = 0; i < wan_list.length; i++) {
			var ifc = wan_list[i];

			us.appendChild(renderBox(
				_('IPv4 Upstream'),
				(ifc.ifname && ifc.proto != 'none'),
				[ E('div', {}, renderBadge(
				L.resource('icons/%s.png').format((ifc && ifc.type) ? ifc.type : 'ethernet_disabled'), null,
				_('Device'), ifc ? (ifc.name || ifc.ifname || '-') : '-',
				_('MAC-Address'), (ifc && ifc.ether) ? ifc.mac : null)) ],
				_('Protocol'), ifc.i18n || E('em', _('Not connected')),
				_('Address'), (ifc.ipaddr) ? ifc.ipaddr : '0.0.0.0',
				_('Netmask'), (ifc.netmask && ifc.netmask != ifc.ipaddr) ? ifc.netmask : '255.255.255.255',
				_('Gateway'), (ifc.gwaddr) ? ifc.gwaddr : '0.0.0.0',
				_('DNS') + ' 1', (ifc.dns) ? ifc.dns[0] : null,
				_('DNS') + ' 2', (ifc.dns) ? ifc.dns[1] : null,
				_('DNS') + ' 3', (ifc.dns) ? ifc.dns[2] : null,
				_('DNS') + ' 4', (ifc.dns) ? ifc.dns[3] : null,
				_('DNS') + ' 5', (ifc.dns) ? ifc.dns[4] : null,
				_('Expires'), (ifc.expires > -1) ? '%t'.format(ifc.expires) : null,
				_('Connected'), (ifc.uptime > 0) ? '%t'.format(ifc.uptime) : null));
		}

		var wan6_list = info.wan6 || [];

		for (var i = 0; i < wan6_list.length; i++) {
			var ifc6 = wan6_list[i];

			us.appendChild(renderBox(
				_('IPv6 Upstream'),
				(ifc6.ifname && ifc6.proto != 'none'),
				[ E('div', {}, renderBadge(
					L.resource('icons/%s.png').format(ifc6.type || 'ethernet_disabled'), null,
					_('Device'), ifc6 ? (ifc6.name || ifc6.ifname || '-') : '-',
					_('MAC-Address'), (ifc6 && ifc6.ether) ? ifc6.mac : null)) ],
				_('Protocol'), ifc6.i18n ? (ifc6.i18n + (ifc6.proto === 'dhcp' && ifc6.ip6prefix ? '-PD' : '')) : E('em', _('Not connected')),
				_('Prefix Delegated'), ifc6.ip6prefix,
				_('Address'), (ifc6.ip6prefix) ? (ifc6.ip6addr || null) : (ifc6.ip6addr || '::'),
				_('Gateway'), (ifc6.gw6addr) ? ifc6.gw6addr : '::',
				_('DNS') + ' 1', (ifc6.dns) ? ifc6.dns[0] : null,
				_('DNS') + ' 2', (ifc6.dns) ? ifc6.dns[1] : null,
				_('DNS') + ' 3', (ifc6.dns) ? ifc6.dns[2] : null,
				_('DNS') + ' 4', (ifc6.dns) ? ifc6.dns[3] : null,
				_('DNS') + ' 5', (ifc6.dns) ? ifc6.dns[4] : null,
				_('Connected'), (ifc6.uptime > 0) ? '%t'.format(ifc6.uptime) : null));
		}

		var ds = document.getElementById('dsl_status_table');
		if (ds) {
			while (ds.lastElementChild)
				ds.removeChild(ds.lastElementChild);

			ds.appendChild(renderBox(
				_('DSL Status'),
				(info.dsl.line_state === 'UP'), [ ],
				_('Line State'), '%s [0x%x]'.format(info.dsl.line_state, info.dsl.line_state_detail),
				_('Line Mode'), info.dsl.line_mode_s || '-',
				_('Line Uptime'), info.dsl.line_uptime_s || '-',
				_('Annex'), info.dsl.annex_s || '-',
				_('Profile'), info.dsl.profile_s || '-',
				_('Data Rate'), '%s/s / %s/s'.format(info.dsl.data_rate_down_s, info.dsl.data_rate_up_s),
				_('Max. Attainable Data Rate (ATTNDR)'), '%s/s / %s/s'.format(info.dsl.max_data_rate_down_s, info.dsl.max_data_rate_up_s),
				_('Latency'), '%s / %s'.format(info.dsl.latency_num_down, info.dsl.latency_num_up),
				_('Line Attenuation (LATN)'), '%.1f dB / %.1f dB'.format(info.dsl.line_attenuation_down, info.dsl.line_attenuation_up),
				_('Signal Attenuation (SATN)'), '%.1f dB / %.1f dB'.format(info.dsl.signal_attenuation_down, info.dsl.signal_attenuation_up),
				_('Noise Margin (SNR)'), '%.1f dB / %.1f dB'.format(info.dsl.noise_margin_down, info.dsl.noise_margin_up),
				_('Aggregate Transmit Power(ACTATP)'), '%.1f dB / %.1f dB'.format(info.dsl.actatp_down, info.dsl.actatp_up),
				_('Forward Error Correction Seconds (FECS)'), '%d / %d'.format(info.dsl.errors_fec_near, info.dsl.errors_fec_far),
				_('Errored seconds (ES)'), '%d / %d'.format(info.dsl.errors_es_near, info.dsl.errors_es_far),
				_('Severely Errored Seconds (SES)'), '%d / %d'.format(info.dsl.errors_ses_near, info.dsl.errors_ses_far),
				_('Loss of Signal Seconds (LOSS)'), '%d / %d'.format(info.dsl.errors_loss_near, info.dsl.errors_loss_far),
				_('Unavailable Seconds (UAS)'), '%d / %d'.format(info.dsl.errors_uas_near, info.dsl.errors_uas_far),
				_('Header Error Code Errors (HEC)'), '%d / %d'.format(info.dsl.errors_hec_near, info.dsl.errors_hec_far),
				_('Non Pre-emtive CRC errors (CRC_P)'), '%d / %d'.format(info.dsl.errors_crc_p_near, info.dsl.errors_crc_p_far),
				_('Pre-emtive CRC errors (CRCP_P)'), '%d / %d'.format(info.dsl.errors_crcp_p_near, info.dsl.errors_crcp_p_far),
				_('ATU-C System Vendor ID'), info.dsl.atuc_vendor_id,
				_('Power Management Mode'), info.dsl.power_mode_s));
		}

		var ws = document.getElementById('wifi_status_table');
		if (ws)
		{
			while (ws.lastElementChild)
				ws.removeChild(ws.lastElementChild);

			for (var didx = 0; didx < info.wifinets.length; didx++)
			{
				var dev = info.wifinets[didx];
				var net0 = (dev.networks && dev.networks[0]) ? dev.networks[0] : {};
				var vifs = [];

				for (var nidx = 0; nidx < dev.networks.length; nidx++)
				{
					var net = dev.networks[nidx];
					var is_assoc = (net.bssid != '00:00:00:00:00:00' && net.channel && !net.disabled);

					var icon;
					if (net.disabled)
						icon = L.resource('icons/signal-none.png');
					else if (net.quality <= 0)
						icon = L.resource('icons/signal-0.png');
					else if (net.quality < 25)
						icon = L.resource('icons/signal-0-25.png');
					else if (net.quality < 50)
						icon = L.resource('icons/signal-25-50.png');
					else if (net.quality < 75)
						icon = L.resource('icons/signal-50-75.png');
					else
						icon = L.resource('icons/signal-75-100.png');

					vifs.push(renderBadge(
						icon,
						'%s: %d dBm / %s: %d%%'.format(_('Signal'), net.signal, _('Quality'), net.quality),
						_('SSID'), E('a', { href: net.link }, [ net.ssid || '?' ]),
						_('Mode'), net.mode,
						_('BSSID'), is_assoc ? (net.bssid || '-') : null,
						_('Encryption'), is_assoc ? net.encryption : null,
						_('Associations'), is_assoc ? (net.num_assoc || '-') : null,
						null, is_assoc ? null : E('em', net.disabled ? _('Wireless is disabled') : _('Wireless is not associated'))));
				}

				ws.appendChild(renderBox(
					dev.device, dev.up || net0.up,
					[ E('div', vifs) ],
					_('Type'), dev.name.replace(/^Generic | Wireless Controller .+$/g, ''),
					_('Channel'), net0.channel ? '%d (%.3f %s)'.format(net0.channel, net0.frequency, _('GHz')) : '-',
					_('Bitrate'), net0.bitrate ? '%d %s'.format(net0.bitrate, _('Mbit/s')) : '-'));
			}

			if (!ws.lastElementChild)
				ws.appendChild(E('em', _('No information available')));
		}

		var e;

		if (e = document.getElementById('localtime'))
			e.innerHTML = info.localtime;

		if (e = document.getElementById('uptime'))
			e.innerHTML = String.format('%t', info.uptime);

		if (e = document.getElementById('loadavg'))
			e.innerHTML = String.format(
				'%.02f, %.02f, %.02f',
				info.loadavg[0] / 65535.0,
				info.loadavg[1] / 65535.0,
				info.loadavg[2] / 65535.0
			);

		progressbar('#memtotal',
			info.memory.free + info.memory.buffered,
			info.memory.total,
			true);

		progressbar('#memfree',
			info.memory.free,
			info.memory.total,
			true);

		progressbar('#membuff',
			info.memory.buffered,
			info.memory.total,
			true);

		progressbar('#swaptotal',
			info.swap.free,
			info.swap.total,
			true);

		progressbar('#swapfree',
			info.swap.free,
			info.swap.total,
			true);

		progressbar('#conns',
			info.conncount, info.connmax, false);

	}
);
