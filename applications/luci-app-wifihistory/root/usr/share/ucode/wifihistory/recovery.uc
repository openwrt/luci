'use strict';

import {
	readfile, writefile, rename, unlink,
	lsdir, dirname, basename, error
} from 'fs';

/* Read a JSON object without treating read errors as an empty file. */
function load_file(path) {
	let dir = dirname(path);
	let name = basename(path);
	let entries = lsdir(dir);

	if (entries == null) {
		warn(sprintf('Cannot list directory %s: %s\n', dir, error()));
		return { ok: false, exists: false, data: null };
	}

	let exists = false;

	for (let entry in entries) {
		if (entry == name) {
			exists = true;
			break;
		}
	}

	if (!exists)
		return { ok: true, exists: false, data: {} };

	let content = readfile(path);

	if (content == null) {
		warn(sprintf('Cannot read %s: %s\n', path, error()));
		return { ok: false, exists: true, data: null };
	}

	try {
		let data = json(content);

		if (type(data) != 'object') {
			warn(sprintf('Invalid data format in %s\n', path));
			return { ok: false, exists: true, data: null };
		}

		return { ok: true, exists: true, data: data };
	}
	catch (e) {
		warn(sprintf('Invalid JSON in %s\n', path));
		return { ok: false, exists: true, data: null };
	}
}

/* Atomically replace a JSON file. */
function save_file(path, data) {
	let tmp = path + '.tmp';

	if (writefile(tmp, sprintf('%J', data)) == null) {
		warn(sprintf('Failed to write %s: %s\n', tmp, error()));
		return false;
	}

	if (!rename(tmp, path)) {
		warn(sprintf('Failed to rename %s: %s\n', path, error()));
		unlink(tmp);
		return false;
	}

	return true;
}

/* Read the persistent clear-operation marker. */
export function read_clear_marker(marker_path) {
	let marker = load_file(marker_path);

	if (!marker.ok)
		return { ok: false, pending: true };

	if (!marker.exists)
		return { ok: true, pending: false };

	let data = marker.data;

	if ((data.state != 'requested' && data.state != 'ram-cleared') ||
	    type(data.storage_path) != 'string') {
		warn('Invalid history clear marker; blocking storage operations\n');
		return { ok: false, pending: true };
	}

	return { ok: true, pending: true, data };
}

/* Write the clear-operation marker atomically. */
export function write_clear_marker(marker_path, state, storage_path) {
	return save_file(marker_path, {
		state: state,
		storage_path: storage_path
	});
}

/* Finish an interrupted clear operation. */
export function complete_pending_clear(marker_path, history_file,
				       restore_marker, dir) {
	let marker = read_clear_marker(marker_path);

	if (!marker.ok)
		return false;

	if (!marker.pending)
		return true;

	let data = marker.data;

	if (data.state == 'requested') {
		if (!save_file(history_file, {}))
			return false;

		if (!write_clear_marker(marker_path, 'ram-cleared',
					data.storage_path))
			return false;

		data.state = 'ram-cleared';
	}

	if (!data.storage_path) {
		if (!unlink(marker_path)) {
			warn(sprintf('Cannot remove clear marker %s: %s\n',
				marker_path, error()));
			return false;
		}

		return true;
	}

	/* Wait for the original configured storage path to become available. */
	if (!dir || dir != data.storage_path)
		return true;

	if (!save_file(dir + '/history.json', {})) {
		warn('Cannot complete history clear on persistent storage\n');
		return true;
	}

	if (writefile(restore_marker, dir) == null) {
		warn(sprintf('Cannot update restore marker: %s\n', error()));
		return true;
	}

	if (!unlink(marker_path)) {
		warn(sprintf('Cannot remove clear marker %s: %s\n',
			marker_path, error()));
		return true;
	}

	return true;
}
