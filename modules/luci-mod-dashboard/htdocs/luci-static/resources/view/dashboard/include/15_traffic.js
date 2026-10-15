'use strict';
'require baseclass';
'require network';
'require view.dashboard.lib.charts as charts';
'require view.dashboard.lib.history as history';

const NET = 4;

return baseclass.extend({
	title: _('WAN traffic'),

	widgets: [
		{ id: 'wan', slot: 'charts', title: _('WAN traffic'), order: 10 }
	],

	load() {
		return Promise.all([
			network.getWANNetworks(),
			network.getWAN6Networks(),
			history.load()
		]);
	},

	uplink(wan, wan6) {
		const pick = list => list.slice().sort((a, b) => a.getMetric() - b.getMetric())[0];

		return pick(wan) || pick(wan6) || null;
	},

	// Rates come from the byte counters of two samples and the time between
	// them on the router's clock. Counters that went backwards, as after the
	// interface was brought up again, give no rate and leave a gap.
	rates(name, index) {
		return history.series((cur, prev, seconds) => {
			const a = prev ? prev[NET][name] : null;
			const b = cur[NET][name];

			if (a == null || b == null || b[0] < a[0] || b[1] < a[1])
				return null;

			return (b[index] - a[index]) * 8 / seconds;
		});
	},

	render([wan, wan6]) {
		const ifc = this.uplink(wan, wan6);
		const dev = ifc ? ifc.getL3Device() : null;

		if (dev == null)
			return { charts: [ { id: 'wan', node: charts.card({ title: this.title, body: charts.empty(_('Not connected')) }) } ] };

		const down = this.rates(dev.getName(), 0);
		const up = this.rates(dev.getName(), 1);
		const last = points => points.length ? points[points.length - 1].v : null;
		const scale = charts.rateScale(Math.max(1, ...down.concat(up).map(p => p.v || 0)));
		const names = (ifc.getName() == dev.getName()) ? [ dev.getName() ] : [ ifc.getName(), dev.getName() ];

		return {
			charts: [ {
				id: 'wan',
				node: charts.card({
					title: this.title,
					desc: names.concat([ scale.unit ]).join(' · '),
					body: down.length ? [
						charts.lines({
							span: history.span(),
							max: scale.max,
							ticks: scale.ticks,
							ariaLabel: this.title,
							series: [ { values: down, area: true }, { values: up, area: true } ]
						}),
						charts.legend([
							{ className: 'dashboard-series-1', label: _('Down.'), value: charts.formatRate(last(down)) },
							{ className: 'dashboard-series-2', label: _('Up.'), value: charts.formatRate(last(up)) }
						])
					] : charts.empty(history.status())
				})
			} ]
		};
	}
});
