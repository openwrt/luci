'use strict';
/* SPDX-License-Identifier: Apache-2.0 */
/* Copyright 2025-2026 Lucas Albers <lucas.b.albers@gmail.com> */

'require baseclass';

/* Pure render-policy decisions for the fwlive view. The module does not
 * mutate state, schedule work, inspect the DOM, or know how rows render. */

/**
 * @param {object} opts
 * @param {number} opts.rowLimit - User-selected stored-row limit.
 * @param {boolean} opts.weakDevice - Whether the weak-device cap is active.
 * @param {number} opts.weakDeviceDisplayRowCap - Maximum visible rows when capped.
 * @returns {number} Maximum rows to render.
 */
function displayRowCap(opts) {
	opts = opts || {};
	return opts.weakDevice ? Math.min(opts.rowLimit, opts.weakDeviceDisplayRowCap) : opts.rowLimit;
}

/**
 * Calculate the token cost for the next render.
 *
 * @param {object} opts
 * @param {number} opts.visibleRowCount - Number of candidate visible rows.
 * @param {*} opts.visibleHeadId - First candidate row identity.
 * @param {number} opts.lastRenderedRowCount - Count from the previous render.
 * @param {*} opts.lastRenderedHeadId - First row identity from the previous render.
 * @param {number} opts.lastBatchNewIdCount - Session-new IDs in the last batch.
 * @returns {number} Token cost for the next render.
 */
function renderCost(opts) {
	opts = opts || {};

	const count = opts.visibleRowCount || 0;
	const headId = count ? opts.visibleHeadId : '';
	const lastRenderedRowCount = opts.lastRenderedRowCount || 0;
	const lastRenderedHeadId = opts.lastRenderedHeadId || '';

	/* This cheap identity check intentionally does not compare full row content. */
	if (!count && !lastRenderedRowCount) return 0;
	if (count === lastRenderedRowCount && headId === lastRenderedHeadId) return 0;

	/* Count changes must stay cheap so Limit/filter/trim updates remain paintable. */
	if (count !== lastRenderedRowCount) return 1;
	return Math.max(1, opts.lastBatchNewIdCount || 1);
}

return baseclass.extend({
	displayRowCap: displayRowCap,
	renderCost: renderCost
});
