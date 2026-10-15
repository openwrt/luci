'use strict';
/* SPDX-License-Identifier: Apache-2.0 */
/* Copyright 2025-2026 Lucas Albers <lucas.b.albers@gmail.com> */

'require baseclass';

/* Own queued render intent and the token bucket; the view owns DOM work.
 * Adapters supply the epoch, paint callback, cost policy, clock and frame APIs.
 * Without a frame API, schedule() paints synchronously. */
function createScheduler(options) {
	const { getEpoch, render, renderCost, capacity, requestFrame, cancelFrame } = options;
	if (!Number.isFinite(capacity) || capacity <= 0)
		throw new TypeError('capacity must be a positive number');
	const now = options.now || Date.now;

	let pending = null;
	let nextForce = null;
	let frameId = null;
	let bucket = capacity;
	let bucketMs = null;
	let floodSuppressed = false;
	let lastRenderedRowCount = 0;
	let lastRenderedHeadId = '';
	let disposed = false;

	function schedule(force) {
		if (disposed) return;
		const reservation = nextForce;
		force = !!force || reservation !== null;
		const epoch = getEpoch();
		if (typeof requestFrame !== 'function') {
			nextForce = null;
			render(!!force);
			return;
		}

		if (pending) {
			/* Retain display changes (e.g. resolved names) even when a new epoch
			 * replaces the frame. The callback always reads current view state. */
			pending.force = pending.force || !!force;
			pending.epoch = epoch;
			if (reservation && !pending.reservation) pending.reservation = reservation;
			return;
		}

		pending = { epoch: epoch, force: !!force, reservation: reservation };
		frameId = requestFrame(function () {
			const request = pending;
			pending = null;
			frameId = null;
			if (disposed || request.epoch !== getEpoch()) return;

			/* Drop only the reservation this frame used. A newer forceNextRender
			 * after an unforced schedule must survive this callback. */
			if (nextForce === request.reservation) nextForce = null;
			/* A current request queued behind stale work gets its own frame. */
			if (epoch !== request.epoch) schedule(request.force);
			else render(request.force);
		});
	}

	/* A successful decision reserves tokens, but only markRendered commits
	 * row identity after the view has actually painted. Forced paints bypass
	 * the bucket without clearing an existing high-rate warning. */
	function shouldRender(rows, force, lastBatchNewIdCount) {
		if (disposed) return false;
		if (force) return true;

		const cost = renderCost({
			visibleRowCount: rows.length,
			visibleHeadId: rows.length ? rows[0].id : '',
			lastRenderedRowCount: lastRenderedRowCount,
			lastRenderedHeadId: lastRenderedHeadId,
			lastBatchNewIdCount: lastBatchNewIdCount
		});
		if (cost <= 0) {
			floodSuppressed = false;
			return false;
		}

		const timestamp = now();
		const elapsed = bucketMs === null ? 0 : Math.max(0, timestamp - bucketMs);
		bucketMs = timestamp;
		bucket = Math.min(capacity, bucket + (elapsed * capacity) / 1000);
		/* A single batch can cost more than one second's budget. Once the
		 * bucket is full, spend that full interval on one paint so a sustained
		 * flood cannot freeze the table until the user changes a control. */
		if (cost > bucket && bucket >= capacity) {
			bucket = 0;
			floodSuppressed = true;
			return true;
		}
		floodSuppressed = cost > bucket;
		if (floodSuppressed) return false;
		bucket -= cost;
		return true;
	}

	function markRendered(rows) {
		lastRenderedRowCount = rows.length;
		lastRenderedHeadId = rows.length ? rows[0].id : '';
	}

	function resetBudget() {
		bucket = capacity;
		bucketMs = now();
		floodSuppressed = false;
	}

	/* Reserve force for the next scheduled render. The caller can cancel its
	 * own unused reservation, never a queued frame or a newer reservation. */
	function forceNextRender() {
		const reservation = {};
		if (!disposed) nextForce = reservation;
		return function () {
			if (nextForce === reservation) nextForce = null;
		};
	}

	function dispose() {
		if (disposed) return;
		disposed = true;
		pending = null;
		nextForce = null;
		if (frameId !== null && typeof cancelFrame === 'function') cancelFrame(frameId);
		frameId = null;
	}

	return {
		schedule: schedule,
		shouldRender: shouldRender,
		markRendered: markRendered,
		resetBudget: resetBudget,
		forceNextRender: forceNextRender,
		isFloodSuppressed: function () {
			return floodSuppressed;
		},
		dispose: dispose
	};
}

return baseclass.extend({
	create: createScheduler
});
