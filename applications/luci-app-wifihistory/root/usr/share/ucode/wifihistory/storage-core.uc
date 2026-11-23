'use strict';

import { mountpoint_from_data } from 'wifihistory.mounts';

const DEFAULT_SAVE_INTERVAL = 300;
const MIN_SAVE_INTERVAL = 30;

function is_below(path, base) {
	return path == base ||
		substr(path, 0, length(base) + 1) == base + '/';
}

function mountpoint_of(deps, path) {
	return mountpoint_from_data(deps.read_mounts() || '', path);
}

function resolve_storage_path(deps) {
	let raw_path = trim(deps.get_config('storage_path') || '');

	if (!raw_path)
		return { path: '', active: false, reason: 'unset' };

	if (raw_path == '/')
		return { path: raw_path, active: false, reason: 'invalid' };

	let path = rtrim(raw_path, '/');

	if (!path || substr(path, 0, 1) != '/')
		return { path: path, active: false, reason: 'invalid' };

	for (let component in split(path, '/')) {
		if (component == '.' || component == '..')
			return { path: path, active: false, reason: 'invalid' };
	}

	let mount = mountpoint_of(deps, path);

	if (!mount || mount.mountpoint == '/')
		return { path: path, active: false, reason: 'not-mounted' };

	if (!deps.is_usb_device(mount.source))
		return { path: path, active: false, reason: 'not-usb' };

	let canonical_mount = deps.realpath(mount.mountpoint);

	if (!canonical_mount)
		return { path: path, active: false, reason: 'invalid' };

	/*
	 * Find the nearest existing parent. This allows storage_path
	 * to contain multiple directories that do not exist yet.
	 */
	let existing_path = path;
	let info = null;

	while (true) {
		info = deps.stat(existing_path);

		if (info)
			break;

		if (existing_path == mount.mountpoint)
			return { path: path, active: false, reason: 'invalid' };

		let parent = deps.dirname(existing_path);

		if (!parent || parent == existing_path ||
		    !is_below(parent, mount.mountpoint))
			return { path: path, active: false, reason: 'invalid' };

		existing_path = parent;
	}

	if (info.type != 'directory')
		return { path: path, active: false, reason: 'invalid' };

	let canonical_existing = deps.realpath(existing_path);

	if (!canonical_existing ||
	    !is_below(canonical_existing, canonical_mount))
		return { path: path, active: false, reason: 'invalid' };

	return {
		path: path,
		active: true,
		reason: 'ok',
		mountpoint: mount.mountpoint,
		source: mount.source,
		canonical_mount: canonical_mount,
		existing_path: existing_path
	};
}

export function storage_status(deps) {
	let status = resolve_storage_path(deps);

	return {
		path: status.path,
		active: status.active,
		reason: status.reason
	};
}

export function ensure_storage_dir(deps) {
	let status = resolve_storage_path(deps);

	if (!status.active)
		return false;

	let missing = [];
	let current = status.path;

	while (current != status.existing_path) {
		push(missing, current);

		let parent = deps.dirname(current);

		if (!parent || parent == current)
			return false;

		current = parent;
	}

	/*
	 * Create directories from the nearest existing parent downwards.
	 */
	for (let i = length(missing) - 1; i >= 0; i--) {
		let dir = missing[i];
		let info = deps.stat(dir);

		if (!info && !deps.mkdir(dir)) {
			info = deps.stat(dir);

			if (!info || info.type != 'directory') {
				deps.warn(sprintf(
					'Cannot create storage directory %s: %s\n',
					dir, deps.error()
				));
				return false;
			}
		}

		info = deps.stat(dir);

		if (!info || info.type != 'directory')
			return false;

		let mount = mountpoint_of(deps, dir);

		if (!mount ||
		    mount.mountpoint != status.mountpoint ||
		    mount.source != status.source)
			return false;

		let canonical_dir = deps.realpath(dir);

		if (!canonical_dir ||
		    !is_below(canonical_dir, status.canonical_mount))
			return false;
	}

	return storage_status(deps).active;
}

export function persistent_dir(deps) {
	let status = storage_status(deps);

	return status.active ? status.path : null;
}

export function save_interval(deps) {
	let raw = deps.get_config('save_interval');
	let val = raw ? int(raw) : 0;

	return (val >= MIN_SAVE_INTERVAL) ? val : DEFAULT_SAVE_INTERVAL;
}
