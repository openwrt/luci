#!/usr/bin/env ucode

'use strict';

import { readfile, writefile, rename, unlink, lsdir, error } from 'fs';
import {
	RAM_DIR, HISTORY_NAME, storage_status, persistent_dir,
	acquire_lock, ensure_storage_dir
} from 'wifihistory.storage';
import { clear_history } from 'wifihistory.clear-core';

const HISTORY_FILE = RAM_DIR + '/' + HISTORY_NAME;
const CLEAR_MARKER = '/etc/wifihistory.clear-pending';
const RESTORE_MARKER = '/var/run/wifihistory.restored';

function save_empty_file(path) {
	let tmp = path + '.tmp';

	if (writefile(tmp, '{}') == null) {
		warn(sprintf('Failed to write %s: %s\n', tmp, error()));
		return false;
	}

	if (!rename(tmp, path)) {
		warn(sprintf('Failed to rename %s: %s\n', tmp, error()));
		unlink(tmp);
		return false;
	}

	return true;
}

function save_json_file(path, data) {
	let tmp = path + '.tmp';

	if (writefile(tmp, sprintf('%J', data)) == null) {
		warn(sprintf('Failed to write %s: %s\n', tmp, error()));
		return false;
	}

	if (!rename(tmp, path)) {
		warn(sprintf('Failed to rename %s: %s\n', tmp, error()));
		unlink(tmp);
		return false;
	}

	return true;
}

const methods = {
	getHistory: {
		call: function() {
			let entries = lsdir(RAM_DIR);

			if (entries == null) {
				warn(sprintf('Cannot list history directory %s: %s\n',
					RAM_DIR, error()));
				return { error: 'history-read-failed' };
			}

			let exists = false;
			for (let entry in entries) {
				if (entry == HISTORY_NAME) {
					exists = true;
					break;
				}
			}

			if (!exists)
				return { history: {} };

			let content = readfile(HISTORY_FILE);
			if (content == null) {
				warn(sprintf('Cannot read history file %s: %s\n',
					HISTORY_FILE, error()));
				return { error: 'history-read-failed' };
			}

			try {
				let data = json(content);

				if (type(data) != 'object') {
					warn(sprintf('Invalid history format in %s\n',
						HISTORY_FILE));
					return { error: 'history-invalid-format' };
				}

				return { history: data };
			}
			catch (e) {
				warn(sprintf('Invalid JSON in %s\n', HISTORY_FILE));
				return { error: 'history-invalid-json' };
			}
		}
	},
	getStatus: {
		call: function() {
			return storage_status();
		}
	},

	clearHistory: {
		call: function() {
			return clear_history({
				acquire_lock: function(nonblocking) {
					return acquire_lock(nonblocking);
				},
				lsdir: function(path) {
					return lsdir(path);
				},
				storage_status: function() {
					return storage_status();
				},
				ensure_storage_dir: function() {
					return ensure_storage_dir();
				},
				persistent_dir: function() {
					return persistent_dir();
				},
				save_json_file: function(path, data) {
					return save_json_file(path, data);
				},
				save_empty_file: function(path) {
					return save_empty_file(path);
				},
				unlink: function(path) {
					return unlink(path);
				},
				writefile: function(path, data) {
					return writefile(path, data);
				},
				warn: function(message) {
					warn(message);
				},
				error: function() {
					return error();
				}
			}, {
				marker_name: 'wifihistory.clear-pending',
				clear_marker: CLEAR_MARKER,
				history_file: HISTORY_FILE,
				restore_marker: RESTORE_MARKER,
				history_name: HISTORY_NAME
			});
		}
	}

};

return { 'luci.wifihistory': methods };
