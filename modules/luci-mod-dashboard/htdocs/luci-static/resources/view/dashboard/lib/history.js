'use strict';
'require baseclass';
'require rpc';

const callHistory = rpc.declare({
	object: 'luci.dashboard',
	method: 'history',
	params: [ 'since', 'id' ]
});

const SEQ = 0, TIME = 1;

return baseclass.extend({
	samples: [],
	step: 5000,
	slots: 60,

	// Both counter history and temperature readings use the same bounded,
	// incremental protocol. State belongs to the caller, not to the chart DOM.
	update(state, res) {
		state.failed = (!L.isObject(res) || !Array.isArray(res.samples));
		if (state.failed) {
			state.samples = [];
			return;
		}
		if (res.id != state.id)
			state.samples = [];
		state.id = res.id;
		state.now = res.now;
		state.step = res.step;
		state.slots = res.slots;
		state.samples = (state.samples || []).concat(res.samples).filter(sample => sample[TIME] > res.now - res.step * res.slots);
	},

	fetch() {
		const last = this.samples[this.samples.length - 1];

		return L.resolveDefault(callHistory(last ? last[SEQ] : 0, this.id || ''), null).then(res => {
			// Failed requests must not turn old samples into live readings.
			this.update(this, res);
		});
	},

	load() {
		const now = performance.now();

		if (this.pending == null || now - this.asked > 1000) {
			this.asked = now;
			this.pending = this.fetch();
		}

		return this.pending;
	},

	status() {
		return this.failed ? _('No data received') : _('Collecting data...');
	},

	span(state = this) {
		return state.slots * state.step / 1000;
	},

	near(prev, cur, step = this.step) {
		return (prev != null && cur[TIME] > prev[TIME] && cur[TIME] - prev[TIME] <= 2.5 * step);
	},

	pair() {
		const cur = this.samples[this.samples.length - 1];
		const prev = this.samples[this.samples.length - 2];

		return this.near(prev, cur) ? [ prev, cur ] : null;
	},

	// Points `{ t, v }` for a chart. `fn(cur, prev, seconds)` gives a value or
	// null; `prev` is null where sampling had paused, which leaves a gap.
	series(fn, samples = this.samples, step = this.step) {
		const points = [];

		samples.forEach((cur, i) => {
			const prev = samples[i - 1];
			const near = this.near(prev, cur, step);

			if (prev != null && !near)
				points.push({ t: cur[TIME] - 1, v: null });

			points.push({ t: cur[TIME], v: fn(cur, near ? prev : null, near ? (cur[TIME] - prev[TIME]) / 1000 : 0) });
		});

		return points;
	}
});
