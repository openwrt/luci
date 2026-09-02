'use strict';
/*
 * LuCI Firewall Live View — client-side view (view.extend + ubus fwlive.poll).
 * UI interaction patterns inspired by OPNsense Live View; original implementation
 * for OpenWrt (Apache-2.0). See docs/fwlive-ui-design-target.md in the fwlive repo.
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

const callFwlivePoll = rpc.declare({
	object: 'fwlive',
	method: 'poll',
	params: [ 'addresses' ]
	/* Full reply object kept so reply.error reaches fetchEntries (#233). */
});

const callFwliveRules = rpc.declare({
	object: 'fwlive',
	method: 'rules'
});

const callFwliveResolve = rpc.declare({
	object: 'fwlive',
	method: 'resolve',
	params: [ 'addresses' ],
	expect: { names: {} }
});

const callFwliveLoggingStatus = rpc.declare({
	object: 'fwlive',
	method: 'logging_status',
	expect: { '': {
		wan_zone: null,
		wan_log: false,
		wan_log_limit: null,
		nf_log_ipv4: false,
		nf_log_ipv6: false,
		ready: false,
		blockers: [],
		warnings: []
	} }
});

const callFwliveEnableLogging = rpc.declare({
	object: 'fwlive',
	method: 'enable_wan_logging',
	expect: { '': { ok: false, changed: false, wan_zone: null } }
});

const callFwliveDisableLogging = rpc.declare({
	object: 'fwlive',
	method: 'disable_wan_logging',
	expect: { '': { ok: false, changed: false, wan_zone: null } }
});

function storedValue(key, fallback) {
	try {
		const v = localStorage.getItem(key);
		return (v === null) ? fallback : v;
	} catch (e) {
		return fallback;
	}
}

function storeValue(key, value) {
	try {
		localStorage.setItem(key, value);
	} catch (e) {
		/* private mode / no storage */
	}
}

function optionNodes(pairs) {
	const opts = [];
	for (let i = 0; i < pairs.length; i++)
		opts.push(E('option', { 'value': pairs[i][0] }, [ pairs[i][1] ]));
	return opts;
}

return view.extend({
	rowLimit: constants.DEFAULT_ROW_LIMIT,
	entries: [],
	sessionSeen: null,
	pauseBufferLoading: false,
	paused: false,
	/* One-shot: first live poll after unpause merges instead of replacing (#43). */
	resumeMerge: false,
	pollFn: null,
	pollDataInFlight: false,
	filterInputTimer: null,
	messageLayout: 'wrap',
	renderBucket: constants.RENDER_CAP_PER_SEC,
	renderBucketMs: 0,
	floodSuppressed: false,
	pendingForceRender: false,
	lastPollNewEvents: 0,
	showHostnames: false,
	rowTint: constants.DEFAULT_ROW_TINT,
	/* Last non-off palette so toggling tint back on restores Classic/Accessible. */
	rowTintPalette: 'classic',
	hostnameCache: null,
	hostnameFailed: null,
	resolveInFlight: false,
	resolveGeneration: 0,
	lastPollError: false,
	lastRulesError: null,
	lastRenderedRowCount: 0,
	lastRenderedHeadId: '',
	followLive: true,
	rulesMap: {},
	firewallBackend: 'nft',
	viewMode: 'simple',
	expandedRowId: null,
	loggingStatus: null,
	loggingBusy: false,
	loggingNotice: '',
	/* Session-only dismiss of first-run consent (Not now without checkbox). */
	consentDismissedSession: false,
	_loggingToolbarSig: '',
	_loggingEmptySig: '',
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
			return el ? (el.value || '') : '';
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
			.filter((k) => filters[k])
			.map((k) => '%s=%s'.format(encodeURIComponent(k), encodeURIComponent(filters[k])));
		if (this.rowLimit !== constants.DEFAULT_ROW_LIMIT)
			parts.push('limit=%s'.format(encodeURIComponent(this.rowLimit)));
		if (this.viewMode === 'detailed')
			parts.push('view=detailed');
		location.hash = parts.join('&');
	},

	applyHash() {
		if (!location.hash || location.hash.length < 2)
			return;

		const entries = location.hash.substring(1).split('&');
		for (let i = 0; i < entries.length; i++) {
			const kv = entries[i].split('=');
			if (kv.length !== 2)
				continue;
			const key = decodeURIComponent(kv[0]);
			const val = decodeURIComponent(kv[1]);
			if (key === 'limit') {
				const n = parseInt(val, 10);
				if (isFinite(n) && constants.ROW_LIMIT_OPTIONS.indexOf(n) >= 0) {
					this.applyRowLimit(n);
					this.saveRowLimit();
				}
				continue;
			}
			if (key === 'view') {
				if (val === 'advanced' || val === 'detailed')
					this.viewMode = 'detailed';
				else if (val === 'simple')
					this.viewMode = 'simple';
				continue;
			}
			const el = document.getElementById('fwlive-' + key);
			if (key === 'proto') {
				proto.setProtoFilterValue(val);
				continue;
			}
			if (el)
				el.value = val;
		}
	},

	readViewMode() {
		const v = storedValue('fwlive-view-mode', null);
		if (v === 'advanced' || v === 'detailed')
			return 'detailed';
		if (v === 'simple')
			return 'simple';
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
		if (v === null)
			return constants.DEFAULT_ROW_TINT;
		/* Migrate pre-mode checkbox storage. */
		if (v === '1' || v === 'true')
			return 'classic';
		if (v === '0' || v === 'false')
			return 'off';
		if (constants.ROW_TINT_OPTIONS.indexOf(v) >= 0)
			return v;
		return constants.DEFAULT_ROW_TINT;
	},

	saveRowTint() {
		storeValue('fwlive-row-tint', this.rowTint);
	},

	rowTintPaletteOptions() {
		return optionNodes([
			[ 'classic', _('Classic (green/red)') ],
			[ 'accessible', _('Accessible (teal/orange)') ]
		]);
	},

	rowTintEnabled() {
		return this.rowTint === 'classic' || this.rowTint === 'accessible';
	},

	applyRowTintMode() {
		const map = document.querySelector('.fwlive-map');
		if (!map)
			return;

		map.setAttribute('data-row-tint', this.rowTint);
		if (!this.rowTintEnabled() && this.tintFallbackActive)
			this.clearTintFallback(map);
	},

	onRowTintEnabledChange(ev) {
		const on = !!(ev && ev.target && ev.target.checked);
		if (on) {
			const pal = (this.rowTintPalette === 'accessible') ? 'accessible' : 'classic';
			this.rowTintPalette = pal;
			this.rowTint = pal;
		} else {
			if (this.rowTintEnabled())
				this.rowTintPalette = this.rowTint;
			this.rowTint = 'off';
		}
		this.commitRowTintChange();
	},

	commitRowTintChange() {
		this.saveRowTint();
		this.tintProbeDone = false;
		this.applyRowTintMode();
		this.updateRowTintUi();
		this.renderRows(true);
	},

	onRowTintPaletteChange(ev) {
		const v = ev && ev.target ? ev.target.value : 'classic';
		const pal = (v === 'accessible') ? 'accessible' : 'classic';
		this.rowTintPalette = pal;
		if (!this.rowTintEnabled())
			return;
		this.rowTint = pal;
		this.commitRowTintChange();
	},

	updateRowTintUi() {
		const on = this.rowTintEnabled();
		const cb = document.getElementById('fwlive-row-tint-toggle');
		if (cb)
			cb.checked = on;

		const wrap = document.getElementById('fwlive-row-tint-palette-wrap');
		if (wrap) {
			if (on)
				wrap.classList.remove('fwlive-hidden');
			else
				wrap.classList.add('fwlive-hidden');
		}

		const tintSel = document.getElementById('fwlive-row-tint');
		if (tintSel) {
			const pal = on ? this.rowTint : this.rowTintPalette;
			tintSel.value = (pal === 'accessible') ? 'accessible' : 'classic';
		}
	},

	actionRowTintClass(action) {
		const a = (action || '').toLowerCase();
		if (a === 'pass')
			return 'fwlive-row-pass';
		if (a === 'drop' || a === 'reject' || a === 'block')
			return 'fwlive-row-deny';
		return '';
	},

	applyTintFallback(map) {
		if (!map)
			return;

		const pair = tint.hexPairForMode(this.rowTint);
		map.style.setProperty('--fwlive-pass-color', pair.pass);
		map.style.setProperty('--fwlive-deny-color', pair.deny);
		map.setAttribute('data-tint-fallback', '1');
		this.tintFallbackActive = true;
		this.updateTintWarnUi();
	},

	clearTintFallback(map) {
		if (!map)
			return;

		map.style.removeProperty('--fwlive-pass-color');
		map.style.removeProperty('--fwlive-deny-color');
		map.removeAttribute('data-tint-fallback');
		this.tintFallbackActive = false;
		this.updateTintWarnUi();
	},

	updateTintWarnUi() {
		const el = document.getElementById('fwlive-tint-warn');
		if (!el)
			return;

		el.style.display = this.tintFallbackActive ? 'inline' : 'none';
	},

	probeRowTintPaint() {
		const map = document.querySelector('.fwlive-map');
		const body = document.querySelector('#fwlive-table tbody');
		if (!map || !body)
			return;

		/* Prefer a non-alt row — zebra --background-color-medium can look "tinted" when transparent. */
		let tr = body.querySelector('tr:not(.fwlive-row-alt)');
		if (!tr)
			tr = body.querySelector('tr');
		if (!tr)
			return;

		const td = tr.querySelector('td');
		if (!td || typeof getComputedStyle !== 'function')
			return;

		const hadPass = tr.classList.contains('fwlive-row-pass');
		const hadDeny = tr.classList.contains('fwlive-row-deny');
		const probeClass = hadDeny ? 'fwlive-row-deny' : 'fwlive-row-pass';

		tr.classList.remove('fwlive-row-pass', 'fwlive-row-deny');
		const offBg = getComputedStyle(td).backgroundColor;
		tr.classList.add(probeClass);
		const onBg = getComputedStyle(td).backgroundColor;

		tr.classList.remove('fwlive-row-pass', 'fwlive-row-deny');
		if (hadPass)
			tr.classList.add('fwlive-row-pass');
		if (hadDeny)
			tr.classList.add('fwlive-row-deny');

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
		if (broken)
			this.applyTintFallback(map);
		else if (this.tintFallbackActive)
			this.clearTintFallback(map);
		else
			this.updateTintWarnUi();
	},

	isLikelyIp(addr) {
		if (!addr)
			return false;

		return /^[\da-fA-F:.]+$/.test(addr);
	},

	activeColumns() {
		return constants.COLUMN_SETS[this.viewMode] || constants.COLUMN_SETS.simple;
	},

	setViewMode(mode) {
		if (constants.VIEW_MODES.indexOf(mode) < 0 || mode === this.viewMode)
			return;

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
		if (simpleBtn)
			simpleBtn.setAttribute('aria-pressed', detailed ? 'false' : 'true');
		if (detailBtn)
			detailBtn.setAttribute('aria-pressed', detailed ? 'true' : 'false');

		const map = document.querySelector('.fwlive-map');
		if (map)
			map.setAttribute('data-view', this.viewMode);

		this.updateFilterPanelUi();
	},

	updateFilterPanelUi() {
		const details = document.getElementById('fwlive-more-filters');
		if (!details)
			return;

		if (this.viewMode === 'detailed') {
			details.open = true;
			return;
		}

		const filters = this.readFilters();
		const hasExtra = !!(filters.interface || filters.src || filters.dst
			|| filters.sport || filters.dport);
		if (hasExtra)
			details.open = true;
	},

	onRowClick(rowId, ev) {
		if (this.viewMode !== 'simple')
			return;

		if (ev && ev.target && ev.target.closest
			&& ev.target.closest('a.fwlive-filter-link'))
			return;

		this.expandedRowId = this.expandedRowId === rowId ? null : rowId;
		this.renderRows(true);
	},

	renderThead() {
		const el = document.getElementById('fwlive-table');
		if (!el)
			return;

		table.renderThead(el, { columns: this.activeColumns().slice() }, {});
	},

	async loadRulesMap() {
		try {
			const res = await callFwliveRules();
			this.rulesMap = (res && res.rules) || {};
			this.firewallBackend = (res && res.backend) || 'nft';
			/* Bounds / mktemp failures are reply.error — same idea as poll (#245). */
			this.lastRulesError = (res && res.error) || null;
			if (this.lastRulesError)
				console.warn('fwlive rules map error:', this.lastRulesError);
		} catch (e) {
			this.rulesMap = {};
			this.firewallBackend = 'nft';
			this.lastRulesError = 'rules_unavailable';
		}
		this.updateBackendUi();
	},

	backendDisplayLabel() {
		if (this.firewallBackend === 'iptables')
			return _('using iptables');
		if (this.firewallBackend === 'nft')
			return _('using fw4');
		return '';
	},

	updateBackendUi() {
		const map = document.querySelector('.fwlive-map');
		if (map)
			map.setAttribute('data-backend', this.firewallBackend || 'unknown');

		const label = document.getElementById('fwlive-backend');
		if (label) {
			let text = this.backendDisplayLabel();
			let degraded = false;
			if (this.lastRulesError) {
				let err = '';
				if (this.lastRulesError === 'rules_truncated')
					err = _('Rule labels incomplete — map truncated');
				else if (this.lastRulesError === 'mktemp_failed')
					err = _('Rule labels unavailable — temp file failed');
				else
					err = _('Rule labels unavailable');
				text = text ? text + ' \u00b7 ' + err : err;
				degraded = true;
			}
			const warnings = (this.loggingStatus && this.loggingStatus.warnings) || [];
			if (warnings.indexOf('timeout_missing') >= 0) {
				const warn = _('Limited diagnostics — timeout command missing');
				text = text ? text + ' \u00b7 ' + warn : warn;
				degraded = true;
			}
			label.textContent = text;
			/* add/remove — classList.toggle(name, force) is unsupported on some 21.02-era browsers */
			if (degraded)
				label.classList.add('fwlive-backend-warn');
			else
				label.classList.remove('fwlive-backend-warn');
		}

		this.updateEmptyStateUi();
	},

	async loadLoggingStatus() {
		try {
			this.loggingStatus = await callFwliveLoggingStatus();
		} catch (e) {
			this.loggingStatus = null;
		}
		this.updateBackendUi();
		this.updateLoggingToolbarUi();
		this.updateEmptyStateUi();
	},

	async handleEnableLogging() {
		if (this.loggingBusy)
			return;

		this.loggingBusy = true;
		this.loggingNotice = '';
		this.updateEmptyStateUi();
		this.updateLoggingToolbarUi();

		try {
			const res = await callFwliveEnableLogging();
			if (!res || !res.ok) {
				if (res && res.error === 'nf_log_missing')
					this.loggingNotice = _('Cannot enable logging until kernel log modules are installed.');
				else if (res && res.error === 'firewall_changes_pending')
					this.loggingNotice = _('Another change is staged for the firewall; apply or revert it first.');
				else
					this.loggingNotice = _('Could not enable logging.');
				await this.loadLoggingStatus();
				return;
			}

			if (res.changed)
				this.loggingNotice = _('WAN drop/reject logging is on. Blocked inbound traffic should appear here as it happens — not normal LAN browsing.');
			else
				this.loggingNotice = _('WAN logging is already enabled.');

			logging.persistConsentDismissed();
			await this.loadLoggingStatus();
		} catch (e) {
			this.loggingNotice = _('Administrator access is required to enable logging.');
			await this.loadLoggingStatus();
		} finally {
			this.loggingBusy = false;
			this.updateEmptyStateUi();
			this.updateLoggingToolbarUi();
		}
	},

	async handleDisableLogging() {
		if (this.loggingBusy)
			return;

		this.loggingBusy = true;
		this.loggingNotice = '';
		this.updateLoggingToolbarUi();

		try {
			const res = await callFwliveDisableLogging();
			if (!res || !res.ok) {
				if (res && res.error === 'firewall_changes_pending')
					this.loggingNotice = _('Another change is staged for the firewall; apply or revert it first.');
				else
					this.loggingNotice = _('Could not disable logging.');
				await this.loadLoggingStatus();
				return;
			}

			if (res.changed)
				this.loggingNotice = _('WAN drop/reject logging is off.');
			await this.loadLoggingStatus();
		} catch (e) {
			this.loggingNotice = _('Administrator access is required to disable logging.');
			await this.loadLoggingStatus();
		} finally {
			this.loggingBusy = false;
			this.updateEmptyStateUi();
			this.updateLoggingToolbarUi();
		}
	},

	shouldShowLoggingConsent() {
		const st = this.loggingStatus;
		if (!st || st.wan_log)
			return false;
		const blockers = st.blockers || [];
		if (blockers.length)
			return false;
		if (logging.consentDismissedPermanent())
			return false;
		if (this.consentDismissedSession)
			return false;
		return true;
	},

	handleDismissConsent(persist) {
		if (persist)
			logging.persistConsentDismissed();
		this.consentDismissedSession = true;
		this._loggingEmptySig = '';
		this.updateEmptyStateUi();
	},

	loggingState() {
		return {
			loggingStatus: this.loggingStatus,
			loggingBusy: this.loggingBusy,
			entriesLength: this.entries.length,
			loggingNotice: this.loggingNotice,
			showConsent: this.shouldShowLoggingConsent()
		};
	},

	/* Stable signature so poll/renderRows does not wipe the logging button every
	   second (destroys the node between mousedown and click → needs a 2nd click). */
	loggingUiSignature() {
		const st = this.loggingStatus;
		/* Sort blockers so unstable backend order does not force a rebuild. */
		const blockers = (st && st.blockers)
			? st.blockers.slice().sort().join(',')
			: '';
		return [
			st ? (st.wan_log ? '1' : '0') : 'x',
			st ? String(st.wan_log_limit || '') : '',
			blockers,
			this.loggingBusy ? '1' : '0',
			this.loggingNotice || '',
			this.shouldShowLoggingConsent() ? 'c1' : 'c0'
		].join('|');
	},

	updateLoggingToolbarUi() {
		const bar = document.getElementById('fwlive-logging-bar');
		if (!bar)
			return;

		const sig = this.loggingUiSignature();
		if (sig === this._loggingToolbarSig)
			return;

		logging.renderToolbar(bar, this.loggingState(), {
			onEnable: () => this.handleEnableLogging(),
			onDisable: () => this.handleDisableLogging()
		});
		this._loggingToolbarSig = sig;
	},

	updateEmptyStateUi() {
		const empty = document.getElementById('fwlive-empty');
		if (!empty)
			return;

		const sig = this.loggingUiSignature();
		if (sig === this._loggingEmptySig)
			return;

		const visible = empty.style.display !== 'none';
		logging.renderEmptyState(empty, this.loggingState(), {
			onEnable: () => this.handleEnableLogging(),
			onDismissConsent: (persist) => this.handleDismissConsent(persist)
		});
		if (visible)
			empty.style.display = 'block';
		this._loggingEmptySig = sig;
	},

	resolveRuleLabel(hint) {
		if (!hint)
			return '';

		if (this.rulesMap[hint])
			return this.rulesMap[hint];

		const slug = hint.toLowerCase();
		if (this.rulesMap[slug])
			return this.rulesMap[slug];

		return log.formatRuleLabel(hint);
	},

	enrichEntry(row) {
		row.rule_label = this.resolveRuleLabel(row.rule_hint);
		return row;
	},

	normalizePollBatch(raw) {
		const normalized = [];
		const seen = {};
		let pollNew = 0;

		for (let i = 0; i < raw.length; i++) {
			if (!log.isFirewallEvent(raw[i]))
				continue;

			const row = this.enrichEntry(log.normalizeEntry(raw[i]));
			if (seen[row.id])
				continue;
			seen[row.id] = true;
			if (this.rememberSessionId(row.id))
				pollNew++;
			normalized.push(row);
		}

		return { rows: normalized, pollNew: pollNew };
	},

	async fetchEntries() {
		if (!this.sessionSeen)
			this.sessionSeen = new Set();

		let reply;
		try {
			/* Raw logd lines, not post-filter rows. Fetch a multiple of the
			 * display limit so mixed syslog still fills the table; pause
			 * reads the ring cap so the buffer can catch up. */
			const fetchLines = this.paused
				? constants.FETCH_LINES_MAX
				: Math.min(Math.max(this.rowLimit * 4, 100), constants.FETCH_LINES_MAX);
			reply = await callFwlivePoll({
				addresses: [ String(fetchLines) ]
			});
		} catch (e) {
			this.lastPollError = true;
			return;
		}
		/* Full poll object (no rpc expect strip). error → banner; log → rows. */
		if (!reply || typeof reply !== 'object' || Array.isArray(reply)) {
			this.lastPollError = true;
			return;
		}
		if (reply.error) {
			this.lastPollError = true;
			return;
		}
		const raw = reply.log;
		if (!Array.isArray(raw)) {
			this.lastPollError = true;
			return;
		}

		this.lastPollError = false;

		const batch = this.normalizePollBatch(raw);
		this.lastPollNewEvents = batch.pollNew;

		/* Oldest-first ring buffer; filteredRows() reverses for newest-first display. */
		this.entries = buffer.applyFetchedEntries(this.entries, batch.rows, {
			paused: this.paused,
			resumeMerge: this.resumeMerge,
			rowLimit: this.rowLimit,
			fetchLinesMax: constants.FETCH_LINES_MAX
		});
	},

	rememberSessionId(id) {
		if (!this.sessionSeen)
			this.sessionSeen = new Set();
		if (this.sessionSeen.has(id))
			return false;

		this.sessionSeen.add(id);
		const cap = Math.max(this.rowLimit * 2, constants.FETCH_LINES_MAX);
		while (this.sessionSeen.size > cap) {
			const oldest = this.sessionSeen.values().next().value;
			this.sessionSeen.delete(oldest);
		}
		return true;
	},

	ingestCap() {
		return buffer.ingestCap(this.paused, this.rowLimit, constants.FETCH_LINES_MAX);
	},

	statusSuffix() {
		const bits = [];
		if (this.paused) {
			if (this.pauseBufferLoading)
				bits.push(_('loading buffer'));
		}

		const cap = this.ingestCap();
		if (this.entries.length >= cap && cap > 0)
			bits.push(_('buffer full'));
		if (this.floodSuppressed)
			bits.push(_('render paused (high rate)'));
		if (!this.paused && !this.followLive)
			bits.push(_('scroll frozen — scroll to top to follow live'));
		return bits.length ? ' — ' + bits.join(', ') : '';
	},

	refillRenderBucket() {
		const now = Date.now();
		if (!this.renderBucketMs)
			this.renderBucketMs = now;

		const elapsed = now - this.renderBucketMs;
		this.renderBucketMs = now;
		this.renderBucket = Math.min(
			constants.RENDER_CAP_PER_SEC,
			this.renderBucket + (elapsed * constants.RENDER_CAP_PER_SEC / 1000)
		);
	},

	consumeRenderBudget(cost) {
		if (cost <= 0) {
			this.floodSuppressed = false;
			return true;
		}

		this.refillRenderBucket();
		if (cost <= this.renderBucket) {
			this.renderBucket -= cost;
			this.floodSuppressed = false;
			return true;
		}

		this.floodSuppressed = true;
		return false;
	},

	/** Charge by new log events per poll, not full table size (avoids false throttle at high limits). */
	renderBudgetCost(rows) {
		const count = rows ? rows.length : 0;
		const headId = count ? rows[0].id : '';

		if (!count && !this.lastRenderedRowCount)
			return 0;

		if (count === this.lastRenderedRowCount && headId === this.lastRenderedHeadId)
			return 0;

		/*
		 * Visible row-count changes (Limit up/down, trim) must not be skipped by
		 * the flood throttle — otherwise status can show N/limit while the table
		 * still paints the previous size under ping -A.
		 */
		if (count !== this.lastRenderedRowCount)
			return 1;

		return Math.max(1, this.lastPollNewEvents || 1);
	},

	updateFloodBanner() {
		const el = document.getElementById('fwlive-flood');
		if (!el)
			return;

		if (this.floodSuppressed) {
			el.style.display = 'block';
			el.textContent = _('High event rate — table refresh is throttled to protect the browser. The buffer still updates; refresh will resume automatically.');
		} else {
			el.style.display = 'none';
			el.textContent = '';
		}
	},

	filteredRows() {
		const filters = this.readFilters();
		return this.entries
			.filter((row) => log.matchesFilter(row, filters))
			.slice(-this.rowLimit)
			.reverse();
	},

	compactCountText(matchCount) {
		const stored = this.entries.length;
		const limit = this.rowLimit;
		const suffix = this.statusSuffix();
		/* While paused the buffer can grow past the display limit — count matches
		 * over the full buffer so "matching" is not capped at visibleRows (#83). */
		let shown = matchCount;
		if (this.paused) {
			const filters = this.readFilters();
			shown = this.entries.filter((row) => log.matchesFilter(row, filters)).length;
		}

		if (this.pauseBufferLoading && stored === 0)
			return _('loading…') + suffix;

		if (shown)
			return _('%d matching · %d/%d stored').format(shown, stored, limit) + suffix;

		if (stored)
			return _('0 matching · %d/%d stored').format(stored, limit) + suffix;

		return '';
	},

	updateStatus(rows) {
		const status = document.getElementById('fwlive-status');
		if (!status)
			return;

		const matchCount = rows ? rows.length : this.filteredRows().length;
		const suffix = this.statusSuffix();

		if (this.lastPollError) {
			status.className = 'fwlive-status fwlive-status-error';
			status.textContent = _('Connection lost — retrying…') + suffix;
			return;
		}

		status.className = this.paused
			? 'fwlive-status fwlive-status-paused'
			: 'fwlive-status';
		status.textContent = this.compactCountText(matchCount);
	},

	readRowLimit() {
		const n = parseInt(storedValue('fwlive-row-limit', null), 10);
		if (constants.ROW_LIMIT_OPTIONS.indexOf(n) >= 0)
			return n;
		return constants.DEFAULT_ROW_LIMIT;
	},

	saveRowLimit() {
		storeValue('fwlive-row-limit', String(this.rowLimit));
	},

	applyRowLimit(limit) {
		const n = constants.ROW_LIMIT_OPTIONS.indexOf(limit) >= 0 ? limit : constants.DEFAULT_ROW_LIMIT;
		this.rowLimit = n;
		if (!this.paused && this.entries.length > n)
			this.entries = this.entries.slice(-n);
	},

	updateStreamControlsUi() {
		const map = document.querySelector('.fwlive-map');
		const dot = document.getElementById('fwlive-watch-dot');
		const label = document.getElementById('fwlive-watch-label');
		const pauseBtn = document.getElementById('fwlive-pause');
		const sel = document.getElementById('fwlive-limit');
		const hostCb = document.getElementById('fwlive-show-hostnames');

		if (map) {
			if (this.paused)
				map.classList.add('fwlive-watch-paused');
			else
				map.classList.remove('fwlive-watch-paused');
		}
		if (dot) {
			if (this.paused)
				dot.classList.remove('fwlive-dot-on');
			else
				dot.classList.add('fwlive-dot-on');
		}
		if (label)
			label.textContent = this.paused ? _('Paused') : _('Watching');
		if (pauseBtn)
			pauseBtn.textContent = this.paused ? _('Resume') : _('Pause');
		if (sel)
			sel.value = String(this.rowLimit);
		if (hostCb)
			hostCb.checked = !!this.showHostnames;
		this.updateRowTintUi();
	},

	onShowHostnamesChange(ev) {
		this.showHostnames = !!(ev && ev.target && ev.target.checked);
		this.saveShowHostnames();
		/* Invalidate any in-flight resolve from the previous toggle state. */
		this.resolveGeneration = (this.resolveGeneration || 0) + 1;
		this.resolveInFlight = false;

		if (this.showHostnames)
			this.resolveHostnamesForEntries(this.filteredRows());
		else
			this.renderRows(true);
	},

	onPauseClick() {
		const wasPaused = this.paused;
		this.paused = !this.paused;
		this.updateStreamControlsUi();

		if (!wasPaused && this.paused) {
			this.pauseBufferLoading = true;
			this.updateStatus();
			this.fetchEntries()
				.catch(function() {})
				.finally(function() {
					this.pauseBufferLoading = false;
					this.updateStatus();
				}.bind(this));
			return;
		}

		if (wasPaused && !this.paused) {
			this.followLive = true;
			/* Merge pause buffer with the first live poll — do not replace (#43). */
			this.resumeMerge = true;
			this.fetchEntries()
				.then(() => this.renderRows(true))
				.finally(function() {
					this.resumeMerge = false;
				}.bind(this));
		}
	},

	onRowLimitChange(ev) {
		const n = parseInt(ev && ev.target ? ev.target.value : '', 10);
		if (!isFinite(n) || constants.ROW_LIMIT_OPTIONS.indexOf(n) < 0)
			return;

		this.applyRowLimit(n);
		this.saveRowLimit();
		this.updateHash(this.readFilters());
		/* Reset flood throttle so Limit changes paint even during ping -A. */
		this.renderBucket = constants.RENDER_CAP_PER_SEC;
		this.floodSuppressed = false;
		this.pendingForceRender = true;
		if (!this.paused)
			this.renderRows(true);
		else
			this.updateStatus();
		this.fetchEntries()
			.then(() => {
				if (this.paused)
					this.updateStatus();
				else
					this.renderRows(true);
			})
			.finally(() => {
				this.pendingForceRender = false;
			});
	},

	limitSelectOptions() {
		const pairs = [];
		for (let i = 0; i < constants.ROW_LIMIT_OPTIONS.length; i++) {
			const n = constants.ROW_LIMIT_OPTIONS[i];
			pairs.push([ String(n), String(n) ]);
		}
		return optionNodes(pairs);
	},

	/* G Grouped: Common / Also seen / Exclude — curated PROTO values from logs. */
	protoSelectOptions() {
		return [
			E('option', { 'value': '' }, [ _('Any protocol') ]),
			E('optgroup', { 'label': _('Common') }, [
				E('option', { 'value': 'TCP' }, [ 'TCP' ]),
				E('option', { 'value': 'UDP' }, [ 'UDP' ]),
				E('option', { 'value': 'ICMP' }, [ 'ICMP' ]),
				E('option', { 'value': 'ICMPV6' }, [ _('ICMPv6') ])
			]),
			E('optgroup', { 'label': _('Also seen') }, [
				E('option', { 'value': 'IGMP' }, [ 'IGMP' ]),
				E('option', { 'value': 'GRE' }, [ 'GRE' ]),
				E('option', { 'value': 'ESP' }, [ 'ESP' ]),
				E('option', { 'value': 'AH' }, [ 'AH' ]),
				E('option', { 'value': 'SCTP' }, [ 'SCTP' ])
			]),
			E('optgroup', { 'label': _('Exclude') }, [
				E('option', { 'value': '!TCP' }, [ _('not TCP') ]),
				E('option', { 'value': '!UDP' }, [ _('not UDP') ]),
				E('option', { 'value': '!ICMP' }, [ _('not ICMP') ]),
				E('option', { 'value': '!ICMPV6' }, [ _('not ICMPv6') ]),
				E('option', { 'value': '!IGMP' }, [ _('not IGMP') ]),
				E('option', { 'value': '!GRE' }, [ _('not GRE') ]),
				E('option', { 'value': '!ESP' }, [ _('not ESP') ]),
				E('option', { 'value': '!AH' }, [ _('not AH') ]),
				E('option', { 'value': '!SCTP' }, [ _('not SCTP') ])
			])
		];
	},

	filterClick(field, value, ev) {
		if (ev && ev.preventDefault)
			ev.preventDefault();

		if (!value)
			return;

		this.setFilterFieldValue(field, value);
		this.onFilterInput();
	},

	collectIpsFromEntries(entries) {
		const ips = new Set();

		for (let i = 0; i < entries.length; i++) {
			const r = entries[i];
			if (r.src && this.isLikelyIp(r.src))
				ips.add(r.src);
			if (r.dst && this.isLikelyIp(r.dst))
				ips.add(r.dst);
		}

		return Array.from(ips);
	},

	async resolveHostnamesForEntries(entries) {
		if (!this.showHostnames || this.resolveInFlight)
			return;

		if (!this.hostnameCache)
			this.hostnameCache = new Map();
		if (!this.hostnameFailed)
			this.hostnameFailed = new Map();

		const ips = this.collectIpsFromEntries(entries);
		const need = [];
		const now = Date.now();

		for (let i = 0; i < ips.length && need.length < 32; i++) {
			const ip = ips[i];
			if (this.hostnameCache.has(ip))
				continue;
			if (hostname.failIsHot(this.hostnameFailed, ip, now))
				continue;
			need.push(ip);
		}

		if (!need.length)
			return;

		this.resolveGeneration = (this.resolveGeneration || 0) + 1;
		const gen = this.resolveGeneration;
		this.resolveInFlight = true;

		try {
			const res = await callFwliveResolve({ addresses: need });
			if (gen !== this.resolveGeneration)
				return;

			/* rpc.declare expect: { names: {} } already unwraps — res IS the map (#243). */
			const names = res || {};
			let updated = false;

			for (let i = 0; i < need.length; i++) {
				const ip = need[i];
				if (names[ip]) {
					hostname.lruSet(this.hostnameCache, ip, names[ip]);
					this.hostnameFailed.delete(ip);
					updated = true;
				} else {
					hostname.failMark(this.hostnameFailed, ip, now);
				}
			}

			if (updated)
				this.renderRows(true);
		} catch (e) {
			/* resolve unavailable — show IPs */
		} finally {
			if (gen === this.resolveGeneration)
				this.resolveInFlight = false;
		}
	},

	setFilterFieldValue(field, value) {
		if (field === 'proto')
			return proto.setProtoFilterValue(value);

		const el = document.getElementById('fwlive-' + field);
		if (!el)
			return false;

		/* SELECT: ensure uncommon click-to-filter / hash values remain selectable. */
		if (el.tagName === 'SELECT' && value) {
			let found = false;
			for (let i = 0; i < el.options.length; i++) {
				if (el.options[i].value === value) {
					found = true;
					break;
				}
			}
			if (!found)
				el.appendChild(E('option', { 'value': value }, [ value ]));
		}

		el.value = value;
		if (el.tagName === 'SELECT')
			el.dispatchEvent(new Event('change', { bubbles: true }));

		return true;
	},

	clearFilter(field, ev) {
		if (ev && ev.preventDefault)
			ev.preventDefault();

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
			if (!cur)
				return;
			proto.setProtoFilterValue(log.toggleFilterNegation(cur));
			this.onFilterInput();
			return;
		}

		const el = document.getElementById('fwlive-' + field);
		if (!el || !el.value)
			return;

		this.setFilterFieldValue(field, log.toggleFilterNegation(el.value));
		this.onFilterInput();
	},

	clearAllFilters(ev) {
		if (ev && ev.preventDefault)
			ev.preventDefault();

		for (let i = 0; i < this.FILTER_CHIP_FIELDS.length; i++) {
			const el = document.getElementById('fwlive-' + this.FILTER_CHIP_FIELDS[i].key);
			if (el)
				el.value = '';
		}
		const protoCustom = document.getElementById('fwlive-proto-custom');
		if (protoCustom)
			protoCustom.value = '';

		this.onFilterInput();
	},

	renderFilterChips() {
		const bar = document.getElementById('fwlive-chips');
		if (!bar)
			return;

		chips.renderFilterChips(bar, {
			filters: Object.assign({}, this.readFilters()),
			chipFields: this.FILTER_CHIP_FIELDS
		}, {
			onInvert: (field, ev) => this.invertFilter(field, ev),
			onClear: (field, ev) => this.clearFilter(field, ev),
			onClearAll: (ev) => this.clearAllFilters(ev)
		});
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
		if (scroll) {
			/* add/remove — classList.toggle(name, force) is unsupported on some 21.02-era browsers */
			if (this.messageLayout === 'oneline') {
				scroll.classList.add('fwlive-msg-oneline');
				scroll.classList.remove('fwlive-msg-wrap');
			} else {
				scroll.classList.add('fwlive-msg-wrap');
				scroll.classList.remove('fwlive-msg-oneline');
			}
		}
		const oneline = this.messageLayout === 'oneline';
		if (wrapBtn)
			wrapBtn.setAttribute('aria-pressed', oneline ? 'false' : 'true');
		if (onelineBtn)
			onelineBtn.setAttribute('aria-pressed', oneline ? 'true' : 'false');
	},

	setMessageLayout(layout) {
		const next = layout === 'oneline' ? 'oneline' : 'wrap';
		if (next === this.messageLayout)
			return;

		this.messageLayout = next;
		this.saveMessageLayout();
		this.updateMessageLayoutUi();
		if (this.paused)
			this.updateStatus();
		else
			this.renderRows(true);
	},

	renderRows(force) {
		const el = document.getElementById('fwlive-table');
		if (!el)
			return;

		const body = el.querySelector('tbody');
		const empty = document.getElementById('fwlive-empty');
		const scroll = document.getElementById('fwlive-scroll');
		this.updateHash(this.readFilters());

		const rows = this.filteredRows();
		const cost = force ? Math.max(1, rows.length) : this.renderBudgetCost(rows);
		this.updateLoggingToolbarUi();

		if (!force && cost === 0) {
			this.floodSuppressed = false;
			this.updateFloodBanner();
			this.updateStatus(rows);
			return;
		}

		if (!force && !this.consumeRenderBudget(cost)) {
			this.updateFloodBanner();
			this.updateStatus(rows);
			return;
		}

		this.updateFloodBanner();

		const prevScroll = scroll ? scroll.scrollTop : 0;

		if (empty)
			empty.style.display = rows.length ? 'none' : 'block';
		this.updateStatus(rows);
		this.renderFilterChips();

		table.renderRows(body, {
			rows: rows.slice(),
			columns: this.activeColumns().slice(),
			viewMode: this.viewMode,
			messageLayout: this.messageLayout,
			expandedRowId: this.expandedRowId,
			rowTint: this.rowTintEnabled(),
			showHostnames: !!this.showHostnames,
			hostnameCache: this.hostnameCache,
			firewallBackend: this.firewallBackend
		}, {
			onRowClick: (rowId, ev) => this.onRowClick(rowId, ev),
			onFilterClick: (field, value, ev) => this.filterClick(field, value, ev),
			actionRowTintClass: (action) => this.actionRowTintClass(action)
		});

		if (scroll) {
			if (!this.paused && this.followLive)
				scroll.scrollTop = 0;
			else
				scroll.scrollTop = prevScroll;
		}

		this.lastRenderedRowCount = rows.length;
		this.lastRenderedHeadId = rows.length ? rows[0].id : '';

		if (rows.length && this.rowTintEnabled() && !this.tintProbeDone) {
			const runProbe = () => {
				if (!this.tintProbeDone)
					this.probeRowTintPaint();
			};
			if (typeof requestAnimationFrame === 'function')
				requestAnimationFrame(() => requestAnimationFrame(runProbe));
			else
				setTimeout(runProbe, 0);
		} else if (!this.rowTintEnabled() && this.tintFallbackActive) {
			this.clearTintFallback(document.querySelector('.fwlive-map'));
			this.tintProbeDone = false;
		}
	},

	onFilterInput() {
		this.renderRows(true);
	},

	onFilterInputDebounced() {
		if (this.filterInputTimer)
			clearTimeout(this.filterInputTimer);
		this.filterInputTimer = setTimeout(function() {
			this.filterInputTimer = null;
			this.onFilterInput();
		}.bind(this), 100);
	},

	onScrollArea(ev) {
		const scroll = ev && ev.target;
		if (!scroll || this.paused)
			return;

		this.followLive = scroll.scrollTop < 8;
		this.updateStatus();
	},

	attachHandlers() {
		const scroll = document.getElementById('fwlive-scroll');
		if (scroll)
			scroll.addEventListener('scroll', this.onScrollArea.bind(this));

		const ids = [ 'q', 'action', 'interface', 'src', 'dst', 'sport', 'dport' ];
		for (let i = 0; i < ids.length; i++) {
			const el = document.getElementById('fwlive-' + ids[i]);
			if (!el)
				continue;
			/* Text inputs: debounce rebuilds. Selects: apply immediately. */
			if (el.tagName === 'SELECT')
				el.addEventListener('change', this.onFilterInput.bind(this));
			else
				el.addEventListener('input', this.onFilterInputDebounced.bind(this));
		}

		const protoSel = document.getElementById('fwlive-proto');
		const protoCustom = document.getElementById('fwlive-proto-custom');
		if (protoSel) {
			protoSel.addEventListener('change', function() {
				if (protoCustom)
					protoCustom.value = '';
				this.onFilterInput();
			}.bind(this));
		}
		if (protoCustom) {
			protoCustom.addEventListener('input', function() {
				if (protoCustom.value.trim() && protoSel)
					protoSel.value = '';
				this.onFilterInputDebounced();
			}.bind(this));
		}

		const pauseBtn = document.getElementById('fwlive-pause');
		if (pauseBtn)
			pauseBtn.addEventListener('click', this.onPauseClick.bind(this));

		const limitSel = document.getElementById('fwlive-limit');
		if (limitSel)
			limitSel.addEventListener('change', this.onRowLimitChange.bind(this));

		const hostCb = document.getElementById('fwlive-show-hostnames');
		if (hostCb)
			hostCb.addEventListener('change', this.onShowHostnamesChange.bind(this));

		const tintCb = document.getElementById('fwlive-row-tint-toggle');
		if (tintCb)
			tintCb.addEventListener('change', this.onRowTintEnabledChange.bind(this));

		const tintSel = document.getElementById('fwlive-row-tint');
		if (tintSel)
			tintSel.addEventListener('change', this.onRowTintPaletteChange.bind(this));
	},

	async pollData() {
		if (this.pollDataInFlight)
			return;

		this.pollDataInFlight = true;
		try {
			try {
				await this.fetchEntries();
			} catch (e) {
				this.lastPollError = true;
			}

			if (this.paused)
				this.updateStatus();
			else
				this.renderRows(!!this.pendingForceRender);

			try {
				await this.resolveHostnamesForEntries(this.filteredRows());
			} catch (e) {
				/* resolve unavailable — show IPs */
			}
		} finally {
			this.pollDataInFlight = false;
		}
	},

	load() {
		if (!this.pollFn) {
			this.pollFn = this.pollData.bind(this);
			poll.add(this.pollFn, 1);
			/* Best-effort teardown when leaving the page (LuCI SPA may full-reload). */
			if (typeof window !== 'undefined' && window.addEventListener) {
				window.addEventListener('pagehide', function() {
					if (this.pollFn) {
						try { poll.remove(this.pollFn); } catch (e) { /* poll gone */ }
						this.pollFn = null;
					}
					if (this.filterInputTimer) {
						clearTimeout(this.filterInputTimer);
						this.filterInputTimer = null;
					}
				}.bind(this));
			}
		}
		return Promise.all([
			this.loadRulesMap(),
			this.loadLoggingStatus()
		]).then(() => this.fetchEntries());
	},

	render() {
		return E('div', { 'class': 'cbi-map fwlive-map', 'data-view': 'simple', 'data-row-tint': 'classic' }, [
			E('style', {}, [css.styleText]),
			E('div', { 'id': 'fwlive-title-row', 'class': 'fwlive-title-row' }, [
				E('h2', {}, [
					_('Firewall Live View'),
					E('span', { 'id': 'fwlive-backend', 'class': 'fwlive-backend' }, [ '' ])
				]),
				E('div', { 'class': 'fwlive-title-status' }, [
					E('span', { 'id': 'fwlive-watch-dot', 'class': 'fwlive-dot fwlive-dot-on', 'aria-hidden': 'true' }, [ '' ]),
					E('span', { 'id': 'fwlive-watch-label', 'class': 'fwlive-watch-label' }, [ _('Watching') ]),
					E('span', { 'id': 'fwlive-status', 'class': 'fwlive-status' }, [ '' ]),
					E('span', {
						'id': 'fwlive-tint-warn',
						'class': 'fwlive-tint-warn',
						'title': _('Row tint used a local color fallback because the active LuCI theme did not apply pass/deny backgrounds.')
					}, [ _('Theme tint fallback') ])
				])
			]),
			E('div', { 'id': 'fwlive-watch-strip', 'class': 'fwlive-watch-strip' }, [
				E('div', { 'class': 'fwlive-watch-group' }, [
					E('button', {
						'id': 'fwlive-pause',
						'class': 'cbi-button fwlive-btn-ghost',
						'type': 'button'
					}, [ _('Pause') ]),
					E('span', { 'id': 'fwlive-logging-bar', 'class': 'fwlive-logging-bar' }, [])
				]),
				E('div', { 'class': 'fwlive-watch-group' }, [
					E('span', { 'class': 'fwlive-watch-group-label' }, [ _('View') ]),
					E('div', {
						'class': 'fwlive-watch-seg',
						'role': 'group',
						'aria-label': _('View')
					}, [
						E('button', {
							'id': 'fwlive-view-simple',
							'class': 'cbi-button fwlive-seg-btn',
							'type': 'button',
							'aria-pressed': 'true',
							'click': () => this.setViewMode('simple')
						}, [ _('Simple') ]),
						E('button', {
							'id': 'fwlive-view-detail',
							'class': 'cbi-button fwlive-seg-btn',
							'type': 'button',
							'aria-pressed': 'false',
							'click': () => this.setViewMode('detailed')
						}, [ _('Detail') ])
					])
				]),
				E('div', {
					'id': 'fwlive-msg-group',
					'class': 'fwlive-watch-group'
				}, [
					E('span', { 'class': 'fwlive-watch-group-label' }, [ _('Message') ]),
					E('div', {
						'id': 'fwlive-msg-seg',
						'class': 'fwlive-watch-seg',
						'role': 'group',
						'aria-label': _('Message')
					}, [
						E('button', {
							'id': 'fwlive-msg-wrap',
							'class': 'cbi-button fwlive-seg-btn',
							'type': 'button',
							'aria-pressed': 'true',
							'click': () => this.setMessageLayout('wrap')
						}, [ _('Wrap') ]),
						E('button', {
							'id': 'fwlive-msg-oneline',
							'class': 'cbi-button fwlive-seg-btn',
							'type': 'button',
							'aria-pressed': 'false',
							'click': () => this.setMessageLayout('oneline')
						}, [ _('One line') ])
					])
				])
			]),
			E('div', { 'id': 'fwlive-flood', 'class': 'fwlive-flood' }, [ '' ]),
			E('div', { 'id': 'fwlive-display-drawer', 'class': 'fwlive-display-bar' }, [
				E('span', { 'class': 'fwlive-display-bar-label' }, [ _('Display options') ]),
				E('div', { 'class': 'fwlive-display-controls' }, [
					E('label', { 'class': 'fwlive-display-ctl', 'for': 'fwlive-limit' }, [
						_('Limit'),
						E('select', {
							'id': 'fwlive-limit',
							'class': 'cbi-input-select'
						}, this.limitSelectOptions())
					]),
					E('label', { 'class': 'fwlive-display-ctl' }, [
						E('input', {
							'id': 'fwlive-row-tint-toggle',
							'type': 'checkbox',
							'title': _('Show pass/deny row background colors')
						}),
						_('Row tint')
					]),
					E('label', {
						'id': 'fwlive-row-tint-palette-wrap',
						'class': 'fwlive-display-ctl',
						'for': 'fwlive-row-tint'
					}, [
						_('Palette'),
						E('select', {
							'id': 'fwlive-row-tint',
							'class': 'cbi-input-select',
							'title': _('Classic uses green/red; Accessible uses teal/orange')
						}, this.rowTintPaletteOptions())
					]),
					E('label', { 'class': 'fwlive-display-ctl' }, [
						E('input', {
							'id': 'fwlive-show-hostnames',
							'type': 'checkbox'
						}),
						_('Show hostnames')
					])
				])
			]),
			E('div', { 'id': 'fwlive-filter-panel', 'class': 'fwlive-filter-panel fwlive-find-row' }, [
				E('div', { 'class': 'fwlive-grid fwlive-grid-core' }, [
					E('input', { 'id': 'fwlive-q', 'class': 'cbi-input-text', 'placeholder': _('Quick search') }),
					E('select', { 'id': 'fwlive-action', 'class': 'cbi-input-select' }, [
						E('option', { 'value': '' }, [ _('Any action') ]),
						E('option', { 'value': 'pass' }, [ 'pass' ]),
						E('option', { 'value': 'block' }, [ 'block' ]),
						E('option', { 'value': 'drop' }, [ 'drop' ]),
						E('option', { 'value': 'reject' }, [ 'reject' ]),
						E('option', { 'value': 'unknown' }, [ 'unknown' ]),
						E('option', { 'value': '!pass' }, [ _('not pass') ]),
						E('option', { 'value': '!drop' }, [ _('not drop') ]),
						E('option', { 'value': '!block' }, [ _('not block') ]),
						E('option', { 'value': '!reject' }, [ _('not reject') ]),
						E('option', { 'value': '!unknown' }, [ _('not unknown') ])
					]),
					E('div', { 'class': 'fwlive-proto-pair' }, [
						E('select', {
							'id': 'fwlive-proto',
							'class': 'cbi-input-select',
							'title': _('Protocol — common values')
						}, this.protoSelectOptions()),
						E('input', {
							'id': 'fwlive-proto-custom',
							'class': 'cbi-input-text',
							'placeholder': _('or type…'),
							'title': _('Custom protocol (prefix ! to exclude). Overrides the menu when set.'),
							'autocomplete': 'off'
						})
					])
				]),
				E('details', { 'id': 'fwlive-more-filters', 'class': 'fwlive-more-filters' }, [
					E('summary', {}, [ _('More filters') ]),
					E('div', { 'class': 'fwlive-grid fwlive-grid-extra' }, [
						E('input', { 'id': 'fwlive-interface', 'class': 'cbi-input-text', 'placeholder': _('Interface (prefix ! to exclude)') }),
						E('input', { 'id': 'fwlive-src', 'class': 'cbi-input-text', 'placeholder': _('Source IP contains (! to exclude)') }),
						E('input', { 'id': 'fwlive-sport', 'class': 'cbi-input-text', 'placeholder': _('Source port (! to exclude)') }),
						E('input', { 'id': 'fwlive-dst', 'class': 'cbi-input-text', 'placeholder': _('Destination IP contains (! to exclude)') }),
						E('input', { 'id': 'fwlive-dport', 'class': 'cbi-input-text', 'placeholder': _('Destination port (! to exclude)') })
					])
				])
			]),
			E('div', { 'id': 'fwlive-chips', 'class': 'fwlive-chips' }, []),
			E('p', { 'class': 'fwlive-hint-line' },
				[ _('Click a cell to filter · ≠ on a chip to exclude · Ctrl+click a rule for firewall settings · in Simple view, click a row for the full message') ]),
			E('div', {
				'id': 'fwlive-empty',
				'class': 'fwlive-empty',
				'style': 'display:none'
			}, []),
			E('div', { 'id': 'fwlive-scroll', 'class': 'fwlive-scroll fwlive-msg-wrap' }, [
				E('table', { 'id': 'fwlive-table', 'class': 'table cbi-section-table' }, [
					E('thead', {}, E('tr', {}, [])),
					E('tbody', {}, [])
				])
			]),
			E('div', { 'class': 'fwlive-help-row' }, [
				E('details', { 'id': 'fwlive-help', 'class': 'fwlive-help' }, [
					E('summary', {}, [ _('Help') ]),
					E('ul', {}, [
						E('li', {}, [ _('The table updates automatically when your firewall logs traffic. Use Pause if it moves too fast.') ]),
						E('li', {}, [ _('Enable logging turns on WAN zone drop/reject logging only (same as Network → Firewall). It does not add rules or log normal LAN browsing.') ]),
						E('li', {}, [ _('Display options on the bar set Limit, row tint, palette, and hostnames.') ]),
						E('li', {}, [ _('The rate shown for WAN logging is the firewall zone log_limit. OpenWrt defaults to 10/minute when no explicit limit is configured; fwlive does not impose this cap.') ]),
						E('li', { 'id': 'fwlive-manual-test' }, []),
						E('li', {}, [ _('Click a row (Time or other non-link cells) to see the full log line (Simple view).') ]),
						E('li', {}, [ _('Click an IP, action, or protocol to filter; use the Protocol menu (or ≠ on a chip) to exclude.') ]),
						E('li', {}, [ _('Row tint shows pass/deny row backgrounds when checked. Choose Classic (green/red, default) or Accessible (teal/orange). Action text stays colored either way.') ]),
						E('li', {}, [ _('Use Detail for all columns (flags, length, raw message).') ]),
						E('li', {}, [ _('If Row tint looks missing, the active LuCI theme may omit success/error or info/warn CSS variables; fwlive falls back to local colors (air-gapped, no data leaves the device).') ])
					])
				]),
				E('span', {
					'id': 'fwlive-build',
					'class': 'fwlive-build',
					'title': 'luci-app-fwlive'
				}, [ 'v' + constants.APP_VERSION ])
			])
		]);
	},

	addFooter() {
		this.viewMode = this.readViewMode();
		this.messageLayout = this.readMessageLayout();
		this.showHostnames = this.readShowHostnames();
		this.rowTint = this.readRowTint();
		this.rowTintPalette = this.rowTintEnabled() ? this.rowTint : 'classic';
		this.hostnameCache = new Map();
		this.hostnameFailed = new Map();
		this.resolveGeneration = 0;
		this.lastPollError = false;
		this.applyRowLimit(this.readRowLimit());
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
		this.renderRows(true);
		const testLi = document.getElementById('fwlive-manual-test');
		if (testLi)
			logging.renderManualTestNodes(testLi, { firewallBackend: this.firewallBackend }, {});
		if (this.showHostnames)
			this.resolveHostnamesForEntries(this.filteredRows());
	}
});
