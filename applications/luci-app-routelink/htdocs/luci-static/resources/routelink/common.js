'use strict';
'require baseclass';
'require rpc';
'require ui';

/* ubus object "routelink" (API 1) and helpers shared by the RouteLink views. */

var callInfo = rpc.declare({ object: 'routelink', method: 'info' });
var callDevices = rpc.declare({ object: 'routelink', method: 'devices', expect: { devices: [] } });
var callLive = rpc.declare({ object: 'routelink', method: 'live' });
var callHistory = rpc.declare({
	object: 'routelink', method: 'history',
	params: [ 'mac', 'start', 'end', 'class', 'hours', 'max_points' ]
});
var callSummary = rpc.declare({
	object: 'routelink', method: 'summary',
	params: [ 'start', 'end', 'class', 'hours', 'sort', 'limit', 'offset' ]
});
var callEvents = rpc.declare({
	object: 'routelink', method: 'events',
	params: [ 'start', 'end', 'types', 'mac', 'limit', 'offset' ]
});
var callStations = rpc.declare({ object: 'routelink', method: 'stations', params: [ 'live' ] });
var callSignal = rpc.declare({ object: 'routelink', method: 'signal', params: [ 'mac', 'start', 'end', 'max_points' ] });
var callSurvey = rpc.declare({ object: 'routelink', method: 'survey' });
var callLatency = rpc.declare({ object: 'routelink', method: 'latency', params: [ 'start', 'end', 'target', 'max_points' ] });
var callOutages = rpc.declare({ object: 'routelink', method: 'outages', params: [ 'start', 'end' ] });
var callSpeedtestStart = rpc.declare({ object: 'routelink', method: 'speedtest_start', params: [ 'server' ] });
var callSpeedtestStatus = rpc.declare({ object: 'routelink', method: 'speedtest_status', params: [ 'id' ] });
var callQuotas = rpc.declare({ object: 'routelink', method: 'quotas', expect: { quotas: [] } });
var callQuotaAllow = rpc.declare({ object: 'routelink', method: 'quota_allow', params: [ 'section', 'until' ] });
var callDestinations = rpc.declare({
	object: 'routelink', method: 'destinations',
	params: [ 'mac', 'start', 'end', 'limit' ]
});
var callDns = rpc.declare({ object: 'routelink', method: 'dns', params: [ 'mac', 'start', 'end', 'q', 'limit', 'offset' ] });
var callNotifyTest = rpc.declare({ object: 'routelink', method: 'notify_test', params: [ 'section' ] });
var callNotifyStatus = rpc.declare({ object: 'routelink', method: 'notify_status' });
var callReset = rpc.declare({ object: 'routelink', method: 'reset', params: [ 'scope' ] });
var callCommit = rpc.declare({ object: 'routelink', method: 'commit' });
var callInit = rpc.declare({ object: 'rc', method: 'init', params: [ 'name', 'action' ] });

var SVG = 'http://www.w3.org/2000/svg';

function svg(tag, attrs) {
	var el = document.createElementNS(SVG, tag);
	for (var k in attrs)
		el.setAttribute(k, attrs[k]);
	return el;
}

function startOfDay(d) {
	return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function secs(d) {
	return Math.floor(d.getTime() / 1000);
}

/* Same presets as the app (src/features/traffic/timeRange.ts), in the browser's time zone. */
var PRESETS = [
	[ 'lastHour', _('Last hour') ],
	[ 'today', _('Today') ],
	[ 'yesterday', _('Yesterday') ],
	[ 'last7d', _('Last 7 days') ],
	[ 'thisMonth', _('This month') ],
	[ 'lastMonth', _('Last month') ],
	[ 'last30d', _('Last 30 days') ]
];

function resolvePreset(id, now) {
	var t = secs(now), today = startOfDay(now);
	switch (id) {
	case 'lastHour':
		return [ t - 3600, t ];
	case 'yesterday':
		return [ secs(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)), secs(today) ];
	case 'last7d':
		return [ t - 7 * 86400, t ];
	case 'thisMonth':
		return [ secs(new Date(now.getFullYear(), now.getMonth(), 1)), t ];
	case 'lastMonth':
		return [ secs(new Date(now.getFullYear(), now.getMonth() - 1, 1)), secs(new Date(now.getFullYear(), now.getMonth(), 1)) ];
	case 'last30d':
		return [ t - 30 * 86400, t ];
	default:
		return [ secs(today), t ];
	}
}

/* 24-bit mask of local hours from..to (exclusive); from > to wraps past midnight. */
function hoursMask(from, to) {
	var mask = 0;
	for (var h = from; h !== to; h = (h + 1) % 24)
		mask |= 1 << h;
	return mask >>> 0;
}

function formatBytes(n) {
	if (n == null)
		return '-';
	var units = [ 'B', 'KB', 'MB', 'GB', 'TB' ], i = 0;
	while (n >= 1024 && i < units.length - 1) {
		n /= 1024;
		i++;
	}
	return (i ? n.toFixed(n < 10 ? 2 : n < 100 ? 1 : 0) : n) + ' ' + units[i];
}

function formatRate(bytesPerSec) {
	var bits = (bytesPerSec || 0) * 8, units = [ 'bit/s', 'kbit/s', 'Mbit/s', 'Gbit/s' ], i = 0;
	while (bits >= 1000 && i < units.length - 1) {
		bits /= 1000;
		i++;
	}
	return bits.toFixed(i ? 1 : 0) + ' ' + units[i];
}

function formatTime(ts, withDate) {
	var d = new Date(ts * 1000), pad = function(n) { return (n < 10 ? '0' : '') + n; };
	var time = pad(d.getHours()) + ':' + pad(d.getMinutes());
	return withDate === false ? time : d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + time;
}

function deviceLabel(d) {
	if (!d)
		return '-';
	if (d.mac === 'unknown')
		return _('Unidentified devices');
	if (d.mac === 'router')
		return _('Router itself');
	return d.name || d.hostname || d.mac;
}

/*
 * Download/upload area chart. points: [ [ts, rx, tx] ] with null for missing data (drawn as a gap).
 * Values are bytes per point; the y axis shows the average rate over the step.
 */
function chart(points, step, height) {
	var width = 800, h = height || 160, pad = 28;
	var root = svg('svg', { viewBox: '0 0 ' + width + ' ' + (h + pad), width: '100%', preserveAspectRatio: 'none',
		style: 'max-height:' + (h + pad) + 'px' });
	var max = 1;
	points.forEach(function(p) {
		if (p[1] != null)
			max = Math.max(max, p[1], p[2]);
	});
	var n = Math.max(points.length, 2);
	var x = function(i) { return i * width / (n - 1); };
	var y = function(v) { return h - v / max * (h - 8); };

	[ [ 1, '#2f7ef6' ], [ 2, '#f39c12' ] ].forEach(function(series) {
		var d = '', open = false, first = 0;
		points.forEach(function(p, i) {
			if (p[series[0]] == null) {
				if (open)
					d += 'L' + x(i - 1) + ',' + h + 'L' + x(first) + ',' + h + 'Z';
				open = false;
				return;
			}
			if (!open) {
				d += 'M' + x(i) + ',' + y(p[series[0]]);
				first = i;
				open = true;
			} else {
				d += 'L' + x(i) + ',' + y(p[series[0]]);
			}
		});
		if (open)
			d += 'L' + x(points.length - 1) + ',' + h + 'L' + x(first) + ',' + h + 'Z';
		root.appendChild(svg('path', { d: d, fill: series[1], 'fill-opacity': '0.25', stroke: series[1], 'stroke-width': '1.5' }));
	});

	points.forEach(function(p, i) {
		if (p[1] == null)
			root.appendChild(svg('rect', { x: x(i) - width / n / 2, y: 0, width: width / n, height: h,
				fill: '#888', 'fill-opacity': '0.12' }));
	});

	var label = svg('text', { x: 4, y: 12, 'font-size': '11', fill: '#888' });
	label.textContent = formatRate(max / (step || 1));
	root.appendChild(label);
	[ 0, Math.floor((points.length - 1) / 2), points.length - 1 ].forEach(function(i, k) {
		if (!points[i])
			return;
		var t = svg('text', { x: x(i), y: h + 18, 'font-size': '11', fill: '#888',
			'text-anchor': k === 0 ? 'start' : k === 1 ? 'middle' : 'end' });
		t.textContent = formatTime(points[i][0], step < 86400 ? (points[points.length - 1][0] - points[0][0] > 86400) : true);
		root.appendChild(t);
	});
	return root;
}

/* ---- wireless ---- */

/* Signal grades of the app (design §17.1): >= -60 dBm excellent, >= -70 good, >= -80 fair, else poor;
 * a signal-to-noise ratio under 20 dB costs a grade. */
var GRADES = [
	[ _('Excellent'), '#2e9e44' ],
	[ _('Good'), '#7cb342' ],
	[ _('Fair'), '#f39c12' ],
	[ _('Poor'), '#d9534f' ]
];

function signalGrade(signal, noise) {
	var g = signal >= -60 ? 0 : signal >= -70 ? 1 : signal >= -80 ? 2 : 3;
	if (noise != null && noise < 0 && signal - noise < 20 && g < 3)
		g++;
	return g;
}

function gradeBadge(signal, noise) {
	if (signal == null)
		return E('span', {}, '-');
	var g = GRADES[signalGrade(signal, noise)];
	return E('span', { style: 'white-space:nowrap' }, [
		E('span', { style: 'display:inline-block;width:10px;height:10px;border-radius:5px;margin-right:6px;background:' + g[1] }),
		'%d dBm '.format(signal),
		E('span', { style: 'color:' + g[1] }, g[0])
	]);
}

function bandOf(freq) {
	return freq >= 5925 ? '6 GHz' : freq >= 4900 ? '5 GHz' : freq >= 2400 ? '2.4 GHz' : '-';
}

/* Negotiated rates come in kbit/s. */
function formatKbit(kbit) {
	if (kbit == null)
		return '-';
	return kbit >= 1000 ? (kbit / 1000).toFixed(kbit >= 100000 ? 0 : 1) + ' Mbit/s' : kbit + ' kbit/s';
}

function formatDuration(sec) {
	if (sec == null)
		return '-';
	var d = Math.floor(sec / 86400), h = Math.floor(sec % 86400 / 3600), m = Math.floor(sec % 3600 / 60);
	return d ? '%dd %dh'.format(d, h) : h ? '%dh %dm'.format(h, m) : m ? '%dm'.format(m) : '%ds'.format(sec);
}

/*
 * Signal history line chart. points: [ [ts, avg, min, ...] ] from the signal method, null for no data
 * (drawn as a gap). Bands at -60/-70/-80 dBm show the grades.
 */
function signalChart(points, height) {
	var width = 800, h = height || 160, pad = 28, top = -10, bottom = -100;
	var root = svg('svg', { viewBox: '0 0 ' + width + ' ' + (h + pad), width: '100%', preserveAspectRatio: 'none',
		style: 'max-height:' + (h + pad) + 'px' });
	var n = Math.max(points.length, 2);
	var x = function(i) { return i * width / (n - 1); };
	var y = function(v) { return (top - Math.max(bottom, Math.min(top, v))) / (top - bottom) * h; };

	[ [ -60, 0 ], [ -70, 1 ], [ -80, 2 ] ].forEach(function(l) {
		root.appendChild(svg('line', { x1: 0, x2: width, y1: y(l[0]), y2: y(l[0]), stroke: GRADES[l[1]][1],
			'stroke-opacity': '0.5', 'stroke-dasharray': '4 4' }));
		var t = svg('text', { x: width - 4, y: y(l[0]) - 2, 'font-size': '10', fill: '#888', 'text-anchor': 'end' });
		t.textContent = l[0] + ' dBm';
		root.appendChild(t);
	});

	[ [ 2, '#2f7ef6', '1', '0.45' ], [ 1, '#2f7ef6', '2', '1' ] ].forEach(function(series) {
		var d = '', open = false;
		points.forEach(function(p, i) {
			if (p[series[0]] == null) {
				open = false;
				return;
			}
			d += (open ? 'L' : 'M') + x(i) + ',' + y(p[series[0]]);
			open = true;
		});
		root.appendChild(svg('path', { d: d, fill: 'none', stroke: series[1], 'stroke-width': series[2],
			'stroke-opacity': series[3] }));
	});

	points.forEach(function(p, i) {
		if (p[1] == null)
			root.appendChild(svg('rect', { x: x(i) - width / n / 2, y: 0, width: width / n, height: h,
				fill: '#888', 'fill-opacity': '0.12' }));
	});

	[ 0, Math.floor((points.length - 1) / 2), points.length - 1 ].forEach(function(i, k) {
		if (!points[i])
			return;
		var t = svg('text', { x: x(i), y: h + 18, 'font-size': '11', fill: '#888',
			'text-anchor': k === 0 ? 'start' : k === 1 ? 'middle' : 'end' });
		t.textContent = formatTime(points[i][0], points[points.length - 1][0] - points[0][0] > 86400);
		root.appendChild(t);
	});
	return root;
}

/* Rate sparkline from an array of numbers. */
function sparkline(values, color) {
	var width = 120, h = 24, max = Math.max.apply(null, values.concat([ 1 ]));
	var root = svg('svg', { viewBox: '0 0 ' + width + ' ' + h, width: width, height: h });
	var d = values.map(function(v, i) {
		return (i ? 'L' : 'M') + (i * width / Math.max(values.length - 1, 1)) + ',' + (h - v / max * (h - 2));
	}).join('');
	root.appendChild(svg('path', { d: d, fill: 'none', stroke: color || '#2f7ef6', 'stroke-width': '1.5' }));
	return root;
}

/* Horizontal share bar. */
function bar(value, total, color) {
	var pct = total > 0 ? Math.max(1, Math.round(value / total * 100)) : 0;
	return E('div', { style: 'background:#8882;border-radius:3px;height:6px;min-width:80px' }, [
		E('div', { style: 'width:' + pct + '%;height:6px;border-radius:3px;background:' + (color || '#2f7ef6') })
	]);
}

/* ---- limits, DNS log, destinations (P4) ---- */

/* Limit rates are configured in kbit/s. */
function formatKbps(kbps) {
	kbps = +kbps || 0;
	if (!kbps)
		return _('unlimited');
	return kbps >= 1000 ? (kbps / 1000).toFixed(kbps % 1000 ? 1 : 0) + ' Mbit/s' : kbps + ' kbit/s';
}

/* Known devices as choices of a MAC field (it still takes any address). */
function deviceChoices(o, devices) {
	(devices || []).forEach(function(d) {
		var label = deviceLabel(d);
		if (d.mac && d.mac.indexOf(':') > 0)
			o.value(d.mac, label === d.mac ? d.mac : '%s (%s)'.format(label, d.mac));
	});
}

/* Busiest destinations: host or address, traffic, connections. */
function destinationTable(list, limit) {
	var total = 0;
	list.forEach(function(d) { total += d.rx + d.tx; });
	var rows = list.slice(0, limit || list.length).map(function(d) {
		return E('tr', { 'class': 'tr' }, [
			E('td', { 'class': 'td left' }, d.host ? [ E('strong', {}, [ d.host ]), E('br'), E('small', {}, [ d.ip ]) ] : [ d.ip ]),
			E('td', { 'class': 'td left' }, formatBytes(d.rx)),
			E('td', { 'class': 'td left' }, formatBytes(d.tx)),
			E('td', { 'class': 'td left' }, String(d.conns)),
			E('td', { 'class': 'td left', width: '20%' }, bar(d.rx + d.tx, total))
		]);
	});
	return E('table', { 'class': 'table' }, [
		E('tr', { 'class': 'tr table-titles' }, [
			E('th', { 'class': 'th' }, _('Destination')),
			E('th', { 'class': 'th' }, _('Download')),
			E('th', { 'class': 'th' }, _('Upload')),
			E('th', { 'class': 'th' }, _('Connections')),
			E('th', { 'class': 'th' }, _('Share'))
		])
	].concat(rows.length ? rows : [ E('tr', { 'class': 'tr placeholder' }, E('td', { 'class': 'td' }, _('No destinations in this range.'))) ]));
}

/* DNS records, newest first; byMac labels the devices (omit to leave the device column out). */
function dnsTable(records, byMac) {
	var rows = records.map(function(r) {
		var result = r.rcode !== 'NOERROR' ? r.rcode : r.answers.length ? r.answers.join(', ') : _('no address');
		return E('tr', { 'class': 'tr' }, [
			E('td', { 'class': 'td left', style: 'white-space:nowrap' }, formatTime(r.ts)),
			byMac ? E('td', { 'class': 'td left' }, [ deviceLabel(byMac[r.mac] || { mac: r.mac }) ]) : E([]),
			E('td', { 'class': 'td left', style: 'word-break:break-all' }, [ r.name ]),
			E('td', { 'class': 'td left' }, [ r.type ]),
			E('td', { 'class': 'td left', style: 'word-break:break-all' }, [ result ])
		]);
	});
	return E('table', { 'class': 'table' }, [
		E('tr', { 'class': 'tr table-titles' }, [
			E('th', { 'class': 'th' }, _('Time')),
			byMac ? E('th', { 'class': 'th' }, _('Device')) : E([]),
			E('th', { 'class': 'th' }, _('Name')),
			E('th', { 'class': 'th' }, _('Type')),
			E('th', { 'class': 'th' }, _('Answer'))
		])
	].concat(rows.length ? rows : [ E('tr', { 'class': 'tr placeholder' }, E('td', { 'class': 'td' }, _('No lookups in this range.'))) ]));
}

function csv(rows) {
	var bom = String.fromCharCode(0xfeff); /* Excel only reads UTF-8 with a BOM */
	return bom + rows.map(function(r) {
		return r.map(function(c) {
			c = c == null ? '' : String(c);
			/* jsmin in the LuCI build reads a regular expression right after return as a division */
			var quote = /[",\r\n]/.test(c);
			return quote ? '"' + c.replace(/"/g, '""') + '"' : c;
		}).join(',');
	}).join('\r\n') + '\r\n';
}

function download(name, text) {
	var a = E('a', { href: URL.createObjectURL(new Blob([ text ], { type: 'text/csv' })), download: name });
	document.body.appendChild(a);
	a.click();
	a.remove();
}

return baseclass.extend({
	info: callInfo,
	devices: callDevices,
	live: callLive,
	history: callHistory,
	summary: callSummary,
	events: callEvents,
	stations: callStations,
	signal: callSignal,
	survey: callSurvey,
	latency: callLatency,
	outages: callOutages,
	speedtestStart: callSpeedtestStart,
	speedtestStatus: callSpeedtestStatus,
	quotas: callQuotas,
	quotaAllow: callQuotaAllow,
	destinations: callDestinations,
	dns: callDns,
	notifyTest: callNotifyTest,
	notifyStatus: callNotifyStatus,
	reset: callReset,
	commit: callCommit,
	initAction: callInit,

	PRESETS: PRESETS,
	resolvePreset: resolvePreset,
	hoursMask: hoursMask,
	formatBytes: formatBytes,
	formatRate: formatRate,
	formatTime: formatTime,
	deviceLabel: deviceLabel,
	chart: chart,
	sparkline: sparkline,
	bar: bar,
	csv: csv,
	download: download,
	GRADES: GRADES,
	signalGrade: signalGrade,
	gradeBadge: gradeBadge,
	bandOf: bandOf,
	formatKbit: formatKbit,
	formatDuration: formatDuration,
	signalChart: signalChart,
	formatKbps: formatKbps,
	deviceChoices: deviceChoices,
	destinationTable: destinationTable,
	dnsTable: dnsTable,

	/* nlbwmon zeroes conntrack counters: offer to stop it. */
	stopNlbwmon: function() {
		return callInit('nlbwmon', 'stop')
			.then(function() { return callInit('nlbwmon', 'disable'); })
			.then(function() { location.reload(); })
			.catch(function(e) { ui.addNotification(null, E('p', {}, [ e.message ]), 'error'); });
	},

	/* Warnings shared by the overview and traffic pages. */
	warnings: function(info, onStopNlbwmon) {
		var list = [];
		if (!info.conntrack_accounting)
			list.push(E('p', {}, _('Connection accounting (nf_conntrack_acct) is off: device traffic reads 0.')));
		if (info.offload_warning)
			list.push(E('p', {}, _('Hardware offloading is on: offloaded traffic may not be counted.')));
		if (!info.time_synced)
			list.push(E('p', {}, _('The router clock is not synchronised yet; data is kept in memory until it is.')));
		if (info.nlbwmon_running)
			list.push(E('p', {}, [
				_('nlbwmon is running and resets the connection counters this plugin reads.') + ' ',
				E('button', { 'class': 'btn cbi-button cbi-button-negative', click: onStopNlbwmon }, _('Stop and disable nlbwmon'))
			]));
		return list.length ? E('div', { 'class': 'alert-message warning' }, list) : E([]);
	}
});
