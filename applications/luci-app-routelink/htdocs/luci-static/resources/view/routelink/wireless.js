'use strict';
'require view';
'require poll';
'require ui';
'require routelink.common as rl';

/* Signal history ranges: the first one reads the in-memory samples of the last minutes. */
var RANGES = [
	[ 300, _('5 minutes') ],
	[ 3600, _('1 hour') ],
	[ 86400, _('24 hours') ],
	[ 7 * 86400, _('7 days') ],
	[ 30 * 86400, _('30 days') ]
];

return view.extend({
	load: function() {
		return Promise.all([
			rl.info(),
			L.resolveDefault(rl.devices(), []),
			L.resolveDefault(rl.stations(true), null),
			L.resolveDefault(rl.survey(), null)
		]);
	},

	render: function(data) {
		var info = data[0], self = this;
		this.byMac = {};
		(data[1] || []).forEach(function(d) { self.byMac[d.mac] = d; });
		this.state = { selected: null, range: 300, weakestFirst: true };
		this.clockOffset = 0; /* router clock minus browser clock: ranges must use the router's time */

		if (info.modules.indexOf('wifi') < 0)
			return E([], [
				E('h2', {}, _('Wireless')),
				E('div', { 'class': 'alert-message notice' }, info.roles.indexOf('ap') < 0
					? _('This router has no access point interface, so there is nothing to sample.')
					: [ _('Wireless sampling is switched off.') + ' ',
						E('a', { href: L.url('admin/services/routelink/settings') }, _('Settings')) ])
			]);

		this.ifaceBox = E('div');
		this.stationBox = E('div');
		this.historyTitle = E('h3', {}, _('Signal history'));
		this.historyBox = E('div', {}, E('p', { 'class': 'cbi-section-descr' }, _('Select a station to see its signal history.')));
		this.surveyBox = E('div');
		this.rangeBar = E('div', { style: 'display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px' }, RANGES.map(function(r) {
			return E('button', { 'class': 'btn cbi-button', 'data-range': r[0], click: function() {
				self.state.range = r[0];
				self.markRange();
				self.refreshHistory();
			} }, r[1]);
		}));
		this.markRange();

		this.renderStations(data[2]);
		this.renderSurvey(data[3]);

		/* every call renews the live lease: stations are sampled each second while the page is open */
		poll.add(function() {
			return L.resolveDefault(rl.stations(true), null).then(function(st) {
				self.renderStations(st);
				if (self.state.selected && self.state.range <= 300)
					return self.refreshHistory();
			});
		}, 3);
		poll.add(function() {
			return L.resolveDefault(rl.survey(), null).then(function(sv) { self.renderSurvey(sv); });
		}, 30);

		return E([], [
			E('h2', {}, _('Wireless')),
			E('div', { 'class': 'cbi-section' }, [ E('h3', {}, _('Access points')), this.ifaceBox ]),
			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, _('Stations')),
				E('p', { 'class': 'cbi-section-descr' },
					_('Signal as this router hears each device. Excellent from -60 dBm, good from -70, fair from -80; a signal-to-noise ratio under 20 dB lowers the grade by one.')),
				this.stationBox
			]),
			E('div', { 'class': 'cbi-section' }, [ this.historyTitle, this.rangeBar, this.historyBox ]),
			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, _('Channel utilisation')),
				E('p', { 'class': 'cbi-section-descr' },
					_('Share of the time the channel was busy during the last minute. Other channels show what the driver measured during the last scan.')),
				this.surveyBox
			])
		]);
	},

	label: function(mac) {
		var d = this.byMac[mac];
		return d ? (d.name || d.hostname || mac) : mac;
	},

	markRange: function() {
		var range = this.state.range;
		this.rangeBar.querySelectorAll('button').forEach(function(b) {
			b.classList.toggle('cbi-button-action', +b.getAttribute('data-range') === range);
		});
	},

	renderStations: function(st) {
		var self = this;
		if (!st)
			return;
		this.clockOffset = st.ts - Math.floor(Date.now() / 1000);
		var noiseOf = {};
		this.ifaceBox.replaceChildren(E('table', { 'class': 'table' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th' }, _('SSID')),
				E('th', { 'class': 'th' }, _('Interface')),
				E('th', { 'class': 'th' }, _('Channel')),
				E('th', { 'class': 'th' }, _('Width')),
				E('th', { 'class': 'th' }, _('Noise')),
				E('th', { 'class': 'th' }, _('Stations'))
			])
		].concat(st.interfaces.length ? st.interfaces.map(function(i) {
			noiseOf[i.ifname] = i.noise;
			return E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td' }, [ i.ssid || '-' ]),
				E('td', { 'class': 'td' }, [ '%s (%s)'.format(i.ifname, i.phy) ]),
				E('td', { 'class': 'td' }, '%d (%s, %d MHz)'.format(i.channel, rl.bandOf(i.freq), i.freq)),
				E('td', { 'class': 'td' }, i.width ? i.width + ' MHz' : '-'),
				E('td', { 'class': 'td' }, i.noise != null ? i.noise + ' dBm' : '-'),
				E('td', { 'class': 'td' }, String(i.stations))
			]);
		}) : [ E('tr', { 'class': 'tr placeholder' }, E('td', { 'class': 'td' }, _('No access point interface is up.'))) ])));

		var list = st.stations.slice().sort(function(a, b) {
			var x = a.signal != null ? a.signal : 1, y = b.signal != null ? b.signal : 1;
			return self.state.weakestFirst ? x - y : y - x;
		});
		var sortHead = E('th', { 'class': 'th', style: 'cursor:pointer', click: function() {
			self.state.weakestFirst = !self.state.weakestFirst;
			self.renderStations(st);
		} }, _('Signal') + (this.state.weakestFirst ? ' ▲' : ' ▼'));
		var rows = list.map(function(s) {
			var noise = s.noise != null ? s.noise : noiseOf[s.ifname];
			var mode = [ s.mode ? s.mode.toUpperCase() : null, s.tx_mcs != null ? 'MCS ' + s.tx_mcs : null,
				s.tx_nss ? s.tx_nss + 'x' : null, s.width ? s.width + ' MHz' : null ].filter(function(v) { return v; }).join(' · ');
			var retry = s.tx_retries != null && s.tx_packets ? (s.tx_retries / (s.tx_retries + s.tx_packets) * 100).toFixed(1) + '%' : '-';
			return E('tr', { 'class': 'tr', style: 'cursor:pointer' + (self.state.selected === s.mac ? ';font-weight:bold' : ''),
				click: function() { self.select(s.mac); } }, [
				E('td', { 'class': 'td' }, [ self.label(s.mac), E('br'), E('small', {}, [ s.mac ]) ]),
				E('td', { 'class': 'td' }, rl.gradeBadge(s.signal, noise)),
				E('td', { 'class': 'td' }, noise != null && s.signal != null ? (s.signal - noise) + ' dB' : '-'),
				E('td', { 'class': 'td' }, [ '%s (%s)'.format(s.ifname, rl.bandOf(s.freq)) ]),
				E('td', { 'class': 'td' }, '↓ %s / ↑ %s'.format(rl.formatKbit(s.tx_rate), rl.formatKbit(s.rx_rate))),
				E('td', { 'class': 'td' }, [ mode || '-' ]),
				E('td', { 'class': 'td' }, retry),
				E('td', { 'class': 'td' }, rl.formatDuration(s.connected_sec))
			]);
		});
		this.stationBox.replaceChildren(E('table', { 'class': 'table' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th' }, _('Device')),
				sortHead,
				E('th', { 'class': 'th' }, _('SNR')),
				E('th', { 'class': 'th' }, _('Interface')),
				E('th', { 'class': 'th' }, _('Rate (to / from device)')),
				E('th', { 'class': 'th' }, _('Mode')),
				E('th', { 'class': 'th' }, _('Retries')),
				E('th', { 'class': 'th' }, _('Connected'))
			])
		].concat(rows.length ? rows : [ E('tr', { 'class': 'tr placeholder' }, E('td', { 'class': 'td' }, _('No wireless stations connected.'))) ])));
	},

	select: function(mac) {
		this.state.selected = mac;
		this.historyTitle.textContent = _('Signal history') + ': ' + this.label(mac);
		return this.refreshHistory();
	},

	refreshHistory: function() {
		var self = this, mac = this.state.selected, now = Math.floor(Date.now() / 1000) + this.clockOffset;
		if (!mac)
			return Promise.resolve();
		return rl.signal(mac, now - this.state.range, now + 60, 300).then(function(h) {
			if (self.state.selected !== mac)
				return;
			var have = h.points.some(function(p) { return p[1] != null; });
			var last = null;
			h.points.forEach(function(p) { if (p[1] != null) last = p; });
			self.historyBox.replaceChildren(E([], [
				have ? rl.signalChart(h.points, 160) : E('p', {}, _('No signal data in this range.')),
				E('p', { 'class': 'cbi-section-descr' }, [
					_('Dark line: average signal, light line: weakest sample.') + ' ',
					h.tier === 'live' ? _('Every sample of the last minutes.') : _('One point per %s.').format(rl.formatDuration(h.step)),
					last && last[3] != null ? ' ' + _('Latest rate to the device: %s.').format(rl.formatKbit(last[3])) : ''
				])
			]));
		}).catch(function(e) {
			self.historyBox.replaceChildren(E('p', {}, [ e.message ]));
		});
	},

	renderSurvey: function(sv) {
		if (!sv)
			return;
		var busyCell = function(pct) {
			if (pct == null)
				return E('td', { 'class': 'td' }, '-');
			var color = pct >= 70 ? '#d9534f' : pct >= 40 ? '#f39c12' : '#2e9e44';
			return E('td', { 'class': 'td', style: 'min-width:140px' }, [ pct + '%', rl.bar(pct, 100, color) ]);
		};
		var rows = sv.radios.map(function(r) {
			return E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td' }, [ '%s (%s)'.format(r.phy, r.ifname) ]),
				E('td', { 'class': 'td' }, '%d (%s, %d MHz)'.format(r.channel, rl.bandOf(r.freq), r.freq)),
				E('td', { 'class': 'td' }, _('In use')),
				E('td', { 'class': 'td' }, r.noise != null ? r.noise + ' dBm' : '-'),
				busyCell(r.busy_pct)
			]);
		}).concat(sv.channels.slice().sort(function(a, b) { return a.freq - b.freq; }).map(function(c) {
			return E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td' }, [ c.phy ]),
				E('td', { 'class': 'td' }, '%d (%s, %d MHz)'.format(c.channel, rl.bandOf(c.freq), c.freq)),
				E('td', { 'class': 'td' }, _('Scanned')),
				E('td', { 'class': 'td' }, c.noise != null ? c.noise + ' dBm' : '-'),
				busyCell(c.busy_pct)
			]);
		}));
		this.surveyBox.replaceChildren(E('table', { 'class': 'table' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th' }, _('Radio')),
				E('th', { 'class': 'th' }, _('Channel')),
				E('th', { 'class': 'th' }, _('Status')),
				E('th', { 'class': 'th' }, _('Noise')),
				E('th', { 'class': 'th' }, _('Busy'))
			])
		].concat(rows.length ? rows : [ E('tr', { 'class': 'tr placeholder' }, E('td', { 'class': 'td' }, _('No channel data yet.'))) ])));
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
