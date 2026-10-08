'use strict';
'require baseclass';
'require view.dashboard.lib.charts as charts';
'require view.dashboard.lib.history as history';

const NET = 4;

function rate(cur, prev, seconds, name, index) {
	const a = prev?.[NET]?.[name];
	const b = cur?.[NET]?.[name];

	if (!Array.isArray(a) || !Array.isArray(b) || !Number.isFinite(seconds) || seconds <= 0)
		return null;

	// Older rpcd instances provide only two fields. Crossing to the new
	// format, like a change of ifindex, starts a fresh pair of samples.
	if (a[2] !== b[2] || a[2] === null || b[2] === null)
		return null;

	for (let i = 0; i < 2; i++)
		if (!Number.isFinite(a[i]) || !Number.isFinite(b[i]) || a[i] < 0 || b[i] < a[i])
			return null;

	return (b[index] - a[index]) * 8 / seconds;
}

function selectedRate(cur, prev, seconds, index) {
	const current = cur?.[5]?.devices, previous = prev?.[5]?.devices;
	if (current?.length !== 1 || previous?.length !== 1 || current[0] !== previous[0])
		return null;
	return rate(cur, prev, seconds, current[0], index);
}

function points(index) {
	const points = history.series((cur, prev, seconds) => selectedRate(cur, prev, seconds, index));
	const last = points[points.length - 1];
	if (last && history.now - last.t > history.step * 2.5)
		points.push({ t: history.now, v: null });
	return points;
}

return baseclass.extend({
	title: _('WAN traffic'),
	widgets: [
		{ id: 'wan', slot: 'charts', title: _('WAN traffic'), order: 10 }
	],

	load() {
		return history.load();
	},

	render() {
		const down = points(0);
		const up = points(1);
		const last = points => points.length ? points[points.length - 1].v : null;
		const scale = charts.rateScale(Math.max(1, ...down.concat(up).map(p => p.v || 0)));
		const available = down.some(p => p.v != null) || up.some(p => p.v != null);
		const current = last(down) != null && last(up) != null;
		const sample = history.samples[history.samples.length - 1];
		const device = sample?.[5]?.devices?.[0];
		const body = [];

		if (available) {
			body.push(charts.lines({
				span: history.span(),
				max: scale.max,
				ticks: scale.ticks,
				ariaLabel: this.title,
				series: [ { values: down, area: true }, { values: up, area: true } ]
			}), charts.legend([
				{ className: 'dashboard-series-1', label: _('Download'), value: scale.format(last(down)) },
				{ className: 'dashboard-series-2', label: _('Upload'), value: scale.format(last(up)) }
			]));
		}
		if (!current)
			body.push(charts.empty(history.failed || !sample?.[5]?.devices?.length
				? _('No data received') : available ? _('Waiting for a new sample...') : history.status()));

		// No null children: older LuCI DOM helpers render them as literal text.
		return { charts: [ { id: 'wan', node: charts.card({
			title: this.title,
			desc: device ? device + ' · ' + scale.unit : scale.unit,
			body: [ E('section', { 'class': 'dashboard-traffic-source' }, body) ]
		}) } ] };
	}
});
