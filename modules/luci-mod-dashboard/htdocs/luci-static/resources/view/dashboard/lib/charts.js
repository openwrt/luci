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

return baseclass.extend({
	icon(name, className) {
		return E('span', {
			'class': 'dashboard-icon ' + (className || ''),
			'style': '--dashboard-icon: url(%s)'.format(L.resource('view/dashboard/icons/' + name + '.svg'))
		});
	},

	badge(text, kind) {
		return E('span', { 'class': 'label ' + (kind || '') }, [ text ]);
	},

	card(opts) {
		const header = [];

		if (opts.title)
			header.push(E('h3', { 'class': 'dashboard-card-title' }, [ opts.title ]));

		if (opts.desc)
			header.push(E('span', { 'class': 'dashboard-card-desc' }, [ opts.desc ]));

		return E('div', { 'class': 'dashboard-card ' + (opts.className || '') }, [
			header.length ? E('div', { 'class': 'dashboard-card-head' }, header) : '',
			E('div', { 'class': 'dashboard-card-body' }, opts.body)
		]);
	},

	kpi(opts) {
		return E('div', { 'class': 'dashboard-card dashboard-kpi ' + (opts.className || '') }, [
			this.icon(opts.icon, 'dashboard-kpi-icon'),
			E('div', { 'class': 'dashboard-kpi-text' }, [
				E('div', { 'class': 'dashboard-kpi-title' }, [ opts.title ]),
				E('div', { 'class': 'dashboard-kpi-value' }, opts.value),
				E('div', { 'class': 'dashboard-kpi-sub' }, opts.sub)
			])
		]);
	},

	empty(text) {
		return E('div', { 'class': 'dashboard-empty' }, [ text ]);
	},

	// A cell is a string, a DOM node or a descriptor `{ text, className }`.
	cell(tag, cell) {
		const descr = (cell != null && typeof(cell) == 'object' && !(cell instanceof Node)) ? cell : { text: cell };

		return E(tag, { 'class': tag + ' ' + (descr.className || '') }, [ (descr.text != null) ? descr.text : '' ]);
	},

	table(opts) {
		const table = E('table', { 'class': 'table ' + (opts.className || '') }, [
			E('thead', { 'class': 'thead' }, [
				E('tr', { 'class': 'tr' }, opts.head.map(cell => this.cell('th', cell)))
			])
		]);

		const body = E('tbody', { 'class': 'tbody' });

		opts.rows.forEach((row, i) => {
			body.appendChild(E('tr', { 'class': 'tr ' + (i % 2 ? 'cbi-rowstyle-2' : 'cbi-rowstyle-1') }, row.map(cell => this.cell('td', cell))));
		});

		if (!opts.rows.length && opts.emptyText)
			body.appendChild(E('tr', { 'class': 'tr dashboard-table-empty' }, [
				E('td', { 'class': 'td', 'colspan': opts.head.length }, [ opts.emptyText ])
			]));

		table.appendChild(body);

		if (opts.foot)
			table.appendChild(E('tfoot', { 'class': 'tfoot' }, [
				E('tr', { 'class': 'tr' }, opts.foot.map(cell => this.cell('td', cell)))
			]));

		return E('div', { 'class': 'dashboard-table-wrap' }, [ table ]);
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

		return E('div', { 'class': 'dashboard-bars ' + (many ? 'dashboard-bars-many' : ''), 'style': '--dashboard-slot:%dpx'.format(opts.slot || 44) }, [
			yAxis,
			E('div', { 'class': 'dashboard-bars-scroll', 'data-chart': opts.id || '' }, [ plot ])
		]);
	},

	legend(items) {
		return E('div', { 'class': 'dashboard-legend-inline' }, items.map(item =>
			E('span', {}, [ E('i', { 'class': item.className }), item.label ])));
	}
});
