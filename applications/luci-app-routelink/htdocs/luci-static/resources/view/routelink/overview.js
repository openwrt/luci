'use strict';
'require view';
'require poll';
'require ui';
'require routelink.common as rl';

var WINDOW = 60; /* live points kept for the WAN chart (2 s each) */

return view.extend({
	load: function() {
		var now = new Date(), today = rl.resolvePreset('today', now);
		return Promise.all([
			rl.info(),
			rl.devices(),
			L.resolveDefault(rl.summary(today[0], today[1] + 60, 'internet', undefined, 'total', 5, 0), null)
		]);
	},

	render: function(data) {
		var info = data[0], devices = data[1] || [], today = data[2];
		var byMac = {};
		devices.forEach(function(d) { byMac[d.mac] = d; });

		var status = E('div', { 'class': 'cbi-section' }, [
			E('h3', {}, _('Status')),
			E('table', { 'class': 'table' }, [
				[ _('Version'), info.version ],
				[ _('Role'), [ info.roles.indexOf('gateway') >= 0 ? _('Gateway (traffic accounting)') : _('Not a gateway'),
					info.roles.indexOf('ap') >= 0 ? _('Access point') : null ].filter(function(r) { return r; }).join(', ') ],
				[ _('Flow offloading'), { none: _('Off'), software: _('Software'), hardware: _('Hardware'), sfe: 'SFE' }[info.offload] || info.offload ],
				[ _('Clock'), info.time_synced ? _('Synchronised') : _('Not synchronised') ],
				[ _('Storage'), '%s / %s'.format(rl.formatBytes(info.storage_used), rl.formatBytes(info.storage_limit)) ],
				[ _('Last write to disk'), info.last_commit ? rl.formatTime(info.last_commit) : _('Not yet') ],
				[ _('Data directory'), info.data_dir ]
			].map(function(r) {
				return E('tr', { 'class': 'tr' }, [ E('td', { 'class': 'td left', width: '33%' }, r[0]),
					E('td', { 'class': 'td left' }, [ r[1] != null ? r[1] : '-' ]) ]);
			}))
		]);

		if (info.modules.indexOf('traffic') < 0)
			return E([], [
				E('h2', {}, _('RouteLink')),
				E('div', { 'class': 'alert-message notice' }, _('This router is not a gateway, so traffic accounting is off.')),
				status
			]);

		var rates = [], wanNow = E('span', {}, '-');
		var chartBox = E('div', {}, rl.chart([], 2));
		var live = E('div', { 'class': 'cbi-section' }, [
			E('h3', {}, [ _('WAN now') + ' ', wanNow ]),
			chartBox,
			E('p', { 'class': 'cbi-section-descr' }, _('Blue: download, orange: upload. Updated every 2 seconds.'))
		]);

		poll.add(function() {
			return rl.live().then(function(l) {
				rates.push([ l.ts, l.wan.rx_rate * 2, l.wan.tx_rate * 2 ]);
				if (rates.length > WINDOW)
					rates.shift();
				wanNow.textContent = '↓ %s   ↑ %s   %d %s'.format(rl.formatRate(l.wan.rx_rate), rl.formatRate(l.wan.tx_rate),
					l.online, _('devices online'));
				chartBox.replaceChildren(rl.chart(rates, 2, 120));
			});
		}, 2);

		var top = E('div', { 'class': 'cbi-section' }, [ E('h3', {}, _('Top devices today')) ]);
		if (!today || !today.devices.length) {
			top.appendChild(E('p', {}, _('No traffic yet today.')));
		} else {
			var total = today.rx + today.tx;
			top.appendChild(E('table', { 'class': 'table' }, today.devices.map(function(d) {
				var dev = byMac[d.mac] || d;
				return E('tr', { 'class': 'tr' }, [
					E('td', { 'class': 'td left' }, E('a', { href: L.url('admin/services/routelink/traffic') + '?mac=' + encodeURIComponent(d.mac) },
						[ rl.deviceLabel(dev) ])),
					E('td', { 'class': 'td left' }, '↓ ' + rl.formatBytes(d.rx)),
					E('td', { 'class': 'td left' }, '↑ ' + rl.formatBytes(d.tx)),
					E('td', { 'class': 'td left', width: '30%' }, rl.bar(d.rx + d.tx, total))
				]);
			})));
		}

		return E([], [
			E('h2', {}, _('RouteLink')),
			rl.warnings(info, rl.stopNlbwmon),
			live,
			top,
			status
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
