'use strict';

import { readfile, writefile, mkdir, rename } from 'fs';
import {
	read_clear_marker,
	complete_pending_clear
} from 'wifihistory.recovery';

const ROOT = ARGV[0];
const MARKER = ROOT + '/etc/clear-pending';
const RAM = ROOT + '/ram/history.json';
const RESTORE = ROOT + '/run/restored';
const USB = ROOT + '/usb';
const USB2 = ROOT + '/usb2';

function check(condition, message) {
	if (!condition) {
		warn('FAIL: ' + message + '\n');
		exit(1);
	}
}

function put(path, data) {
	check(writefile(path, sprintf('%J', data)) != null,
		'cannot write ' + path);
}

function empty_object(path) {
	let content = readfile(path);
	if (content == null)
		return false;

	try {
		let data = json(content);
		for (let key in data)
			return false;

		return type(data) == 'object';
	}
	catch (e) {
		return false;
	}
}

function marker_absent() {
	let result = read_clear_marker(MARKER);
	return result.ok && !result.pending;
}

/* 1. No marker: nothing to recover. */
let result = read_clear_marker(MARKER);
check(result.ok && !result.pending, 'missing marker is not treated as absent');
check(complete_pending_clear(MARKER, RAM, RESTORE, null),
	'no-marker recovery failed');

/* 2. requested: clear RAM first, then wait for the original USB path. */
put(RAM, { old: true });
put(USB + '/history.json', { old_persistent: true });
put(MARKER, {
	state: 'requested',
	storage_path: USB
});

check(complete_pending_clear(MARKER, RAM, RESTORE, null),
	'requested recovery failed');
check(empty_object(RAM), 'requested state did not clear RAM');

result = read_clear_marker(MARKER);
check(result.ok && result.pending &&
      result.data.state == 'ram-cleared',
	'requested marker was not advanced to ram-cleared');

check(!empty_object(USB + '/history.json'),
	'USB history was cleared before the configured path was available');

check(complete_pending_clear(MARKER, RAM, RESTORE, USB2),
	'recovery with a different storage path failed');
check(!empty_object(USB + '/history.json'),
	'recovery cleared the wrong storage path');

check(complete_pending_clear(MARKER, RAM, RESTORE, USB),
	'recovery on the original storage path failed');
check(empty_object(USB + '/history.json'),
	'persistent history was not cleared');
check(readfile(RESTORE) == USB,
	'restore marker was not updated');
check(marker_absent(), 'clear marker was not removed after completion');

/* 3. ram-cleared: resume without requiring another RAM clear. */
put(RAM, { should_remain: true });
put(USB2 + '/history.json', { old_persistent: true });
put(MARKER, {
	state: 'ram-cleared',
	storage_path: USB2
});

check(complete_pending_clear(MARKER, RAM, RESTORE, null),
	'ram-cleared recovery while storage is unavailable failed');
check(!empty_object(RAM), 'ram-cleared recovery unexpectedly changed RAM');

check(complete_pending_clear(MARKER, RAM, RESTORE, USB2),
	'ram-cleared recovery on available storage failed');
check(empty_object(USB2 + '/history.json'),
	'ram-cleared recovery did not clear persistent history');
check(marker_absent(), 'ram-cleared marker was not removed');

/* 4. RAM-only clear: complete without persistent storage. */
put(RAM, { old: true });
put(MARKER, {
	state: 'requested',
	storage_path: ''
});

check(complete_pending_clear(MARKER, RAM, RESTORE, null),
	'RAM-only recovery failed');
check(empty_object(RAM), 'RAM-only recovery did not clear RAM');
check(marker_absent(), 'RAM-only marker was not removed');

/* 5. Persistent write failure: keep the marker for a retry. */
const USBFAIL = ROOT + '/usb-fail';

check(mkdir(USBFAIL), 'cannot create usb-fail directory');

put(RAM, { old: true });
put(USBFAIL + '/history.json', { old_persistent: true });
put(MARKER, {
	state: 'requested',
	storage_path: USBFAIL
});

/* Block the atomic temporary-file write. */
check(mkdir(USBFAIL + '/history.json.tmp'),
	'cannot create persistent-write obstruction');

check(complete_pending_clear(MARKER, RAM, RESTORE, USBFAIL),
	'persistent write failure should remain recoverable');

result = read_clear_marker(MARKER);
check(result.ok && result.pending &&
      result.data.state == 'ram-cleared',
	'marker was not retained in ram-cleared state after write failure');

check(empty_object(RAM),
	'RAM was not cleared before persistent write failure');

/* Remove the obstruction and retry the pending persistent clear. */
check(rename(USBFAIL + '/history.json.tmp',
	     USBFAIL + '/history.json.tmp.blocked'),
	'cannot remove persistent-write obstruction');

check(complete_pending_clear(MARKER, RAM, RESTORE, USBFAIL),
	'retry after persistent write failure failed');
check(empty_object(USBFAIL + '/history.json'),
	'persistent history was not cleared on retry');
check(readfile(RESTORE) == USBFAIL,
	'restore marker was not updated after retry');
check(marker_absent(),
	'clear marker was not removed after successful retry');

/* 6. Invalid marker: fail closed and preserve history. */
put(RAM, { must_survive: true });
put(MARKER, {
	state: 'invalid-state',
	storage_path: USB
});

check(!complete_pending_clear(MARKER, RAM, RESTORE, USB),
	'invalid marker was accepted');
check(!empty_object(RAM), 'invalid marker caused RAM history to be cleared');

result = read_clear_marker(MARKER);
check(!result.ok && result.pending,
	'invalid marker did not block storage operations');

warn('PASS: all recovery tests passed\n');
