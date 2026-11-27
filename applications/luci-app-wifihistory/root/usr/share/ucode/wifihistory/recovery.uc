'use strict';

import { writefile, unlink, error } from 'fs';
import { load_file, save_file } from 'wifihistory.json-file';

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
				       restore_marker, dir, configured_path) {
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

	/* A changed or cleared configuration abandons the old USB target.
	 * RAM has already been cleared, so the marker can now be removed. */
	if (!data.storage_path || configured_path != data.storage_path) {
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
