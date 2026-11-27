'use strict';

/*
 * Complete the clear-history operation.
 *
 * All system operations are injected through deps so this module
 * can be tested without rpcd, UCI or actual persistent storage.
 */
export function clear_history(deps, paths) {
	let lock_fd = deps.acquire_lock(true);

	if (!lock_fd)
		return { result: false, error: 'busy' };

	function finish(result) {
		lock_fd.close();
		return result;
	}

	/*
	 * Fail closed if /etc cannot be inspected or an earlier
	 * clear operation is still pending.
	 */
	let etc_entries = deps.lsdir('/etc');

	if (etc_entries == null)
		return finish({
			result: false,
			error: 'marker-check-failed'
		});

	for (let entry in etc_entries) {
		if (entry == paths.marker_name)
			return finish({
				result: false,
				error: 'storage-clear-pending'
			});
	}

	let status = deps.storage_status();

	/*
	 * Do not clear RAM while configured persistent storage
	 * is unavailable, otherwise old USB data may return.
	 */
	if (status.path && !status.active)
		return finish({
			result: false,
			error: 'storage-unavailable',
			reason: status.reason
		});

	let dir = null;

	if (status.active) {
		if (!deps.ensure_storage_dir())
			return finish({
				result: false,
				error: 'storage-unavailable'
			});

		dir = deps.persistent_dir();

		if (!dir)
			return finish({
				result: false,
				error: 'storage-unavailable'
			});
	}

	/*
	 * Record the operation before changing either history copy.
	 */
	if (!deps.save_json_file(paths.clear_marker, {
		state: 'requested',
		storage_path: dir || ''
	}))
		return finish({
			result: false,
			error: 'marker-write-failed'
		});

	/*
	 * Clear RAM first. The marker makes this operation recoverable.
	 */
	if (!deps.save_empty_file(paths.history_file))
		return finish({
			result: false,
			error: 'ram-write-failed'
		});

	if (!deps.save_json_file(paths.clear_marker, {
		state: 'ram-cleared',
		storage_path: dir || ''
	}))
		return finish({
			result: false,
			error: 'storage-clear-pending'
		});

	/* RAM-only configuration: no persistent copy remains. */
	if (!dir) {
		if (!deps.unlink(paths.clear_marker)) {
			deps.warn(sprintf(
				'Cannot remove clear marker %s: %s\n',
				paths.clear_marker, deps.error()
			));

			return finish({
				result: false,
				error: 'storage-clear-pending'
			});
		}

		return finish({ result: true });
	}

	/* If USB write fails, keep the marker for background retry. */
	if (!deps.save_empty_file(dir + '/' + paths.history_name))
		return finish({
			result: false,
			error: 'storage-clear-pending'
		});

	if (deps.writefile(paths.restore_marker, dir) == null) {
		deps.warn(sprintf(
			'Cannot update restore marker: %s\n',
			deps.error()
		));

		return finish({
			result: false,
			error: 'storage-clear-pending'
		});
	}

	if (!deps.unlink(paths.clear_marker)) {
		deps.warn(sprintf(
			'Cannot remove clear marker %s: %s\n',
			paths.clear_marker, deps.error()
		));

		return finish({
			result: false,
			error: 'storage-clear-pending'
		});
	}

	return finish({ result: true });
}
