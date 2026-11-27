'use strict';

import {
	readfile, writefile, rename, unlink,
	lsdir, dirname, basename, error
} from 'fs';

/* Read a JSON object without treating read errors as an empty file. */
export function load_file(path) {
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
export function save_file(path, data) {
	let tmp = path + '.tmp';

	if (writefile(tmp, sprintf('%J', data)) == null) {
		warn(sprintf('Failed to write %s: %s\n', tmp, error()));
		return false;
	}

	if (!rename(tmp, path)) {
		warn(sprintf('Failed to rename %s to %s: %s\n',
			tmp, path, error()));
		unlink(tmp);
		return false;
	}

	return true;
}
