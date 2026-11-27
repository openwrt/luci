'use strict';
'require view';
'require poll';
'require ui';
'require routelink.common as rl';

var PAGE = 50;
var SPARK = 30; /* live points per device */

function pad(n) {
	return (n < 10 ? '0' : '') + n;
}

function localInput(ts) {
	var d = new Date(ts * 1000);
	return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

function fromInput(value) {
	var t = Date.parse(value);
	return isNaN(t) ? null : Math.floor(t / 1000);
}

return view.extend({
	load: function() {
		return Promise.all([ rl.info(), rl.devices() ]);
	},

	render: function(data) {
		var info = data[0], self = this;
		this.info = info;
		this.byMac = {};
		(data[1] || []).forEach(function(d) { self.byMac[d.mac] = d; });

		if (info.modules.indexOf('traffic') < 0)
			return E([], [ E('h2', {}, _('Traffic')),
				E('div', { 'class': 'alert-message notice' }, _('This router is not a gateway, so traffic accounting is off.')) ]);

		this.state = { preset: 'today', start: null, end: null, hours: null, cls: 'internet', sort: 'total', page: 0, tab: 'ranking' };
		this.liveSeries = {};

		var presetButtons = rl.PRESETS.map(function(p) {
			return E('button', { 'class': 'btn cbi-button', 'data-preset': p[0], click: function() { self.setPreset(p[0]); } }, p[1]);
		});
		presetButtons.push(E('button', { 'class': 'btn cbi-button', 'data-preset': 'custom', click: function() { self.showCustom(); } },
			_('Custom…')));
		this.presetBar = E('div', { style: 'display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px' }, presetButtons);
		this.rangeLabel = E('p', { 'class': 'cbi-section-descr' });

		this.classSelect = E('select', { 'class': 'cbi-input-select', change: function(ev) {
			self.state.cls = ev.target.value;
			self.state.page = 0;
			self.refresh();
		} }, [
			E('option', { value: 'internet' }, _('Internet')),
			E('option', { value: 'lan' }, _('Local network')),
			E('option', { value: 'all' }, _('All'))
		]);

		this.totals = E('div', { style: 'display:flex;gap:24px;flex-wrap:wrap;margin:8px 0' });
		this.chartBox = E('div');
		this.notice = E('p', { 'class': 'cbi-section-descr' });
		this.table = E('div');
		this.pager = E('div', { style: 'margin-top:8px' });

		var tabs = E('div', { 'class': 'cbi-tabmenu' }, [
			E('li', { 'class': 'cbi-tab', 'data-tab': 'ranking' }, E('a', { href: '#', click: function(ev) { ev.preventDefault(); self.setTab('ranking'); } }, _('Ranking'))),
			E('li', { 'class': 'cbi-tab-disabled', 'data-tab': 'live' }, E('a', { href: '#', click: function(ev) { ev.preventDefault(); self.setTab('live'); } }, _('Live')))
		]);
		this.tabs = tabs;

		poll.add(function() {
			return self.state.tab === 'live' ? self.refreshLive() : Promise.resolve();
		}, 2);

		var page = E([], [
			E('h2', {}, _('Traffic')),
			rl.warnings(info, rl.stopNlbwmon),
			E('div', { 'class': 'cbi-section' }, [
				this.presetBar,
				this.rangeLabel,
				E('div', {}, [ _('Traffic class') + ': ', this.classSelect, ' ',
					E('button', { 'class': 'btn cbi-button', click: function() { self.exportCsv(); } }, _('Export CSV')) ]),
				this.totals,
				this.chartBox,
				this.notice
			]),
			E('div', { 'class': 'cbi-section' }, [ tabs, this.table, this.pager ])
		]);

		var mac = new URLSearchParams(location.search).get('mac');
		this.setPreset('today').then(function() {
			if (mac)
				self.showDevice(mac);
		});
		return page;
	},

	range: function() {
		var s = this.state;
		if (s.preset === 'custom')
			return [ s.start, s.end ];
		return rl.resolvePreset(s.preset, new Date());
	},

	setPreset: function(id) {
		this.state.preset = id;
		this.state.page = 0;
		this.presetBar.querySelectorAll('button').forEach(function(b) {
			b.classList.toggle('cbi-button-action', b.getAttribute('data-preset') === id);
		});
		return this.refresh();
	},

	showCustom: function() {
		var self = this, r = this.range();
		var start = E('input', { type: 'datetime-local', 'class': 'cbi-input-text', value: localInput(r[0]) });
		var end = E('input', { type: 'datetime-local', 'class': 'cbi-input-text', value: localInput(r[1]) });
		var useHours = E('input', { type: 'checkbox' });
		var hourOptions = function() {
			var o = [];
			for (var h = 0; h < 24; h++)
				o.push(E('option', { value: h }, pad(h) + ':00'));
			return o;
		};
		var from = E('select', { 'class': 'cbi-input-select' }, hourOptions());
		var to = E('select', { 'class': 'cbi-input-select' }, hourOptions());
		from.value = 20;
		to.value = 23;
		var error = E('p', { style: 'color:#c00' });
		ui.showModal(_('Custom time range'), [
			E('p', {}, [ _('From') + ' ', start ]),
			E('p', {}, [ _('To') + ' ', end ]),
			E('p', {}, [ E('label', {}, [ useHours, ' ' + _('Only these hours of each day') + ' ' ]), from, ' – ', to ]),
			E('p', { 'class': 'cbi-section-descr' }, _('The hour filter uses the router time zone and the hourly data (kept for %d days).')
				.format(this.info.retention.hour_days)),
			error,
			E('div', { 'class': 'right' }, [
				E('button', { 'class': 'btn', click: ui.hideModal }, _('Cancel')), ' ',
				E('button', { 'class': 'btn cbi-button-action', click: function() {
					var a = fromInput(start.value), b = fromInput(end.value);
					if (a == null || b == null || a >= b) {
						error.textContent = _('The end must be after the start.');
						return;
					}
					self.state.start = a;
					self.state.end = b;
					self.state.hours = useHours.checked && from.value !== to.value ? rl.hoursMask(+from.value, +to.value) : null;
					ui.hideModal();
					self.setPreset('custom');
				} }, _('Apply'))
			])
		]);
	},

	refresh: function() {
		var self = this, r = this.range(), s = this.state;
		var hours = s.preset === 'custom' && s.hours ? s.hours : undefined;
		this.rangeLabel.textContent = '%s – %s%s'.format(rl.formatTime(r[0]), rl.formatTime(r[1]),
			hours ? ' · ' + _('selected hours only') : '');
		return Promise.all([
			rl.summary(r[0], r[1], s.cls, hours, s.sort, PAGE, s.page * PAGE),
			rl.history(undefined, r[0], r[1], s.cls === 'internet' ? 'internet' : 'all', hours, 300)
		]).then(function(res) {
			var sum = res[0], hist = res[1];
			self.summaryData = sum;
			self.historyData = hist;
			self.totals.replaceChildren(
				E('div', {}, [ E('strong', {}, '↓ ' + rl.formatBytes(sum.rx)), E('br'), _('Download') ]),
				E('div', {}, [ E('strong', {}, '↑ ' + rl.formatBytes(sum.tx)), E('br'), _('Upload') ]),
				E('div', { title: _('WAN counters include link-layer overhead (PPPoE etc.), so they read a few percent higher.') },
					[ E('strong', {}, '%s / %s'.format(rl.formatBytes(sum.wan_rx), rl.formatBytes(sum.wan_tx))), E('br'), _('WAN interface') ])
			);
			self.chartBox.replaceChildren(rl.chart(hist.points, hist.step));
			self.notice.textContent = sum.start_exact > r[0] + 60 ?
				_('Older data is kept per %s; counting starts at %s.').format(
					{ hour: _('hour'), day: _('day') }[sum.granularity] || sum.granularity, rl.formatTime(sum.start_exact)) : '';
			if (s.tab === 'ranking')
				self.renderRanking();
		}).catch(function(e) {
			ui.addNotification(null, E('p', {}, [ _('Query failed: %s').format(e.message) ]), 'error');
		});
	},

	setTab: function(tab) {
		this.state.tab = tab;
		this.tabs.querySelectorAll('li').forEach(function(li) {
			li.className = li.getAttribute('data-tab') === tab ? 'cbi-tab' : 'cbi-tab-disabled';
		});
		this.pager.replaceChildren();
		if (tab === 'ranking')
			this.renderRanking();
		else
			this.refreshLive();
	},

	sortHeader: function(key, label) {
		var self = this;
		return E('th', { 'class': 'th', style: 'cursor:pointer', click: function() {
			self.state.sort = key;
			self.state.page = 0;
			self.refresh();
		} }, label + (this.state.sort === key ? ' ▾' : ''));
	},

	renderRanking: function() {
		var self = this, sum = this.summaryData, s = this.state;
		if (!sum)
			return;
		var total = sum.rx + sum.tx;
		var rows = sum.devices.map(function(d) {
			var dev = self.byMac[d.mac] || d, label = rl.deviceLabel(dev);
			var details = (label !== d.mac && d.mac.indexOf(':') > 0 ? [ d.mac ] : [])
				.concat(dev.ipv4 && dev.ipv4.length ? [ dev.ipv4[0] ] : []);
			return E('tr', { 'class': 'tr', style: 'cursor:pointer', click: function() { self.showDevice(d.mac); } }, [
				E('td', { 'class': 'td left' }, [ E('strong', {}, [ label ]), E('br'), E('small', {}, [ details.join(' · ') ]) ]),
				E('td', { 'class': 'td left' }, rl.formatBytes(d.rx)),
				E('td', { 'class': 'td left' }, rl.formatBytes(d.tx)),
				E('td', { 'class': 'td left' }, rl.formatBytes(d.rx + d.tx)),
				E('td', { 'class': 'td left', width: '20%' }, rl.bar(d.rx + d.tx, total))
			]);
		});
		this.table.replaceChildren(E('table', { 'class': 'table' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th' }, _('Device')),
				this.sortHeader('rx', _('Download')),
				this.sortHeader('tx', _('Upload')),
				this.sortHeader('total', _('Total')),
				E('th', { 'class': 'th' }, _('Share'))
			])
		].concat(rows.length ? rows : [ E('tr', { 'class': 'tr placeholder' }, E('td', { 'class': 'td' }, _('No traffic in this range.'))) ])));

		var pages = Math.ceil(sum.count / PAGE);
		this.pager.replaceChildren();
		if (pages > 1)
			for (var i = 0; i < pages; i++)
				this.pager.appendChild(E('button', { 'class': 'btn cbi-button' + (i === s.page ? ' cbi-button-action' : ''),
					click: (function(p) { return function() { s.page = p; self.refresh(); }; })(i) }, String(i + 1)));
	},

	refreshLive: function() {
		var self = this;
		return rl.live().then(function(l) {
			var seen = {};
			l.devices.forEach(function(d) {
				var series = self.liveSeries[d.mac] || (self.liveSeries[d.mac] = []);
				series.push(d.rx_rate + d.tx_rate);
				if (series.length > SPARK)
					series.shift();
				seen[d.mac] = true;
			});
			Object.keys(self.liveSeries).forEach(function(mac) {
				if (!seen[mac]) {
					self.liveSeries[mac].push(0);
					if (self.liveSeries[mac].length > SPARK)
						self.liveSeries[mac].shift();
				}
			});
			if (self.state.tab !== 'live')
				return;
			var rows = l.devices.map(function(d) {
				return E('tr', { 'class': 'tr', style: 'cursor:pointer', click: function() { self.showDevice(d.mac); } }, [
					E('td', { 'class': 'td left' }, [ rl.deviceLabel(self.byMac[d.mac] || d) ]),
					E('td', { 'class': 'td left' }, '↓ ' + rl.formatRate(d.rx_rate)),
					E('td', { 'class': 'td left' }, '↑ ' + rl.formatRate(d.tx_rate)),
					E('td', { 'class': 'td left' }, rl.sparkline(self.liveSeries[d.mac] || []))
				]);
			});
			self.table.replaceChildren(
				E('p', {}, '%s: ↓ %s ↑ %s · %d %s'.format(_('WAN'), rl.formatRate(l.wan.rx_rate), rl.formatRate(l.wan.tx_rate),
					l.online, _('devices online'))),
				E('table', { 'class': 'table' }, [
					E('tr', { 'class': 'tr table-titles' }, [ E('th', { 'class': 'th' }, _('Device')), E('th', { 'class': 'th' }, _('Download')),
						E('th', { 'class': 'th' }, _('Upload')), E('th', { 'class': 'th' }, _('Last minute')) ])
				].concat(rows.length ? rows : [ E('tr', { 'class': 'tr placeholder' }, E('td', { 'class': 'td' }, _('No traffic right now.'))) ])));
		});
	},

	showDevice: function(mac) {
		var self = this, r = this.range(), dev = this.byMac[mac] || { mac: mac }, title = [ rl.deviceLabel(dev) ];
		var hours = this.state.preset === 'custom' && this.state.hours ? this.state.hours : undefined;
		ui.showModal(title, [ E('p', { 'class': 'spinning' }, _('Loading…')) ]);
		/* P4: where it went and what it looked up (DNS logging); the 0.1 daemon lists no capabilities */
		var access = (this.info.capabilities || []).indexOf('dns') >= 0 && mac.indexOf(':') > 0;
		return Promise.all([
			rl.history(mac, r[0], r[1], 'all', hours, 200),
			L.resolveDefault(rl.events(r[0], r[1] + 60, [ 'device_online', 'device_offline', 'device_new' ], mac, 50, 0), { events: [] }),
			access ? L.resolveDefault(rl.destinations(mac, r[0], r[1], 10), { destinations: [] }) : null,
			access ? L.resolveDefault(rl.dns(mac, r[0], r[1], undefined, 20, 0), { count: 0, records: [] }) : null
		]).then(function(res) {
			var h = res[0], ev = res[1].events || [], dest = res[2] && res[2].destinations || [], dns = res[3];
			var accessNodes = !access ? [] : !self.info.dns_enabled && !dest.length && !(dns && dns.count) ?
				[ E('h4', {}, _('Destinations and DNS lookups')),
					E('p', {}, [ _('DNS logging is off.') + ' ', E('a', { href: L.url('admin/services/routelink/access') }, _('Access log')) ]) ] :
				[ E('h4', {}, _('Destinations')), rl.destinationTable(dest),
					E('h4', {}, _('Latest DNS lookups')), rl.dnsTable(dns.records || []),
					E('p', {}, E('a', { href: L.url('admin/services/routelink/access') }, _('Access log'))) ];
			var rx = 0, tx = 0, peak = 0;
			h.points.forEach(function(p) {
				rx += p[1] || 0;
				tx += p[2] || 0;
				peak = Math.max(peak, (p[1] || 0) / h.step);
			});
			ui.showModal(title, [
				E('p', {}, [ mac ].concat(dev.ipv4 && dev.ipv4.length ? [ ' · ' + dev.ipv4.join(', ') ] : [])
					.concat(dev.ipv6 && dev.ipv6.length ? [ ' · ' + dev.ipv6.join(', ') ] : [])),
				E('p', {}, '%s ↓ %s ↑ %s · %s %s (%s)'.format(rl.formatTime(r[0]) + ' – ' + rl.formatTime(r[1]) + ':',
					rl.formatBytes(rx), rl.formatBytes(tx), _('peak'), rl.formatRate(peak),
					_('averaged over %d min').format(Math.round(h.step / 60)))),
				rl.chart(h.points, h.step, 140),
				E('h4', {}, _('Online history')),
				ev.length ? E('ul', {}, ev.map(function(e) {
					var label = { device_online: _('came online'), device_offline: _('went offline'), device_new: _('first seen') }[e.type] || e.type;
					return E('li', {}, [ rl.formatTime(e.ts) + ' — ' + label ]);
				})) : E('p', {}, _('No changes in this range.'))
			].concat(accessNodes, [
				E('div', { 'class': 'right' }, E('button', { 'class': 'btn', click: ui.hideModal }, _('Close')))
			]));
		}).catch(function(e) {
			ui.showModal(title, [ E('p', {}, [ _('Query failed: %s').format(e.message) ]),
				E('div', { 'class': 'right' }, E('button', { 'class': 'btn', click: ui.hideModal }, _('Close'))) ]);
		});
	},

	exportCsv: function() {
		var self = this, sum = this.summaryData, hist = this.historyData;
		if (!sum || !hist)
			return;
		var rows = [ [ _('Device'), 'MAC', _('Download (bytes)'), _('Upload (bytes)'), _('Total (bytes)') ] ];
		sum.devices.forEach(function(d) {
			rows.push([ rl.deviceLabel(self.byMac[d.mac] || d), d.mac, d.rx, d.tx, d.rx + d.tx ]);
		});
		rows.push([]);
		rows.push([ _('Time'), _('Download (bytes)'), _('Upload (bytes)') ]);
		hist.points.forEach(function(p) {
			rows.push([ rl.formatTime(p[0]), p[1], p[2] ]);
		});
		var r = this.range();
		rl.download('routelink-traffic-%s.csv'.format(rl.formatTime(r[0]).replace(/[: ]/g, '-')), rl.csv(rows));
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
