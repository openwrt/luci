'use strict';

import { glob, readfile, realpath, stat } from 'fs';
import * as uloop from 'uloop';

// Mark labels for LuCI's i18n scanner; translation happens in the browser.
function _(message) { return message; }

// The single registry for component IDs, display labels and recognition.
// Each rule is [pattern, optional CPU priority]. Lower priorities win, without
// considering the current temperature or whether the latest read succeeded.
const COMPONENTS = {
	cpu: {
		label: _('CPU'),
		names: [
			[/^cpu[0-9]*-thermal$/, 3], [/^cpu-die-thermal$/, 4], [/^cpu-top-thermal$/, 5],
			[/^(cpuss[0-9]+|cluster)-thermal$/, 6], [/^(bigcore[0-9]+|littlecore)-thermal$/, 7]
		],
		drivers: [[/^(coretemp|k10temp|k8temp)$/, 2]],
		channels: [[/^(package\s+id\s+[0-9]+|tdie)$/, 0], [/^tctl$/, 1]]
	},
	soc: { label: _('SoC'), names: [[/^(soc|package)-thermal$/]] },
	wifi: {
		label: _('Wi-Fi'),
		names: [[/^(wcss(-phy[ab][0-9]*)?|wifi[0-9]*)-thermal$/], [/^iwlwifi-[0-9]+$/]],
		drivers: [[/^ath(10|11)k-hwmon$/]], devices: [[/\/ieee80211\//]]
	},
	nss: { label: _('NSS'), names: [[/^nss([0-9]+|-top)?-thermal$/]] },
	modem: { label: _('Modem'), names: [[/^modem[0-9]*(-thermal)?$/]] },
	lpass: { label: _('LPASS'), names: [[/^lpass-thermal$/]] },
	ddr: { label: _('DDR'), names: [[/^ddr(ss(-top)?)?-thermal$/]] },
	ethernet: {
		label: _('Ethernet'),
		names: [[/^(gephy|ethphy|aqr-lan|aqr-wan|mxl)-thermal$/]],
		devices: [[/\/mdio_bus\//]]
	},
	storage: { label: _('Storage'), names: [[/^hdd-thermal$/]], drivers: [[/^(nvme|drivetemp)$/]] },
	gpu: { label: _('GPU'), names: [[/^gpu-thermal$/]] },
	npu: { label: _('NPU'), names: [[/^npu-thermal$/]] },
	ve: { label: _('VE'), names: [[/^ve-thermal$/]] },
	gbe: { label: _('GbE'), names: [[/^gbe-thermal$/]] },
	// A bare PHY name does not distinguish Ethernet from other PHY types.
	phy: { label: _('PHY'), names: [[/^(cp[0-9]+-)?phy[0-9]+-thermal$/]] },
	chassis: { label: _('Chassis'), names: [[/^chassis[0-9]*-thermal$/]] },
	system: { label: _('System'), names: [[/^sys-thermal$/]] },
	switch: { label: _('Switch'), names: [[/^switch-thermal$/]] },
	// Preserve these identifiers rather than guessing CPU, radio or port roles.
	ubi: { label: _('UBI'), names: [[/^ubi-[0-9]+-thermal$/]] },
	ubi32: { label: _('UBI32'), names: [[/^ubi32-thermal$/]] },
	rfa: { label: _('RFA'), names: [[/^rfa-[0-9]+-thermal$/]] },
	topglue: { label: _('Top Glue'), names: [[/^top-glue-thermal$/]] },
	misc: { label: _('Misc'), names: [[/^misc-thermal$/]] },
	center: { label: _('Center'), names: [[/^center-thermal$/]] },
	serdes: { label: _('SerDes'), names: [[/^serdes-thermal$/]] },
	fman: { label: _('FMan'), names: [[/^fman-thermal$/]] },
	sec: { label: _('SEC'), names: [[/^sec-thermal$/]] },
	other: { label: _('Sensor') }
};

export const labels = {};
for (let id, component in COMPONENTS)
	labels[id] = component.label;

function normalized(name) {
	return replace(lc(trim(name ?? '')), /_/g, '-');
}

function matchRules(value, rules, category) {
	for (let rule in rules ?? [])
		if (match(value, rule[0]))
			return { category, priority: rule[1] };
	return null;
}

function lookup(value, field) {
	for (let id, component in COMPONENTS) {
		const found = matchRules(value, component[field], id);
		if (found)
			return found;
	}
	return null;
}

function classify(name, device, label) {
	name = normalized(name);
	label = normalized(label);
	const named = lookup(label, 'names') ?? lookup(name, 'names');
	if (named)
		return named;
	const attached = lookup(device ?? '', 'devices');
	if (attached)
		return attached;
	const driver = lookup(name, 'drivers');
	if (driver)
		return matchRules(label, COMPONENTS[driver.category].channels, driver.category) ?? driver;
	return { category: 'other', priority: null };
};

const LIMIT = 64;

function text(path) {
	const value = readfile(path, 256);
	return value == null ? null : trim(value);
}

// Discovery is separate from sampling. No caller-provided paths enter the RPC.
export function discover(root) {
	const sensors = [], covered = {};
	let available = false;
	for (let base in [ `${root}/class/hwmon`, `${root}/class/thermal` ])
		available ||= stat(base)?.type == 'directory';
	if (!available)
		return null;

	for (let dir in sort(glob(`${root}/class/hwmon/hwmon*`) ?? [])) {
		const name = text(`${dir}/name`) || 'hwmon';
		const device = realpath(`${dir}/device`) || realpath(dir) || dir;
		let found = false;
		for (let path in sort(glob(`${dir}/temp*_input`) ?? [])) {
			const channel = match(path, /\/(temp[0-9]+)_input$/)?.[1];
			if (!channel || length(sensors) >= LIMIT)
				continue;
			const label = text(`${dir}/${channel}_label`);
			push(sensors, {
				id: `${device}/${channel}`, path, ...classify(name, device, label),
				label: label ? `${name} / ${label}` : `${name} / ${channel}`
			});
			found = true;
		}
		if (found)
			covered[device] = true;
	}

	for (let dir in sort(glob(`${root}/class/thermal/thermal_zone*`) ?? [])) {
		const device = realpath(dir) || dir;
		if (covered[device] || length(sensors) >= LIMIT || !stat(`${dir}/temp`))
			continue;
		const name = text(`${dir}/type`) || 'thermal';
		push(sensors, {
			id: `${device}/temp`, path: `${dir}/temp`,
			label: name, ...classify(name, device)
		});
	}
	return sensors;
};

export function sample(sources) {
	const sensors = [];
	let valid = 0;
	for (let source in sources) {
		const raw = text(source.path);
		const value = raw != null && match(raw, /^-?[0-9]+$/) ? +raw / 1000.0 : null;
		if (value != null)
			valid++;
		push(sensors, { id: source.id, category: source.category, priority: source.priority, label: source.label, celsius: value });
	}
	return {
		status: !length(sources) ? 'unsupported' : valid == length(sources) ? 'ok' : valid ? 'partial' : 'error',
		sensors
	};
};

// Start sampling when the dashboard RPC service registers its methods.
export function start() {
	const STEP = 10000, SLOTS = 30, DISCOVERY = 60000, TIMEOUT = 1000;
	const instance = trim(readfile('/proc/sys/kernel/random/uuid'));
	let sources, discovered = 0, cached, sampled = 0, retry = 0, failures = 0;
	let worker, deadline, timer, generation = 0;
	let ring = [], columns = [], seq = 0, schema = 0;

	function now() {
		const t = clock(true);
		return t[0] * 1000 + int(t[1] / 1000000);
	}

	function prune(t) {
		while (length(ring) && (length(ring) > SLOTS || ring[0][1] < t - STEP * SLOTS))
			shift(ring);
	}

	// Store only timestamps and numeric columns, never repeated sensor names or
	// paths. Keep surviving channels' history when discovery reorders the sources.
	function record(t) {
		const next = map(cached.sensors, sensor => sensor.id);
		let changed = length(next) != length(columns);
		for (let i = 0; !changed && i < length(next); i++)
			changed = next[i] != columns[i];
		if (changed) {
			const previous = {};
			for (let i = 0; i < length(columns); i++)
				previous[columns[i]] = i;
			const indices = map(next, id => previous[id]);
			for (let entry in ring)
				entry[2] = map(indices, i => i == null ? null : entry[2][i]);
			columns = next;
			schema++;
		}

		if (length(columns))
			push(ring, [ ++seq, t, map(cached.sensors, sensor => sensor.celsius) ]);
		else
			ring = [];
		prune(t);
	}

	function schedule() {
		timer.set(max(cached?.status == 'unsupported' ? DISCOVERY : STEP, retry - now()));
	}

	function failed() {
		failures = min(failures + 1, 5);
		retry = now() + min(300000, 30000 * (2 ** (failures - 1)));
		cached = { status: 'error', sensors: map(sources ?? [], s => ({ id: s.id, category: s.category,
			priority: s.priority, label: s.label, celsius: null })) };
		sampled = 0;
		discovered = 0;
		record(now());
		schedule();
	}

	// One bounded asynchronous read every ten seconds, independent of page visits.
	// Slow drivers cannot block rpcd or create overlapping collection workers.
	function collect() {
		const t = now();
		if (worker && worker.finished())
			worker = null;
		if (worker || t < retry) {
			prune(t);
			schedule();
			return;
		}

		const token = ++generation;
		const refresh = sources == null || !discovered || t - discovered >= DISCOVERY;
		try {
			// Older ucode only closes the task's output pipe when an input
			// callback exists. Keep that cleanup path active even though this
			// worker never requests input (ucode b885dd0f, uc_uloop_task_clear).
			worker = uloop.task(() => {
				const list = refresh ? discover('/sys') : sources;
				return list == null ? null : { sources: list, result: sample(list) };
			}, data => {
				if (token != generation)
					return;
				deadline.cancel();
				if (data == null) {
					failed();
					return;
				}
				sources = data.sources;
				cached = data.result;
				sampled = now();
				if (refresh)
					discovered = sampled;
				// Keep healthy channels current when just one sensor is unavailable.
				if (cached.status == 'error') {
					failures = min(failures + 1, 5);
					retry = sampled + min(300000, 30000 * (2 ** (failures - 1)));
					discovered = 0;
				}
				else {
					failures = 0;
					retry = 0;
				}
				record(sampled);
				schedule();
			}, () => null);
			if (!worker) {
				failed();
				return;
			}
			deadline = uloop.timer(TIMEOUT, () => {
				generation++;
				worker.kill();
				failed();
			});
		}
		catch (e) { failed(); }
	}

	timer = uloop.timer(0, collect);

	return {
		read: {
			args: { since: 0, id: 'id' },
			call: function(request) {
				const t = now(), id = instance + '.' + schema;
				const since = request.args?.id == id ? +(request.args?.since ?? 0) : 0;
				prune(t);
				return {
					components: labels,
					status: cached?.status ?? 'error', sensors: cached?.sensors ?? [],
					id, age_ms: sampled ? t - sampled : null,
					now: t, step: STEP, slots: SLOTS,
					samples: filter(ring, entry => entry[0] > since)
				};
			}
		}
	};
};
