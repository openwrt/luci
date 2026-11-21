'use strict';

import {
	readfile, realpath, basename, dirname,
	open, stat, mkdir, error
} from 'fs';
import { cursor } from 'uci';
import {
	storage_status as core_storage_status,
	ensure_storage_dir as core_ensure_storage_dir,
	persistent_dir as core_persistent_dir,
	save_interval as core_save_interval
} from 'wifihistory.storage-core';

export const RAM_DIR = '/var/lib/wifihistory';
export const HISTORY_NAME = 'history.json';
export const LOCK_FILE = '/var/lock/wifihistory.lock';

function uci_get(option) {
	return cursor().get('wifihistory', 'config', option);
}

function is_usb_device(source) {
	let device = realpath(source);

	if (!device || substr(device, 0, 5) != '/dev/')
		return false;

	let name = basename(device);
	let sysfs = realpath('/sys/class/block/' + name);

	if (!sysfs)
		return false;

	for (let component in split(sysfs, '/')) {
		if (substr(component, 0, 3) == 'usb' &&
		    int(substr(component, 3)) > 0)
			return true;
	}

	return false;
}

const storage_deps = {
	get_config: function(option) {
		return uci_get(option);
	},

	read_mounts: function() {
		return readfile('/proc/mounts') || '';
	},

	is_usb_device: function(source) {
		return is_usb_device(source);
	},

	realpath: function(path) {
		return realpath(path);
	},

	stat: function(path) {
		return stat(path);
	},

	dirname: function(path) {
		return dirname(path);
	},

	mkdir: function(path) {
		return mkdir(path);
	},

	warn: function(message) {
		warn(message);
	},

	error: function() {
		return error();
	}
};

export function storage_status() {
	return core_storage_status(storage_deps);
}

export function ensure_storage_dir() {
	return core_ensure_storage_dir(storage_deps);
}

export function persistent_dir() {
	return core_persistent_dir(storage_deps);
}

export function acquire_lock(nonblocking) {
	let fd = open(LOCK_FILE, 'a');

	if (!fd)
		return null;

	if (!fd.lock(nonblocking ? 'xn' : 'x')) {
		fd.close();
		return null;
	}

	return fd;
}

export function save_interval() {
	return core_save_interval(storage_deps);
}
