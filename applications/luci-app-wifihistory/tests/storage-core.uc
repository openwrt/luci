'use strict';

import {
	storage_status,
	ensure_storage_dir,
	persistent_dir,
	save_interval
} from 'wifihistory.storage-core';

let passed = 0;
let failed = 0;

function assert_equal(name, actual, expected) {
	if (actual != expected) {
		printf('FAIL: %s (expected %J, got %J)\n',
			name, expected, actual);
		failed++;
		return;
	}

	printf('PASS: %s\n', name);
	passed++;
}

function make_deps(config, options) {
	options = options || {};

	let files = options.files || {};
	let dirs = options.dirs || {};
	let warnings = [];

	return {
		get_config: function(key) {
			return config[key];
		},

		read_mounts: function() {
			return options.mounts || '';
		},

		is_usb_device: function(source) {
			return source == '/dev/sda1';
		},

		realpath: function(path) {
			let paths = options.realpaths || {};

			return paths[path] || path;
		},

		stat: function(path) {
			if (files[path])
				return { type: 'file' };

			if (dirs[path])
				return { type: 'directory' };

			return null;
		},

		dirname: function(path) {
			let pos = rindex(path, '/');

			return pos > 0 ? substr(path, 0, pos) : '/';
		},

		mkdir: function(path) {
			if (options.mkdir_fails ||
			    options.mkdir_fail_path == path)
				return false;

			dirs[path] = true;
			return true;
		},

		warn: function(message) {
			push(warnings, message);
		},

		error: function() {
			return 'simulated error';
		},

		get_warnings: function() {
			return warnings;
		}
	};
}

const USB_MOUNTS =
	'/dev/sda1 /mnt/usb ext4 rw,relatime 0 0\n';

let deps = make_deps({
	storage_path: '/mnt/usb/wifihistory'
}, {
	mounts: USB_MOUNTS,
	dirs: {
		'/mnt/usb': true
	}
});

let status = storage_status(deps);
assert_equal('USB storage is active',
	status.active, true);
assert_equal('USB storage reason',
	status.reason, 'ok');
assert_equal('USB storage path',
	status.path, '/mnt/usb/wifihistory');

assert_equal('persistent_dir returns active path',
	persistent_dir(deps), '/mnt/usb/wifihistory');

assert_equal('unset storage path',
	storage_status(make_deps({})).reason, 'unset');

assert_equal('root storage path is invalid',
	storage_status(make_deps({
		storage_path: '/'
	})).reason, 'invalid');

assert_equal('relative storage path is invalid',
	storage_status(make_deps({
		storage_path: 'mnt/usb/data'
	})).reason, 'invalid');

assert_equal('dot component is invalid',
	storage_status(make_deps({
		storage_path: '/mnt/usb/../etc'
	})).reason, 'invalid');

assert_equal('missing mount is not mounted',
	storage_status(make_deps({
		storage_path: '/mnt/usb/data'
	})).reason, 'not-mounted');

assert_equal('non-USB mount is rejected',
	storage_status(make_deps({
		storage_path: '/mnt/disk/data'
	}, {
		mounts: '/dev/mmcblk0p1 /mnt/disk ext4 rw 0 0\n'
	})).reason, 'not-usb');

assert_equal('root filesystem mount is rejected',
	storage_status(make_deps({
		storage_path: '/data'
	}, {
		mounts: '/dev/sda1 / ext4 rw 0 0\n'
	})).reason, 'not-mounted');

assert_equal('existing regular file is rejected',
	storage_status(make_deps({
		storage_path: '/mnt/usb/history'
	}, {
		mounts: USB_MOUNTS,
		files: {
			'/mnt/usb/history': true
		}
	})).reason, 'invalid');

assert_equal('canonical path outside mount is rejected',
	storage_status(make_deps({
		storage_path: '/mnt/usb/link'
	}, {
		mounts: USB_MOUNTS,
		dirs: {
			'/mnt/usb/link': true
		},
		realpaths: {
			'/mnt/usb/link': '/etc'
		}
	})).reason, 'invalid');

deps = make_deps({
	storage_path: '/mnt/usb/new'
}, {
	mounts: USB_MOUNTS,
	dirs: {
		'/mnt/usb': true
	}
});

assert_equal('ensure_storage_dir creates directory',
	ensure_storage_dir(deps), true);

assert_equal('created directory is present',
	deps.stat('/mnt/usb/new').type, 'directory');

deps = make_deps({
	storage_path: '/mnt/usb/fail'
}, {
	mounts: USB_MOUNTS,
	dirs: {
		'/mnt/usb': true
	},
	mkdir_fails: true
});

assert_equal('mkdir failure is reported',
	ensure_storage_dir(deps), false);

assert_equal('mkdir failure produces warning',
	length(deps.get_warnings()) > 0, true);


deps = make_deps({
	storage_path: '/mnt/usb/archive/2026/wifihistory'
}, {
	mounts: USB_MOUNTS,
	dirs: {
		'/mnt/usb': true
	}
});

assert_equal('ensure_storage_dir creates multiple nested directories',
	ensure_storage_dir(deps), true);
assert_equal('first nested directory is created',
	deps.stat('/mnt/usb/archive').type, 'directory');
assert_equal('second nested directory is created',
	deps.stat('/mnt/usb/archive/2026').type, 'directory');
assert_equal('final nested directory is created',
	deps.stat('/mnt/usb/archive/2026/wifihistory').type, 'directory');

deps = make_deps({
	storage_path: '/mnt/usb/archive/2026/wifihistory'
}, {
	mounts: USB_MOUNTS,
	dirs: {
		'/mnt/usb': true
	},
	mkdir_fail_path: '/mnt/usb/archive/2026'
});

assert_equal('intermediate mkdir failure is reported',
	ensure_storage_dir(deps), false);
assert_equal('intermediate mkdir failure produces warning',
	length(deps.get_warnings()) > 0, true);

deps = make_deps({
	storage_path: '/mnt/usb/link/wifihistory'
}, {
	mounts: USB_MOUNTS,
	dirs: {
		'/mnt/usb': true,
		'/mnt/usb/link': true
	},
	realpaths: {
		'/mnt/usb/link': '/etc'
	}
});

assert_equal('symlink in missing path pointing outside USB is rejected',
	storage_status(deps).reason, 'invalid');
assert_equal('ensure_storage_dir rejects symlink outside USB',
	ensure_storage_dir(deps), false);

deps = make_deps({
	storage_path: '/mnt/usb/data/history'
}, {
	mounts: USB_MOUNTS +
		'/dev/mmcblk0p1 /mnt/usb/data ext4 rw 0 0\n',
	dirs: {
		'/mnt/usb': true,
		'/mnt/usb/data': true
	}
});

assert_equal('nested non-USB mount is rejected',
	storage_status(deps).reason, 'not-usb');

assert_equal('default save interval',
	save_interval(make_deps({})), 300);

assert_equal('configured save interval',
	save_interval(make_deps({
		save_interval: '120'
	})), 120);

assert_equal('too-small save interval uses default',
	save_interval(make_deps({
		save_interval: '10'
	})), 300);

printf('\nStorage-core tests: %d passed, %d failed\n',
	passed, failed);

exit(failed ? 1 : 0);
