'use strict';
'require view';
'require poll';
'require ui';
'require routelink.common as rl';

/* Latency to the probe targets, the outage log and the router-side speed test (P3). */

var RANGES = [
	[ 3600, _('1 hour') ],
	[ 6 * 3600, _('6 hours') ],
	[ 86400, _('24 hours') ],
	[ 7 * 86400, _('7 days') ],
	[ 30 * 86400, _('30 days') ],
	[ 90 * 86400, _('90 days') ]
];
var POINTS = 240;
var COLORS = [ '#2f7ef6', '#f39c12', '#2e9e44', '#8e44ad', '#16a085', '#c0392b', '#7f8c8d', '#d35400', '#2c3e50' ];
var SVGNS = 'http://www.w3.org/2000/svg';

function svg(tag, attrs) {
	var el = document.createElementNS(SVGNS, tag);
	for (var k in attrs)
		el.setAttribute(k, attrs[k]);
	return el;
}

function ms(v) {
	return v == null ? '-' : (v < 10 ? v.toFixed(1) : Math.round(v)) + ' ms';
}

function pct(v) {
	return v == null ? '-' : (v < 10 && v > 0 ? v.toFixed(1) : Math.round(v)) + '%';
}

/* Speed-test rates come in bit/s. */
function bps(v) {
	if (v == null)
		return '-';
	var units = [ 'bit/s', 'kbit/s', 'Mbit/s', 'Gbit/s' ], i = 0;
	while (v >= 1000 && i < units.length - 1) {
		v /= 1000;
		i++;
	}
	return v.toFixed(i ? 1 : 0) + ' ' + units[i];
}

var CAUSES = {
	wan_down: _('WAN disconnected'),
	redial: _('Reconnect (redial)'),
	upstream: _('Upstream (provider or beyond)')
};

var PHASES = {
	latency: _('Measuring latency'),
	download: _('Download'),
	upload: _('Upload')
};

function targetLabel(t) {
	return t.kind === 'gateway' ? _('WAN next hop') + (t.ip ? ' (' + t.ip + ')' : '') : t.ip;
}

/*
 * Latency lines of the shown targets (average; the worst round trip too when one target is shown) over a
 * strip of loss bars, outages shaded. series: [ { color, points: [ [ts, avg, max, loss] ] } ].
 */
function latencyChart(series, outages, start, end) {
	var width = 800, h = 170, lossH = 36, gap = 6, pad = 26, top = h + gap + lossH;
	var root = svg('svg', { viewBox: '0 0 ' + width + ' ' + (top + pad), width: '100%', preserveAspectRatio: 'none',
		style: 'max-height:' + (top + pad) + 'px' });
	var pts = series.length ? series[0].points : [];
	var n = Math.max(pts.length, 2);
	var t0 = pts.length ? pts[0][0] : start, t1 = pts.length > 1 ? pts[pts.length - 1][0] : end;
	var x = function(i) { return i * width / (n - 1); };
	var xt = function(ts) { return Math.max(0, Math.min(width, (ts - t0) / Math.max(t1 - t0, 1) * width)); };

	/* scale: the averages decide, a spike of the worst round trip is cut at the top */
	var scale = 5;
	series.forEach(function(s) {
		s.points.forEach(function(p) { if (p[1] != null) scale = Math.max(scale, p[1] * 1.5); });
	});
	var y = function(v) { return h - Math.min(v, scale) / scale * (h - 6); };

	outages.forEach(function(o) {
		var a = xt(o.start), b = xt(o.end);
		root.appendChild(svg('rect', { x: a, y: 0, width: Math.max(b - a, 2), height: top, fill: '#d9534f', 'fill-opacity': '0.12' }));
	});
	pts.forEach(function(p, i) {
		var none = series.every(function(s) { return s.points[i] && s.points[i][3] == null; });
		if (none)
			root.appendChild(svg('rect', { x: x(i) - width / n / 2, y: 0, width: width / n, height: h, fill: '#888', 'fill-opacity': '0.10' }));
	});

	root.appendChild(svg('line', { x1: 0, x2: width, y1: y(scale / 2), y2: y(scale / 2),
		stroke: '#888', 'stroke-opacity': '0.25', 'stroke-dasharray': '4 4' }));
	var half = svg('text', { x: 4, y: y(scale / 2) - 2, 'font-size': '10', fill: '#888' });
	half.textContent = ms(scale / 2);
	root.appendChild(half);
	series.forEach(function(s) {
		var lines = series.length === 1 ? [ [ 2, '1', '0.35' ], [ 1, '2', '1' ] ] : [ [ 1, '1.5', '1' ] ];
		lines.forEach(function(l) {
			var d = '', open = false;
			s.points.forEach(function(p, i) {
				if (p[l[0]] == null) {
					open = false;
					return;
				}
				d += (open ? 'L' : 'M') + x(i) + ',' + y(p[l[0]]);
				open = true;
			});
			root.appendChild(svg('path', { d: d, fill: 'none', stroke: s.color, 'stroke-width': l[1], 'stroke-opacity': l[2] }));
		});
	});

	/* loss: the worst of the shown targets per point */
	root.appendChild(svg('line', { x1: 0, x2: width, y1: top, y2: top, stroke: '#888', 'stroke-opacity': '0.4' }));
	pts.forEach(function(p, i) {
		var loss = 0;
		series.forEach(function(s) { if (s.points[i] && s.points[i][3] > loss) loss = s.points[i][3]; });
		if (loss > 0)
			root.appendChild(svg('rect', { x: x(i) - width / n / 2, y: top - lossH * loss / 100, width: Math.max(width / n, 1.5),
				height: lossH * loss / 100, fill: '#d9534f' }));
	});

	var label = svg('text', { x: 4, y: 12, 'font-size': '11', fill: '#888' });
	label.textContent = ms(scale);
	root.appendChild(label);
	var lossLabel = svg('text', { x: 4, y: h + gap + 11, 'font-size': '11', fill: '#888' });
	lossLabel.textContent = _('Loss');
	root.appendChild(lossLabel);
	[ 0, Math.floor((pts.length - 1) / 2), pts.length - 1 ].forEach(function(i, k) {
		if (!pts[i])
			return;
		var t = svg('text', { x: x(i), y: top + 18, 'font-size': '11', fill: '#888',
			'text-anchor': k === 0 ? 'start' : k === 1 ? 'middle' : 'end' });
		t.textContent = rl.formatTime(pts[i][0], t1 - t0 > 86400);
		root.appendChild(t);
	});
	return root;
}

return view.extend({
	load: function() {
		return Promise.all([ rl.info(), L.resolveDefault(rl.speedtestStatus(), null) ]);
	},

	render: function(data) {
		var info = data[0], self = this;
		this.info = info;
		this.state = { range: 86400, selected: null, run: null };

		var modules = info.modules || [];
		if (modules.indexOf('latency') < 0 && modules.indexOf('speedtest') < 0)
			return E([], [
				E('h2', {}, _('Latency and outages')),
				E('div', { 'class': 'alert-message notice' }, info.roles.indexOf('gateway') < 0
					? _('This router is not a gateway, so there is no WAN to probe.')
					: [ _('Latency probes are switched off.') + ' ',
						E('a', { href: L.url('admin/services/routelink/settings') }, _('Settings')) ])
			]);

		this.rangeBar = E('div', { style: 'display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px' }, RANGES.map(function(r) {
			return E('button', { 'class': 'btn cbi-button', 'data-range': r[0], click: function() {
				self.state.range = r[0];
				self.markRange();
				self.refresh();
			} }, r[1]);
		}));
		this.markRange();
		this.figures = E('div', { style: 'display:flex;gap:32px;flex-wrap:wrap;margin:8px 0' });
		this.chartBox = E('div');
		this.legend = E('div', { 'class': 'cbi-section-descr' });
		this.targetBox = E('div');
		this.outageBox = E('div');
		this.speedBox = E('div');
		this.speedHistory = E('div');

		var sections = [ E('h2', {}, _('Latency and outages')) ];
		if (modules.indexOf('latency') >= 0) {
			sections.push(E('div', { 'class': 'cbi-section' }, [
				this.rangeBar,
				this.figures,
				this.chartBox,
				this.legend,
				E('p', { 'class': 'cbi-section-descr' },
					_('Every 10 seconds the router pings each target; no answer within 2 seconds counts as lost. An outage is when none of the targets except the WAN next hop answers three rounds in a row. Red bars: loss, red shading: outages, grey: no data.'))
			]));
			sections.push(E('div', { 'class': 'cbi-section' }, [ E('h3', {}, _('Targets')), this.targetBox ]));
			sections.push(E('div', { 'class': 'cbi-section' }, [ E('h3', {}, _('Outages')), this.outageBox ]));
			poll.add(function() { return self.refresh(); }, 30);
		} else {
			sections.push(E('div', { 'class': 'alert-message notice' }, [ _('Latency probes are switched off.') + ' ',
				E('a', { href: L.url('admin/services/routelink/settings') }, _('Settings')) ]));
		}
		if (modules.indexOf('speedtest') >= 0) {
			sections.push(E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, _('Speed test')),
				E('p', { 'class': 'cbi-section-descr' },
					_('Measured on the router: the latency of TCP handshakes with the server, then parallel downloads and uploads of 10 seconds each. The rates come from the WAN counters, so traffic of other devices at the same time counts too.')),
				this.speedBox,
				this.speedHistory
			]));
			this.renderSpeed(data[1]);
		}
		this.refresh();
		return E([], sections);
	},

	markRange: function() {
		var range = this.state.range;
		this.rangeBar.querySelectorAll('button').forEach(function(b) {
			b.classList.toggle('cbi-button-action', +b.getAttribute('data-range') === range);
		});
	},

	refresh: function() {
		var self = this, range = this.state.range, end = Math.floor(Date.now() / 1000), start = end - range;
		if (!this.chartBox)
			return Promise.resolve();
		return Promise.all([
			rl.latency(start, end + 60, undefined, POINTS),
			rl.outages(start, end + 60)
		]).then(function(r) {
			if (self.state.range !== range)
				return;
			self.renderLatency(r[0], r[1], start, end);
		}).catch(function(e) {
			self.chartBox.replaceChildren(E('p', {}, [ e.message ]));
		});
	},

	renderLatency: function(lat, out, start, end) {
		var self = this;
		var color = {};
		lat.targets.forEach(function(t, i) { color[t.id] = COLORS[i % COLORS.length]; });
		if (this.state.selected != null && !lat.targets.some(function(t) { return t.id === self.state.selected; }))
			this.state.selected = null;
		var shown = lat.series.filter(function(s) { return self.state.selected == null || s.target === self.state.selected; });

		this.figures.replaceChildren(
			E('div', {}, [ E('div', { style: 'font-size:200%' }, out.availability != null ? out.availability.toFixed(2) + '%' : '-'),
				E('small', {}, _('Availability')) ]),
			E('div', {}, [ E('div', { style: 'font-size:200%' }, String(out.count)), E('small', {}, _('Outages')) ]),
			E('div', {}, [ E('div', { style: 'font-size:200%' }, out.total_sec ? rl.formatDuration(out.total_sec) : '0'),
				E('small', {}, _('Time without internet')) ])
		);

		this.chartBox.replaceChildren(lat.targets.length
			? latencyChart(shown.map(function(s) { return { color: color[s.target], points: s.points }; }), out.outages, start, end)
			: E('p', {}, _('No latency data in this range yet.')));
		this.legend.replaceChildren(E([], lat.targets.filter(function(t) {
			return self.state.selected == null || t.id === self.state.selected;
		}).map(function(t) {
			return E('span', { style: 'margin-right:16px;white-space:nowrap' }, [
				E('span', { style: 'display:inline-block;width:12px;height:3px;vertical-align:middle;margin-right:6px;background:' + color[t.id] }),
				targetLabel(t)
			]);
		}).concat([ _('One point per %s.').format(rl.formatDuration(lat.step)) ])));

		var sum = {};
		lat.summary.forEach(function(s) { sum[s.target] = s; });
		var rows = lat.targets.map(function(t) {
			var s = sum[t.id] || {};
			var loss = s.sent ? s.lost / s.sent * 100 : null;
			return E('tr', { 'class': 'tr', style: 'cursor:pointer' + (self.state.selected === t.id ? ';font-weight:bold' : ''),
				click: function() {
					self.state.selected = self.state.selected === t.id ? null : t.id;
					self.renderLatency(lat, out, start, end);
				} }, [
				E('td', { 'class': 'td' }, [ E('span', { style: 'display:inline-block;width:10px;height:10px;border-radius:5px;margin-right:6px;background:' + color[t.id] }),
					targetLabel(t) ]),
				E('td', { 'class': 'td' }, ms(s.avg_ms)),
				E('td', { 'class': 'td' }, ms(s.max_ms)),
				E('td', { 'class': 'td', style: loss >= 1 ? 'color:#d9534f' : '' }, pct(loss)),
				E('td', { 'class': 'td' }, s.sent != null ? String(s.sent) : '-')
			]);
		});
		this.targetBox.replaceChildren(E([], [
			E('table', { 'class': 'table' }, [
				E('tr', { 'class': 'tr table-titles' }, [
					E('th', { 'class': 'th' }, _('Target')),
					E('th', { 'class': 'th' }, _('Average')),
					E('th', { 'class': 'th' }, _('Worst')),
					E('th', { 'class': 'th' }, _('Loss')),
					E('th', { 'class': 'th' }, _('Probes'))
				])
			].concat(rows.length ? rows : [ E('tr', { 'class': 'tr placeholder' }, E('td', { 'class': 'td' }, _('No targets yet.'))) ])),
			E('p', { 'class': 'cbi-section-descr' }, [ _('Click a target to show only its curve (with its worst round trip).') + ' ',
				E('a', { href: L.url('admin/services/routelink/settings') }, _('Change the targets')) ])
		]));

		this.outageBox.replaceChildren(E('table', { 'class': 'table' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th' }, _('Start')),
				E('th', { 'class': 'th' }, _('End')),
				E('th', { 'class': 'th' }, _('Duration')),
				E('th', { 'class': 'th' }, _('Cause'))
			])
		].concat(out.outages.length ? out.outages.map(function(o) {
			return E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td' }, rl.formatTime(o.start)),
				E('td', { 'class': 'td' }, o.ongoing ? E('strong', { style: 'color:#d9534f' }, _('Ongoing')) : rl.formatTime(o.end)),
				E('td', { 'class': 'td' }, rl.formatDuration(o.duration)),
				E('td', { 'class': 'td' }, [ CAUSES[o.cause] || o.cause ])
			]);
		}) : [ E('tr', { 'class': 'tr placeholder' }, E('td', { 'class': 'td' }, _('No outages in this range.'))) ])));
	},

	/* ---- speed test ---- */

	renderSpeed: function(st) {
		var self = this;
		if (!st)
			return;
		var running = this.state.run;
		var button = E('button', { 'class': 'btn cbi-button cbi-button-action', disabled: running ? '' : null,
			click: ui.createHandlerFn(this, 'startSpeedtest') }, _('Start speed test'));
		var progress = running ? E('div', { style: 'flex:1;min-width:200px' }, [
			E('div', {}, [ '%s · %d%%'.format(PHASES[running.phase] || running.phase, Math.round(running.progress * 100)) ]),
			rl.bar(running.progress * 100, 100)
		]) : E([]);
		this.speedBox.replaceChildren(E('div', { style: 'display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin-bottom:8px' }, [
			button, progress,
			E('a', { href: L.url('admin/services/routelink/settings') }, _('Choose the server'))
		]));

		var rows = (st.results || []).map(function(r) {
			return E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td' }, rl.formatTime(r.ts)),
				E('td', { 'class': 'td' }, [ r.server || 'Cloudflare' ]),
				E('td', { 'class': 'td' }, ms(r.latency_ms)),
				E('td', { 'class': 'td' }, ms(r.jitter_ms)),
				E('td', { 'class': 'td' }, bps(r.down_bps)),
				E('td', { 'class': 'td' }, bps(r.up_bps)),
				E('td', { 'class': 'td' }, r.error ? E('span', { style: 'color:#d9534f' }, [ r.error ]) : '')
			]);
		});
		this.speedHistory.replaceChildren(E('table', { 'class': 'table' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th' }, _('Time')),
				E('th', { 'class': 'th' }, _('Server')),
				E('th', { 'class': 'th' }, _('Latency')),
				E('th', { 'class': 'th' }, _('Jitter')),
				E('th', { 'class': 'th' }, _('Download')),
				E('th', { 'class': 'th' }, _('Upload')),
				E('th', { 'class': 'th' }, '')
			])
		].concat(rows.length ? rows : [ E('tr', { 'class': 'tr placeholder' }, E('td', { 'class': 'td' }, _('No speed tests yet.'))) ])));

		/* a test started elsewhere (the app) is followed too */
		if (st.running && st.current != null && !running)
			this.follow(st.current);
	},

	startSpeedtest: function() {
		var self = this;
		return rl.speedtestStart().then(function(r) {
			self.follow(r.id);
		}).catch(function(e) {
			ui.addNotification(null, E('p', {}, [ _('The speed test could not start: %s').format(e.message) ]), 'error');
		});
	},

	follow: function(id) {
		var self = this;
		this.state.run = { id: id, phase: 'latency', progress: 0 };
		var step = function() {
			return rl.speedtestStatus(id).then(function(r) {
				if (r.running) {
					self.state.run = r;
					return L.resolveDefault(rl.speedtestStatus(), null).then(function(st) {
						self.renderSpeed(st);
						window.setTimeout(step, 1000);
					});
				}
				self.state.run = null;
				if (r.error)
					ui.addNotification(null, E('p', {}, [ _('The speed test failed: %s').format(r.error) ]), 'warning');
				return L.resolveDefault(rl.speedtestStatus(), null).then(function(st) { self.renderSpeed(st); });
			}).catch(function() {
				self.state.run = null;
			});
		};
		return L.resolveDefault(rl.speedtestStatus(), null).then(function(st) {
			self.renderSpeed(st);
			window.setTimeout(step, 1000);
		});
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
