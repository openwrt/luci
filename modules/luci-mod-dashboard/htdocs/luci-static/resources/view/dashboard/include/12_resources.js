'use strict';
'require baseclass';
'require view.dashboard.lib.charts as charts';
'require view.dashboard.lib.history as history';
'require view.dashboard.lib.system as system';

// The first eight fields of a /proc/stat cpu line. Guest time is already
// part of user and nice, so it must not be added again.
const CPUS = 2, MEMORY = 3;
const USER = 0, NICE = 1, SYSTEM = 2, IDLE = 3, IOWAIT = 4, IRQ = 5, SOFTIRQ = 6, STEAL = 7;

// Shares of the time between two samples, in percent. Both are in jiffies,
// so no clock is involved. Waiting for I/O is idle time. The iowait counter
// may step back, hence the clamp.
function usage(prev, cur) {
	const d = cur.map((value, i) => Math.max(0, value - (prev[i] || 0)));
	const total = d.reduce((sum, value) => sum + value, 0);

	if (total <= 0)
		return null;

	const share = value => 100 * value / total;

	return {
		busy: share(total - d[IDLE] - d[IOWAIT]),
		user: share(d[USER] + d[NICE]),
		system: share(d[SYSTEM]),
		iowait: share(d[IOWAIT]),
		irq: share(d[IRQ]),
		softirq: share(d[SOFTIRQ]),
		steal: share(d[STEAL])
	};
}

function progressbar(percent, text) {
	return E('div', { 'class': 'cbi-progressbar', 'title': text }, [
		E('div', { 'style': 'width:%.2f%%'.format(Math.max(0, Math.min(100, percent))) })
	]);
}

return baseclass.extend({
	widgets: [
		{ id: 'cpu', slot: 'cards', title: _('CPU usage'), order: 20 },
		{ id: 'memory', slot: 'cards', title: _('Memory'), order: 30 },
		{ id: 'load', slot: 'cards', title: _('Load average'), order: 80, hidden: true },
		{ id: 'system', slot: 'charts', title: _('System load'), order: 20 },
		{ id: 'resources', slot: 'tabs', title: _('Resources'), order: 30 }
	],

	load() {
		return Promise.all([ system.info(), history.load() ]);
	},

	// Per-CPU usage over the latest interval, keyed by the kernel's names so
	// that a CPU going offline does not shift the others.
	cpu() {
		const pair = history.pair();
		const result = {};

		if (pair == null)
			return null;

		for (const name in pair[1][CPUS])
			if (pair[0][CPUS][name] != null)
				result[name] = usage(pair[0][CPUS][name], pair[1][CPUS][name]);

		return (result.cpu != null) ? result : null;
	},

	memory(info) {
		const mem = L.isObject(info.memory) ? info.memory : {};

		if (!mem.total)
			return null;

		// What the kernel reckons can be had without swapping. Counting
		// everything but "free" as used would include the page cache.
		const available = (mem.available != null) ? mem.available : (mem.free || 0) + (mem.buffered || 0) + (mem.cached || 0);
		const used = Math.max(0, mem.total - available);

		return { total: mem.total, used: used, percent: 100 * used / mem.total, buffered: mem.buffered, cached: mem.cached };
	},

	renderCpuCard(cpu, cores, load) {
		return charts.kpi({
			icon: 'cpu',
			title: _('CPU usage'),
			value: [ cpu ? '%d%%'.format(Math.round(cpu.cpu.busy)) : '-' ],
			sub: cpu ? [ N_(cores, '%d core', '%d cores').format(cores), load ? _('load %.2f').format(load[0]) : null ]
				: [ E('em', {}, [ history.status() ]) ]
		});
	},

	renderMemoryCard(mem) {
		return charts.kpi({
			icon: 'memory',
			title: _('Memory'),
			value: [ mem ? '%d%%'.format(Math.round(mem.percent)) : '-' ],
			sub: [ mem ? '%1024.1mB / %1024.1mB'.format(mem.used, mem.total) : '' ]
		});
	},

	renderLoadCard(load) {
		return charts.kpi({
			icon: 'load',
			title: _('Load average'),
			value: [ load ? '%.2f'.format(load[0]) : '-' ],
			sub: load ? [ _('5 min: %.2f').format(load[1]), _('15 min: %.2f').format(load[2]) ] : []
		});
	},

	renderChart(cores, mem) {
		const busy = history.series((cur, prev) => {
			const share = (prev != null && prev[CPUS].cpu != null && cur[CPUS].cpu != null) ? usage(prev[CPUS].cpu, cur[CPUS].cpu) : null;

			return share ? share.busy : null;
		});
		const used = history.series(cur => (mem != null && cur[MEMORY] != null) ? 100 * (1 - cur[MEMORY] / mem.total) : null);
		const last = points => points.length ? points[points.length - 1].v : null;
		const percent = value => (value != null) ? '%d%%'.format(Math.round(value)) : '-';
		const desc = [];

		if (cores)
			desc.push(N_(cores, '%d core', '%d cores').format(cores));

		if (mem)
			desc.push('%1024.0mB'.format(mem.total));

		return charts.card({
			title: _('System load'),
			desc: desc.join(' · '),
			body: busy.length ? [
				charts.lines({
					span: history.span(),
					max: 100,
					ticks: [ 0, 25, 50, 75, 100 ].map(value => ({ value: value, label: '%d%%'.format(value) })),
					ariaLabel: _('System load'),
					series: [ { values: busy, area: true }, { values: used } ]
				}),
				charts.legend([
					{ className: 'dashboard-series-1', label: _('CPU'), value: percent(last(busy)) },
					{ className: 'dashboard-series-2', label: _('Memory'), value: percent(last(used)) }
				])
			] : charts.empty(history.status())
		});
	},

	renderTab(cpu, mem, load, swap) {
		const rows = [];
		const pending = () => E('em', {}, [ history.status() ]);
		const bytes = (value, total) => progressbar(100 * value / total, '%1024.1mB / %1024.1mB (%d%%)'.format(value, total, Math.round(100 * value / total)));

		if (load)
			rows.push([ _('Load average'), '%.2f, %.2f, %.2f'.format(load[0], load[1], load[2]) ]);

		const core = (title, share) => [
			E('span', { 'data-tooltip': 'user %.1f · system %.1f · iowait %.1f · irq %.1f · softirq %.1f · steal %.1f'.format(
				share.user, share.system, share.iowait, share.irq, share.softirq, share.steal) }, [ title ]),
			progressbar(share.busy, '%.1f%%'.format(share.busy))
		];

		rows.push(cpu ? core(_('CPU usage'), cpu.cpu) : [ _('CPU usage'), pending() ]);

		if (cpu && Object.keys(cpu).length > 2)
			Object.keys(cpu).filter(name => name != 'cpu' && cpu[name] != null).forEach(name => {
				rows.push(core(name.replace(/^cpu/, _('CPU') + ' '), cpu[name]));
			});

		if (mem) {
			rows.push([ _('Memory used'), bytes(mem.used, mem.total) ]);

			if (mem.buffered)
				rows.push([ _('Buffered'), bytes(mem.buffered, mem.total) ]);

			if (mem.cached)
				rows.push([ _('Cached'), bytes(mem.cached, mem.total) ]);
		}

		if (swap && swap.total > 0)
			rows.push([ _('Swap used'), bytes(swap.total - swap.free, swap.total) ]);

		return E('table', { 'class': 'table' }, rows.map(row => E('tr', { 'class': 'tr' }, [
			E('td', { 'class': 'td left', 'width': '33%' }, [ row[0] ]),
			E('td', { 'class': 'td left' }, [ row[1] ])
		])));
	},

	render([info]) {
		const cpu = this.cpu();
		const latest = history.samples[history.samples.length - 1];
		const cores = latest ? Math.max(1, Object.keys(latest[CPUS]).length - 1) : 0;
		const mem = this.memory(info);
		const load = Array.isArray(info.load) ? info.load.map(value => value / 65536) : null;

		return {
			cards: [
				{ id: 'cpu', node: () => this.renderCpuCard(cpu, cores, load) },
				{ id: 'memory', node: () => this.renderMemoryCard(mem) },
				{ id: 'load', node: () => this.renderLoadCard(load) }
			],
			charts: [ { id: 'system', node: () => this.renderChart(cores, mem) } ],
			tabs: [ { id: 'resources', title: _('Resources'), content: () => this.renderTab(cpu, mem, load, info.swap) } ]
		};
	}
});
