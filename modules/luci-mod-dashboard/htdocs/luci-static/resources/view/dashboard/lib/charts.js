'use strict';
'require baseclass';

const SVG_NS = 'http://www.w3.org/2000/svg';

function svg(tag, attrs, children, existing) {
	const node = existing || document.createElementNS(SVG_NS, tag);

	for (const key in (attrs || {}))
		if (node.getAttribute(key) !== String(attrs[key]))
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
	formatRate(value, targetExp) {
		if (value == null)
			return '-';

		const exp = (targetExp != null) ? targetExp : rateUnit(value);
		const unit = Math.pow(1000, exp);
		const num = value / unit;

		if (num === 0)
			return '0 %s'.format(RATE_UNITS[exp]);

		if (num > 0 && num < 0.01 && exp > 0)
			return '< 0.01 %s'.format(RATE_UNITS[exp]);

		if (num < 1 && exp > 0)
			return '%.2f %s'.format(num, RATE_UNITS[exp]);

		return '%.1f %s'.format(num, RATE_UNITS[exp]);
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
			ticks: [ 0, 1, 2, 3, 4 ].map(n => ({ value: step * n * unit, label: String(+(step * n).toFixed(2)) })),
			format: value => this.formatRate(value, exp)
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

	// Keep the theme's card surface, with shared chart header spacing.
	card(opts) {
		// Reuse the shell as well as its plot: moving a live plot into a new
		// card temporarily shrinks the page and clamps its scroll position.
		if (opts.node) {
			let previous = opts.node.querySelector('.cbi-section-descr');
			if (previous.textContent !== (opts.desc || ''))
				previous.textContent = opts.desc || '';
			for (const child of [].concat(opts.body)) {
				if (previous.nextSibling !== child) {
					if (previous.nextSibling)
						opts.node.replaceChild(child, previous.nextSibling);
					else
						opts.node.appendChild(child);
				}
				previous = child;
			}
			while (previous.nextSibling)
				opts.node.removeChild(previous.nextSibling);
			return opts.node;
		}

		return E('div', { 'class': 'cbi-section dashboard-chart ' + (opts.className || '') }, [
			opts.title ? E('h3', {}, [ opts.title ]) : '',
			E('div', { 'class': 'cbi-section-descr' }, [ opts.desc || '' ])
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

	updateTable(table, opts) {
		const cell = (tag, content, title) => E(tag, { 'class': tag, 'data-title': title || null }, [ content ?? '' ]);
		const head = opts.head || [];
		const rows = opts.rows || [];
		const tbody = (table.tBodies && table.tBodies[0]) ? table.tBodies[0] : table;
		const currentRows = tbody.querySelectorAll('tr:not(.table-titles):not(.table-foot):not(.placeholder)');
		const placeholder = tbody.querySelector('tr.placeholder');
		const foot = tbody.querySelector('tr.table-foot');

		for (let i = 0; i < rows.length; i++) {
			const tr = E('tr', { 'class': 'tr ' + (i % 2 ? 'cbi-rowstyle-2' : 'cbi-rowstyle-1') },
				rows[i].map((content, n) => cell('td', content, head[n])));
			if (currentRows[i])
				tbody.replaceChild(tr, currentRows[i]);
			else if (foot)
				tbody.insertBefore(tr, foot);
			else
				tbody.appendChild(tr);
		}

		for (let i = rows.length; i < currentRows.length; i++)
			tbody.removeChild(currentRows[i]);

		if (!rows.length && opts.emptyText) {
			if (!placeholder) {
				const tr = E('tr', { 'class': 'tr placeholder' }, [
					E('td', { 'class': 'td', 'colspan': head.length }, [ E('em', {}, [ opts.emptyText ]) ])
				]);
				if (foot)
					tbody.insertBefore(tr, foot);
				else
					tbody.appendChild(tr);
			}
		}
		else if (placeholder) {
			tbody.removeChild(placeholder);
		}

		if (opts.foot) {
			if (!foot) {
				const tr = E('tr', { 'class': 'tr table-foot' }, opts.foot.map(content => cell('td', content)));
				tr.lastChild.setAttribute('colspan', head.length - opts.foot.length + 1);
				tbody.appendChild(tr);
			}
			else {
				while (foot.firstChild)
					foot.removeChild(foot.firstChild);
				opts.foot.map(content => cell('td', content)).forEach(td => foot.appendChild(td));
				foot.lastChild.setAttribute('colspan', head.length - opts.foot.length + 1);
			}
		}

		return table;
	},

	// Same markup as ui.Table: flat .table > .tr, header row .table-titles,
	// data-title on the cells so themes can label them on phones.
	table(opts) {
		const existing = opts.node || (opts.id ? document.getElementById(opts.id) : null);
		if (existing && existing.parentNode)
			return this.updateTable(existing, opts);

		const cell = (tag, content, title) => E(tag, { 'class': tag, 'data-title': title || null }, [ content ?? '' ]);
		const head = opts.head || [];
		const table = E('table', { 'id': opts.id || null, 'class': 'table ' + (opts.className || '') }, [
			E('tr', { 'class': 'tr table-titles' }, head.map(title => cell('th', title)))
		]);

		return this.updateTable(table, opts);
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

	// Time-ordered points `{ t, v }`, with t in milliseconds. The x axis spans
	// `span` seconds up to `end` or the last point. Non-finite values leave a
	// gap; isolated points are dots. Pass `node` to update an existing chart.
	lines(opts) {
		const min = opts.min ?? 0;
		const max = opts.max ?? 1;
		const shapes = [];
		const end = opts.end ?? opts.series.reduce((t, series) => Math.max(t, series.values[series.values.length - 1]?.t || 0), 0);
		const plot = opts.node?.querySelector('svg');
		const previous = plot ? Array.from(plot.children) : [];
		const shape = (tag, attrs) => {
			const old = previous[shapes.length];
			shapes.push(svg(tag, attrs, null, old?.localName == tag ? old : null));
		};

		opts.series.forEach((series, n) => {
			let run = [];
			const className = series.className || 'dashboard-series-' + (n + 1);

			series.values.concat([ { v: null } ]).forEach(p => {
				if (Number.isFinite(p.v)) {
					run.push([ 100 - (end - p.t) / (opts.span * 10), 100 - scale(p.v, min, max) ]);
					return;
				}

				if (run.length) {
					if (run.length == 1)
						run.push(run[0]);

					const points = run.map(p => '%.2f,%.2f'.format(p[0], p[1])).join(' ');

					if (series.area)
						shape('polygon', {
							'class': className,
							'points': '%.2f,100 %s %.2f,100'.format(run[0][0], points, run[run.length - 1][0])
						});

					shape('polyline', { 'class': className, 'points': points, 'style': series.color ? 'stroke:' + series.color : '' });
				}

				run = [];
			});
		});

		const axis = opts.node?.querySelector('.dashboard-bars-axis');
		const ago = (opts.span >= 60) ? _('%d min ago').format(Math.round(opts.span / 60)) : _('%d s ago').format(opts.span);
		if (axis && axis.children.length == opts.ticks.length) {
			const grid = opts.node.querySelector('.dashboard-bars-grid');
			opts.ticks.forEach((tick, i) => {
				const top = '%.2f%%'.format(100 - scale(tick.value, min, max));
				axis.children[i].style.top = grid.children[i].style.top = top;
				if (axis.children[i].textContent !== String(tick.label))
					axis.children[i].textContent = tick.label;
			});
			shapes.forEach((node, i) => {
				if (plot.children[i] !== node)
					plot.insertBefore(node, plot.children[i] || null);
			});
			while (plot.children.length > shapes.length)
				plot.removeChild(plot.lastChild);
			opts.node.querySelector('.dashboard-lines-time span').textContent = ago;
			return opts.node;
		}

		return E('div', { 'class': 'dashboard-bars' }, [
			E('div', { 'class': 'dashboard-bars-axis' }, opts.ticks.map(tick =>
				E('span', { 'style': 'top:%.2f%%'.format(100 - scale(tick.value, min, max)) }, [ tick.label ]))),
			E('div', { 'class': 'dashboard-lines-plot' }, [
				E('div', { 'class': 'dashboard-bars-grid' }, opts.ticks.map(tick =>
					E('i', { 'style': 'top:%.2f%%'.format(100 - scale(tick.value, min, max)) }))),
				svg('svg', { 'viewBox': '0 0 100 100', 'preserveAspectRatio': 'none', 'role': 'img', 'aria-label': opts.ariaLabel || '' }, shapes)
			]),
			E('div', { 'class': 'dashboard-lines-time' }, [
				E('span', {}, [ ago ]),
				E('span', {}, [ _('now') ])
			])
		]);
	},

	legend(items) {
		return E('div', { 'class': 'dashboard-legend-inline' }, items.map(item =>
			E('span', { 'title': item.title || null }, [ E('i', { 'class': item.className, 'style': item.color ? 'background-color:' + item.color : null }), item.label, (item.value != null) ? E('b', {}, [ item.value ]) : '' ])));
	}
});
