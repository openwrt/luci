'use strict';

import { glob, readfile, realpath, stat } from 'fs';

const LIMIT = 64;

function text(path) {
	const value = readfile(path, 256);
	return value == null ? null : trim(value);
}

// Standard thermal zone types may also appear as hwmon channel labels.
// Do not assign numbered TSENS channels to components without a named label.
function component(name) {
	name = lc(name ?? '');
	if (match(name, /^cpu[0-9]*[-_]thermal$/))
		return 'cpu';
	if (match(name, /^nss([0-9]+|[-_]top)?[-_]thermal$/))
		return 'nss';
	if (match(name, /^(wcss([-_]phy[ab][0-9]+)?|wifi[0-9]*)[-_]thermal$/))
		return 'wifi';
	if (match(name, /^modem[0-9]*([-_]thermal)?$/))
		return 'modem';
	return null;
}

// Display hints only: unknown names never prevent collection.
function category(name, device, label) {
	const named = component(label) ?? component(name);
	if (named)
		return named;
	if (match(device, /\/ieee80211\//) || match(name, /^ath(10|11)k_hwmon$/))
		return 'wifi';
	if (match(device, /\/mdio_bus\//))
		return 'ethernet';
	if (match(name, /^(coretemp|k10temp|k8temp|cpu[0-9]*[-_]thermal)$/))
		return 'cpu';
	if (match(name, /^soc[-_]thermal$/))
		return 'soc';
	if (match(name, /^(nvme|drivetemp)$/))
		return 'storage';
	return 'other';
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
				id: `${device}/${channel}`, path, category: category(name, device, label),
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
			label: name, category: category(name, device)
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
		push(sensors, { id: source.id, category: source.category, label: source.label, celsius: value });
	}
	return {
		status: !length(sources) ? 'unsupported' : valid == length(sources) ? 'ok' : valid ? 'partial' : 'error',
		sensors
	};
};
