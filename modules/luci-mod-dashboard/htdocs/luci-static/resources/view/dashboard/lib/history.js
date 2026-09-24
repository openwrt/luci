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

	fetch() {
		const last = this.samples[this.samples.length - 1];

		return L.resolveDefault(callHistory(last ? last[SEQ] : 0, this.id || ''), null).then(res => {
			this.failed = (!L.isObject(res) || !Array.isArray(res.samples));

			if (this.failed) {
				// Old samples must not appear as current CPU usage or live traffic.
				this.samples = [];
				return;
			}

			if (res.id != this.id)
				this.samples = [];

			this.id = res.id;
			this.step = res.step;
			this.slots = res.slots;
			this.samples = this.samples.concat(res.samples).filter(sample => sample[TIME] > res.now - res.step * res.slots);
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

	span() {
		return this.slots * this.step / 1000;
	},

	near(prev, cur) {
		return (prev != null && cur[TIME] - prev[TIME] <= 2.5 * this.step);
	},

	pair() {
		const cur = this.samples[this.samples.length - 1];
		const prev = this.samples[this.samples.length - 2];

		return this.near(prev, cur) ? [ prev, cur ] : null;
	},

	// Points `{ t, v }` for a chart. `fn(cur, prev, seconds)` gives a value or
	// null; `prev` is null where sampling had paused, which leaves a gap.
	series(fn) {
		const points = [];

		this.samples.forEach((cur, i) => {
			const prev = this.samples[i - 1];
			const near = this.near(prev, cur);

			if (prev != null && !near)
				points.push({ t: cur[TIME] - 1, v: null });

			points.push({ t: cur[TIME], v: fn(cur, near ? prev : null, near ? (cur[TIME] - prev[TIME]) / 1000 : 0) });
		});

		return points;
	}
});
