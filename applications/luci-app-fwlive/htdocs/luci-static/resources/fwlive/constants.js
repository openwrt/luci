'use strict';
/* SPDX-License-Identifier: Apache-2.0 */
/* Copyright 2025-2026 Lucas Albers <lucas.b.albers@gmail.com> */
'require baseclass';

/**
 * Shared view constants for luci-app-fwlive.
 * LuCI modules must return baseclass.extend(...) — plain objects fail Class.isSubclass.
 */
return baseclass.extend({
	/* Keep in sync with Makefile PKG_VERSION. */
	APP_VERSION: '0.1.51',
	ROW_LIMIT_OPTIONS: [25, 50, 100, 250, 500, 1000, 2000],
	DEFAULT_ROW_LIMIT: 100,
	FETCH_MODE_OPTIONS: ['auto', 'manual'],
	MANUAL_FETCH_LINES_OPTIONS: [25, 50, 100, 250, 500, 1000, 2000],
	DEFAULT_FETCH_MODE: 'auto',
	DEFAULT_MANUAL_FETCH_LINES: 100,
	/* Row pass/deny tint: classic green/red default; accessible teal/orange */
	ROW_TINT_OPTIONS: ['off', 'classic', 'accessible'],
	DEFAULT_ROW_TINT: 'classic',
	FETCH_LINES_MAX: 2000 /* ubus poll / logd ring cap (~2000 lines ≈ typical ring) */,
	/* DOM budget: ~250 new/updated rows painted per second on typical LuCI routers */
	RENDER_CAP_PER_SEC: 250,
	/* Sustained 4x-throttled evidence keeps this cap within the frame/task budget. */
	WEAK_DEVICE_DISPLAY_ROW_CAP: 250,
	/* Layer 2 — measured client RTT → poll cadence (seconds). */
	POLL_CADENCE_FAST_S: 1,
	POLL_CADENCE_MID_S: 2,
	POLL_CADENCE_SLOW_S: 5,
	/* Three slow polls; keep empty-poll status quiet through adaptive cadence changes. */
	EMPTY_POLL_STALE_AFTER_MS: 15000,
	POLL_RTT_FAST_MS: 300,
	POLL_RTT_SLOW_MS: 1500,
	POLL_RTT_STREAK: 3,
	/* Rules-map retry backoff; attempts include the initial read, a reload starts fresh. */
	RULES_RETRY_BASE_MS: 5000,
	RULES_RETRY_MAX_DELAY_MS: 60000,
	RULES_RETRY_MAX_ATTEMPTS: 6,
	/* Addresses per fwlive.resolve call; must equal rpcd RESOLVE_MAX. */
	RESOLVE_BATCH_MAX: 32,
	RESOLVE_SHED_COOLDOWN_MS: 60000,
	FILTER_INPUT_DEBOUNCE_MS: 100,
	VIEW_MODES: ['simple', 'detailed'],
	COLUMN_SETS: {
		simple: ['action', 'time', 'iface', 'flow', 'proto', 'rule'],
		detailed: [
			'time',
			'action',
			'rule',
			'iface_in',
			'iface_out',
			'dir',
			'proto',
			'src',
			'sport',
			'dst',
			'dport',
			'flags',
			'len',
			'message'
		]
	}
});
