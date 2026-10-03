'use strict';
/* SPDX-License-Identifier: Apache-2.0 */
/* Copyright 2025-2026 Lucas Albers <lucas.b.albers@gmail.com> */
/*
 * LuCI Firewall Live View — client-side view (view.extend + ubus fwlive.poll).
 * UI interaction patterns inspired by OPNsense Live View; original implementation
 * for OpenWrt (Apache-2.0).
 */
'require view';
'require poll';
'require rpc';
'require fwlive.log as log';
'require fwlive.constants as constants';
'require fwlive.css as css';
'require fwlive.tint as tint';
'require fwlive.chips as chips';
'require fwlive.logging as logging';
'require fwlive.table as table';
'require fwlive.buffer as buffer';
'require fwlive.hostname as hostname';
'require fwlive.proto as proto';
'require fwlive.poll-coordinator as pollCoordinator';
'require fwlive.render-policy as renderPolicy';
'require fwlive.render-scheduler as renderScheduler';

/* Poll error codes that only a reinstall fixes; retrying cannot help. */
const INSTALL_POLL_ERRORS = ['jsonfilter_missing', 'classifier_missing'];

const callFwlivePoll = rpc.declare({
	object: 'fwlive',
	method: 'poll',
	params: ['addresses']
	/* Full reply object kept so reply.error reaches fetchEntries. */
});

const callFwliveRules = rpc.declare({
	object: 'fwlive',
	method: 'rules'
});

const callFwliveResolve = rpc.declare({
	object: 'fwlive',
	method: 'resolve',
	params: ['addresses']
	/* Full reply kept so disabled:"load" reaches the view. */
});

const callFwliveLoggingStatus = rpc.declare({
	object: 'fwlive',
	method: 'logging_status',
	expect: {
		'': {
			wan_zone: null,
			wan_zone_candidates: [],
			wan_log: false,
			wan_log_limit: null,
			nf_log_ipv4: false,
			nf_log_ipv6: false,
			ready: false,
			weak_device: false,
			blockers: [],
			warnings: []
		}
	}
});

const callFwliveEnableLogging = rpc.declare({
	object: 'fwlive',
	method: 'enable_wan_logging',
	expect: { '': { ok: false, changed: false, wan_zone: null, wan_zone_candidates: [] } }
});

const callFwliveDisableLogging = rpc.declare({
	object: 'fwlive',
	method: 'disable_wan_logging',
	expect: { '': { ok: false, changed: false, wan_zone: null, wan_zone_candidates: [] } }
});

function storedValue(key, fallback) {
	try {
		const v = localStorage.getItem(key);
		return v === null ? fallback : v;
	} catch (_e) {
		return fallback;
	}
}

function storeValue(key, value) {
	try {
		localStorage.setItem(key, value);
	} catch (_e) {
		/* private mode / no storage */
	}
}

function optionNodes(pairs) {
	const opts = [];
	for (let i = 0; i < pairs.length; i++)
		opts.push(E('option', { 'value': pairs[i][0] }, [pairs[i][1]]));
	return opts;
}

function expansionButtonRowId(button) {
	if (
		!button ||
		!button.classList ||
		!button.classList.contains('fwlive-row-expand') ||
		button._fwliveRowId == null
	)
		return null;

	return String(button._fwliveRowId);
}

function restoreExpansionFocus(body, rowId, previousFocus) {
	if (!body || typeof body.querySelectorAll !== 'function' || rowId == null) return false;

	const buttons = body.querySelectorAll('button.fwlive-row-expand');
	const activeElement = typeof document !== 'undefined' ? document.activeElement : null;
	for (let i = 0; i < buttons.length; i++) {
		const button = buttons[i];
		if (String(button._fwliveRowId) !== String(rowId)) continue;
		if (
			(button !== previousFocus || activeElement !== button) &&
			typeof button.focus === 'function'
		)
			button.focus();
		return true;
	}
	return false;
}

function isIpv4Address(addr) {
	if (addr.indexOf('.') === -1) return false;

	const octets = addr.split('.');
	if (octets.length !== 4) return false;
	for (let i = 0; i < octets.length; i++) {
		if (!/^\d{1,3}$/.test(octets[i]) || Number(octets[i]) > 255) return false;
	}
	return true;
}

return view.extend({
	rowLimit: constants.DEFAULT_ROW_LIMIT,
	fetchMode: constants.DEFAULT_FETCH_MODE,
	manualFetchLines: constants.DEFAULT_MANUAL_FETCH_LINES,
	manualFetchLinesExplicit: false,
	rpcPreferencesResolved: false,
	entries: [],
	filteredRowsCache: null,
	sessionSeen: null,
	pauseBufferLoading: false,
	/* Freezes row rendering while polling, health, and cadence updates continue. */
	tablePaused: false,
	/* One-shot: first live poll after unpause merges instead of replacing. */
	resumeMerge: false,
	pollCoordinator: null,
	renderScheduler: null,
	pagehideHandler: null,
	/* Terminal after a non-persisted pagehide; late startup RPCs must not paint. */
	viewDisposed: false,
	/* Layer 2 — visibility / RTT cadence / shed surfacing. */
	rttStreakKind: null,
	rttStreakCount: 0,
	serverAdaptive: undefined,
	serverTruncated: 0,
	serverShed: null,
	lastPollRequestedLines: null,
	lastPollEffectiveLimit: null,
	lastPollReturnedMessages: null,
	fillingBuffer: false,
	weakDevice: false,
	degradedSampling: false,
	/* Layer 2 summary fallback — rows remain available behind an explicit toggle. */
	summaryMode: false,
	summaryRowsShown: false,
	summaryData: null,
	resolveLoadShed: false,
	resolveShedUntil: 0,
	resolveErrorUntil: 0,
	filterInputTimer: null,
	messageLayout: 'wrap',
	/* Session-new IDs from the last applied batch; this is not buffer growth. */
	lastBatchNewIdCount: 0,
	/* Monotonic time for age hints after successful empty poll batches. */
	lastNonEmptyBatchAt: null,
	lastSuccessfulBatchEmpty: false,
	showHostnames: false,
	rowTint: constants.DEFAULT_ROW_TINT,
	/* Last non-off palette so toggling tint back on restores Classic/Accessible. */
	rowTintPalette: 'classic',
	hostnameCache: null,
	hostnameFailed: null,
	resolveInFlight: false,
	resolveGeneration: 0,
	/* Track hostname paints queued or deferred until a visible forced paint. */
	resolvePaintPending: false,
	lastPollError: false,
	lastPollErrorCode: null,
	lastRulesError: null,
	rulesMapTruncated: false,
	rulesMapLoaded: false,
	rulesRetryAttempt: 0,
	nextRulesRetryAt: 0,
	followLive: true,
	rulesMap: {},
	firewallBackend: 'nft',
	viewMode: 'simple',
	expandedRowId: null,
	loggingStatus: null,
	/* Invalidates status reads started before a newer toggle or refresh. */
	loggingStatusReadGeneration: 0,
	loggingBusy: false,
	loggingNotice: '',
	loggingNoticeFail: false,
	_loggingNoticeFromToggle: false,
	/* Session-only dismiss of first-run consent (Not now without checkbox). */
	consentDismissedSession: false,
	_loggingToolbarSig: '',
	_loggingEmptySig: '',
	_filterChipCallbacks: null,
	tintFallbackActive: false,
	tintProbeDone: false,

	FILTER_CHIP_FIELDS: [
		{ key: 'q', label: 'search' },
		{ key: 'action', label: 'action' },
		{ key: 'interface', label: 'iface' },
		{ key: 'proto', label: 'proto' },
		{ key: 'src', label: 'src' },
		{ key: 'dst', label: 'dst' },
		{ key: 'sport', label: 'sport' },
		{ key: 'dport', label: 'dport' }
	],

	readFilters() {
		const val = (id) => {
			const el = document.getElementById(id);
			return el ? el.value || '' : '';
		};
		return {
			q: val('fwlive-q').trim(),
			action: val('fwlive-action'),
			interface: val('fwlive-interface'),
			proto: proto.readProtoFilter(),
			src: val('fwlive-src').trim(),
			dst: val('fwlive-dst').trim(),
			sport: val('fwlive-sport').trim(),
			dport: val('fwlive-dport').trim()
		};
	},

	updateHash(filters) {
		const parts = Object.keys(filters)
			.filter((k) => filters[k] && log.parseFilterValue(filters[k]).value)
			.map((k) => '%s=%s'.format(encodeURIComponent(k), encodeURIComponent(filters[k])));
		if (this.rowLimit !== constants.DEFAULT_ROW_LIMIT)
			parts.push('limit=%s'.format(encodeURIComponent(this.rowLimit)));
		if (this.fetchMode === 'manual') {
			parts.push('poll=manual');
			parts.push('maxraw=%s'.format(encodeURIComponent(this.manualFetchLines)));
		}
		if (this.viewMode === 'detailed') parts.push('view=detailed');
		history.replaceState(history.state, '', '#' + parts.join('&'));
	},

	hashEntries() {
		if (!location.hash || location.hash.length < 2) return [];

		const entries = location.hash.substring(1).split('&');
		const result = [];
		for (let i = 0; i < entries.length; i++) {
			const separator = entries[i].indexOf('=');
			if (separator === -1) continue;
			let key;
			let val;
			try {
				key = decodeURIComponent(entries[i].substring(0, separator));
				val = decodeURIComponent(entries[i].substring(separator + 1));
			} catch (_e) {
				continue;
			}
			result.push({ key: key, val: val });
		}
		return result;
	},

	readFetchMode() {
		const v = storedValue('fwlive-poll-mode', constants.DEFAULT_FETCH_MODE);
		return constants.FETCH_MODE_OPTIONS.indexOf(v) >= 0 ? v : constants.DEFAULT_FETCH_MODE;
	},

	saveFetchMode() {
		storeValue('fwlive-poll-mode', this.fetchMode);
	},

	readManualFetchLines() {
		const raw = storedValue('fwlive-manual-lines', '');
		const n = Number(raw);
		return String(n) === raw && constants.MANUAL_FETCH_LINES_OPTIONS.indexOf(n) >= 0 ? n : null;
	},

	saveManualFetchLines() {
		storeValue('fwlive-manual-lines', String(this.manualFetchLines));
	},

	autoFetchLines() {
		return Math.min(Math.max(this.rowLimit * 4, 100), constants.FETCH_LINES_MAX);
	},

	snapManualFetchLines(lines) {
		const options = constants.MANUAL_FETCH_LINES_OPTIONS;
		let snapped = options[0];
		for (let i = 0; i < options.length; i++) {
			if (options[i] > lines) break;
			snapped = options[i];
		}
		return snapped;
	},

	resolveRpcPreferences() {
		if (this.rpcPreferencesResolved) return;

		this.applyRowLimit(this.readRowLimit());
		this.fetchMode = this.readFetchMode();
		const storedManual = this.readManualFetchLines();
		this.manualFetchLinesExplicit = storedManual !== null;
		this.manualFetchLines =
			storedManual === null ? this.snapManualFetchLines(this.autoFetchLines()) : storedManual;

		let hashLimit = null;
		let hashMode = null;
		let hashManual = null;
		const entries = this.hashEntries();
		for (let i = 0; i < entries.length; i++) {
			const key = entries[i].key;
			const val = entries[i].val;
			if (key === 'limit') {
				const n = Number(val);
				if (String(n) === val && constants.ROW_LIMIT_OPTIONS.indexOf(n) >= 0) hashLimit = n;
				continue;
			}
			if (key === 'poll') {
				if (constants.FETCH_MODE_OPTIONS.indexOf(val) >= 0) hashMode = val;
				continue;
			}
			if (key === 'maxraw') {
				const n = Number(val);
				if (String(n) === val && constants.MANUAL_FETCH_LINES_OPTIONS.indexOf(n) >= 0)
					hashManual = n;
			}
		}

		if (hashLimit !== null) {
			this.applyRowLimit(hashLimit);
			this.saveRowLimit();
		}
		if (hashMode !== null) {
			this.fetchMode = hashMode;
			this.saveFetchMode();
		}
		if (hashManual !== null && this.fetchMode === 'manual') {
			this.manualFetchLines = hashManual;
			this.manualFetchLinesExplicit = true;
			this.saveManualFetchLines();
		}
		if (storedManual === null && !(hashManual !== null && this.fetchMode === 'manual')) {
			this.manualFetchLines = this.snapManualFetchLines(this.autoFetchLines());
		}

		this.rpcPreferencesResolved = true;
	},

	requestedFetchLines() {
		this.resolveRpcPreferences();
		if (this.tablePaused)
			return this.fetchMode === 'manual' ? this.manualFetchLines : constants.FETCH_LINES_MAX;
		return this.fetchMode === 'manual' ? this.manualFetchLines : this.autoFetchLines();
	},

	updateFillingState(beforeLength, reply, requestedLines) {
		if (!this.tablePaused || this.resumeMerge) {
			this.fillingBuffer = false;
			return;
		}

		const cap = this.ingestCap();
		const grew = this.entries.length > beforeLength;
		if (this.entries.length >= cap || !grew) {
			this.fillingBuffer = false;
			return;
		}

		const rawCount =
			reply &&
			typeof reply.messages_received === 'number' &&
			isFinite(reply.messages_received) &&
			Math.floor(reply.messages_received) === reply.messages_received &&
			reply.messages_received >= 0
				? reply.messages_received
				: null;
		const effective =
			this.lastPollEffectiveLimit !== null ? this.lastPollEffectiveLimit : requestedLines;
		const shortRead = rawCount !== null && rawCount < effective;
		this.fillingBuffer = !shortRead && (rawCount === null || rawCount >= effective || grew);
	},

	hashFilterKeyAllowed(key) {
		const fields = this.FILTER_CHIP_FIELDS;
		for (let i = 0; i < fields.length; i++) {
			if (fields[i].key === key) return true;
		}
		return false;
	},

	applyHash() {
		this.resolveRpcPreferences();

		const entries = this.hashEntries();
		for (let i = 0; i < entries.length; i++) {
			const key = entries[i].key;
			const val = entries[i].val;
			if (key === 'limit' || key === 'poll' || key === 'maxraw') continue;
			if (key === 'fetch-mode' || key === 'row-tint') continue;
			if (key === 'view') {
				if (val === 'advanced' || val === 'detailed') this.viewMode = 'detailed';
				else if (val === 'simple') this.viewMode = 'simple';
				continue;
			}
			if (!this.hashFilterKeyAllowed(key)) continue;
			this.setFilterFieldValue(key, val);
		}
	},

	readViewMode() {
		const v = storedValue('fwlive-view-mode', null);
		if (v === 'advanced' || v === 'detailed') return 'detailed';
		if (v === 'simple') return 'simple';
		return 'simple';
	},

	saveViewMode() {
		storeValue('fwlive-view-mode', this.viewMode);
	},

	readShowHostnames() {
		return storedValue('fwlive-show-hostnames', '') === '1';
	},

	saveShowHostnames() {
		storeValue('fwlive-show-hostnames', this.showHostnames ? '1' : '0');
	},

	readRowTint() {
		const v = storedValue('fwlive-row-tint', null);
		if (v === null) return constants.DEFAULT_ROW_TINT;
		/* Migrate pre-mode checkbox storage. */
		if (v === '1' || v === 'true') return 'classic';
		if (v === '0' || v === 'false') return 'off';
		if (constants.ROW_TINT_OPTIONS.indexOf(v) >= 0) return v;
		return constants.DEFAULT_ROW_TINT;
	},

	readRowTintPalette() {
		const v = storedValue('fwlive-row-tint-palette', null);
		if (v === 'accessible') return 'accessible';
		if (v === 'classic') return 'classic';
		/* Migrate an enabled legacy mode into the separate palette key. */
		return this.readRowTint() === 'accessible' ? 'accessible' : 'classic';
	},

	saveRowTint() {
		storeValue('fwlive-row-tint', this.rowTint);
	},

	saveRowTintPalette() {
		storeValue('fwlive-row-tint-palette', this.rowTintPalette);
	},

	rowTintPaletteOptions() {
		return optionNodes([
			['classic', _('Classic (green/red)')],
			['accessible', _('Accessible (teal/orange)')]
		]);
	},

	rowTintEnabled() {
		return this.rowTint === 'classic' || this.rowTint === 'accessible';
	},

	applyRowTintMode() {
		const map = document.querySelector('.fwlive-map');
		if (!map) return;

		map.setAttribute('data-row-tint', this.rowTint);
		if (!this.rowTintEnabled() && this.tintFallbackActive) this.clearTintFallback(map);
	},

	onRowTintEnabledChange(ev) {
		const on = !!(ev && ev.target && ev.target.checked);
		if (on) {
			const pal = this.rowTintPalette === 'accessible' ? 'accessible' : 'classic';
			this.rowTintPalette = pal;
			this.rowTint = pal;
		} else {
			if (this.rowTintEnabled()) this.rowTintPalette = this.rowTint;
			this.rowTint = 'off';
		}
		this.commitRowTintChange();
	},

	commitRowTintChange() {
		this.saveRowTint();
		this.saveRowTintPalette();
		this.tintProbeDone = false;
		this.applyRowTintMode();
		this.updateRowTintUi();
		this.renderRows(true);
	},

	onRowTintPaletteChange(ev) {
		const v = ev && ev.target ? ev.target.value : 'classic';
		const pal = v === 'accessible' ? 'accessible' : 'classic';
		this.rowTintPalette = pal;
		if (!this.rowTintEnabled()) {
			this.saveRowTintPalette();
			return;
		}
		this.rowTint = pal;
		this.commitRowTintChange();
	},

	updateRowTintUi() {
		const on = this.rowTintEnabled();
		const cb = document.getElementById('fwlive-row-tint-toggle');
		if (cb) cb.checked = on;

		const wrap = document.getElementById('fwlive-row-tint-palette-wrap');
		if (wrap) {
			if (on) wrap.classList.remove('fwlive-hidden');
			else wrap.classList.add('fwlive-hidden');
		}

		const tintSel = document.getElementById('fwlive-row-tint');
		if (tintSel) {
			const pal = on ? this.rowTint : this.rowTintPalette;
			tintSel.value = pal === 'accessible' ? 'accessible' : 'classic';
		}
	},

	actionRowTintClass(action) {
		const a = (action || '').toLowerCase();
		if (a === 'pass') return 'fwlive-row-pass';
		if (a === 'drop' || a === 'reject' || a === 'block') return 'fwlive-row-deny';
		return '';
	},

	applyTintFallback(map) {
		if (!map) return;

		const pair = tint.hexPairForMode(this.rowTint);
		map.style.setProperty('--fwlive-pass-color', pair.pass);
		map.style.setProperty('--fwlive-deny-color', pair.deny);
		map.setAttribute('data-tint-fallback', '1');
		this.tintFallbackActive = true;
		this.updateTintWarnUi();
	},

	clearTintFallback(map) {
		if (!map) return;

		map.style.removeProperty('--fwlive-pass-color');
		map.style.removeProperty('--fwlive-deny-color');
		map.removeAttribute('data-tint-fallback');
		this.tintFallbackActive = false;
		this.updateTintWarnUi();
	},

	updateTintWarnUi() {
		const el = document.getElementById('fwlive-tint-warn');
		if (!el) return;

		el.style.display = this.tintFallbackActive ? 'inline' : 'none';
	},

	probeRowTintPaint() {
		const map = document.querySelector('.fwlive-map');
		const body = document.querySelector('#fwlive-table tbody');
		if (!map || !body) return;

		/* Prefer a non-alt row — zebra --background-color-medium can look "tinted" when transparent. */
		let tr = body.querySelector('tr:not(.fwlive-row-alt)');
		if (!tr) tr = body.querySelector('tr');
		if (!tr) return;

		const td = tr.querySelector('td');
		if (!td || typeof getComputedStyle !== 'function') return;

		const hadPass = tr.classList.contains('fwlive-row-pass');
		const hadDeny = tr.classList.contains('fwlive-row-deny');
		const probeClass = hadDeny ? 'fwlive-row-deny' : 'fwlive-row-pass';

		tr.classList.remove('fwlive-row-pass', 'fwlive-row-deny');
		const offBg = getComputedStyle(td).backgroundColor;
		tr.classList.add(probeClass);
		const onBg = getComputedStyle(td).backgroundColor;

		tr.classList.remove('fwlive-row-pass', 'fwlive-row-deny');
		if (hadPass) tr.classList.add('fwlive-row-pass');
		if (hadDeny) tr.classList.add('fwlive-row-deny');

		const passToken = getComputedStyle(map).getPropertyValue('--fwlive-pass-color').trim();
		const paintDelta = tint.cssColorPaintDelta(onBg, offBg);
		map.setAttribute('data-tint-probe-delta', String(paintDelta));
		map.setAttribute('data-tint-probe-on', onBg || '');
		map.setAttribute('data-tint-probe-off', offBg || '');
		const broken = tint.tintShouldEngageFallback({
			paintDelta: paintDelta,
			tokenResolved: !!passToken,
			minDelta: tint.PAINT_DELTA_MIN
		});

		this.tintProbeDone = true;
		if (broken) this.applyTintFallback(map);
		else if (this.tintFallbackActive) this.clearTintFallback(map);
		else this.updateTintWarnUi();
	},

	isLikelyIp(addr) {
		if (typeof addr !== 'string' || !addr) return false;
		addr = hostname.stripZone(addr);
		if (!addr) return false;
		if (isIpv4Address(addr)) return true;
		if (!addr.includes(':') || !/^[\da-f:.]+$/i.test(addr) || addr.includes(':::'))
			return false;

		const compression = addr.indexOf('::');
		if (compression !== -1 && addr.indexOf('::', compression + 2) !== -1) return false;
		/* A stray leading/trailing colon is not part of a single `::`. */
		if (addr[0] === ':' && addr[1] !== ':') return false;
		if (addr[addr.length - 1] === ':' && addr[addr.length - 2] !== ':') return false;

		let groups;
		let embeddedIpv4 = false;
		if (addr.includes('.')) {
			const lastColon = addr.lastIndexOf(':');
			if (lastColon === -1 || !isIpv4Address(addr.substring(lastColon + 1))) return false;
			groups = addr.substring(0, lastColon).split(':').filter(Boolean);
			embeddedIpv4 = true;
		} else {
			groups = addr.split(':').filter(Boolean);
		}

		if (
			groups.some(function (group) {
				return !/^[\da-f]{1,4}$/i.test(group);
			})
		)
			return false;

		const groupCount = groups.length + (embeddedIpv4 ? 2 : 0);
		return compression === -1 ? groupCount === 8 : groupCount < 8;
	},

	activeColumns() {
		return constants.COLUMN_SETS[this.viewMode] || constants.COLUMN_SETS.simple;
	},

	setViewMode(mode) {
		if (constants.VIEW_MODES.indexOf(mode) < 0 || mode === this.viewMode) return;

		this.viewMode = mode;
		this.expandedRowId = null;
		this.saveViewMode();
		this.updateDetailToggleUi();
		this.renderThead();
		this.updateHash(this.readFilters());
		this.renderRows(true);
	},

	updateDetailToggleUi() {
		const simpleBtn = document.getElementById('fwlive-view-simple');
		const detailBtn = document.getElementById('fwlive-view-detail');
		const detailed = this.viewMode === 'detailed';
		if (simpleBtn) simpleBtn.setAttribute('aria-pressed', detailed ? 'false' : 'true');
		if (detailBtn) detailBtn.setAttribute('aria-pressed', detailed ? 'true' : 'false');

		const map = document.querySelector('.fwlive-map');
		if (map) map.setAttribute('data-view', this.viewMode);

		this.updateFilterPanelUi();
	},

	updateFilterPanelUi() {
		const details = document.getElementById('fwlive-more-filters');
		if (!details) return;

		if (this.viewMode === 'detailed') {
			details.open = true;
			return;
		}

		const filters = this.readFilters();
		const hasExtra = !!(
			filters.interface ||
			filters.src ||
			filters.dst ||
			filters.sport ||
			filters.dport
		);
		if (hasExtra) details.open = true;
	},

	onRowClick(rowId, ev) {
		if (this.viewMode !== 'simple') return;

		if (ev && ev.target && ev.target.closest && ev.target.closest('a.fwlive-filter-link'))
			return;

		const focusRowId = expansionButtonRowId(ev && ev.currentTarget);
		this.expandedRowId = this.expandedRowId === rowId ? null : rowId;
		this.renderRows(true, focusRowId);
	},

	renderThead() {
		const el = document.getElementById('fwlive-table');
		if (!el) return;

		table.renderThead(el, { columns: this.activeColumns().slice() }, {});
	},

	isCurrentPollEpoch(epoch) {
		return !this.viewDisposed && (epoch == null || epoch === this.currentPollEpoch());
	},

	async loadRulesMap(epoch) {
		try {
			const res = await callFwliveRules();
			if (!this.isCurrentPollEpoch(epoch)) return;
			this.rulesMap = (res && res.rules) || {};
			this.rulesMapTruncated = !!(res && res.truncated === true);
			this.rulesMapLoaded = true;
			this.firewallBackend = (res && res.backend) || 'nft';
			/* Truncation belongs to this map; error describes its lookup failure. */
			this.noteRulesMapOutcome((res && res.error) || null);
			if (this.lastRulesError) console.warn('fwlive rules map error:', this.lastRulesError);
			this.refreshBufferedRuleLabels();
		} catch (_e) {
			if (!this.isCurrentPollEpoch(epoch)) return;
			/* Retain the entire last snapshot, including an empty truncated map. */
			this.noteRulesMapOutcome('rules_unavailable');
		}
		this.updateBackendUi();
	},

	noteRulesMapOutcome(error) {
		this.lastRulesError = error;
		if (error !== 'rules_unavailable') {
			this.rulesRetryAttempt = 0;
			this.nextRulesRetryAt = 0;
			return;
		}

		/* Back off consecutive failures, then stop after a bounded retry budget. */
		this.rulesRetryAttempt = Math.min(
			(this.rulesRetryAttempt || 0) + 1,
			constants.RULES_RETRY_MAX_ATTEMPTS
		);
		if (this.rulesRetryAttempt >= constants.RULES_RETRY_MAX_ATTEMPTS) {
			this.nextRulesRetryAt = 0;
			return;
		}
		const delay = Math.min(
			constants.RULES_RETRY_BASE_MS * Math.pow(2, this.rulesRetryAttempt - 1),
			constants.RULES_RETRY_MAX_DELAY_MS
		);
		this.nextRulesRetryAt = this.nowMs() + delay;
	},

	backendDisplayLabel() {
		if (this.firewallBackend === 'nft') return _('using fw4');
		return '';
	},

	rulesDiagnosticCause(error) {
		switch (error) {
			case 'mktemp_failed':
				return _('Could not create a temporary file for rule names.');
			case 'tsv_failed':
				return _('Could not process firewall rule names.');
			case 'no_backend':
				return _('Could not read the active firewall rules.');
			case 'rules_unavailable':
				if (!this.rulesMapLoaded) return _('Could not load rule names.');
				if (this.rulesMap && Object.keys(this.rulesMap).length)
					return _(
						'Could not refresh rule names; previously loaded names are still shown.'
					);
				return _('Could not refresh rule names.');
			default:
				return _('Rule-name lookup failed.');
		}
	},

	rulesDiagnosticLines() {
		const lines = [];
		if (this.rulesMapTruncated)
			lines.push(_('Rule-name lookup reached a safety limit.') + ' (truncated=true)');
		if (this.lastRulesError) {
			const cause = this.rulesDiagnosticCause(this.lastRulesError);
			/* Unknown RPC codes are bounded diagnostic text, never HTML. */
			const code =
				typeof this.lastRulesError === 'string' ? this.lastRulesError.slice(0, 80) : '';
			lines.push(cause + (code ? ' (' + code + ')' : ''));
		}
		lines.push(_('Rule-name lookup does not change your firewall rules.'));
		lines.push(
			_(
				'Some entries may show names derived from their log prefixes. Searching by a friendly rule name may miss those entries.'
			)
		);
		return lines;
	},

	rulesMapDegraded() {
		return !!(this.rulesMapTruncated || this.lastRulesError);
	},

	updateBackendUi() {
		const map = document.querySelector('.fwlive-map');
		if (map) map.setAttribute('data-backend', this.firewallBackend || 'unknown');

		const label = document.getElementById('fwlive-backend');
		if (label) {
			const warnings = (this.loggingStatus && this.loggingStatus.warnings) || [];
			let text = this.backendDisplayLabel();
			let degraded = false;
			if (this.rulesMapDegraded()) {
				const err = _('Some rule names may be missing');
				text = text ? text + ' \u00b7 ' + err : err;
				degraded = true;
			}
			if (warnings.indexOf('legacy_iptables_detected') >= 0) {
				const warn = _(
					'Live view may be incomplete — a legacy iptables table is registered'
				);
				text = text ? text + ' \u00b7 ' + warn : warn;
				degraded = true;
			}
			label.textContent = text;
			label.classList.toggle('fwlive-backend-warn', degraded);
		}
		const details = document.getElementById('fwlive-rules-details');
		const body = document.getElementById('fwlive-rules-details-body');
		if (details && body) {
			const degraded = this.rulesMapDegraded();
			details.style.display = degraded ? '' : 'none';
			body.textContent = degraded ? this.rulesDiagnosticLines().join('\n\n') : '';
			if (!degraded) details.open = false;
		}

		this.updateEmptyStateUi();
	},

	async loadLoggingStatus(epoch) {
		const readGeneration = ++this.loggingStatusReadGeneration;
		const wasWeakDevice = this.weakDevice;
		try {
			const status = await callFwliveLoggingStatus();
			if (
				!this.isCurrentPollEpoch(epoch) ||
				readGeneration !== this.loggingStatusReadGeneration
			)
				return;
			this.loggingStatus = status;
			if (!this._loggingNoticeFromToggle) {
				this.loggingNotice = '';
				this.loggingNoticeFail = false;
			}
			this.weakDevice = !!(this.loggingStatus && this.loggingStatus.weak_device === true);
		} catch (_e) {
			if (
				!this.isCurrentPollEpoch(epoch) ||
				readGeneration !== this.loggingStatusReadGeneration
			)
				return;
			/* Keep last-known toolbar; unknown until the first successful fetch. */
			if (!this.loggingNotice) {
				this.loggingNotice = this.loggingStatus
					? _('Could not refresh logging status; showing the last known state.')
					: _('Could not load logging status.');
				this.loggingNoticeFail = true;
			}
		}
		this.updateBackendUi();
		this.updateLoggingToolbarUi();
		this.updateEmptyStateUi();
		this.updateStatus();
		if (wasWeakDevice !== this.weakDevice) this.updateAdaptiveBanner();
		if (wasWeakDevice !== this.weakDevice && document.getElementById('fwlive-table'))
			this.renderRows(true);
	},

	async runLoggingToggle(opts) {
		if (this.loggingBusy) return;

		/* Older recovery reads must not overwrite this toggle's later status. */
		this.loggingStatusReadGeneration++;
		this.loggingBusy = true;
		this.loggingNotice = '';
		this.loggingNoticeFail = false;
		this._loggingNoticeFromToggle = false;
		opts.initialUi();

		try {
			const res = await opts.call();
			if (!res || !res.ok) {
				this.loggingNotice = opts.failureNotice(res);
				this.loggingNoticeFail = true;
				this._loggingNoticeFromToggle = true;
				await this.loadLoggingStatus();
				return;
			}

			this.loggingNotice = opts.successNotice(res);
			this.loggingNoticeFail = false;
			this._loggingNoticeFromToggle = !!this.loggingNotice;
			if (opts.onSuccess) opts.onSuccess(res);
			if (this.loggingStatus && typeof opts.wanLog === 'boolean')
				this.loggingStatus = Object.assign({}, this.loggingStatus, {
					wan_log: opts.wanLog
				});
			await this.loadLoggingStatus();
		} catch (_e) {
			this.loggingNotice = opts.catchNotice();
			this.loggingNoticeFail = true;
			this._loggingNoticeFromToggle = true;
			await this.loadLoggingStatus();
		} finally {
			/* Survive only the refresh owned by this toggle. */
			this._loggingNoticeFromToggle = false;
			this.loggingBusy = false;
			this.updateEmptyStateUi();
			this.updateLoggingToolbarUi();
		}
	},

	async handleEnableLogging() {
		return this.runLoggingToggle({
			wanLog: true,
			call: () => callFwliveEnableLogging(),
			initialUi: () => {
				this.updateEmptyStateUi();
				this.updateLoggingToolbarUi();
			},
			failureNotice: (res) =>
				logging.toggleFailureNotice(res && res.error, _('Could not enable logging.')),
			successNotice: (res) =>
				res.changed
					? _(
							'WAN drop/reject logging is on. Blocked inbound traffic should appear here as it happens — not normal LAN browsing.'
						)
					: _('WAN logging is already enabled.'),
			onSuccess: () => logging.persistConsentDismissed(),
			catchNotice: () => _('Administrator access is required to enable logging.')
		});
	},

	async handleDisableLogging() {
		return this.runLoggingToggle({
			wanLog: false,
			call: () => callFwliveDisableLogging(),
			initialUi: () => this.updateLoggingToolbarUi(),
			failureNotice: (res) =>
				logging.toggleFailureNotice(res && res.error, _('Could not disable logging.')),
			successNotice: (res) => (res.changed ? _('WAN drop/reject logging is off.') : ''),
			catchNotice: () => _('Administrator access is required to disable logging.')
		});
	},

	shouldShowLoggingConsent() {
		const st = this.loggingStatus;
		if (!st || st.wan_log) return false;
		const blockers = st.blockers || [];
		if (blockers.length) return false;
		if (logging.consentDismissedPermanent()) return false;
		if (this.consentDismissedSession) return false;
		return true;
	},

	handleDismissConsent(persist) {
		if (persist) logging.persistConsentDismissed();
		this.consentDismissedSession = true;
		this._loggingEmptySig = '';
		this.updateEmptyStateUi();
	},

	loggingState() {
		return {
			loggingStatus: this.loggingStatus,
			loggingBusy: this.loggingBusy,
			loggingNotice: this.loggingNotice,
			loggingNoticeFail: !!this.loggingNoticeFail,
			showConsent: this.shouldShowLoggingConsent()
		};
	},

	/* Stable signature so poll/renderRows does not wipe the logging button every
	   second (destroys the node between mousedown and click → needs a 2nd click). */
	loggingUiSignature() {
		const st = this.loggingStatus;
		/* Sort blockers so unstable backend order does not force a rebuild. */
		const blockers = st && st.blockers ? st.blockers.slice().sort().join(',') : '';
		const candidates =
			st && Array.isArray(st.wan_zone_candidates) ? st.wan_zone_candidates.join(',') : '';
		return [
			st ? (st.wan_log ? '1' : '0') : 'x',
			st ? String(st.wan_log_limit || '') : '',
			blockers,
			candidates,
			this.loggingBusy ? '1' : '0',
			this.loggingNotice || '',
			this.loggingNoticeFail ? 'f1' : 'f0',
			this.shouldShowLoggingConsent() ? 'c1' : 'c0'
		].join('|');
	},

	updateLoggingToolbarUi() {
		const bar = document.getElementById('fwlive-logging-bar');
		if (!bar) return;

		const sig = this.loggingUiSignature();
		if (sig === this._loggingToolbarSig) return;

		logging.renderToolbar(bar, this.loggingState(), {
			onEnable: () => this.handleEnableLogging(),
			onDisable: () => this.handleDisableLogging()
		});
		this._loggingToolbarSig = sig;
	},

	updateEmptyStateUi() {
		const empty = document.getElementById('fwlive-empty');
		if (!empty) return;

		const sig = this.loggingUiSignature();
		if (sig === this._loggingEmptySig) return;

		const visible = empty.style.display !== 'none';
		logging.renderEmptyState(empty, this.loggingState(), {
			onEnable: () => this.handleEnableLogging(),
			onDismissConsent: (persist) => this.handleDismissConsent(persist)
		});
		if (visible) empty.style.display = 'block';
		this._loggingEmptySig = sig;
	},

	resolveRuleLabel(hint) {
		if (!hint) return '';

		const own = Object.prototype.hasOwnProperty;
		if (own.call(this.rulesMap, hint) && typeof this.rulesMap[hint] === 'string')
			return this.rulesMap[hint];

		const slug = hint.toLowerCase();
		if (own.call(this.rulesMap, slug) && typeof this.rulesMap[slug] === 'string')
			return this.rulesMap[slug];

		return log.formatRuleLabel(hint);
	},

	enrichEntry(row) {
		row.rule_label = this.resolveRuleLabel(row.rule_hint);
		return row;
	},

	refreshBufferedRuleLabels() {
		let changed = false;
		for (let i = 0; i < this.entries.length; i++) {
			const row = this.entries[i];
			const label = this.resolveRuleLabel(row.rule_hint);
			if (row.rule_label !== label) {
				row.rule_label = label;
				changed = true;
			}
		}

		if (changed) this.invalidateFilteredRows();

		/* Keep buffered rows current without painting a paused or hidden table. */
		if (changed && !this.tablePaused && (!this.summaryMode || this.summaryRowsShown))
			this.renderRows(true);
		return changed;
	},

	normalizePollBatch(raw) {
		const normalized = [];
		const seen = {};
		let pollNew = 0;

		for (let i = 0; i < raw.length; i++) {
			if (!log.isFirewallEvent(raw[i])) continue;

			const row = this.enrichEntry(log.normalizeEntry(raw[i]));
			if (seen[row.id]) continue;
			seen[row.id] = true;
			if (this.rememberSessionId(row.id)) pollNew++;
			normalized.push(row);
		}

		return { rows: normalized, pollNew: pollNew };
	},

	/* Keep RPC timing and reply acquisition separate from view-state mutation. */
	async fetchPollReply(fetchLines) {
		const t0 = this.nowMs();
		let reply;
		try {
			/* Raw logd lines, not post-filter rows. Fetch a multiple of the
			 * display limit so mixed syslog still fills the table; pause
			 * reads the ring cap so the buffer can catch up. */
			reply = await callFwlivePoll([String(fetchLines)]);
		} catch (_e) {
			reply = null;
		}
		return {
			reply: reply,
			rtt: this.nowMs() - t0
		};
	},

	/* Caller must discard stale epochs before this synchronous application.
	 * This updates transport/adaptive state, summary/banner UI, rows, and buffer. */
	failPollReply(rtt, errorCode) {
		this.lastPollError = true;
		this.lastPollErrorCode = typeof errorCode === 'string' ? errorCode : null;
		this.lastBatchNewIdCount = 0;
		this.fillingBuffer = false;
		this.notePollRtt(rtt, true);
		this.updateAdaptiveBanner();
	},

	applyPollReply(poll, context) {
		const reply = poll.reply;
		const rtt = poll.rtt;
		const resumeMerge = context.resumeMerge;
		const fetchLines = context.fetchLines;
		const beforeLength = context.beforeLength;
		this.lastPollReturnedMessages = null;
		this.lastPollEffectiveLimit = null;

		if (!reply || typeof reply !== 'object' || Array.isArray(reply)) {
			this.failPollReply(rtt);
			return;
		}
		if (reply.error) {
			this.failPollReply(rtt, reply.error);
			return;
		}
		const raw = reply.log;
		if (!Array.isArray(raw)) {
			this.failPollReply(rtt);
			return;
		}

		this.lastPollError = false;
		this.lastPollErrorCode = null;
		if (reply.adaptive === 0 || reply.adaptive === false) this.serverAdaptive = 0;
		else if (reply.adaptive === 1 || reply.adaptive === true) this.serverAdaptive = 1;
		else this.serverAdaptive = undefined;
		this.serverTruncated = reply.truncated ? 1 : 0;
		this.serverShed =
			reply.shed && typeof reply.shed === 'object' && !Array.isArray(reply.shed)
				? reply.shed
				: null;
		this.lastPollReturnedMessages = raw.length;
		if (
			this.serverAdaptive === 1 &&
			typeof reply.effective_limit === 'number' &&
			isFinite(reply.effective_limit) &&
			Math.floor(reply.effective_limit) === reply.effective_limit &&
			reply.effective_limit >= 1 &&
			reply.effective_limit <= constants.FETCH_LINES_MAX
		) {
			this.lastPollEffectiveLimit = reply.effective_limit;
		}

		this.notePollRtt(rtt, false);
		this.updateAdaptiveBanner();
		if (this.clientBackoffEnabled()) {
			if (this.summaryMode) {
				this.summaryData =
					reply.summary &&
					typeof reply.summary === 'object' &&
					!Array.isArray(reply.summary)
						? reply.summary
						: null;
				this.renderSummary();
			} else if (rtt > constants.POLL_RTT_SLOW_MS) {
				this.enterSummaryMode(reply.summary);
			}
		}

		const batch = this.normalizePollBatch(raw);
		this.lastBatchNewIdCount = batch.pollNew;
		this.lastSuccessfulBatchEmpty = batch.rows.length === 0;
		if (batch.rows.length) this.lastNonEmptyBatchAt = this.nowMs();

		/* Oldest-first ring buffer; filteredRows() reverses for newest-first display. */
		this.entries = buffer.applyFetchedEntries(this.entries, batch.rows, {
			/* buffer.js retains its public paused option; this is the view's table state. */
			paused: this.tablePaused,
			resumeMerge: resumeMerge || context.pausedAtStart,
			rowLimit: this.rowLimit,
			fetchLinesMax: constants.FETCH_LINES_MAX
		});
		this.updateFillingState(beforeLength, reply, fetchLines);
		/* Clear the merge obligation only after the current batch is applied. */
		if (resumeMerge) this.resumeMerge = false;
	},

	async fetchEntries() {
		if (!this.sessionSeen) this.sessionSeen = new Set();

		const epoch = this.currentPollEpoch();
		const pausedAtStart = !!this.tablePaused;
		const resumeMerge = !!this.resumeMerge;
		const fetchLines = this.requestedFetchLines();
		const beforeLength = this.entries.length;
		this.lastPollRequestedLines = fetchLines;
		this.lastPollReturnedMessages = null;
		this.lastPollEffectiveLimit = null;

		const poll = await this.fetchPollReply(fetchLines);

		/* Visibility changes and disposal invalidate all application of this reply. */
		if (epoch !== this.currentPollEpoch()) return;

		this.applyPollReply(poll, {
			beforeLength: beforeLength,
			fetchLines: fetchLines,
			pausedAtStart: pausedAtStart,
			resumeMerge: resumeMerge
		});
		if (
			this.lastRulesError === 'rules_unavailable' &&
			this.rulesRetryAttempt < constants.RULES_RETRY_MAX_ATTEMPTS &&
			!this.tablePaused &&
			!this.lastPollError &&
			this.nowMs() >= (this.nextRulesRetryAt || 0)
		) {
			await this.loadRulesMap(epoch);
			if (epoch !== this.currentPollEpoch() || this.viewDisposed) return;
		}
	},

	rememberSessionId(id) {
		if (!this.sessionSeen) this.sessionSeen = new Set();
		if (this.sessionSeen.has(id)) return false;

		this.sessionSeen.add(id);
		const cap = Math.max(this.rowLimit * 2, constants.FETCH_LINES_MAX);
		while (this.sessionSeen.size > cap) {
			const oldest = this.sessionSeen.values().next().value;
			this.sessionSeen.delete(oldest);
		}
		return true;
	},

	ingestCap() {
		return buffer.ingestCap(this.tablePaused, this.rowLimit, constants.FETCH_LINES_MAX);
	},

	displayRowCap() {
		return renderPolicy.displayRowCap({
			rowLimit: this.rowLimit,
			weakDevice: this.weakDevice,
			weakDeviceDisplayRowCap: constants.WEAK_DEVICE_DISPLAY_ROW_CAP
		});
	},

	statusSuffix() {
		const bits = [];
		if (this.tablePaused) {
			if (this.pauseBufferLoading) bits.push(_('loading buffer'));
			if (this.fillingBuffer) bits.push(_('buffer filling'));
		}

		const cap = this.ingestCap();
		if (this.entries.length >= cap && cap > 0) bits.push(_('buffer full'));
		if (this.ensureRenderScheduler().isFloodSuppressed())
			bits.push(_('table refresh throttled'));
		if (this.weakDevice && this.rowLimit > constants.WEAK_DEVICE_DISPLAY_ROW_CAP)
			bits.push(
				_('display limited to %d rows').format(constants.WEAK_DEVICE_DISPLAY_ROW_CAP)
			);
		if (this.degradedSampling) bits.push(_('polling slowed'));
		if (this.serverTruncated) bits.push(_('server limited fetch'));
		if (this.resolveLoadShed) bits.push(_('hostname lookup paused'));
		if (!this.tablePaused && !this.followLive)
			bits.push(_('scroll frozen — scroll to top to follow live'));
		return bits.length ? ' — ' + bits.join(', ') : '';
	},

	nowMs() {
		if (typeof performance !== 'undefined' && performance.now) return performance.now();
		return Date.now();
	},

	isTabHidden() {
		return typeof document !== 'undefined' && !!document.hidden;
	},

	/* Classify one RTT sample into hysteresis buckets.
	 * error and >1.5s share the slow/degraded streak so mixed failures still trip N=3. */
	rttKindFromMs(ms, errored) {
		if (errored) return 'slow';
		if (!(ms >= 0)) return 'slow';
		if (ms < constants.POLL_RTT_FAST_MS) return 'fast';
		if (ms <= constants.POLL_RTT_SLOW_MS) return 'mid';
		return 'slow';
	},

	cadenceForKind(kind) {
		if (kind === 'fast') return constants.POLL_CADENCE_FAST_S;
		if (kind === 'mid') return constants.POLL_CADENCE_MID_S;
		return constants.POLL_CADENCE_SLOW_S;
	},

	resetRttHistory() {
		this.rttStreakKind = null;
		this.rttStreakCount = 0;
	},

	ensurePollCoordinator() {
		if (this.pollCoordinator) return this.pollCoordinator;

		const visibility = {
			add: function (handler) {
				if (typeof document !== 'undefined' && document.addEventListener)
					document.addEventListener('visibilitychange', handler);
			},
			remove: function (handler) {
				if (typeof document !== 'undefined' && document.removeEventListener)
					document.removeEventListener('visibilitychange', handler);
			}
		};
		this.pollCoordinator = pollCoordinator.create({
			poll: poll,
			visibility: visibility,
			isHidden: this.isTabHidden.bind(this),
			run: this.runPollRequest.bind(this),
			initialCadence: constants.POLL_CADENCE_FAST_S,
			onVisible: this.resetRttHistory.bind(this)
		});
		return this.pollCoordinator;
	},

	ensureRenderScheduler() {
		if (this.renderScheduler) return this.renderScheduler;
		this.renderScheduler = renderScheduler.create({
			getEpoch: () => this.currentPollEpoch(),
			render: (force) => this.renderRows(force),
			renderCost: renderPolicy.renderCost,
			now: () => this.nowMs(),
			capacity: constants.RENDER_CAP_PER_SEC,
			requestFrame:
				typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function'
					? (cb) => window.requestAnimationFrame(cb)
					: null,
			cancelFrame:
				typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function'
					? (id) => window.cancelAnimationFrame(id)
					: null
		});
		return this.renderScheduler;
	},

	currentPollEpoch() {
		return this.ensurePollCoordinator().getState().epoch;
	},

	clientBackoffEnabled() {
		return this.serverAdaptive !== 0;
	},

	setPollCadence(sec) {
		this.ensurePollCoordinator().setCadence(sec);
	},

	notePollRtt(ms, errored) {
		if (!this.clientBackoffEnabled()) {
			if (this.summaryMode) this.leaveSummaryMode();
			this.degradedSampling = false;
			/* Drop any partial streak so a slow sample from before the
			 * adaptive:0 window cannot trip degraded on re-enable. */
			this.resetRttHistory();
			this.setPollCadence(constants.POLL_CADENCE_FAST_S);
			return;
		}

		const kind = this.rttKindFromMs(ms, errored);
		if (kind === this.rttStreakKind) this.rttStreakCount++;
		else {
			this.rttStreakKind = kind;
			this.rttStreakCount = 1;
		}

		if (this.rttStreakCount < constants.POLL_RTT_STREAK) return;

		const cadence = this.cadenceForKind(kind);
		this.degradedSampling = cadence === constants.POLL_CADENCE_SLOW_S;
		this.setPollCadence(cadence);
		if (kind === 'fast' && this.summaryMode) this.leaveSummaryMode();
	},

	disposeView() {
		this.viewDisposed = true;
		if (this.pollCoordinator) this.pollCoordinator.dispose();
		if (this.renderScheduler) this.renderScheduler.dispose();
		this.resolveGeneration = (this.resolveGeneration || 0) + 1;
		this.resolveInFlight = false;
		if (this.pagehideHandler) {
			window.removeEventListener('pagehide', this.pagehideHandler);
			this.pagehideHandler = null;
		}
		if (this.filterInputTimer) {
			clearTimeout(this.filterInputTimer);
			this.filterInputTimer = null;
		}
	},

	adaptiveBannerParts() {
		const parts = [];
		const mode = this.fetchMode === 'manual' ? _('Manual') : _('Auto');
		if (this.lastPollRequestedLines !== null && this.lastPollReturnedMessages !== null) {
			if (
				this.serverAdaptive === 1 &&
				this.lastPollEffectiveLimit !== null &&
				this.lastPollEffectiveLimit < this.lastPollRequestedLines
			) {
				parts.push(
					_(
						'%s · requested up to %d raw lines · server limited fetch to %d · %d firewall messages returned'
					).format(
						mode,
						this.lastPollRequestedLines,
						this.lastPollEffectiveLimit,
						this.lastPollReturnedMessages
					)
				);
			} else {
				parts.push(
					_('%s · requested up to %d raw lines · %d firewall messages returned').format(
						mode,
						this.lastPollRequestedLines,
						this.lastPollReturnedMessages
					)
				);
			}
		}
		if (this.serverAdaptive === undefined) parts.push(_('Server protection state is unknown.'));
		else if (this.serverAdaptive === 0)
			parts.push(_('Server adaptive protection is disabled.'));
		if (this.degradedSampling)
			parts.push(
				_('Polling slowed: the router is responding slowly, so polls run less often.')
			);
		if (this.serverShed && this.serverShed.limit)
			parts.push(
				_(
					'Server limited fetch: the router is under load; at most %d log lines per poll.'
				).format(this.serverShed.limit)
			);
		else if (this.serverTruncated)
			parts.push(
				_('Server limited fetch: this poll returned fewer lines to protect the router.')
			);
		if (this.resolveLoadShed)
			parts.push(_('Hostname lookup paused while the router is under load.'));
		if (this.weakDevice && this.rowLimit > constants.WEAK_DEVICE_DISPLAY_ROW_CAP)
			parts.push(
				_(
					'Display limited to %d rows on this device; the larger Limit still buffers rows.'
				).format(constants.WEAK_DEVICE_DISPLAY_ROW_CAP)
			);
		return parts;
	},

	updateAdaptiveBanner() {
		const el = document.getElementById('fwlive-adaptive');
		if (!el) return;

		const parts = this.adaptiveBannerParts();

		if (parts.length) {
			el.style.display = 'block';
			el.textContent = parts.join(' ');
		} else {
			el.style.display = 'none';
			el.textContent = '';
		}
	},

	fetchModeOptions() {
		return optionNodes([
			['auto', _('Auto')],
			['manual', _('Manual')]
		]);
	},

	manualFetchLinesOptions() {
		const pairs = [];
		for (let i = 0; i < constants.MANUAL_FETCH_LINES_OPTIONS.length; i++) {
			const n = constants.MANUAL_FETCH_LINES_OPTIONS[i];
			pairs.push([String(n), String(n)]);
		}
		return optionNodes(pairs);
	},

	summaryListText(label, values) {
		const lines = [label + ':'];
		if (!Array.isArray(values) || !values.length) {
			lines.push(_('none'));
			return lines;
		}
		for (let i = 0; i < values.length; i++) {
			const item = values[i];
			if (!item || typeof item.value !== 'string') continue;
			const count = Number.isFinite(Number(item.count)) ? Number(item.count) : 0;
			lines.push('%s — %d'.format(item.value, count));
		}
		if (lines.length === 1) lines.push(_('none'));
		return lines;
	},

	renderSummary() {
		const card = document.getElementById('fwlive-summary');
		const body = document.getElementById('fwlive-summary-body');
		if (!card || !body) return;
		const summary = this.summaryData;
		const lines = [_('Showing a compact summary of the top of the shown sample.')];
		if (!summary || typeof summary !== 'object') {
			lines.push(_('Summary data is unavailable; show rows to inspect the sample.'));
		} else if (summary.truncated) {
			lines.push(_('Summary was bounded before all categories could be included.'));
		} else {
			this.summaryListText(_('Top talkers'), summary.top_talkers).forEach((line) =>
				lines.push(line)
			);
			this.summaryListText(_('Top drops'), summary.top_drops).forEach((line) =>
				lines.push(line)
			);
			this.summaryListText(_('Top rules'), summary.top_rules).forEach((line) =>
				lines.push(line)
			);
		}
		body.textContent = lines.join('\n');
		this.updateSummaryUi();
	},

	syncEmptyScrollVisibility(rowCount) {
		const hideTable = this.summaryMode && !this.summaryRowsShown;
		const scroll = document.getElementById('fwlive-scroll');
		const empty = document.getElementById('fwlive-empty');
		if (scroll) {
			scroll.style.display = hideTable ? 'none' : '';
		}
		if (empty) {
			empty.style.display = hideTable ? 'none' : rowCount ? 'none' : 'block';
		}
	},

	updateSummaryUi() {
		const card = document.getElementById('fwlive-summary');
		const toggle = document.getElementById('fwlive-summary-rows');
		if (card) {
			card.style.display = this.summaryMode ? 'block' : 'none';
		}
		this.syncEmptyScrollVisibility(this.filteredRowsState().rows.length);
		if (toggle) {
			toggle.textContent = this.summaryRowsShown ? _('Hide rows') : _('Show rows');
			toggle.setAttribute('aria-pressed', this.summaryRowsShown ? 'true' : 'false');
		}
	},

	enterSummaryMode(summary) {
		this.summaryMode = true;
		this.summaryRowsShown = false;
		this.summaryData =
			summary && typeof summary === 'object' && !Array.isArray(summary) ? summary : null;
		this.renderSummary();
	},

	leaveSummaryMode() {
		if (!this.summaryMode) return;
		this.summaryMode = false;
		this.summaryRowsShown = false;
		this.summaryData = null;
		this.updateSummaryUi();
		if (this.tablePaused) {
			this.syncEmptyScrollVisibility(this.filteredRowsState().rows.length);
			this.updateStatus();
		} else {
			this.resolvePaintPending = false;
			this.renderRows(true);
		}
	},

	onSummaryRowsToggle() {
		if (!this.summaryMode) return;
		this.summaryRowsShown = !this.summaryRowsShown;
		this.updateSummaryUi();
		if (this.summaryRowsShown) this.renderRows(true);
	},

	scheduleRenderRows(force) {
		this.ensureRenderScheduler().schedule(!!force);
	},

	scheduleResolvePaint() {
		this.resolvePaintPending = true;
		if (this.tablePaused) {
			this.updateStatus();
			return;
		}
		this.scheduleRenderRows(true);
	},

	updateFloodBanner() {
		const el = document.getElementById('fwlive-flood');
		if (!el) return;

		if (this.ensureRenderScheduler().isFloodSuppressed()) {
			el.style.display = 'block';
			el.textContent = _(
				'Table refresh throttled: the event rate is high, so the table repaints less often to protect the browser. The buffer still updates; refresh resumes automatically.'
			);
		} else {
			el.style.display = 'none';
			el.textContent = '';
		}
	},

	invalidateFilteredRows() {
		/* Use after in-place edits: free-text query matching reads every row field. */
		this.filteredRowsCache = null;
	},

	/* Internal shared result: consumers must treat the state and rows as read-only.
	 * filteredRows() provides an array copy for callers that need to mutate it. */
	filteredRowsState() {
		/* Poll ingest and limit trimming replace the array, even at equal length.
		 * Rule-label edits invalidate explicitly because query matches all fields. */
		const filters = this.readFilters();
		const filterKey = JSON.stringify(filters);
		const rowCap = this.displayRowCap();
		const entries = this.entries;
		const cached = this.filteredRowsCache;

		if (
			cached &&
			cached.entries === entries &&
			cached.filterKey === filterKey &&
			cached.rowCap === rowCap
		)
			return cached;

		const matching = [];
		for (let i = 0; i < entries.length; i++) {
			if (log.matchesFilter(entries[i], filters)) matching.push(entries[i]);
		}

		const state = {
			entries: entries,
			filterKey: filterKey,
			rowCap: rowCap,
			matchCount: matching.length,
			rows: matching.slice(-rowCap).reverse()
		};
		this.filteredRowsCache = state;
		return state;
	},

	filteredRows() {
		return this.filteredRowsState().rows.slice();
	},

	formatAgeShort(seconds) {
		if (seconds < 60) return _('%ds').format(seconds);
		if (seconds < 3600) return _('%dm').format(Math.floor(seconds / 60));
		if (seconds < 86400) return _('%dh').format(Math.floor(seconds / 3600));
		return _('%dd').format(Math.floor(seconds / 86400));
	},

	stalenessHint() {
		if (
			!this.entries.length ||
			!this.lastSuccessfulBatchEmpty ||
			!Number.isFinite(this.lastNonEmptyBatchAt)
		)
			return '';

		const elapsed = Math.max(0, this.nowMs() - this.lastNonEmptyBatchAt);
		if (elapsed < constants.EMPTY_POLL_STALE_AFTER_MS) return '';

		const age = this.formatAgeShort(Math.floor(elapsed / 1000));
		return _('Firewall log has no current entries; showing rows last received %s ago.').format(
			age
		);
	},

	compactCountText(filtered) {
		const stored = this.entries.length;
		/* Keep the stored-buffer denominator tied to the user's Limit. A weak
		 * device's rendered-row cap is called out separately in statusSuffix(). */
		const limit = this.rowLimit;
		const stale = this.stalenessHint();
		const suffix = this.statusSuffix() + (stale ? ' — ' + stale : '');
		/* The filter state contains both visible rows and the full match count, so
		 * paused status can report matches beyond the display cap without rescanning. */
		const state =
			filtered && Array.isArray(filtered.rows) ? filtered : this.filteredRowsState();
		const shown = this.tablePaused ? state.matchCount : state.rows.length;

		if (this.pauseBufferLoading && stored === 0) return _('loading…') + suffix;

		if (shown) return _('%d matching · %d/%d stored').format(shown, stored, limit) + suffix;

		if (stored) return _('0 matching · %d/%d stored').format(stored, limit) + suffix;

		return '';
	},

	/* No reply is a transport failure; a typed code means rpcd answered. */
	pollErrorText(suffix) {
		const code = this.lastPollErrorCode;
		if (INSTALL_POLL_ERRORS.indexOf(code) >= 0)
			return _('Installation is incomplete. Reinstall luci-app-fwlive.');
		if (code) return _('The router could not read the firewall log — retrying…') + suffix;
		return _('Connection lost — retrying…') + suffix;
	},

	updateStatus(filtered) {
		const status = document.getElementById('fwlive-status');
		if (!status) return;

		const state =
			filtered && Array.isArray(filtered.rows) ? filtered : this.filteredRowsState();
		const suffix = this.statusSuffix();

		if (this.lastPollError) {
			status.className = 'fwlive-status fwlive-status-error';
			status.textContent = this.pollErrorText(suffix);
			this.updateAdaptiveBanner();
			return;
		}

		status.className = this.tablePaused
			? 'fwlive-status fwlive-status-paused'
			: 'fwlive-status';
		status.textContent = this.compactCountText(state);
		this.updateAdaptiveBanner();
	},

	readRowLimit() {
		const n = parseInt(storedValue('fwlive-row-limit', null), 10);
		if (constants.ROW_LIMIT_OPTIONS.indexOf(n) >= 0) return n;
		return constants.DEFAULT_ROW_LIMIT;
	},

	saveRowLimit() {
		storeValue('fwlive-row-limit', String(this.rowLimit));
	},

	applyRowLimit(limit) {
		const n =
			constants.ROW_LIMIT_OPTIONS.indexOf(limit) >= 0 ? limit : constants.DEFAULT_ROW_LIMIT;
		this.rowLimit = n;
		if (!this.tablePaused && this.entries.length > n) this.entries = this.entries.slice(-n);
	},

	updateStreamControlsUi() {
		const map = document.querySelector('.fwlive-map');
		const dot = document.getElementById('fwlive-watch-dot');
		const label = document.getElementById('fwlive-watch-label');
		const pauseBtn = document.getElementById('fwlive-pause');
		const sel = document.getElementById('fwlive-limit');
		const modeSel = document.getElementById('fwlive-fetch-mode');
		const manualSel = document.getElementById('fwlive-manual-lines');
		const hostCb = document.getElementById('fwlive-show-hostnames');

		if (map) {
			if (this.tablePaused) map.classList.add('fwlive-watch-paused');
			else map.classList.remove('fwlive-watch-paused');
		}
		if (dot) {
			if (this.tablePaused) dot.classList.remove('fwlive-dot-on');
			else dot.classList.add('fwlive-dot-on');
		}
		if (label) label.textContent = this.tablePaused ? _('Paused') : _('Watching');
		if (pauseBtn) pauseBtn.textContent = this.tablePaused ? _('Resume') : _('Pause');
		if (sel) sel.value = String(this.rowLimit);
		if (modeSel) modeSel.value = this.fetchMode;
		if (manualSel) {
			manualSel.value = String(this.manualFetchLines);
			manualSel.disabled = this.fetchMode !== 'manual';
		}
		if (hostCb) hostCb.checked = !!this.showHostnames;
		this.updateRowTintUi();
	},

	onShowHostnamesChange(ev) {
		this.showHostnames = !!(ev && ev.target && ev.target.checked);
		this.saveShowHostnames();
		/* Invalidate any in-flight resolve from the previous toggle state. */
		this.resolveGeneration = (this.resolveGeneration || 0) + 1;
		this.resolveInFlight = false;
		/* A toggle is an explicit retry; drop resolver pauses from the last state. */
		this.resolveErrorUntil = 0;
		if (this.resolveLoadShed) {
			this.resolveLoadShed = false;
			this.resolveShedUntil = 0;
			this.updateAdaptiveBanner();
		}

		/* Paint the existing cache immediately; resolving only fills misses. */
		if (this.tablePaused) this.updateStatus();
		else this.renderRows(true);
		if (this.showHostnames) this.resolveHostnamesForEntries(this.filteredRows());
	},

	onFetchModeChange(ev) {
		const mode = ev && ev.target ? ev.target.value : '';
		if (constants.FETCH_MODE_OPTIONS.indexOf(mode) < 0) return;
		this.fetchMode = mode;
		if (mode === 'manual' && !this.manualFetchLinesExplicit) {
			this.manualFetchLines = this.snapManualFetchLines(this.autoFetchLines());
			this.manualFetchLinesExplicit = true;
		}
		this.saveFetchMode();
		if (mode === 'manual') this.saveManualFetchLines();
		this.updateStreamControlsUi();
		this.updateHash(this.readFilters());
	},

	onManualFetchLinesChange(ev) {
		const n = parseInt(ev && ev.target ? ev.target.value : '', 10);
		if (constants.MANUAL_FETCH_LINES_OPTIONS.indexOf(n) < 0) return;
		this.manualFetchLines = n;
		this.manualFetchLinesExplicit = true;
		this.saveManualFetchLines();
		this.updateHash(this.readFilters());
	},

	onPauseClick() {
		const wasPaused = this.tablePaused;
		this.tablePaused = !this.tablePaused;
		this.updateStreamControlsUi();

		if (!wasPaused && this.tablePaused) {
			this.pauseBufferLoading = true;
			this.updateStatus();
			this.requestPoll()
				.catch(function () {})
				.finally(
					function () {
						this.pauseBufferLoading = false;
						if (this.ensurePollCoordinator().getState().disposed) return;
						this.updateStatus();
					}.bind(this)
				);
			return;
		}

		if (wasPaused && !this.tablePaused) {
			this.pauseBufferLoading = false;
			this.fillingBuffer = false;
			this.followLive = true;
			/* Merge pause buffer with the first live poll — do not replace. */
			this.resumeMerge = true;
			const epoch = this.currentPollEpoch();
			this.requestPoll()
				.then(() => {
					/* A hide/show bump abandons this epoch; the catch-up poll paints. */
					if (epoch === this.currentPollEpoch()) {
						this.resolvePaintPending = false;
						this.renderRows(true);
					}
				})
				.catch(function () {});
		}
	},

	onRowLimitChange(ev) {
		const n = parseInt(ev && ev.target ? ev.target.value : '', 10);
		if (!isFinite(n) || constants.ROW_LIMIT_OPTIONS.indexOf(n) < 0) return;

		this.applyRowLimit(n);
		this.saveRowLimit();
		this.updateHash(this.readFilters());
		this.updateAdaptiveBanner();
		/* Reset flood throttle so Limit changes paint even during ping -A. */
		this.ensureRenderScheduler().resetBudget();
		const cancelForce = this.ensureRenderScheduler().forceNextRender();
		this.renderRows(true);
		const epoch = this.currentPollEpoch();
		this.requestPoll()
			.then(() => {
				/* A hide/show bump abandons this epoch; the catch-up poll paints. */
				if (epoch !== this.currentPollEpoch()) return;
				if (this.tablePaused) this.updateStatus();
				else this.renderRows(true);
			})
			.finally(cancelForce);
	},

	limitSelectOptions() {
		const pairs = [];
		for (let i = 0; i < constants.ROW_LIMIT_OPTIONS.length; i++) {
			const n = constants.ROW_LIMIT_OPTIONS[i];
			pairs.push([String(n), String(n)]);
		}
		return optionNodes(pairs);
	},

	/* G Grouped: Common / Also seen / Exclude — curated PROTO values from logs. */
	protoSelectOptions() {
		return [
			E('option', { 'value': '' }, [_('Any protocol')]),
			E('optgroup', { 'label': _('Common') }, [
				E('option', { 'value': 'TCP' }, ['TCP']),
				E('option', { 'value': 'UDP' }, ['UDP']),
				E('option', { 'value': 'ICMP' }, ['ICMP']),
				E('option', { 'value': 'ICMPV6' }, [_('ICMPv6')])
			]),
			E('optgroup', { 'label': _('Also seen') }, [
				E('option', { 'value': 'IGMP' }, ['IGMP']),
				E('option', { 'value': 'GRE' }, ['GRE']),
				E('option', { 'value': 'ESP' }, ['ESP']),
				E('option', { 'value': 'AH' }, ['AH']),
				E('option', { 'value': 'SCTP' }, ['SCTP'])
			]),
			E('optgroup', { 'label': _('Exclude') }, [
				E('option', { 'value': '!TCP' }, [_('not TCP')]),
				E('option', { 'value': '!UDP' }, [_('not UDP')]),
				E('option', { 'value': '!ICMP' }, [_('not ICMP')]),
				E('option', { 'value': '!ICMPV6' }, [_('not ICMPv6')]),
				E('option', { 'value': '!IGMP' }, [_('not IGMP')]),
				E('option', { 'value': '!GRE' }, [_('not GRE')]),
				E('option', { 'value': '!ESP' }, [_('not ESP')]),
				E('option', { 'value': '!AH' }, [_('not AH')]),
				E('option', { 'value': '!SCTP' }, [_('not SCTP')])
			])
		];
	},

	filterClick(field, value, ev) {
		if (ev && ev.preventDefault) ev.preventDefault();

		if (!value) return;

		this.setFilterFieldValue(field, value);
		this.onFilterInput();
	},

	collectIpsFromEntries(entries) {
		const ips = new Set();

		for (let i = 0; i < entries.length; i++) {
			const r = entries[i];
			if (r.src && this.isLikelyIp(r.src)) ips.add(hostname.stripZone(r.src));
			if (r.dst && this.isLikelyIp(r.dst)) ips.add(hostname.stripZone(r.dst));
		}

		return Array.from(ips);
	},

	isLoadShedReply(res) {
		return res && typeof res === 'object' && res.disabled === 'load';
	},

	resolveNamesFromReply(res) {
		if (!res || typeof res !== 'object' || Array.isArray(res)) return null;
		if (Object.prototype.hasOwnProperty.call(res, 'error')) return null;
		if (Object.prototype.hasOwnProperty.call(res, 'names')) {
			return res.names && typeof res.names === 'object' && !Array.isArray(res.names)
				? res.names
				: null;
		}
		/* Legacy expect-unwrap replies are the names map itself. */
		return res;
	},

	async resolveHostnamesForEntries(entries) {
		if (!this.showHostnames || this.resolveInFlight) return;

		if (!this.hostnameCache) this.hostnameCache = new Map();
		if (!this.hostnameFailed) this.hostnameFailed = new Map();

		const ips = this.collectIpsFromEntries(entries);
		const need = [];
		const now = this.nowMs();
		/* While the router sheds resolve load, hold the paused banner without
		 * re-asking every poll — retry after the cooldown expires. */
		if (this.resolveLoadShed) {
			if (now < (this.resolveShedUntil || 0)) return;
			/* The cooldown is over; the next reply re-arms it if load persists. */
			this.resolveLoadShed = false;
			this.resolveShedUntil = 0;
			this.updateAdaptiveBanner();
		}
		/* Resolver errors carry no per-address signal: back off the whole call. */
		if (now < (this.resolveErrorUntil || 0)) return;

		for (let i = 0; i < ips.length && need.length < constants.RESOLVE_BATCH_MAX; i++) {
			const ip = ips[i];
			if (hostname.lruGet(this.hostnameCache, ip) !== undefined) continue;
			if (hostname.failIsHot(this.hostnameFailed, ip, now)) continue;
			need.push(ip);
		}

		if (!need.length) return;

		this.resolveGeneration = (this.resolveGeneration || 0) + 1;
		const gen = this.resolveGeneration;
		this.resolveInFlight = true;

		try {
			const res = await callFwliveResolve(need);
			if (gen !== this.resolveGeneration) return;

			if (this.isLoadShedReply(res)) {
				this.resolveLoadShed = true;
				this.resolveShedUntil = this.nowMs() + constants.RESOLVE_SHED_COOLDOWN_MS;
				this.updateAdaptiveBanner();
				return;
			}

			this.resolveLoadShed = false;
			this.resolveShedUntil = 0;
			/* Full reply: names map under .names; legacy expect-unwrap was the map. */
			const names = this.resolveNamesFromReply(res);
			/* RPC-level failures carry no per-address signal. Do not turn numeric,
			 * null, or malformed replies into negative hostname cache entries. */
			if (names === null) {
				this.resolveErrorUntil = this.nowMs() + hostname.FAIL_TTL_MS;
				return;
			}
			this.resolveErrorUntil = 0;
			const truncated = res && typeof res === 'object' && res.truncated === true;
			let updated = false;

			for (let i = 0; i < need.length; i++) {
				const ip = need[i];
				if (names[ip]) {
					hostname.lruSet(this.hostnameCache, ip, names[ip]);
					this.hostnameFailed.delete(ip);
					updated = true;
				} else if (Object.prototype.hasOwnProperty.call(names, ip) || !truncated) {
					/* Empty-string names are completed NXDOMAIN/timeout lookups.
					 * Truncated replies omit unprocessed addresses entirely. */
					hostname.failMark(this.hostnameFailed, ip, now);
				}
			}

			this.updateAdaptiveBanner();
			if (updated) this.scheduleResolvePaint();
		} catch (_e) {
			/* resolve unavailable — show IPs */
			if (gen === this.resolveGeneration)
				this.resolveErrorUntil = this.nowMs() + hostname.FAIL_TTL_MS;
		} finally {
			if (gen === this.resolveGeneration) this.resolveInFlight = false;
		}
	},

	setFilterFieldValue(field, value) {
		if (field === 'proto') return proto.setProtoFilterValue(value);

		const el = document.getElementById('fwlive-' + field);
		if (!el) return false;

		/* SELECT: ensure uncommon click-to-filter / hash values remain selectable. */
		if (el.tagName === 'SELECT' && value) {
			let found = false;
			for (let i = 0; i < el.options.length; i++) {
				if (el.options[i].value === value) {
					found = true;
					break;
				}
			}
			if (!found) el.appendChild(E('option', { 'value': value }, [value]));
		}

		el.value = value;
		if (el.tagName === 'SELECT') el.dispatchEvent(new Event('change', { bubbles: true }));

		return true;
	},

	clearFilter(field, ev) {
		if (ev && ev.preventDefault) ev.preventDefault();

		this.setFilterFieldValue(field, '');
		this.onFilterInput();
	},

	invertFilter(field, ev) {
		if (ev) {
			ev.preventDefault();
			ev.stopPropagation();
		}

		if (field === 'proto') {
			const cur = proto.readProtoFilter();
			if (!cur) return;
			proto.setProtoFilterValue(log.toggleFilterNegation(cur));
			this.onFilterInput();
			return;
		}

		const el = document.getElementById('fwlive-' + field);
		if (!el || !el.value) return;

		this.setFilterFieldValue(field, log.toggleFilterNegation(el.value));
		this.onFilterInput();
	},

	clearAllFilters(ev) {
		if (ev && ev.preventDefault) ev.preventDefault();

		for (let i = 0; i < this.FILTER_CHIP_FIELDS.length; i++) {
			const el = document.getElementById('fwlive-' + this.FILTER_CHIP_FIELDS[i].key);
			if (el) el.value = '';
		}
		const protoCustom = document.getElementById('fwlive-proto-custom');
		if (protoCustom) protoCustom.value = '';

		this.onFilterInput();
	},

	focusFilterFallback(field) {
		if (this.viewDisposed) return;
		let target = field ? document.getElementById('fwlive-' + field) : null;
		if (!target || typeof target.focus !== 'function')
			target = document.getElementById('fwlive-q');
		if (target && typeof target.focus === 'function') {
			const details = typeof target.closest === 'function' ? target.closest('details') : null;
			if (details && !details.open) details.open = true;
			target.focus();
		}
	},

	renderFilterChips() {
		const bar = document.getElementById('fwlive-chips');
		if (!bar || this.viewDisposed) return;

		if (!this._filterChipCallbacks) {
			this._filterChipCallbacks = {
				onInvert: (field, ev) => {
					if (!this.viewDisposed) this.invertFilter(field, ev);
					else {
						if (ev && ev.preventDefault) ev.preventDefault();
						if (ev && ev.stopPropagation) ev.stopPropagation();
					}
				},
				onClear: (field, ev) => {
					if (!this.viewDisposed) this.clearFilter(field, ev);
					else if (ev && ev.preventDefault) ev.preventDefault();
				},
				onClearAll: (ev) => {
					if (!this.viewDisposed) this.clearAllFilters(ev);
					else if (ev && ev.preventDefault) ev.preventDefault();
				},
				onFocusFallback: (field) => this.focusFilterFallback(field)
			};
		}

		chips.renderFilterChips(
			bar,
			{
				filters: Object.assign({}, this.readFilters()),
				chipFields: this.FILTER_CHIP_FIELDS
			},
			this._filterChipCallbacks
		);
	},

	readMessageLayout() {
		return storedValue('fwlive-msg-layout', '') === 'oneline' ? 'oneline' : 'wrap';
	},

	saveMessageLayout() {
		storeValue('fwlive-msg-layout', this.messageLayout);
	},

	updateMessageLayoutUi() {
		const scroll = document.getElementById('fwlive-scroll');
		const wrapBtn = document.getElementById('fwlive-msg-wrap');
		const onelineBtn = document.getElementById('fwlive-msg-oneline');
		const oneline = this.messageLayout === 'oneline';
		if (scroll) {
			scroll.classList.toggle('fwlive-msg-oneline', oneline);
			scroll.classList.toggle('fwlive-msg-wrap', !oneline);
		}
		if (wrapBtn) wrapBtn.setAttribute('aria-pressed', oneline ? 'false' : 'true');
		if (onelineBtn) onelineBtn.setAttribute('aria-pressed', oneline ? 'true' : 'false');
	},

	setMessageLayout(layout) {
		const next = layout === 'oneline' ? 'oneline' : 'wrap';
		if (next === this.messageLayout) return;

		this.messageLayout = next;
		this.saveMessageLayout();
		this.updateMessageLayoutUi();
		this.renderRows(true);
	},

	renderRows(force, focusRowId) {
		const el = document.getElementById('fwlive-table');
		if (!el || typeof el.querySelector !== 'function') return;

		const body = el.querySelector('tbody');
		const scroll = document.getElementById('fwlive-scroll');
		const activeElement = typeof document !== 'undefined' ? document.activeElement : null;
		const activeRowId = expansionButtonRowId(activeElement);
		const restoreRowId = focusRowId != null ? String(focusRowId) : activeRowId;

		const filtered = this.filteredRowsState();
		const rows = filtered.rows.slice();
		const paint = this.ensureRenderScheduler().shouldRender(
			rows,
			!!force,
			this.lastBatchNewIdCount
		);
		this.updateLoggingToolbarUi();

		if (!paint) {
			this.updateFloodBanner();
			this.syncEmptyScrollVisibility(rows.length);
			this.updateStatus(filtered);
			return;
		}

		this.updateFloodBanner();

		const prevScroll = scroll ? scroll.scrollTop : 0;

		this.syncEmptyScrollVisibility(rows.length);
		this.updateStatus(filtered);
		this.renderFilterChips();

		table.renderRows(
			body,
			{
				rows: rows.slice(),
				columns: this.activeColumns().slice(),
				/* force only bypasses the paint budget; the key sees expand/hostnames. */
				forceRender: false,
				viewMode: this.viewMode,
				messageLayout: this.messageLayout,
				expandedRowId: this.expandedRowId,
				rowTint: this.rowTintEnabled(),
				showHostnames: !!this.showHostnames,
				hostnameCache: this.hostnameCache
			},
			{
				onRowClick: (rowId, ev) => this.onRowClick(rowId, ev),
				onFilterClick: (field, value, ev) => this.filterClick(field, value, ev),
				actionRowTintClass: (action) => this.actionRowTintClass(action)
			}
		);
		const expansionFocusKept = restoreExpansionFocus(body, restoreRowId, activeElement);
		if (force && !this.isTabHidden()) this.resolvePaintPending = false;

		if (scroll) {
			if (!this.tablePaused && this.followLive && !expansionFocusKept) scroll.scrollTop = 0;
			else scroll.scrollTop = prevScroll;
		}

		this.ensureRenderScheduler().markRendered(rows);

		if (rows.length && this.rowTintEnabled() && !this.tintProbeDone) {
			const runProbe = () => {
				if (!this.tintProbeDone) this.probeRowTintPaint();
			};
			if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function')
				window.requestAnimationFrame(() => window.requestAnimationFrame(runProbe));
			else setTimeout(runProbe, 0);
		} else if (!this.rowTintEnabled() && this.tintFallbackActive) {
			this.clearTintFallback(document.querySelector('.fwlive-map'));
			this.tintProbeDone = false;
		}
	},

	onFilterInput() {
		this.updateHash(this.readFilters());
		this.renderRows(true);
	},

	onFilterInputDebounced() {
		if (this.filterInputTimer) clearTimeout(this.filterInputTimer);
		this.filterInputTimer = setTimeout(
			function () {
				this.filterInputTimer = null;
				this.onFilterInput();
			}.bind(this),
			constants.FILTER_INPUT_DEBOUNCE_MS
		);
	},

	onScrollArea(ev) {
		const scroll = ev && ev.target;
		if (!scroll || this.tablePaused) return;

		const now = scroll.scrollTop < 8;
		if (now === this.followLive) return;
		this.followLive = now;
		this.updateStatus();
	},

	attachHandlers() {
		const scroll = document.getElementById('fwlive-scroll');
		if (scroll) scroll.addEventListener('scroll', this.onScrollArea.bind(this));

		const ids = ['q', 'action', 'interface', 'src', 'dst', 'sport', 'dport'];
		for (let i = 0; i < ids.length; i++) {
			const el = document.getElementById('fwlive-' + ids[i]);
			if (!el) continue;
			/* Text inputs: debounce rebuilds. Selects: apply immediately. */
			if (el.tagName === 'SELECT')
				el.addEventListener('change', this.onFilterInput.bind(this));
			else el.addEventListener('input', this.onFilterInputDebounced.bind(this));
		}

		const protoSel = document.getElementById('fwlive-proto');
		const protoCustom = document.getElementById('fwlive-proto-custom');
		if (protoSel) {
			protoSel.addEventListener(
				'change',
				function () {
					if (protoCustom) protoCustom.value = '';
					this.onFilterInput();
				}.bind(this)
			);
		}
		if (protoCustom) {
			protoCustom.addEventListener(
				'input',
				function () {
					if (protoCustom.value.trim() && protoSel) protoSel.value = '';
					this.onFilterInputDebounced();
				}.bind(this)
			);
		}

		const pauseBtn = document.getElementById('fwlive-pause');
		if (pauseBtn) pauseBtn.addEventListener('click', this.onPauseClick.bind(this));

		const limitSel = document.getElementById('fwlive-limit');
		if (limitSel) limitSel.addEventListener('change', this.onRowLimitChange.bind(this));

		const modeSel = document.getElementById('fwlive-fetch-mode');
		if (modeSel) modeSel.addEventListener('change', this.onFetchModeChange.bind(this));

		const manualSel = document.getElementById('fwlive-manual-lines');
		if (manualSel)
			manualSel.addEventListener('change', this.onManualFetchLinesChange.bind(this));

		const hostCb = document.getElementById('fwlive-show-hostnames');
		if (hostCb) hostCb.addEventListener('change', this.onShowHostnamesChange.bind(this));

		const tintCb = document.getElementById('fwlive-row-tint-toggle');
		if (tintCb) tintCb.addEventListener('change', this.onRowTintEnabledChange.bind(this));

		const tintSel = document.getElementById('fwlive-row-tint');
		if (tintSel) tintSel.addEventListener('change', this.onRowTintPaletteChange.bind(this));

		const summaryRows = document.getElementById('fwlive-summary-rows');
		if (summaryRows) summaryRows.addEventListener('click', this.onSummaryRowsToggle.bind(this));
	},

	requestPoll() {
		return this.ensurePollCoordinator().requestPoll();
	},

	/* Join the request LuCI poll.add may already have fired. */
	catchUpPoll() {
		return this.ensurePollCoordinator().catchUp();
	},

	async runPollRequest(epoch) {
		try {
			try {
				await this.fetchEntries();
			} catch (_e) {
				/* fetchEntries already accounts the poll RTT for every rpc
				 * outcome; a throw here is a local normalize/buffer bug, not
				 * network slowness, so count nothing further. */
				this.markLocalPollFailure(epoch);
			}

			if (epoch !== this.currentPollEpoch()) return;

			/* Pause freezes row rendering but polling remains active for health and
			 * cadence state; summary mode can therefore appear while rows are paused
			 * and stays behind the explicit Show rows control. */
			if (this.tablePaused) this.updateStatus();
			else if (this.summaryMode) {
				this.renderSummary();
				this.updateStatus();
				if (this.summaryRowsShown) {
					const forceHostnamePaint = this.resolvePaintPending;
					this.resolvePaintPending = false;
					this.scheduleRenderRows(forceHostnamePaint);
				}
			} else {
				/* Stale resume skips renderRows(true); catch-up polls must still
				 * flush coalesced hostname paints. */
				const forceHostnamePaint = this.resolvePaintPending;
				this.resolvePaintPending = false;
				this.scheduleRenderRows(forceHostnamePaint);
			}

			try {
				await this.resolveHostnamesForEntries(this.filteredRows());
			} catch (_e) {
				/* resolve unavailable — show IPs */
			}
		} catch (_e) {
			/* Keep the coordinator promise settling so a queued refresh cannot
			 * be stranded by an unexpected local rendering failure. */
			this.markLocalPollFailure(epoch);
		}
	},

	/* No error code: the status line reports it as a lost connection. */
	markLocalPollFailure(epoch) {
		if (epoch !== this.currentPollEpoch()) return;
		this.lastPollError = true;
		this.lastPollErrorCode = null;
	},

	load() {
		/* A late LuCI lifecycle callback may re-enter load() after pagehide has
		 * made disposal terminal; do not restore state or re-register polling. */
		if (this.viewDisposed) return Promise.resolve();
		/* RPC-affecting preferences must precede poll registration and the first
		 * request; filter widgets still restore in addFooter after render. */
		this.resolveRpcPreferences();
		const coordinator = this.ensurePollCoordinator();
		if (coordinator.getState().disposed) return Promise.resolve();
		if (!this.pagehideHandler && typeof window !== 'undefined' && window.addEventListener) {
			this.pagehideHandler = function (ev) {
				/* A persisted pagehide enters BFCache; keep this view resumable. */
				if (ev && ev.persisted) return;
				this.disposeView();
			}.bind(this);
			window.addEventListener('pagehide', this.pagehideHandler);
		}
		coordinator.startPolling();
		/* Join the bootstrap request before metadata can outlast it. Later
		 * refresh, resume and visibility catch-ups must still request fresh data. */
		const startupPoll = this.catchUpPoll();
		return Promise.all([startupPoll, this.loadRulesMap(), this.loadLoggingStatus()]).then(
			() => undefined
		);
	},

	renderDisplayDrawer() {
		return E('div', { 'id': 'fwlive-display-drawer', 'class': 'fwlive-display-bar' }, [
			E('span', { 'class': 'fwlive-display-bar-label' }, [_('Display options')]),
			E('div', { 'class': 'fwlive-display-controls' }, [
				E('label', { 'class': 'fwlive-display-ctl', 'for': 'fwlive-limit' }, [
					_('Limit'),
					E(
						'select',
						{
							'id': 'fwlive-limit',
							'class': 'cbi-input-select'
						},
						this.limitSelectOptions()
					)
				]),
				E('label', { 'class': 'fwlive-display-ctl', 'for': 'fwlive-fetch-mode' }, [
					_('Fetch budget'),
					E(
						'select',
						{
							'id': 'fwlive-fetch-mode',
							'class': 'cbi-input-select',
							'aria-controls': 'fwlive-manual-lines'
						},
						this.fetchModeOptions()
					)
				]),
				E('label', { 'class': 'fwlive-display-ctl', 'for': 'fwlive-manual-lines' }, [
					_('Maximum raw lines'),
					E(
						'select',
						{
							'id': 'fwlive-manual-lines',
							'class': 'cbi-input-select',
							'title': _('Manual still uses server protection and poll cadence')
						},
						this.manualFetchLinesOptions()
					)
				]),
				E('label', { 'class': 'fwlive-display-ctl' }, [
					E('input', {
						'id': 'fwlive-row-tint-toggle',
						'type': 'checkbox',
						'title': _('Show pass/deny row background colors')
					}),
					_('Row tint')
				]),
				E(
					'label',
					{
						'id': 'fwlive-row-tint-palette-wrap',
						'class': 'fwlive-display-ctl',
						'for': 'fwlive-row-tint'
					},
					[
						_('Palette'),
						E(
							'select',
							{
								'id': 'fwlive-row-tint',
								'class': 'cbi-input-select',
								'title': _('Classic uses green/red; Accessible uses teal/orange')
							},
							this.rowTintPaletteOptions()
						)
					]
				),
				E('label', { 'class': 'fwlive-display-ctl' }, [
					E('input', {
						'id': 'fwlive-show-hostnames',
						'type': 'checkbox'
					}),
					_('Show hostnames')
				])
			])
		]);
	},

	renderHelpNodes() {
		return E('div', { 'class': 'fwlive-help-row' }, [
			E('details', { 'id': 'fwlive-help', 'class': 'fwlive-help' }, [
				E('summary', {}, [_('Help')]),
				E('ul', {}, [
					E('li', {}, [
						_(
							'The table updates automatically when your firewall logs traffic. Use Pause if it moves too fast.'
						)
					]),
					E('li', {}, [
						_(
							'Enable logging turns on WAN zone drop/reject logging only (same as Network → Firewall). It does not add rules or log normal LAN browsing.'
						)
					]),
					E('li', {}, [
						_(
							'Display options set Limit, Fetch budget, Maximum raw lines, row tint, palette, and hostnames.'
						)
					]),
					E('li', {}, [
						_(
							'Summary mode: when the router responds slowly, a compact summary replaces the table. Use Show rows to see the table; it returns automatically after three fast polls.'
						)
					]),
					E('li', {}, [
						_(
							'Fetch budget controls raw log lines per poll. Auto derives from Limit; Manual selects a bounded maximum.'
						)
					]),
					E('li', {}, [
						_(
							'Manual still uses server protection and poll cadence; it changes the fetch budget, not the polling interval.'
						)
					]),
					E('li', {}, [
						_(
							'For a responsive table on a weak device, keep Limit at 250 rows or below. The weak-device cap affects rendered rows; the buffer can still retain more.'
						)
					]),
					E('li', {}, [
						_(
							'Switching tabs pauses polling; returning performs one catch-up poll. Hostnames are off by default because lookups add work.'
						)
					]),
					E('li', {}, [
						_(
							'The router log ring may evict older events before fwlive reads them. fwlive cannot recover evicted entries or change forwarding behavior.'
						)
					]),
					E('li', {}, [
						_(
							'The rate shown for WAN logging is the firewall zone log_limit. OpenWrt defaults to 10/minute when no explicit limit is configured; fwlive does not impose this cap.'
						)
					]),
					E('li', { 'id': 'fwlive-manual-test' }, []),
					E('li', {}, [
						_(
							'In Simple view, activate the message button or click a row to show or hide the full message.'
						)
					]),
					E('li', {}, [
						_(
							'Click an IP, action, or protocol to filter; use the Protocol menu (or ≠ on a chip) to exclude.'
						)
					]),
					E('li', {}, [
						_(
							'Row tint shows pass/deny row backgrounds when checked. Choose Classic (green/red, default) or Accessible (teal/orange). Action text stays colored either way.'
						)
					]),
					E('li', {}, [_('Use Detail for all columns (flags, length, raw message).')]),
					E('li', {}, [
						_(
							'If Row tint looks missing, the active LuCI theme may omit success/error or info/warn CSS variables; fwlive falls back to local colors (air-gapped, no data leaves the device).'
						)
					])
				])
			]),
			E(
				'span',
				{
					'id': 'fwlive-build',
					'class': 'fwlive-build',
					'title': 'luci-app-fwlive'
				},
				['v' + constants.APP_VERSION]
			)
		]);
	},

	render() {
		/* LuCI may finish the load/render/addFooter sequence after pagehide. */
		if (this.viewDisposed) return E('div', { 'class': 'cbi-map' });
		return E(
			'div',
			{ 'class': 'cbi-map fwlive-map', 'data-view': 'simple', 'data-row-tint': 'classic' },
			[
				E('style', {}, [css.styleText]),
				E('div', { 'id': 'fwlive-title-row', 'class': 'fwlive-title-row' }, [
					E('h2', {}, [
						_('Firewall Live View'),
						E('span', { 'id': 'fwlive-backend', 'class': 'fwlive-backend' }, [''])
					]),
					E('div', { 'class': 'fwlive-title-status' }, [
						E(
							'span',
							{
								'id': 'fwlive-watch-dot',
								'class': 'fwlive-dot fwlive-dot-on',
								'aria-hidden': 'true'
							},
							['']
						),
						E('span', { 'id': 'fwlive-watch-label', 'class': 'fwlive-watch-label' }, [
							_('Watching')
						]),
						E('span', { 'id': 'fwlive-status', 'class': 'fwlive-status' }, ['']),
						E(
							'span',
							{
								'id': 'fwlive-tint-warn',
								'class': 'fwlive-tint-warn',
								'title': _(
									'Row tint used a local color fallback because the active LuCI theme did not apply pass/deny backgrounds.'
								)
							},
							[_('Theme tint fallback')]
						)
					])
				]),
				E(
					'details',
					{
						'id': 'fwlive-rules-details',
						'class': 'fwlive-rules-details',
						'style': 'display:none'
					},
					[
						E('summary', { 'aria-label': _('Rule name details') }, [_('Details')]),
						E('div', { 'id': 'fwlive-rules-details-body' }, [])
					]
				),
				E('div', { 'id': 'fwlive-watch-strip', 'class': 'fwlive-watch-strip' }, [
					E('div', { 'class': 'fwlive-watch-group' }, [
						E(
							'button',
							{
								'id': 'fwlive-pause',
								'class': 'cbi-button fwlive-btn-ghost',
								'type': 'button'
							},
							[_('Pause')]
						),
						E('span', { 'id': 'fwlive-logging-bar', 'class': 'fwlive-logging-bar' }, [])
					]),
					E('div', { 'class': 'fwlive-watch-group' }, [
						E('span', { 'class': 'fwlive-watch-group-label' }, [_('View')]),
						E(
							'div',
							{
								'class': 'fwlive-watch-seg',
								'role': 'group',
								'aria-label': _('View')
							},
							[
								E(
									'button',
									{
										'id': 'fwlive-view-simple',
										'class': 'cbi-button fwlive-seg-btn',
										'type': 'button',
										'aria-pressed': 'true',
										'click': () => this.setViewMode('simple')
									},
									[_('Simple')]
								),
								E(
									'button',
									{
										'id': 'fwlive-view-detail',
										'class': 'cbi-button fwlive-seg-btn',
										'type': 'button',
										'aria-pressed': 'false',
										'click': () => this.setViewMode('detailed')
									},
									[_('Detail')]
								)
							]
						)
					]),
					E(
						'div',
						{
							'id': 'fwlive-msg-group',
							'class': 'fwlive-watch-group'
						},
						[
							E('span', { 'class': 'fwlive-watch-group-label' }, [_('Message')]),
							E(
								'div',
								{
									'id': 'fwlive-msg-seg',
									'class': 'fwlive-watch-seg',
									'role': 'group',
									'aria-label': _('Message')
								},
								[
									E(
										'button',
										{
											'id': 'fwlive-msg-wrap',
											'class': 'cbi-button fwlive-seg-btn',
											'type': 'button',
											'aria-pressed': 'true',
											'click': () => this.setMessageLayout('wrap')
										},
										[_('Wrap')]
									),
									E(
										'button',
										{
											'id': 'fwlive-msg-oneline',
											'class': 'cbi-button fwlive-seg-btn',
											'type': 'button',
											'aria-pressed': 'false',
											'click': () => this.setMessageLayout('oneline')
										},
										[_('One line')]
									)
								]
							)
						]
					)
				]),
				E('div', { 'id': 'fwlive-flood', 'class': 'fwlive-flood' }, ['']),
				E('div', { 'id': 'fwlive-adaptive', 'class': 'fwlive-adaptive' }, ['']),
				E(
					'div',
					{ 'id': 'fwlive-summary', 'class': 'fwlive-summary', 'style': 'display:none' },
					[
						E('div', { 'class': 'fwlive-summary-head' }, [
							E('strong', {}, [_('Summary mode')]),
							E(
								'button',
								{
									'id': 'fwlive-summary-rows',
									'class': 'cbi-button fwlive-btn-ghost',
									'type': 'button',
									'aria-pressed': 'false'
								},
								[_('Show rows')]
							)
						]),
						E('pre', { 'id': 'fwlive-summary-body', 'class': 'fwlive-summary-body' }, [
							''
						])
					]
				),
				this.renderDisplayDrawer(),
				E(
					'div',
					{ 'id': 'fwlive-filter-panel', 'class': 'fwlive-filter-panel fwlive-find-row' },
					[
						E('div', { 'class': 'fwlive-grid fwlive-grid-core' }, [
							E('input', {
								'id': 'fwlive-q',
								'class': 'cbi-input-text',
								'placeholder': _('Quick search')
							}),
							E(
								'select',
								{
									'id': 'fwlive-action',
									'class': 'cbi-input-select',
									'aria-label': String(_('Filter by %s').format(_('Action')))
								},
								[
									E('option', { 'value': '' }, [_('Any action')]),
									E('option', { 'value': 'pass' }, [_('pass')]),
									E('option', { 'value': 'block' }, [_('block')]),
									E('option', { 'value': 'drop' }, [_('drop')]),
									E('option', { 'value': 'reject' }, [_('reject')]),
									E('option', { 'value': 'unknown' }, [_('unknown')]),
									E('option', { 'value': '!pass' }, [_('not pass')]),
									E('option', { 'value': '!drop' }, [_('not drop')]),
									E('option', { 'value': '!block' }, [_('not block')]),
									E('option', { 'value': '!reject' }, [_('not reject')]),
									E('option', { 'value': '!unknown' }, [_('not unknown')])
								]
							),
							E('div', { 'class': 'fwlive-proto-pair' }, [
								E(
									'select',
									{
										'id': 'fwlive-proto',
										'class': 'cbi-input-select',
										'title': _('Protocol — common values')
									},
									this.protoSelectOptions()
								),
								E('input', {
									'id': 'fwlive-proto-custom',
									'class': 'cbi-input-text',
									'placeholder': _('or type…'),
									'title': _(
										'Custom protocol (prefix ! to exclude). Overrides the menu when set.'
									),
									'autocomplete': 'off'
								})
							])
						]),
						E(
							'details',
							{ 'id': 'fwlive-more-filters', 'class': 'fwlive-more-filters' },
							[
								E('summary', {}, [_('More filters')]),
								E('div', { 'class': 'fwlive-grid fwlive-grid-extra' }, [
									E('input', {
										'id': 'fwlive-interface',
										'class': 'cbi-input-text',
										'placeholder': _('Interface (prefix ! to exclude)')
									}),
									E('input', {
										'id': 'fwlive-src',
										'class': 'cbi-input-text',
										'placeholder': _('Source IP contains (! to exclude)')
									}),
									E('input', {
										'id': 'fwlive-sport',
										'class': 'cbi-input-text',
										'placeholder': _('Source port (! to exclude)')
									}),
									E('input', {
										'id': 'fwlive-dst',
										'class': 'cbi-input-text',
										'placeholder': _('Destination IP contains (! to exclude)')
									}),
									E('input', {
										'id': 'fwlive-dport',
										'class': 'cbi-input-text',
										'placeholder': _('Destination port (! to exclude)')
									})
								])
							]
						)
					]
				),
				E('div', { 'id': 'fwlive-chips', 'class': 'fwlive-chips' }, []),
				E('p', { 'class': 'fwlive-hint-line' }, [
					_(
						'Click a cell to filter · ≠ on a chip to exclude · Ctrl+click a rule for firewall settings · in Simple view, activate the message button or click a row to show or hide the full message'
					)
				]),
				E(
					'div',
					{
						'id': 'fwlive-empty',
						'class': 'fwlive-empty',
						'style': 'display:none'
					},
					[]
				),
				E('div', { 'id': 'fwlive-scroll', 'class': 'fwlive-scroll fwlive-msg-wrap' }, [
					E('table', { 'id': 'fwlive-table', 'class': 'table cbi-section-table' }, [
						E('thead', {}, E('tr', {}, [])),
						E('tbody', {}, [])
					])
				]),
				this.renderHelpNodes()
			]
		);
	},

	addFooter() {
		if (this.viewDisposed) return;
		this.viewMode = this.readViewMode();
		this.messageLayout = this.readMessageLayout();
		this.showHostnames = this.readShowHostnames();
		this.rowTint = this.readRowTint();
		this.rowTintPalette = this.readRowTintPalette();
		this.hostnameCache = new Map();
		this.hostnameFailed = new Map();
		this.resolveGeneration = 0;
		this.lastPollError = false;
		this.lastPollErrorCode = null;
		this.applyHash();
		this.attachHandlers();
		this.applyRowTintMode();
		this.updateRowTintUi();
		this.updateMessageLayoutUi();
		this.updateStreamControlsUi();
		this.updateDetailToggleUi();
		this.renderThead();
		this.updateLoggingToolbarUi();
		this.updateEmptyStateUi();
		this.updateBackendUi();
		this.updateTintWarnUi();
		this.updateHash(this.readFilters());
		this.renderRows(true);
		const testLi = document.getElementById('fwlive-manual-test');
		if (testLi)
			logging.renderManualTestNodes(testLi, { firewallBackend: this.firewallBackend }, {});
		if (this.showHostnames) this.resolveHostnamesForEntries(this.filteredRows());
	}
});
