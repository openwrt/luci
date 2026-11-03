'use strict';
'require baseclass';
'require rpc';
'require uci';
'require view.dashboard.lib.charts as charts';
'require view.dashboard.lib.history as history';

const read = rpc.declare({ object: 'luci.dashboard.temperature', method: 'read', params: [ 'since', 'id' ], expect: { '': {} } });
const temperature = value => Number.isFinite(value) ? '%.1f °C'.format(value) : '—';
const STEP = 10000, DEFAULT_LINES = 8, MAX_LINES = 64;
const components = {
	cpu: _('CPU'), soc: _('SoC'), wifi: _('Wi-Fi'), nss: _('NSS'), modem: _('Modem'),
	ethernet: _('Ethernet'), storage: _('Storage'), other: _('Sensor')
};

function sensorCategory(sensor) {
	return typeof components[sensor.category] == 'string' ? sensor.category : 'other';
}

// Rebuild only when sensor metadata changes. Number channels within their
// component, keeping existing numbers when sources reorder or disappear.
// These are sensor labels, not inferred radio bands or physical port numbers.
function nameChannels(channels) {
	const groups = new Map();
	for (const channel of channels.values()) {
		const group = groups.get(channel.category) || { count: 0, last: 0, numbered: false };
		group.count++;
		group.last = Math.max(group.last, channel.number || 0);
		group.numbered ||= channel.numbered;
		groups.set(channel.category, group);
	}
	for (const [, channel] of Array.from(channels).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))) {
		const group = groups.get(channel.category);
		channel.number ||= ++group.last;
		channel.numbered = group.count > 1 || group.numbered;
		channel.name = components[channel.category] + (channel.numbered ? ' ' + channel.number : '');
	}
}

function colorChannels(channels) {
	const used = new Set(Array.from(channels.values(), channel => channel.color));
	let color = 1;
	for (const channel of channels.values())
		if (!channel.color) {
			while (used.has(color))
				color++;
			if (color > MAX_LINES)
				break;
			channel.color = color;
			used.add(color++);
		}
}

function channelColor(channel) {
	return channel.color > 8
		? 'hsl(%d, 60%%, var(--dashboard-extra-lightness))'.format((channel.color * 137.508) % 360) : null;
}

// Prefer package/die readings, then an explicitly named CPU channel.
// Selection is independent of the current values, so a failed CPU read cannot
// silently turn the processor card into a Wi-Fi or disk temperature card.
function processorSensor(sensors) {
	const rank = sensor => {
		const [name, channel = ''] = (sensor.label || '').toLowerCase().split(' / ');
		if (/^(coretemp|k10temp|k8temp)$/.test(name))
			return /^(package\sid\s[0-9]+|tdie)$/.test(channel) ? 0 : channel == 'tctl' ? 1 : 2;
		if (sensor.category == 'cpu' || /^cpu[0-9]*[-_]thermal$/.test(name))
			return 3;
		return 99;
	};
	let selected, priority = 99;
	for (const sensor of sensors) {
		const value = rank(sensor);
		if (value < priority || (selected && value == priority &&
		    (sensor.id || sensor.label).localeCompare(selected.id || selected.label, undefined, { numeric: true }) < 0)) {
			selected = sensor;
			priority = value;
		}
	}
	return selected;
}

// A module may expose multiple radios or thermal zones. Keep all channels in
// details, and summarize the hottest available reading for each component.
function componentTemperature(sensors, category, label) {
	let present = false, value = -Infinity;
	for (const sensor of sensors)
		if (sensor.category == category) {
			present = true;
			if (Number.isFinite(sensor.celsius))
				value = Math.max(value, sensor.celsius);
		}
	// Wrap between components, keeping each label and reading together.
	return present ? '%s\u00a0%s'.format(label, temperature(value).replace(' ', '\u00a0')) : null;
}

return baseclass.extend({
	widgets: [
		{ id: 'temperature', slot: 'cards', title: _('Temperature'), order: 40 },
		{ id: 'temperature_history', slot: 'charts', title: _('Temperature history'), order: 30 },
		{ id: 'temperatures', slot: 'tabs', title: _('Temperatures'), order: 40 }
	],

	load() {
		const now = performance.now();
		const state = this.history ||= { samples: [], step: STEP, slots: 30, now: 0 };
		if (this.pending)
			return this.pending;
		if (this.data && now < this.nextRead) {
			this.data.age_ms = this.age == null ? null : this.age + now - this.received;
			state.now = this.receivedNow + now - this.received;
			return Promise.resolve(this.data);
		}

		// Match backend sampling and fetch only new rows after the first load.
		const last = state.samples[state.samples.length - 1];
		this.pending = L.resolveDefault(read(last ? last[0] : 0, state.id || ''), { status: 'error', sensors: [] }).then(data => {
			history.update(state, data);
			this.data = data;
			this.received = performance.now();
			this.receivedNow = state.now;
			this.age = Number.isFinite(data.age_ms) ? data.age_ms : null;
			this.nextRead = this.received + (data.status == 'unsupported' ? 60000
				: this.age != null && this.age < state.step ? state.step - this.age : state.step);
			this.pending = null;
			return data;
		});
		return this.pending;
	},


	renderChart(data, sensors) {
		const state = this.history;
		const span = history.span(state);
		const fresh = !state.failed && Number.isFinite(data.age_ms) && data.age_ms < 15000
			&& (data.status == 'ok' || data.status == 'partial');
		let h = this.trend;
		if (!h) {
			h = this.trend = {
				channels: new Map(), min: 0, max: 100,
				selected: new Set(L.toArray(uci.get('dashboard', 'layout', 'temperature_sensors')).slice(0, MAX_LINES)),
				plot: E('div'), legend: E('div'), message: charts.empty('')
			};
			h.node = charts.card({ title: _('Temperature history'), desc: '°C', body: [ h.plot, h.legend, h.message ] });
		}

		if (h.id !== state.id) {
			h.id = state.id;
			h.min = 0;
			h.max = 100;
			h.dirty = true;
		}
		if (data !== h.data && Array.isArray(data.samples)) {
			h.data = data;
			const current = new Map(sensors.slice(0, 64).map((sensor, index) => [ sensor.id, { sensor, index } ]));
			for (const [id] of h.channels)
				if (!current.has(id)) {
					h.channels.delete(id);
					h.dirty = true;
				}
			for (const [id, { sensor, index }] of current) {
				let channel = h.channels.get(id);
				if (!channel) {
					channel = { color: 0 };
					h.channels.set(id, channel);
					h.dirty = true;
				}
				if (channel.label !== sensor.label || channel.index !== index)
					h.dirty = true;
				const category = sensorCategory(sensor);
				if (channel.category !== category) {
					channel.category = category;
					channel.number = 0;
					channel.numbered = false;
					h.dirty = true;
				}
				channel.label = sensor.label;
				channel.index = index;
				channel.current = sensor.celsius;
			}
		}

		if (h.dirty) {
			nameChannels(h.channels);
			colorChannels(h.channels);
		}

		const tick = Math.floor(performance.now() / state.step);
		const last = state.samples[state.samples.length - 1]?.[0] || 0;
		if (!h.dirty && h.tick === tick && h.drawn === last && h.fresh === fresh)
			return h.node;
		h.dirty = false;
		h.tick = tick;
		h.drawn = last;
		h.fresh = fresh;

		const series = [], legend = [];
		const selected = h.selected.size ? h.selected : new Set(sensors.slice(0, DEFAULT_LINES).map(sensor => sensor.id));
		for (const [id, channel] of h.channels) {
			if (!channel.color || !selected.has(id))
				continue;
			const values = history.series(cur => cur[1] > state.now - span * 1000 ? cur[2][channel.index] : null, state.samples, state.step);
			for (const point of values)
				if (Number.isFinite(point.v)) {
					h.min = Math.min(h.min, Math.floor(point.v / 20) * 20);
					h.max = Math.max(h.max, Math.ceil(point.v / 20) * 20);
				}
			const className = 'dashboard-series-' + channel.color;
			const color = channelColor(channel);
			series.push({ className, color, values });
			legend.push({ className, color, label: channel.name, title: channel.label, value: temperature(fresh ? channel.current : null) });
		}
		h.lines = charts.lines({ node: h.lines, end: state.now, span, min: h.min, max: h.max,
			ticks: [ 0, 1, 2, 3, 4 ].map(i => {
				const value = h.min + (h.max - h.min) * i / 4;
				return { value, label: String(value) };
			}), ariaLabel: _('Temperature history'), series });
		if (h.plot.firstChild !== h.lines)
			L.dom.content(h.plot, h.lines);
		L.dom.content(h.legend, charts.legend(legend));
		h.message.textContent = !fresh ? _('Temperature temporarily unavailable')
			: !series.length ? _('Selected temperature sensors are unavailable') : '';
		return h.node;
	},

	render(data) {
		const age = data.age_ms >= 15000 ? Math.floor(data.age_ms / 1000) : 0;
		if (data === this.renderedData && age === this.renderedAge)
			return this.sections;
		this.renderedData = data;
		this.renderedAge = age;
		const sensors = Array.isArray(data.sensors) ? data.sensors : [];
		const categories = {
			...components, ethernet: _('Ethernet PHY'), other: _('Other sensors')
		};
		const processor = processorSensor(sensors);
		const value = processor?.celsius;
		const message = data.status == 'unsupported' ? _('No supported temperature sensors found') : _('Temperature temporarily unavailable');
		const stale = data.age_ms >= 15000;
		const modules = ['nss', 'wifi', 'modem'].map(category => componentTemperature(sensors, category, categories[category])).filter(Boolean);
		const sub = [];
		for (let i = 0; i < modules.length; i += 2)
			sub.push(modules.slice(i, i + 2).join(' · '));
		if (!processor)
			sub.push(_('Processor temperature unavailable'));
		else if (!Number.isFinite(value))
			sub.push(message);
		if (stale)
			sub.push(_('Reading age: %d seconds').format(Math.floor(data.age_ms / 1000)));

		let card, tab;
		if (data.status == 'unsupported')
			this.trend = null;
		return this.sections = {
			cards: data.status == 'unsupported' ? [] : [{
				id: 'temperature', node: () => card ||= charts.kpi({
					icon: 'temperature', title: _('Temperature'), className: 'dashboard-temperature',
					value: [ '%s %s'.format(_('CPU'), temperature(value)) ], sub, stacked: true
				})
			}],
			charts: data.status == 'unsupported' ? [] : [{
				id: 'temperature_history', node: () => this.renderChart(data, sensors)
			}],
			tabs: data.status == 'unsupported' ? [] : [{ id: 'temperatures', title: _('Temperatures'), content: () => tab ||= E('div', {}, [
				stale ? E('p', {}, [ _('Reading age: %d seconds').format(Math.floor(data.age_ms / 1000)) ]) : '',
				data.status == 'partial' ? E('p', {}, [ _('Some temperature sensors are unavailable') ]) : '',
				sensors.length ? charts.table({
					head: [ _('Component'), _('Sensor'), _('Temperature') ],
					rows: sensors.map(s => [ categories[s.category] || categories.other, s.label, temperature(s.celsius) ])
				}) : charts.empty(message)
			]) }]
		};
	}
});
