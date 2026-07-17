// SPDX-License-Identifier: Apache-2.0

export function lstat(path) {
	global.TEST_LSTAT_PATH = path;

	if (!global.TEST_LOCK_EXISTS)
		return null;

	return {
		type: global.TEST_LOCK_TYPE,
		uid: global.TEST_LOCK_UID,
		nlink: global.TEST_LOCK_NLINK,
		mode: global.TEST_LOCK_MODE
	};
};

export function open(path, mode, permissions) {
	global.TEST_OPEN = { path, mode, permissions };

	if (global.TEST_LOCK_OPEN_FAIL)
		return null;

	if (!global.TEST_LOCK_EXISTS) {
		global.TEST_LOCK_EXISTS = true;
		global.TEST_LOCK_MODE = permissions;
	}

	return {
		lock: function(flags) {
			global.TEST_LOCK_FLAGS = flags;
			return !global.TEST_LOCK_BUSY;
		},

		close: function() {
			global.TEST_LOCK_CLOSED = true;
			return true;
		}
	};
};

export function chmod(path, mode) {
	global.TEST_CHMOD = { path, mode };

	if (global.TEST_LOCK_CHMOD_FAIL)
		return null;

	global.TEST_LOCK_MODE = mode;
	return true;
};
