'use strict';

import { clear_history } from 'wifihistory.clear-core';

function check(condition, message) {
	if (!condition) {
		warn('FAIL: ' + message + '\n');
		exit(1);
	}
}

const PATHS = {
	marker_name: 'wifihistory.clear-pending',
	clear_marker: '/etc/wifihistory.clear-pending',
	history_file: '/var/lib/wifihistory/history.json',
	restore_marker: '/var/run/wifihistory.restored',
	history_name: 'history.json'
};

function make_deps(options) {
	let files = {};
	let event_count = 0;
	let marker_write_count = 0;
	let storage_checked = false;
	let lock_closed = false;

	let deps = {
		acquire_lock: function(nonblocking) {
			event_count++;

			if (options.busy)
				return null;

			return {
				close: function() {
					lock_closed = true;
					event_count++;
				}
			};
		},

		lsdir: function(path) {
			event_count++;

			if (options.lsdir_fail)
				return null;

			return options.marker_exists ?
				[ PATHS.marker_name ] : [];
		},

		storage_status: function() {
			event_count++;
			storage_checked = true;
			return options.status || {
				path: null,
				active: false
			};
		},

		ensure_storage_dir: function() {
			event_count++;
			return !options.ensure_fail;
		},

		persistent_dir: function() {
			event_count++;
			return options.dir || null;
		},

		save_json_file: function(path, data) {
			event_count++;

			if (path == PATHS.clear_marker) {
				marker_write_count++;

				if (options.marker_write_fail ||
				    options.marker_write_fail_at == marker_write_count)
					return false;
			}

			files[path] = data;
			return true;
		},

		save_empty_file: function(path) {
			event_count++;

			if (options.ram_write_fail &&
			    path == PATHS.history_file)
				return false;

			if (options.usb_write_fail &&
			    path == options.dir + '/' + PATHS.history_name)
				return false;

			files[path] = {};
			return true;
		},

		unlink: function(path) {
			event_count++;

			if (options.unlink_fail)
				return false;

			delete files[path];
			return true;
		},

		writefile: function(path, data) {
			event_count++;

			if (options.restore_write_fail)
				return null;

			files[path] = data;
			return 1;
		},

		warn: function(message) {
			event_count++;
		},

		error: function() {
			return 'test error';
		}
	};

	return {
		deps: deps,
		files: files,
		event_count: function() { return event_count; },
		storage_checked: function() { return storage_checked; },
		lock_closed: function() {
			return lock_closed;
		}
	};
}

/* 1. RAM-only configuration. */
let env = make_deps({});
let result = clear_history(env.deps, PATHS);

check(result.result, 'RAM-only clear failed');
check(env.files[PATHS.history_file] != null,
	'RAM history file was not written');
check(env.files[PATHS.clear_marker] == null,
	'RAM-only clear marker was not removed');
check(env.lock_closed(), 'lock was not released after RAM-only clear');

/* 2. Persistent storage: both copies must be cleared. */
env = make_deps({
	status: { path: '/mnt/usb', active: true },
	dir: '/mnt/usb'
});

result = clear_history(env.deps, PATHS);

check(result.result, 'persistent clear failed');
check(env.files[PATHS.history_file] != null,
	'RAM history was not cleared');
check(env.files['/mnt/usb/history.json'] != null,
	'persistent history was not cleared');
check(env.files[PATHS.restore_marker] == '/mnt/usb',
	'restore marker was not updated');
check(env.files[PATHS.clear_marker] == null,
	'persistent clear marker was not removed');
check(env.lock_closed(), 'lock was not released after persistent clear');

/* 3. Busy lock: no storage operation may be attempted. */
env = make_deps({ busy: true });
result = clear_history(env.deps, PATHS);

check(!result.result && result.error == 'busy',
	'busy lock was not reported');
check(env.event_count() == 1,
	'operations continued despite busy lock');

/* 4. Existing pending marker: preserve history and stop. */
env = make_deps({ marker_exists: true });
result = clear_history(env.deps, PATHS);

check(!result.result && result.error == 'storage-clear-pending',
	'existing marker was not detected');
check(env.lock_closed(), 'lock was not released after marker detection');
check(!env.storage_checked(),
	'storage status was checked despite pending marker');

/* 5. Configured storage unavailable: do not clear RAM. */
env = make_deps({
	status: {
		path: '/mnt/usb',
		active: false,
		reason: 'not-mounted'
	}
});
result = clear_history(env.deps, PATHS);

check(!result.result && result.error == 'storage-unavailable',
	'unavailable storage was not reported');
check(result.reason == 'not-mounted',
	'storage failure reason was not propagated');
check(env.files[PATHS.history_file] == null,
	'RAM was cleared despite unavailable persistent storage');
check(env.lock_closed(), 'lock was not released after storage failure');

/* 6. USB write failure: retain marker for recovery. */
env = make_deps({
	status: { path: '/mnt/usb', active: true },
	dir: '/mnt/usb',
	usb_write_fail: true
});
result = clear_history(env.deps, PATHS);

check(!result.result && result.error == 'storage-clear-pending',
	'persistent write failure was not reported');
check(env.files[PATHS.history_file] != null,
	'RAM was not cleared before persistent write failure');
check(env.files[PATHS.clear_marker] != null,
	'clear marker was not retained after persistent write failure');
check(env.lock_closed(), 'lock was not released after persistent write failure');


/* 7. Failure to inspect /etc. */
env = make_deps({ lsdir_fail: true });
result = clear_history(env.deps, PATHS);
check(!result.result && result.error == 'marker-check-failed',
	'/etc inspection failure was not reported');
check(!env.storage_checked(), 'storage checked after /etc inspection failure');
check(env.lock_closed(), 'lock not released after /etc inspection failure');

/* 8. Failure to prepare persistent storage. */
env = make_deps({
	status: { path: '/mnt/usb', active: true },
	ensure_fail: true
});
result = clear_history(env.deps, PATHS);
check(!result.result && result.error == 'storage-unavailable',
	'storage directory preparation failure was not reported');
check(env.files[PATHS.clear_marker] == null,
	'marker written after storage directory preparation failed');
check(env.lock_closed(), 'lock not released after directory preparation failure');

/* 9. Missing persistent directory. */
env = make_deps({
	status: { path: '/mnt/usb', active: true },
	dir: null
});
result = clear_history(env.deps, PATHS);
check(!result.result && result.error == 'storage-unavailable',
	'missing persistent directory was not reported');
check(env.files[PATHS.clear_marker] == null,
	'marker written without a persistent directory');
check(env.lock_closed(), 'lock not released after missing persistent directory');

/* 10. First marker write failure. */
env = make_deps({ marker_write_fail_at: 1 });
result = clear_history(env.deps, PATHS);
check(!result.result && result.error == 'marker-write-failed',
	'initial marker write failure was not reported');
check(env.files[PATHS.history_file] == null,
	'RAM history changed after initial marker write failure');
check(env.lock_closed(), 'lock not released after initial marker write failure');

/* 11. RAM write failure. */
env = make_deps({ ram_write_fail: true });
result = clear_history(env.deps, PATHS);
check(!result.result && result.error == 'ram-write-failed',
	'RAM write failure was not reported');
check(env.files[PATHS.clear_marker] != null &&
      env.files[PATHS.clear_marker].state == 'requested',
	'requested marker not retained after RAM write failure');
check(env.lock_closed(), 'lock not released after RAM write failure');

/* 12. Second marker write failure. */
env = make_deps({ marker_write_fail_at: 2 });
result = clear_history(env.deps, PATHS);
check(!result.result && result.error == 'storage-clear-pending',
	'second marker write failure was not reported');
check(env.files[PATHS.history_file] != null,
	'RAM history not cleared before second marker write failure');
check(env.files[PATHS.clear_marker] != null &&
      env.files[PATHS.clear_marker].state == 'requested',
	'requested marker not retained after second marker write failure');
check(env.lock_closed(), 'lock not released after second marker write failure');

/* 13. Restore marker write failure. */
env = make_deps({
	status: { path: '/mnt/usb', active: true },
	dir: '/mnt/usb',
	restore_write_fail: true
});
result = clear_history(env.deps, PATHS);
check(!result.result && result.error == 'storage-clear-pending',
	'restore marker write failure was not reported');
check(env.files['/mnt/usb/history.json'] != null,
	'persistent history not cleared before restore marker failure');
check(env.files[PATHS.clear_marker] != null,
	'clear marker not retained after restore marker failure');
check(env.lock_closed(), 'lock not released after restore marker failure');

/* 14. RAM-only marker removal failure. */
env = make_deps({ unlink_fail: true });
result = clear_history(env.deps, PATHS);
check(!result.result && result.error == 'storage-clear-pending',
	'RAM-only marker removal failure was not reported');
check(env.files[PATHS.clear_marker] != null,
	'RAM-only marker not retained after removal failure');
check(env.lock_closed(), 'lock not released after RAM-only marker removal failure');

/* 15. Persistent marker removal failure. */
env = make_deps({
	status: { path: '/mnt/usb', active: true },
	dir: '/mnt/usb',
	unlink_fail: true
});
result = clear_history(env.deps, PATHS);
check(!result.result && result.error == 'storage-clear-pending',
	'persistent marker removal failure was not reported');
check(env.files[PATHS.clear_marker] != null,
	'persistent marker not retained after removal failure');
check(env.files[PATHS.restore_marker] == '/mnt/usb',
	'restore marker not written before clear marker removal');
check(env.lock_closed(), 'lock not released after persistent marker removal failure');

warn('PASS: all clear-core tests passed\n');
