'use strict';

import {
	decode_mount_field,
	mountpoint_from_data
} from 'wifihistory.mounts';

function check(condition, message) {
	if (!condition) {
		warn('FAIL: ' + message + '\n');
		exit(1);
	}
}

/* 1. Decode escaped fields from /proc/mounts. */
check(decode_mount_field('/mnt/My\\040Disk') == '/mnt/My Disk',
	'\\040 was not decoded as a space');

check(decode_mount_field('/mnt/My\\011Disk') == '/mnt/My\tDisk',
	'\\011 was not decoded as a tab');

check(decode_mount_field('/mnt/My\\012Disk') == '/mnt/My\nDisk',
	'\\012 was not decoded as a newline');

check(decode_mount_field('/mnt/My\\134Disk') == '/mnt/My\\Disk',
	'\\134 was not decoded as a backslash');

/* 2. Select the longest matching mountpoint. */
let data =
	'/dev/sda1 /mnt/usb ext4 rw 0 0\n' +
	'/dev/sda2 /mnt/usb/data ext4 rw 0 0\n';

let mount = mountpoint_from_data(data, '/mnt/usb/data/history');

check(mount != null, 'nested mountpoint was not found');
check(mount.source == '/dev/sda2',
	'nested mountpoint did not take precedence');
check(mount.mountpoint == '/mnt/usb/data',
	'wrong nested mountpoint selected');
check(mount.fstype == 'ext4', 'filesystem type was not returned');

/* 3. Do not confuse sibling path prefixes. */
mount = mountpoint_from_data(
	'/dev/sda1 /mnt/usb ext4 rw 0 0\n',
	'/mnt/usb-backup/history'
);

check(mount == null,
	'/mnt/usb incorrectly matched /mnt/usb-backup');

/* 4. The root mount matches paths without a more specific mount. */
mount = mountpoint_from_data(
	'/dev/root / squashfs ro 0 0\n',
	'/etc/config/wifihistory'
);

check(mount != null, 'root mountpoint was not selected');
check(mount.mountpoint == '/', 'wrong root mountpoint selected');

/* 5. Ignore incomplete entries. */
mount = mountpoint_from_data(
	'/dev/sda1 /mnt/usb\n' +
	'/dev/sda2 /mnt/usb2 ext4 rw 0 0\n',
	'/mnt/usb2/history'
);

check(mount != null, 'valid entry after incomplete entry was ignored');
check(mount.source == '/dev/sda2',
	'incomplete entry was not ignored');

warn('PASS: all mount parser tests passed\n');
