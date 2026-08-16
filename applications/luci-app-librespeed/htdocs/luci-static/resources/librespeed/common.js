'use strict';
'require baseclass';
'require ui';

/* Shared between the Test page's recent-history block and the full History
 * page, so the two can never draw the same data differently. */

/* Labels are translated here, where the extractor can see them; consumers
 * take them display-ready, the way RANGES and PHASES do. */
const METRICS = [
	[ 'download_mbps', _('Download'), 'Mbps' ],
	[ 'upload_mbps',   _('Upload'),   'Mbps' ],
	[ 'ping_ms',       _('Ping'),     'ms'   ],
	[ 'jitter_ms',     _('Jitter'),   'ms'   ]
];

/* Series that share a unit share an axis; mixing Mbps and ms on one scale
 * would flatten the milliseconds into the floor. */
const GROUPS = {
	speed:   [ 'download_mbps', 'upload_mbps' ],
	latency: [ 'ping_ms', 'jitter_ms' ]
};

/* Labels are translated here, where the extractor can see them: switcher()
 * takes them display-ready. The key is the seconds, never the label. */
const RANGES = [
	[ _('24h'), 86400    ],
	[ _('7d'),  604800   ],
	[ _('30d'), 2592000  ],
	[ _('1y'),  31536000 ],
	[ _('All'), 0        ]
];

function esc(s) {
	return String(s == null ? '' : s).replace(/"/g, '""');
}

function download(name, mime, text) {
	const blob = new Blob([ text ], { type: mime }),
	      url = window.URL.createObjectURL(blob),
	      link = E('a', { 'style': 'display:none', 'href': url, 'download': name });

	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	window.URL.revokeObjectURL(url);
}

function metricOf(key) {
	return METRICS.find(m => m[0] == key);
}

/* A metric keeps one color everywhere: the first of its group wears the
 * theme's primary color, the second the fixed companion shade. */
function colorIndexOf(key) {
	for (const g in GROUPS) {
		const i = GROUPS[g].indexOf(key);
		if (i >= 0)
			return i;
	}
	return 0;
}

/* Math.min.apply passes the whole series as arguments, and a year of
 * quarter-hourly samples is more of them than an engine has to accept in one
 * call -- the chart would throw instead of drawing. */
function extent(vals) {
	let min = vals[0], max = vals[0];

	for (let i = 1; i < vals.length; i++) {
		if (vals[i] < min) min = vals[i];
		if (vals[i] > max) max = vals[i];
	}

	return [ min, max ];
}

/* One scale shared by the renderer and the hover layer: both must agree on
 * where a sample sits, or the tooltip would point beside the line. Spans
 * every requested series, and the day's min/max spread when aggregated. */
function chartScale(entries, metrics, resolution) {
	const W = 600, H = 240, L = 46, R = 10, T = 14, B = 24;

	if (!entries || entries.length < 1)
		return null;

	const vals = [];

	entries.forEach(e => {
		metrics.forEach(k => {
			if (typeof e[k] == 'number')
				vals.push(e[k]);
			if (resolution == '1d') {
				if (typeof e[k + '_min'] == 'number')
					vals.push(e[k + '_min']);
				if (typeof e[k + '_max'] == 'number')
					vals.push(e[k + '_max']);
			}
		});
	});

	if (!vals.length)
		return null;

	let [ min, max ] = extent(vals);

	/* Vertical padding: 10% of the spread, but never less than 2% of the
	 * value itself -- a connection steady within tenths of a Mbps must not
	 * be zoomed into dramatic noise. A flat zero line still needs a
	 * nonzero span to be drawable. */
	const pad = Math.max((max - min) * 0.1, Math.abs(max) * 0.02) || 1;
	min -= pad; max += pad;

	return {
		W: W, H: H, L: L, R: R, T: T, B: B,
		min: min, max: max,
		xs: i => entries.length > 1
			? L + i * (W - L - R) / (entries.length - 1)
			: (L + W - R) / 2,
		ys: v => T + (H - T - B) * (1 - (v - min) / (max - min))
	};
}

/* Timestamps for humans: daily aggregates carry a plain date, everything else
 * becomes the locale's date and time; garbage shows as itself. */
function chartStampFull(e, resolution) {
	if (!e || !e.timestamp)
		return '?';
	if (resolution == '1d' || e.timestamp.indexOf('T') < 0)
		return e.timestamp;
	const d = new Date(e.timestamp);
	return isNaN(d.getTime()) ? e.timestamp : d.toLocaleString();
}

function chartStampShort(e, resolution) {
	if (!e || !e.timestamp)
		return '';
	if (resolution == '1d' || e.timestamp.indexOf('T') < 0)
		return e.timestamp;
	const d = new Date(e.timestamp);
	return isNaN(d.getTime()) ? e.timestamp : d.toLocaleDateString();
}

function fmtVal(v, unit) {
	return (typeof v == 'number')
		? (v.toFixed(unit == 'Mbps' ? 2 : 1) + ' ' + unit) : '–';
}

return baseclass.extend({
	METRICS: METRICS,
	GROUPS: GROUPS,
	RANGES: RANGES,

	/* Linked plainly, the way the other applications do: uhttpd serves
	 * static resources with ETag revalidation, so an upgraded stylesheet
	 * reaches the browser without a cache-busting version to maintain. */
	cssLink() {
		return E('link', {
			'rel': 'stylesheet',
			'href': L.resource('librespeed/librespeed.css')
		});
	},

	/* One token->label table for the schedule intervals: Settings builds
	 * its choices from it and the Test page looks the status label up, so
	 * the two cannot drift. The init script accepts more shapes than these
	 * six, so readers must fall back to the raw token. */
	INTERVALS: {
		'15m': _('Every 15 minutes'),
		'30m': _('Every 30 minutes'),
		'1h': _('Hourly'),
		'6h': _('Every 6 hours'),
		'12h': _('Every 12 hours'),
		'1d': _('Daily')
	},

	/* Exported alongside the chart: every timestamp a page prints should
	 * come through here, or the date-only guard gets lost in a copy. */
	chartStampFull: chartStampFull,

	/* Plain figures of one series: what is normal, how much it wobbles, and
	 * where it stands now. The story sentences are built from these. On
	 * daily aggregates the extremes come from the _min/_max columns the
	 * chart also draws -- min/max of the daily means would understate the
	 * spread and contradict the band directly above the sentence. */
	seriesStats(entries, metric, resolution) {
		const vals = (entries || []).map(e => e[metric]).filter(v => typeof v == 'number');

		if (!vals.length)
			return null;

		const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
		const lows = (resolution == '1d')
			? (entries || []).map(e => typeof e[metric + '_min'] == 'number'
				? e[metric + '_min'] : e[metric]).filter(v => typeof v == 'number')
			: vals;
		const highs = (resolution == '1d')
			? (entries || []).map(e => typeof e[metric + '_max'] == 'number'
				? e[metric + '_max'] : e[metric]).filter(v => typeof v == 'number')
			: vals;

		return {
			count: vals.length,
			avg: avg,
			min: extent(lows)[0],
			max: extent(highs)[1],
			current: vals[vals.length - 1]
		};
	},

	/* A row of toggle buttons; the active one is highlighted. The state is
	 * also spoken: colour alone says nothing to a screen reader, so each
	 * button carries aria-pressed and the group a name for what it picks. */
	switcher(view, items, current, onpick, label) {
		return E('div', { 'role': 'group', 'aria-label': label || null },
			items.map(it =>
				E('button', {
					'class': it[0] == current ? 'cbi-button cbi-button-action' : 'cbi-button',
					'style': 'margin-right:.3em',
					'aria-pressed': it[0] == current ? 'true' : 'false',
					'click': ui.createHandlerFn(view, function() {
						return onpick.call(view, it[0]);
					})
				/* Callers hand in display-ready labels: a runtime _() here
				 * would both miss the extractor and translate twice. */
				}, [ it[1] != null ? it[1] : it[0] ])));
	},

	/* The one chart component: hand-built SVG, the way the realtime status
	 * graphs do it, colored by the stylesheet so it wears the active theme.
	 *
	 * opts.series      keys drawn as lines (one unit family per chart)
	 * opts.resolution  'raw' or '1d'; aggregates draw their min-max band
	 * opts.hover       guide line + a full-measurement tooltip
	 * opts.legend      { all, onToggle }: checkbox legend that switches
	 *                  series on and off -- a control, not a caption
	 *
	 * The x axis is always time: a time series must never be reordered, or
	 * the story it tells dissolves. Sorting belongs to the table.
	 * Returns false when there is nothing to draw. */
	renderChart(container, entries, opts) {
		container.innerHTML = '';

		const series = (opts.series || []).filter(k => metricOf(k));
		const sc = chartScale(entries, series, opts.resolution);

		if (!sc) {
			if (opts.legend)
				this.renderLegend(container, entries, opts);
			return false;
		}

		const W = sc.W, H = sc.H, L = sc.L, R = sc.R, T = sc.T, B = sc.B;

		const grid = [ 0.25, 0.5, 0.75 ].map(f => {
			const y = T + (H - T - B) * f,
			      v = sc.max - (sc.max - sc.min) * f;
			return '<line x1="%d" y1="%f" x2="%d" y2="%f" stroke="currentColor" stroke-opacity="0.15"/>'
					.format(L, y, W - R, y) +
				'<text x="%d" y="%f" font-size="10" fill="currentColor" fill-opacity="0.6" text-anchor="end">%s</text>'
					.format(L - 4, y + 3, v.toFixed(1));
		}).join('');

		let body = '';

		series.forEach(k => {
			const ci = colorIndexOf(k);
			const valid = entries
				.map((e, i) => (typeof e[k] == 'number') ? [ sc.xs(i), sc.ys(e[k]), e[k] ] : null)
				.filter(p => p != null);

			if (!valid.length)
				return;

			const pts = valid.map(p => '%f,%f'.format(p[0], p[1])).join(' ');

			/* Aggregated entries carry the day's spread beside the mean,
			 * drawn as a band under the mean line. */
			if (opts.resolution == '1d') {
				const lo = entries.map((e, i) => (typeof e[k + '_min'] == 'number')
					? '%f,%f'.format(sc.xs(i), sc.ys(e[k + '_min'])) : null).filter(p => p != null);
				const hi = entries.map((e, i) => (typeof e[k + '_max'] == 'number')
					? '%f,%f'.format(sc.xs(i), sc.ys(e[k + '_max'])) : null).filter(p => p != null);

				if (lo.length)
					body += '<polygon class="librespeed-band librespeed-fill-%d" points="%s %s"/>'
						.format(ci, lo.join(' '), hi.reverse().join(' '));
			}

			/* The soft fill reads well under one line; under two it is mud. */
			if (series.length == 1 && valid.length > 1)
				body += '<polygon class="librespeed-area librespeed-fill-%d" points="%s %f,%f %f,%f"/>'
					.format(ci, pts, valid[valid.length - 1][0], H - B, valid[0][0], H - B);

			/* The dashed average is the series' "what is normal" reference. */
			const avg = valid.reduce((a, p) => a + p[2], 0) / valid.length;
			body += '<line class="librespeed-avgline librespeed-stroke-%d" x1="%d" y1="%f" x2="%d" y2="%f"/>'
				.format(ci, L, sc.ys(avg), W - R, sc.ys(avg));
			body += '<text x="%d" y="%f" font-size="9" fill="currentColor" fill-opacity=".55" text-anchor="end">%h %s</text>'
				.format(W - R, sc.ys(avg) - 4, _('avg'),
					avg.toFixed(avg >= 100 ? 0 : 1));

			body += (valid.length > 1)
				? '<polyline class="librespeed-line librespeed-stroke-%d" points="%s"/>'.format(ci, pts)
				: '<circle class="librespeed-dot librespeed-fill-%d" cx="%f" cy="%f" r="3"/>'
					.format(ci, valid[0][0], valid[0][1]);

			/* Dots make a sparse series readable; with hundreds of points
			 * they would just thicken the line, so they bow out. */
			if (valid.length > 1 && valid.length <= 60)
				body += valid.map(p =>
					'<circle class="librespeed-dot librespeed-fill-%d" cx="%f" cy="%f" r="2"/>'
						.format(ci, p[0], p[1])).join('');
		});

		/* A date-only timestamp names a local calendar day; new Date() would
		 * read it as UTC midnight and shift it in negative offsets. */
		const first = entries[0],
		      last = entries[entries.length - 1],
		      mid = entries[Math.floor((entries.length - 1) / 2)];
		const s1 = chartStampShort(first, opts.resolution),
		      s2 = chartStampShort(mid, opts.resolution),
		      s3 = chartStampShort(last, opts.resolution);
		const midLabel = (entries.length > 2 && s2 != s1 && s2 != s3)
			? '<text x="%f" y="%d" font-size="10" fill="currentColor" fill-opacity="0.6" text-anchor="middle">%h</text>'
				.format((L + W - R) / 2, H - 6, s2)
			: '';

		const unit = metricOf(series[0]) ? metricOf(series[0])[2] : '';

		const chart = E('div', {});
		chart.innerHTML =
			'<svg viewBox="0 0 %d %d" style="width:100%%; max-height:280px" xmlns="http://www.w3.org/2000/svg">'
				.format(W, H) +
			grid + body +
			'<text x="%d" y="%d" font-size="10" fill="currentColor" fill-opacity="0.6">%h</text>'
				.format(L, H - 6, s1) +
			midLabel +
			'<text x="%d" y="%d" font-size="10" fill="currentColor" fill-opacity="0.6" text-anchor="end">%h (%s)</text>'
				.format(W - R, H - 6, s3, unit) +
			'</svg>';
		container.appendChild(chart);

		if (opts.hover !== false)
			this.attachChartHover(chart, entries, series, opts.resolution, sc);

		if (opts.legend)
			this.renderLegend(container, entries, opts);

		return true;
	},

	/* The legend doubles as the series switch: each entry is a checkbox with
	 * the series' color and its average over the visible range. */
	renderLegend(container, entries, opts) {
		const leg = E('div', { 'class': 'librespeed-legend' });

		opts.legend.all.forEach(k => {
			const m = metricOf(k);
			const st = this.seriesStats(entries, k, opts.resolution);
			const cb = E('input', { 'type': 'checkbox' });

			cb.checked = opts.series.indexOf(k) >= 0;
			cb.addEventListener('change', () => opts.legend.onToggle(k, cb.checked));

			leg.appendChild(E('label', { 'class': 'librespeed-legend-item' }, [
				cb,
				E('span', { 'class': 'librespeed-swatch librespeed-bg-%d'.format(colorIndexOf(k)) }),
				E('span', {}, [ m[1] ]),
				st ? E('span', { 'class': 'librespeed-muted' },
					[ ' ' + fmtVal(st.avg, m[2]) + ' ' + _('avg') ]) : ''
			]));
		});

		container.appendChild(leg);
	},

	/* Hover layer: a guide line, a highlighted sample per series, and an HTML
	 * tooltip carrying the whole measurement -- every metric, the server and
	 * how the test travelled -- because whoever inspects one point wants to
	 * know about that test, not one number of it. Daily aggregates show the
	 * day's spread of the drawn series instead. */
	attachChartHover(container, entries, series, resolution, sc) {
		const svg = container.querySelector('svg');

		if (!svg || !sc)
			return;

		container.classList.add('librespeed-chart-holder');

		const NS = 'http://www.w3.org/2000/svg';
		const guide = document.createElementNS(NS, 'line');
		guide.setAttribute('class', 'librespeed-guide');
		guide.setAttribute('y1', sc.T);
		guide.setAttribute('y2', sc.H - sc.B);
		guide.style.display = 'none';

		const dots = series.map(k => {
			const d = document.createElementNS(NS, 'circle');
			d.setAttribute('class', 'librespeed-dot librespeed-fill-%d'.format(colorIndexOf(k)));
			d.setAttribute('r', '3.5');
			d.style.display = 'none';
			return d;
		});

		const hit = document.createElementNS(NS, 'rect');
		hit.setAttribute('x', sc.L);
		hit.setAttribute('y', sc.T);
		hit.setAttribute('width', sc.W - sc.L - sc.R);
		hit.setAttribute('height', sc.H - sc.T - sc.B);
		hit.setAttribute('fill', 'transparent');

		svg.appendChild(guide);
		dots.forEach(d => svg.appendChild(d));
		svg.appendChild(hit);

		const tip = E('div', { 'class': 'librespeed-tooltip' });
		container.appendChild(tip);

		const row = (lab, txt) => E('div', { 'class': 'librespeed-tooltip-row' }, [
			E('span', { 'class': 'librespeed-muted' }, [ lab ]),
			E('span', {}, [ txt ])
		]);

		const hide = () => {
			guide.style.display = 'none';
			dots.forEach(d => (d.style.display = 'none'));
			tip.style.display = 'none';
		};

		hit.addEventListener('mousemove', ev => {
			const rect = svg.getBoundingClientRect();
			const x = (ev.clientX - rect.left) * sc.W / rect.width;
			const step = entries.length > 1
				? (sc.W - sc.L - sc.R) / (entries.length - 1) : 1;
			const i = Math.max(0, Math.min(entries.length - 1,
				Math.round((x - sc.L) / step)));
			const e = entries[i];

			const px = sc.xs(i);
			let anchorY = null;

			guide.setAttribute('x1', px);
			guide.setAttribute('x2', px);
			guide.style.display = '';

			series.forEach((k, si) => {
				if (typeof e[k] == 'number') {
					const py = sc.ys(e[k]);
					dots[si].setAttribute('cx', px);
					dots[si].setAttribute('cy', py);
					dots[si].style.display = '';
					anchorY = (anchorY == null) ? py : Math.min(anchorY, py);
				}
				else
					dots[si].style.display = 'none';
			});

			if (anchorY == null)
				return hide();

			tip.innerHTML = '';
			tip.appendChild(E('div', { 'style': 'font-weight:600; margin-bottom:.2em' },
				[ chartStampFull(e, resolution) ]));

			if (resolution == '1d') {
				series.forEach(k => {
					const m = metricOf(k);
					if (typeof e[k] != 'number')
						return;
					let txt = fmtVal(e[k], m[2]);
					if (typeof e[k + '_min'] == 'number' &&
					    typeof e[k + '_max'] == 'number')
						txt += ' (%s – %s)'.format(
							e[k + '_min'].toFixed(m[2] == 'Mbps' ? 0 : 1),
							e[k + '_max'].toFixed(m[2] == 'Mbps' ? 0 : 1));
					tip.appendChild(row(m[1], txt));
				});
			}
			else {
				METRICS.forEach(m => {
					if (typeof e[m[0]] == 'number')
						tip.appendChild(row(m[1], fmtVal(e[m[0]], m[2])));
				});

				if (e.server && e.server.name)
					tip.appendChild(E('div', { 'style': 'margin-top:.2em' },
						[ e.server.name ]));

				const meta = [];
				if (e.interface)
					meta.push(e.interface);
				if (e.family)
					meta.push(e.family == 'ipv6' ? 'IPv6' : 'IPv4');
				if (e.proto)
					meta.push(e.proto.toUpperCase());
				if (meta.length)
					tip.appendChild(E('div', { 'class': 'librespeed-muted' },
						[ meta.join(' · ') ]));
			}

			tip.style.display = 'block';

			const cr = container.getBoundingClientRect();
			const pxs = rect.left - cr.left + px * rect.width / sc.W;
			const pys = rect.top - cr.top + anchorY * rect.height / sc.H;
			let left = pxs - tip.offsetWidth / 2;
			left = Math.max(0, Math.min(cr.width - tip.offsetWidth, left));
			tip.style.left = left + 'px';
			tip.style.top = Math.max(0, pys - tip.offsetHeight - 14) + 'px';
		});
		hit.addEventListener('mouseleave', hide);
	},

	/* Daily aggregates carry each metric's spread beside the mean; the CSV
	 * must not lose it, so aggregated exports gain the _min/_max columns. */
	exportCSV(entries, resolution) {
		const agg = (resolution == '1d');
		const keys = METRICS.map(m => m[0]);
		const n = v => (typeof v == 'number') ? v : '';

		let head = 'timestamp,resolution,interface,family,proto,server,' + keys.join(',');

		if (agg)
			head += ',' + keys.map(k => k + '_min,' + k + '_max').join(',');

		const lines = [ head ];

		(entries || []).forEach(e => {
			/* Every text field is quoted, so esc()'s quote-doubling is correct
			 * everywhere and embedded commas cannot shift columns. */
			let row = '"%s","%s","%s","%s","%s","%s",'.format(
				esc(e.timestamp), agg ? '1d' : 'raw', esc(e.interface),
				esc(e.family), esc(e.proto), esc(e.server && e.server.name)) +
				keys.map(k => n(e[k])).join(',');

			if (agg)
				row += ',' + keys.map(k => n(e[k + '_min']) + ',' + n(e[k + '_max'])).join(',');

			lines.push(row);
		});

		download('librespeed-history.csv', 'text/csv', lines.join('\n') + '\n');
	},

	exportJSON(entries, resolution) {
		download('librespeed-history.json', 'application/json',
			JSON.stringify({ resolution: resolution || 'raw', entries: entries || [] }, null, '\t') + '\n');
	}
});
