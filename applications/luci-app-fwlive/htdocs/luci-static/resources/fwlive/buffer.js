'use strict';
'require baseclass';

/**
 * Ring-buffer helpers for luci-app-fwlive poll ingest.
 * LuCI modules must return baseclass.extend(...) — plain objects fail Class.isSubclass.
 *
 * While paused, ingest grows up to fetchLinesMax. Live mode caps at rowLimit.
 * On resume, merge (do not replace) so pause-accumulated rows survive the first
 * live poll — see issue #43 pause→resume data loss.
 */

function ingestCap(paused, rowLimit, fetchLinesMax) {
	return paused ? fetchLinesMax : rowLimit;
}

function mergeById(entries, normalized, cap) {
	if (!normalized || !normalized.length) {
		if (!entries || !entries.length)
			return [];
		return entries.slice(-cap);
	}

	const byId = {};
	let i;
	if (entries) {
		for (i = 0; i < entries.length; i++)
			byId[entries[i].id] = entries[i];
	}
	for (i = 0; i < normalized.length; i++)
		byId[normalized[i].id] = normalized[i];

	const merged = Object.keys(byId).map(function(id) { return byId[id]; });
	merged.sort(function(a, b) {
		const ta = a.timestamp || 0;
		const tb = b.timestamp || 0;
		if (ta !== tb)
			return ta - tb;
		return (a.log_id || 0) - (b.log_id || 0);
	});
	return merged.slice(-cap);
}

/**
 * Apply a poll batch onto the current buffer.
 *
 * @param {object[]} entries - current buffer (oldest-first)
 * @param {object[]} normalized - newly polled rows (oldest-first)
 * @param {{ paused: boolean, resumeMerge: boolean, rowLimit: number, fetchLinesMax: number }} opts
 * @returns {object[]} next buffer
 */
function applyFetchedEntries(entries, normalized, opts) {
	const paused = !!(opts && opts.paused);
	const resumeMerge = !!(opts && opts.resumeMerge);
	const rowLimit = (opts && opts.rowLimit) || 0;
	const fetchLinesMax = (opts && opts.fetchLinesMax) || rowLimit;
	const cap = ingestCap(paused, rowLimit, fetchLinesMax);
	const merge = paused || resumeMerge;

	let next;
	if (merge)
		next = mergeById(entries, normalized, cap);
	else
		next = (normalized || []).slice(-cap);

	if (!paused && next.length > rowLimit)
		next = next.slice(-rowLimit);

	return next;
}

return baseclass.extend({
	ingestCap: ingestCap,
	mergeById: mergeById,
	applyFetchedEntries: applyFetchedEntries
});
