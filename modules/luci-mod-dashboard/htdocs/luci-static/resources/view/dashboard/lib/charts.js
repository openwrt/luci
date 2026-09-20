'use strict';
'require baseclass';

const SVG_NS = 'http://www.w3.org/2000/svg';

function svg(tag, attrs, children) {
	const node = document.createElementNS(SVG_NS, tag);

	for (const key in (attrs || {}))
		node.setAttribute(key, attrs[key]);

	(children || []).forEach(child => {
		if (child != null)
			node.appendChild(typeof(child) == 'string' ? document.createTextNode(child) : child);
	});

	return node;
}

function scale(value, min, max) {
	return Math.max(0, Math.min(100, (value - min) / (max - min) * 100));
}

// Data rates take decimal prefixes, as link speeds and ISP plans do.
const RATE_UNITS = [ _('bit/s'), _('Kbit/s'), _('Mbit/s'), _('Gbit/s') ];

function rateUnit(value) {
	let exp = 0;

	while (value >= 1000 && exp < RATE_UNITS.length - 1) {
		value /= 1000;
		exp++;
	}

	return exp;
}

return baseclass.extend({
	formatRate(value) {
		if (value == null)
			return '-';

		const exp = rateUnit(value);

		return '%.1f %s'.format(value / Math.pow(1000, exp), RATE_UNITS[exp]);
	},

	rateScale(peak) {
		const exp = rateUnit(peak);
		const unit = Math.pow(1000, exp);
		const raw = Math.max(peak / unit, 1e-9) / 4;
		const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
		const step = [ 1, 2, 2.5, 5, 10 ].map(n => n * magnitude).find(candidate => candidate >= raw);

		return {
			max: step * 4 * unit,
			unit: RATE_UNITS[exp],
			ticks: [ 0, 1, 2, 3, 4 ].map(n => ({ value: step * n * unit, label: String(+(step * n).toFixed(2)) }))
		};
	},

	icon(name, className) {
		return E('span', {
			'class': 'dashboard-icon ' + (className || ''),
			'style': '--dashboard-icon: url(%s)'.format(L.resource('view/dashboard/icons/' + name + '.svg'))
		});
	},

	badge(text, kind) {
		return E('span', { 'class': 'label ' + (kind || '') }, [ text ]);
	},

	// A card is a plain .cbi-section, so the theme draws it.
	card(opts) {
		return E('div', { 'class': 'cbi-section ' + (opts.className || '') }, [
			opts.title ? E('h3', {}, [ opts.title ]) : '',
			opts.desc ? E('div', { 'class': 'cbi-section-descr' }, [ opts.desc ]) : ''
		].concat(opts.body));
	},

	kpi(opts) {
		const parts = (opts.sub || []).filter(part => part != null && part !== '');
		const sub = opts.stacked
			? parts.map(part => E('small', { 'class': 'dashboard-kpi-sub dashboard-kpi-line', 'title': part }, [ part ]))
			: [ E('small', { 'class': 'dashboard-kpi-sub' }, parts.flatMap((part, i) => i ? [ ' · ', part ] : [ part ])) ];

		return E('div', { 'class': 'cbi-section dashboard-kpi ' + (opts.className || '') }, [
			this.icon(opts.icon, 'dashboard-kpi-icon'),
			E('div', { 'class': 'dashboard-kpi-text' }, [
				E('small', {}, [ opts.title ]),
				E('strong', { 'class': 'dashboard-kpi-value' }, opts.value)
			].concat(sub))
		]);
	},

	empty(text) {
		return E('em', {}, [ text ]);
	},

	// Same markup as ui.Table: flat .table > .tr, header row .table-titles,
	// data-title on the cells so themes can label them on phones.
	table(opts) {
		const cell = (tag, content, title) => E(tag, { 'class': tag, 'data-title': title || null }, [ content ?? '' ]);
		const table = E('table', { 'class': 'table ' + (opts.className || '') }, [
			E('tr', { 'class': 'tr table-titles' }, opts.head.map(title => cell('th', title)))
		]);

		opts.rows.forEach((row, i) => {
			table.appendChild(E('tr', { 'class': 'tr ' + (i % 2 ? 'cbi-rowstyle-2' : 'cbi-rowstyle-1') }, row.map((content, n) => cell('td', content, opts.head[n]))));
		});

		if (!opts.rows.length && opts.emptyText)
			table.appendChild(E('tr', { 'class': 'tr placeholder' }, [
				E('td', { 'class': 'td', 'colspan': opts.head.length }, [ E('em', {}, [ opts.emptyText ]) ])
			]));

		if (opts.foot) {
			const foot = E('tr', { 'class': 'tr' }, opts.foot.map(content => cell('td', content)));

			foot.lastChild.setAttribute('colspan', opts.head.length - opts.foot.length + 1);
			table.appendChild(foot);
		}

		return table;
	},

	donut(opts) {
		const radius = 40;
		const circumference = 2 * Math.PI * radius;
		const total = opts.series.reduce((sum, item) => sum + item.value, 0);
		const gap = (opts.series.filter(item => item.value > 0).length > 1) ? 3 : 0;
		const circles = [ svg('circle', { 'class': 'dashboard-donut-track', 'cx': 50, 'cy': 50, 'r': radius }) ];
		let offset = 0;

		opts.series.forEach((item, i) => {
			const length = total ? item.value / total * circumference : 0;

			if (length > 0)
				circles.push(svg('circle', {
					'class': 'dashboard-donut-seg dashboard-series-' + (i + 1),
					'cx': 50, 'cy': 50, 'r': radius,
					'stroke-dasharray': '%.2f %.2f'.format(Math.max(0, length - gap), circumference - Math.max(0, length - gap)),
					'stroke-dashoffset': '%.2f'.format(-offset),
					'transform': 'rotate(-90 50 50)'
				}));

			offset += length;
		});

		circles.push(svg('text', { 'class': 'dashboard-donut-value', 'x': 50, 'y': 53 }, [ String(total) ]));
		circles.push(svg('text', { 'class': 'dashboard-donut-label', 'x': 50, 'y': 64 }, [ opts.centerLabel || '' ]));

		return E('div', { 'class': 'dashboard-donut' }, [
			svg('svg', { 'viewBox': '0 0 100 100', 'role': 'img', 'aria-label': opts.ariaLabel || '' }, circles),
			E('ul', { 'class': 'dashboard-legend' }, opts.series.map((item, i) => E('li', {}, [
				E('i', { 'class': 'dashboard-series-' + (i + 1) }),
				E('span', { 'class': 'dashboard-legend-name' }, item.label),
				E('b', {}, [ String(item.value) ]),
				E('small', {}, [ total ? '%d%%'.format(Math.round(item.value / total * 100)) : '0%' ])
			])))
		]);
	},

	barChart(opts) {
		const min = opts.min || 0;
		const max = (opts.max != null) ? opts.max : 1;
		const many = opts.items.length > 10;
		const yAxis = E('div', { 'class': 'dashboard-bars-axis' }, opts.ticks.map(tick =>
			E('span', { 'style': 'top:%.2f%%'.format(100 - scale(tick.value, min, max)) }, [ tick.label ])));
		const grid = E('div', { 'class': 'dashboard-bars-grid' }, opts.ticks.map(tick =>
			E('i', { 'style': 'top:%.2f%%'.format(100 - scale(tick.value, min, max)) })));
		const plot = E('div', { 'class': 'dashboard-bars-plot' }, [ grid ]);

		opts.items.forEach(item => {
			plot.appendChild(E('div', { 'class': 'dashboard-bars-col', 'title': item.title || item.label }, [
				E('div', { 'class': 'dashboard-bars-stack' }, item.values.map(v =>
					E('i', { 'class': v.className || '', 'style': 'height:%.2f%%'.format((v.value != null) ? scale(v.value, min, max) : 0) }))),
				E('div', { 'class': 'dashboard-bars-label' }, [ item.label ])
			]));
		});

		return E('div', { 'class': 'dashboard-bars ' + (many ? 'dashboard-bars-many' : '') }, [
			yAxis,
			E('div', { 'class': 'dashboard-bars-scroll', 'data-chart': opts.id || '' }, [ plot ])
		]);
	},

	// A time series of points `{ t, v }`, placed by their time: the x axis
	// spans `span` seconds up to the last point. A null `v` leaves a gap, and
	// a point with gaps on both sides is drawn as a dot.
	lines(opts) {
		const max = opts.max || 1;
		const shapes = [];
		const end = opts.series.reduce((t, series) => Math.max(t, ...series.values.map(p => p.t)), 0);

		opts.series.forEach((series, n) => {
			let run = [];

			series.values.concat([ { v: null } ]).forEach(p => {
				if (p.v != null) {
					run.push([ 100 - (end - p.t) / (opts.span * 10), 100 - scale(p.v, 0, max) ]);
					return;
				}

				if (run.length) {
					if (run.length == 1)
						run.push(run[0]);

					const points = run.map(p => '%.2f,%.2f'.format(p[0], p[1])).join(' ');

					if (series.area)
						shapes.push(svg('polygon', {
							'class': 'dashboard-series-' + (n + 1),
							'points': '%.2f,100 %s %.2f,100'.format(run[0][0], points, run[run.length - 1][0])
						}));

					shapes.push(svg('polyline', { 'class': 'dashboard-series-' + (n + 1), 'points': points }));
				}

				run = [];
			});
		});

		return E('div', { 'class': 'dashboard-bars' }, [
			E('div', { 'class': 'dashboard-bars-axis' }, opts.ticks.map(tick =>
				E('span', { 'style': 'top:%.2f%%'.format(100 - scale(tick.value, 0, max)) }, [ tick.label ]))),
			E('div', { 'class': 'dashboard-lines-plot' }, [
				E('div', { 'class': 'dashboard-bars-grid' }, opts.ticks.map(tick =>
					E('i', { 'style': 'top:%.2f%%'.format(100 - scale(tick.value, 0, max)) }))),
				svg('svg', { 'viewBox': '0 0 100 100', 'preserveAspectRatio': 'none', 'role': 'img', 'aria-label': opts.ariaLabel || '' }, shapes)
			]),
			E('div', { 'class': 'dashboard-lines-time' }, [
				E('span', {}, [ (opts.span >= 60) ? _('%d min ago').format(Math.round(opts.span / 60)) : _('%d s ago').format(opts.span) ]),
				E('span', {}, [ _('now') ])
			])
		]);
	},

	legend(items) {
		return E('div', { 'class': 'dashboard-legend-inline' }, items.map(item =>
			E('span', {}, [ E('i', { 'class': item.className }), item.label, (item.value != null) ? E('b', {}, [ item.value ]) : '' ])));
	}
});
