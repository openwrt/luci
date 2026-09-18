'use strict';
'require baseclass';
'require ui';

/* fs-fit — the theme's one "does it still fit?" engine and the one place the reader's scroll
 * position is corrected. Add fit logic here, never a second observer: no CSS query can ask what the
 * content needs (media = viewport, container = container). Three rules, each a bug that was hit:
 * rule 1, measure uncollapsed, since a collapsed thing always fits; rule 2, re-fit synchronously on
 * a mutation, since deferring a poll tick to rAF paints one frame of a stacked table at full width
 * (19-109px of overflow); rule 3, coalesce on resize, since every fit forces a layout. The reader's
 * place is docs/anchoring.md, "The corrections"; the measurement behind each rule is
 * docs/anchoring-log.md. */

/* Exported, not armed at module eval: only fs-select.js clears the rule this raises, and arming
 * without it left every data table invisible. docs/anchoring-log.md, "The arm belongs to the disarm". */
function armGate() {
	if (!fittersEnabled()) return;
	/* WRITTEN AS THE LITERAL `dataset.fsFit`, never through a helper: tools/table-contract.mjs
	 * reads this file for exactly that spelling to prove the gate rule is still armed, and an
	 * indirection hides the write from it. The behaviour survives being factored out; the
	 * contract does not. */
	try { document.documentElement.dataset.fsFit = '1'; }
	catch (e) { /* no document, no flag to write */ }
}

const _fitters = [];
let _rafPending = false;
let _ro = null, _mo = null, _moFlag = null, _moTabs = null;

function runAll(list, what) {
	for (const fit of list) {
		try { fit(); }
		catch (e) { console.error('fs-fit: a ' + what + ' threw', e); }
	}
}

/* dev switch — docs/anchoring.md, "The dev switches" */
function fittersEnabled() {
	try { return localStorage.getItem('fsFit') !== 'off'; }
	catch (e) { return true; }
}
function run(records) {
	if (!fittersEnabled()) return;
	runAll(_fitters, 'fitter');
	holdFloor(records);
	if (!_anchorPending) rememberRest();
}

/* ---- the document may not get shorter while a tick is in flight ----
 * A layout taken while `dom.content()` has the container empty clamps the reader's offset into a
 * document that was never that short. Written before the tick (a pin in the same statement
 * sequence is never laid out: 1882px still clamped away) and on the containers, never the column,
 * where it suppresses the engine's own anchoring (css-scroll-anchoring-1 §2.2.2) and cost 120px of
 * growth, all 120px. The selector is `dom.content()`'s own three: a section body, a table, and a
 * table's body — the third was missing and a poll emptying it took 58px from under the reader on
 * 24.10's Overview. docs/anchoring.md, "The document may not get shorter: `holdFloor()`". */
const SHRINKS = '.cbi-section > div, .table';

const FLOORED = '[data-fs-floor]';

/* One floor per container, cleared and re-measured in one batched pass: not while the reader
 * scrolls, and not on a table box — `min-height` is undefined there (CSS 2.1 §10.7) and a 313px
 * floor still collapsed to 30px on WebKit. The clear is what keeps the answer honest (issue #41). */
function holdFloor(records) {
	if (scrolling()) return;
	const host = document.getElementById('view');
	if (!host) return;			/* the login page has no view */
	const boxes = [], hs = [];
	host.querySelectorAll(SHRINKS).forEach((el) => {
		let box = el, cs = window.getComputedStyle(el);
		while (box && box !== host && cs.display.startsWith('table')) {
			box = box.parentElement;
			if (box) cs = window.getComputedStyle(box);
		}
		if (!box || box === host || boxes.indexOf(box) !== -1) return;
		boxes.push(box);
	});
	host.querySelectorAll(FLOORED).forEach((box) => { if (boxes.indexOf(box) === -1) boxes.push(box); });

	let dirty = boxes;
	if (records && records.length) {
		const targets = [];
		for (const r of records) if (r.target && targets.indexOf(r.target) === -1) targets.push(r.target);
		dirty = boxes.filter((box) => targets.some((t) => box.contains(t) || t.contains(box)));
	}
	if (!dirty.length) return;

	/* The sweep puts back the offset its own clear pass took: 8 of 38 sweeps took the document down a
	 * pixel and the offset with it, losing a 60px correction. docs/anchoring-log.md, "The sweep's own clamp". */
	const sc = scroller(), page = sc || document.documentElement;
	const at = scrollTop(), tall = page.scrollHeight;
	dirty.forEach((box) => { box.style.minHeight = ''; });
	/* The box's own rect height, not `offsetHeight`'s rounding: 22 floors half a pixel too tall made
	 * the document 2px taller, and the next clear handed that back as a clamp — 6 of 12 refills
	 * corrected against 12 of 12. docs/anchoring-log.md, "The floor is written half a pixel too tall". */
	dirty.forEach((box) => hs.push(box.getBoundingClientRect().height));
	dirty.forEach((box, i) => {
		if (hs[i] > 0) { box.style.minHeight = hs[i] + 'px'; box.setAttribute('data-fs-floor', ''); }
		else box.removeAttribute('data-fs-floor');
	});
	/* And where the scroller stayed shorter the shrink is real: the clamp gave back only the 60px the
	 * document lost at its bottom. docs/anchoring-log.md, "A clamp is not the reader". */
	const landed = scrollTop();
	if (landed >= at) return;
	if (page.scrollHeight >= tall) writeOffset(sc, at); else _clampedTo = landed;
}

/* Is the page moving? asked of the position, never of the events: on iOS momentum carries the page
 * long after the finger has gone, and one offset read per frame sees it. SCROLL_IDLE is how long the
 * page must hold still before put-off work may run: 137-256px of roughness at 200ms against 59px —
 * one pixel of rounding per frame, the floor — at 250ms and above.
 * docs/anchoring.md, "Is the page moving: `scrolling()`". */
const SCROLL_IDLE = 400;
let _deferred = false;
function deferMeasurement() { _deferred = true; }
let _movingUntil = 0;
let _lastOffset = null;
let _sampling = false;
/* This file's own write is a scroll event too, and counting it as motion blocked the floor, the
 * reference and the correction for 400ms — 59px uncorrected, and two of them distrusted a correct
 * engine. docs/anchoring-log.md, "A correction's own write reads as the reader moving". */
let _ownWrite = null;
function sawOwnWrite(y) {
	if (_ownWrite === null) return true;
	if (Math.abs(y - _ownWrite) < 1) return false;
	_ownWrite = null;
	return true;
}
/* Where the browser's clamp last put the offset, read by `applyAnchor()` alone — `scrolling()`
 * keeps answering for the whole theme. docs/anchoring-log.md, "A clamp is not the reader". */
let _clampedTo = null;
function sawClamp() {
	if (scrollTop() === _clampedTo) return true;
	_clampedTo = null;
	return false;
}
function writeOffset(sc, value) {
	if (sc) sc.scrollTop = value; else window.scrollTo(0, value);
	_ownWrite = sc ? sc.scrollTop : window.scrollY;
}

/* Which element scrolls, cached per width: a probe per frame is a forced layout mid-flick, and the
 * stylesheet decides it. docs/anchoring-log.md, "Which element scrolls, asked once per width". */
let _scroller = null, _scrollerAt = -1, _scrollerKey = null;
function layoutKey() {
	const root = document.documentElement;
	return (root.getAttribute('data-layout') || '') + (root.hasAttribute('data-narrow') ? '|narrow' : '');
}
function scroller() {
	const key = layoutKey();
	if (_scrollerAt === _resizeSeq && _scrollerKey === key &&
	    (_scroller === null || _scroller.isConnected))
		return _scroller;
	const sc = document.getElementById('maincontent');
	const flow = sc ? window.getComputedStyle(sc).overflowY : '';
	_scroller = (flow === 'auto' || flow === 'scroll') ? sc : null;
	_scrollerAt = _resizeSeq;
	_scrollerKey = key;
	return _scroller;
}
function scrollTop() {
	const sc = scroller();
	return sc ? sc.scrollTop : window.scrollY;
}

function scrolling() { return Date.now() < _movingUntil; }
function sampleMotion() {
	const y = scrollTop();
	if (_lastOffset === null || y !== _lastOffset) {
		const own = !sawOwnWrite(y);
		_lastOffset = y;
		if (!own) _movingUntil = Date.now() + SCROLL_IDLE;
	}
	if (scrolling()) { requestAnimationFrame(sampleMotion); return; }
	_sampling = false;
	/* The offset's own response to the write below, not a reference element's drift: one re-established
	 * on wrong ground shows none. docs/anchoring-log.md, "A floor that shrinks with nobody watching". */
	const target = _deferredFloor;
	_deferredFloor = null;
	const floorBefore = (target && target.isConnected) ? (parseFloat(target.style.minHeight) || 0) : 0;
	const offsetBefore = scrollTop();
	holdFloor();
	if (target && target.isConnected) {
		const shrink = floorBefore - (parseFloat(target.style.minHeight) || 0);
		if (shrink > 1) settleDeferredFloor(offsetBefore, shrink);
	}
	rememberRest();
	if (_deferred) {
		_deferred = false;
		run();
	}
}

function noteMotion() {
	if (!sawOwnWrite(scrollTop())) return;
	_movingUntil = Date.now() + SCROLL_IDLE;
	if (_sampling) return;
	_sampling = true;
	requestAnimationFrame(sampleMotion);
}

let _userUntil = 0;
function noteIntent() {
	_userUntil = Date.now() + SCROLL_IDLE;
}
function noteUser() {
	noteIntent();
	noteMotion();
}

(function watchMotion() {
	const opts = { passive: true, capture: true };
	window.addEventListener('scroll', noteMotion, opts);
	for (const name of [ 'wheel', 'touchmove' ])
		window.addEventListener(name, noteUser, opts);
	for (const name of [ 'mousedown', 'keydown', 'touchstart' ])
		window.addEventListener(name, noteIntent, opts);
})();

function schedule() {
	if (_rafPending) return;
	_rafPending = true;
	requestAnimationFrame(() => { _rafPending = false; run(); });
}

/* Width only: iOS resizes the viewport height as the URL bar slides away, and twenty height-only
 * steps rewrote 1054 class attributes. docs/anchoring-log.md, "Width only: the URL bar is a resize". */
let _resizeSeq = 0;
const _lastWidth = new WeakMap();
function onResize(entries) {
	let widthMoved = false;
	for (const e of entries) {
		const w = Math.round(e.contentRect.width);
		if (_lastWidth.get(e.target) !== w) {
			_lastWidth.set(e.target, w);
			widthMoved = true;
		}
	}
	if (widthMoved) { _resizeSeq++; schedule(); }
}

function watch(el) {
	if (!el) return;
	if (!_ro) _ro = new ResizeObserver(onResize);
	_ro.observe(el);
}

/* ---- scroll anchoring, where the engine has none ----
 * An older WebKit absorbs none of a tick's growth and the page moved on every one, measured on the
 * reporter's own router: +133px, +134px, +123px, +108px. Computed from the reference, never the
 * offset: measuring the offset corrects an anchoring engine's own adjustment (16 movements, 1827px).
 * Whether there is one to leave anything behind is asked of the platform, never of a browser name —
 * with anchoring suppressed, a 120px growth moves the reader 120px.
 * docs/anchoring.md, "Who is responsible: `ENGINE_ANCHORS`" and "The corrections". */
const ENGINE_ANCHORS = (() => {
	/* dev switch — docs/anchoring.md, "The dev switches" */
	try { if (localStorage.getItem('fsEngineAnchor') === 'off') return false; }
	catch (e) { /* no storage, no switch */ }
	try { return typeof CSS !== 'undefined' && typeof CSS.supports === 'function'
		? CSS.supports('overflow-anchor', 'auto') : true; }
	catch (e) { return true; }
})();

/* A load-time check cannot see an engine that declines on a given refill: two residuals written
 * back 419-420ms late move the observer to the 7-36ms path until trust returns. Never a browser
 * name, only a count. docs/anchoring.md, "When the platform check is not enough: `_engineTrusted`". */
const LATE_MISS_LIMIT = 2;
let _lateMisses = 0;
let _engineTrusted = ENGINE_ANCHORS;
/* The witness's own rounding on a 32-36 row lease table at 390 wide is 8-12.25px, none of them a
 * residual. docs/anchoring-log.md, "The witness is not safe to write on its own". */
const LATE_ROUND_TOLERANCE = 16;

/* Trust returns after this many refills where `_rest.el` itself held: the two cheaper witnesses
 * tried recovered on an engine still 48px wrong. docs/anchoring-log.md, "Trust that comes back". */
const TRUST_RECOVERY_LIMIT = 2;
let _lateHits = 0;

let _rest = null;
let _restAt = null, _restPage = null;
/* The floored box `holdFloor()` refused for: wired to nothing, a growth-then-shrink refill inside
 * one motion window left `_restAt` 59px high.
 * docs/anchoring-log.md, "A floor that shrinks with nobody watching". */
let _deferredFloor = null;
function pageStamp() {
	return (document.body && document.body.getAttribute('data-page')) || '';
}
function forgetRest() {
	_rest = null;
	_restAt = null;
	_restPage = null;
}
/* `force`: only for the caller that has just written the offset itself, since the engine's own
 * compensation leaves `scrolling()` true for milliseconds after it — `moved 0, 0, -59` without,
 * `0, 0, 0` with it. docs/anchoring-log.md, "The reference after this file's own write must be
 * re-taken forced". */
function rememberRest(force) {
	if (scrolling() && !force) return;
	if (ENGINE_ANCHORS && scrollTop() <= 0) {
		_rest = null;
		_restAt = 0;
		_restPage = pageStamp();
		return;
	}
	const ref = anchorRef();
	_restAt = scrollTop();
	_restPage = pageStamp();
	_rest = ref ? { el: ref.el, top: ref.top, at: _restAt, sec: ref.sec, secTop: ref.secTop } : null;
}

function anchorFor() {
	const at = scrollTop();
	const clamped = (_restAt != null && at < _restAt && !scrolling() && _restPage === pageStamp());
	if (!_rest || !_rest.el.isConnected) {
		if (clamped) return { by: _restAt - at };
		if (_rest && _rest.sec && _rest.sec.isConnected && at === _restAt)
			return { el: _rest.sec, top: _rest.secTop, slack: 0 };
		return anchorRef();
	}
	if (at !== _rest.at && !clamped) return null;
	return { el: _rest.el, top: _rest.top, slack: Math.max(0, _rest.at - at) };
}

function anchorRef() {
	if (scrolling()) return null;

	const host = document.getElementById('view');
	if (!host) return null;
	const box = host.getBoundingClientRect();
	const x = Math.round(box.left + (Math.min(box.width, window.innerWidth || box.width) / 2));
	let y = 1;
	let el = document.elementFromPoint(x, y);
	const chrome = el && el.closest ? el.closest('[data-fs-chrome]') : null;
	if (chrome) y = Math.max(1, Math.round(chrome.getBoundingClientRect().bottom) + 1);

	const floor = Math.max(1, Math.round(window.innerHeight || 800));
	const pick = (yy) => {
		if (typeof document.elementsFromPoint === 'function') {
			for (const cand of document.elementsFromPoint(x, yy))
				if (cand !== host && host.contains(cand)) return cand;
			return null;
		}
		const one = document.elementFromPoint(x, yy);
		return (one && one !== host && host.contains(one)) ? one : null;
	};
	el = null;
	for (let step = 0; step < 5 && !el; step++)
		el = pick(Math.min(floor - 1, y + (Math.round(floor * 0.12) * step)));
	if (!el) return null;
	const table = el.closest('.table.fs-dt');
	if (table) {
		const up = table.parentElement;
		el = (up && up !== host && host.contains(up)) ? up : table;
	}
	if (!el || el === host || !host.contains(el)) return null;
	if (!el.getClientRects().length) return null;
	let keep = el.parentElement;
	while (keep && keep !== host && !keep.classList.contains('cbi-section')
			&& !keep.classList.contains('cbi-map') && !keep.classList.contains('fs-ovl'))
		keep = keep.parentElement;
	if (!keep || keep === host || !host.contains(keep)) keep = null;
	return { el, top: el.getBoundingClientRect().top,
		sec: keep, secTop: keep ? keep.getBoundingClientRect().top : 0 };
}

let _anchorPending = null;
let _anchorWhy = null;
const _anchorTrail = [];
function awhy(w) {
	_anchorWhy = w;
	_anchorTrail.push(w + '@' + Math.round(performance.now()));
	if (_anchorTrail.length > 8) _anchorTrail.shift();
}
let _anchorFrame = 0;
function anchorEnabled() {
	try { return localStorage.getItem('fsAnchor') !== 'off'; }
	catch (e) { return true; }
}
/* ---- what the engine's own anchoring leaves behind ----
 * It keeps a reference still; it does not promise that a section can vanish and come back. An
 * older WebKit moved 180px for 120px of growth, so the element is asked where it is now. */
let _lateFrame = 0;
/* why the last late correction did or did not write — eight exits, one symptom from outside */
let _lateWhy = null;
const _lateTrail = [];
function why(w) {
	_lateWhy = w;
	_lateTrail.push(w + '@' + Math.round(performance.now()));
	if (_lateTrail.length > 8) _lateTrail.shift();
}

function lateDrift(ref, grow, floorShrink) {
	if (_lateFrame) return why('busy');
	if (!ref) return why('no-reference');
	why('armed');
	_lateFrame = requestAnimationFrame(() => {
		why('frame');
		const seen = scrollTop();
		const settle = () => {
			_lateFrame = 0;
			why('settle');
			if (!anchorEnabled()) return why('anchoring-off');
			if (Date.now() < _userUntil) return why('reader-intent');
			if (_restPage !== pageStamp()) return why('page-changed');
			/* The offset, not the event stream: the engine's own compensation starts the motion sampler, and
			 * in WebKit the event arrives up to 1.2s late. `ref.at`, since run() has re-taken `_restAt` and the
			 * comparison becomes a value against itself (320px through, @1440 side). */
			if (scrollTop() !== seen) return why('offset-moved');
			let el = ref.el, was = ref.top;
			if (!el || !el.isConnected) {
				if (!ref.sec || !ref.sec.isConnected || ref.secTop == null) return why('reference-gone');
				el = ref.sec; was = ref.secTop;
			}
			let drift = el.getBoundingClientRect().top - was;
			/* The witness can be blind: the fold's element need not sit below the container this tick refilled,
			 * 13 of 13 refills reading 0px with the reader 120px off, and a gap under the tolerance is `grow`'s
			 * own rounding. docs/anchoring-log.md, "A witness at the fold can be blind". */
			if (Math.abs(drift) < 1 && grow > 1) {
				const compensated = seen - ref.at;
				if (Math.abs(compensated) < 1) drift = grow - compensated;
				else if (Math.abs(grow - compensated) > LATE_ROUND_TOLERANCE) {
					if (++_lateMisses >= LATE_MISS_LIMIT) { _engineTrusted = false; _lateHits = 0; }
					rememberRest(true);
					return why('engine-partly-' + Math.round(compensated) + '-of-' + Math.round(grow));
				}
			}
			if (Math.abs(drift) < 1) {
				if (grow > 1 || floorShrink > 1) rememberRest(true);
				return why('no-drift-grow-' + Math.round(grow));	/* the engine put it back */
			}
			if (Math.abs(drift) > (window.innerHeight || 800)) return why('drift-too-big');
			const sc = scroller();
			const at = sc ? sc.scrollTop : window.scrollY;
			writeOffset(sc, at + drift);
			why('wrote-' + Math.round(drift));
			/* A fresh, forced rememberRest(): `_rest` was taken mid-transition, and left standing it is what
			 * the next refill measures against. docs/anchoring-log.md, "The reference after this file's
			 * own write must be re-taken forced". */
			rememberRest(true);
			/* A drop in this box's own floor says nothing about the engine: every run() rewrites `min-height`,
			 * an invalidation in itself. docs/anchoring-log.md, "A floor shrink is not evidence about the engine". */
			if (floorShrink > 1) return;
			/* A direct drift inside the blind branch's tolerance is that same table rounding: 1px against a
			 * 132px growth counted as a miss, twice over.
			 * docs/anchoring-log.md, "One pixel of direct drift is the same table rounding". */
			if (Math.abs(drift) <= LATE_ROUND_TOLERANCE) return;
			if (++_lateMisses >= LATE_MISS_LIMIT) { _engineTrusted = false; _lateHits = 0; }
		};
		/* How long to wait is a question about the reader (docs/anchoring.md): where nothing is driving,
		 * the engine is the only mover and its window is 7-36ms — 404-422ms became 8-61ms. */
		if (!scrolling() && Date.now() >= _userUntil) { why('now'); settle(); }
		else { why(scrolling() ? 'wait-idle-moving' : 'wait-idle-intent'); _lateFrame = window.setTimeout(settle, SCROLL_IDLE); }
	});
}

/* A floor `holdFloor()` could not clear at mutation time, cleared later with nobody watching: its
 * own frame slot, and the offset's own response to the write below as the check. Not gated on
 * `scrolling()` — the belated write is what the engine reacts to, and the reaction re-arms the
 * motion window, still reading true one rAF later on all three cells.
 * docs/anchoring-log.md, "A floor that shrinks with nobody watching". */
let _floorLateFrame = 0;
function settleDeferredFloor(offsetBefore, shrink) {
	if (_floorLateFrame) return;
	_floorLateFrame = requestAnimationFrame(() => {
		const seen = scrollTop();
		_floorLateFrame = requestAnimationFrame(() => {
			_floorLateFrame = 0;
			if (!anchorEnabled() || Date.now() < _userUntil) return;
			if (_restPage !== pageStamp()) return;
			if (scrollTop() !== seen) return;		/* still settling, or the reader has moved */
			const wanted = offsetBefore - shrink;
			const gap = wanted - seen;
			if (Math.abs(gap) <= LATE_ROUND_TOLERANCE) return;		/* the engine already gave it back */
			if (Math.abs(gap) > (window.innerHeight || 800)) return;
			const sc = scroller();
			const at = sc ? sc.scrollTop : window.scrollY;
			writeOffset(sc, at + gap);
			if (_rest) { _rest.top -= gap; if (_rest.sec) _rest.secTop -= gap; _rest.at = scrollTop(); }
			_restAt = scrollTop();
		});
	});
}

function scheduleAnchor(ref) {
	if (!ref) return awhy('no-reference');
	if (!anchorEnabled()) return awhy('anchoring-off');
	if (_anchorPending) return awhy('pending-kept-first');
	_anchorPending = ref;
	if (_anchorFrame) return;
	_anchorFrame = requestAnimationFrame(() => {
		_anchorFrame = 0;
		const pending = _anchorPending;
		_anchorPending = null;
		const wrote = applyAnchor(pending);
		rememberRest(wrote);
	});
}
function applyAnchor(ref) {
	if (!ref) return;
	/* Not into a moving page — unless the motion IS the clamp this correction is for, which held a
	 * correct -60px correction unwritten. docs/anchoring-log.md, "A clamp is not the reader". */
	if (scrolling() && !sawClamp()) return awhy('refused-moving');
	const sc = scroller();
	const at = sc ? sc.scrollTop : window.scrollY;
	if (ref.by != null) {
		if (ref.by < 1) return awhy('by-under-1');
		writeOffset(sc, at + ref.by);
		awhy('wrote-by-' + Math.round(ref.by));
		return true;
	}
	if (at <= 0) return awhy('at-top');
	if (!ref.el.isConnected) return awhy('reference-gone');
	const drift = ref.el.getBoundingClientRect().top - ref.top;
	if (Math.abs(drift) < 1) return awhy('no-drift');			/* nothing needed correcting here */
	_lateHits = 0;
	if (Math.abs(drift) > (window.innerHeight || 0) + 200 + (ref.slack || 0)) return awhy('drift-too-big');
	writeOffset(sc, at + drift);
	awhy('wrote-' + Math.round(drift));
	return true;
}

function observeContent() {
	if (_mo) return;
	const hosts = [ document.getElementById('view') || document.body, document.getElementById('modal_overlay') ]
		.filter(Boolean);
	const viewHost = hosts[0];
	_mo = new MutationObserver((records) => {
		const settled = _rest;
		const trustEngine = _engineTrusted;
		const ref = trustEngine ? null : anchorFor();
		/* The record's own target, read before run() rewrites its floor: the growth in pixels, rather than
		 * whichever element the fold happened to hit, and read on every tick so recovery can tell a tick
		 * that tested the engine from one that did not. The floored box the record sits IN, since
		 * `dom.content()` refills a node inside the pinned box on 1 of 12 nodes (docs/anchoring-log.md,
		 * "A witness that cannot see the box it is measuring"). */
		let r = null, box = null;
		for (const m of records) {
			if (m.type !== 'childList' || !m.target.closest) continue;
			const b = m.target.closest(FLOORED);
			if (b) { r = m; box = b; break; }
		}
		const before = box && (parseFloat(box.style.minHeight) || 0);
		let grew = before ? box.offsetHeight - before : 0;
		/* only growth above the reader's reference: counting a box below it wrote the whole growth back,
		 * offset +120 and reader -120 (docs/anchoring-log.md, "Growth below the reader") */
		if (grew > 1 && settled && settled.el && settled.el.isConnected
				&& box.getBoundingClientRect().top >= settled.el.getBoundingClientRect().top) grew = 0;
		if (!trustEngine && grew > 1 && _rest && _rest.el.isConnected && Date.now() >= _userUntil
				&& !scrolling() && _restPage === pageStamp()
				&& Math.abs(_rest.el.getBoundingClientRect().top - _rest.top) < 1
				&& ++_lateHits >= TRUST_RECOVERY_LIMIT) {
			_engineTrusted = true;
			_lateMisses = _lateHits = 0;
		}
		const wasScrolling = scrolling();
		if (r && before && wasScrolling) _deferredFloor = box;
		run(records);
		if (!wasScrolling) _deferredFloor = null;
		const floorShrink = (r && before) ? Math.max(0, before - (parseFloat(box.style.minHeight) || 0)) : 0;
		/* `#view` itself emptied and refilled is a page swap: a reference measured mid-swap is read 431px
		 * out and written over a correct restoreScroll(). docs/anchoring.md, "The commit is not a refill". */
		let gone = 0, came = 0, took = 0, gave = 0;
		for (const m of records) {
			if (m.target === viewHost) { gone += m.removedNodes.length; came += m.addedNodes.length; }
			if (m.type === 'childList') { took += m.removedNodes.length; gave += m.addedNodes.length; }
		}
		if (gone && came) {
			forgetRest();
			return;
		}
		/* Not on a batch that only took nodes away: arming on the empty half wrote -834px, and superseding
		 * with the later batch cost 12 findings. docs/anchoring-log.md, "The later batch must not win". */
		if (trustEngine) {
			if (took && !gave && grew <= 0 && floorShrink <= 1) why('emptying');
			else lateDrift(settled, grew, floorShrink);
		}
		else scheduleAnchor(ref);
	});
	for (const host of hosts) {
		_mo.observe(host, { childList: true, subtree: true });
		watch(host);
	}
	_moFlag = new MutationObserver(() => run());
	_moFlag.observe(document.body, { attributes: true, attributeFilter: [ 'class' ] });

	/* A tab switch, a closing fold and a `depends()` row mutate no node, and `min-height` beats the
	 * `height: 0` they collapse with: 1299px of blank left standing (docs/anchoring-log.md, "A tab
	 * switch moves no node"). A same-value write is not a change, though: the fitters re-apply classes
	 * every pass, and an unguarded `class` watch froze the tab, 391 callbacks in 432ms
	 * (docs/anchoring-log.md, "A same-value class write is a feedback loop"). */
	_moTabs = new MutationObserver((records) =>
		records.some((r) => r.oldValue !== r.target.getAttribute(r.attributeName)
			&& (r.attributeName !== 'class' || r.target.dataset.field)) && run());
	for (const host of hosts)
		_moTabs.observe(host, { attributes: true, attributeOldValue: true,
			attributeFilter: [ 'data-tab-active', 'hidden', 'aria-expanded', 'class' ], subtree: true });

}

return baseclass.extend({
	add(fit) {
		if (typeof fit !== 'function') return;
		_fitters.push(fit);
		observeContent();
		try { fit(); }
		catch (e) { console.error('fs-fit: a fitter threw on registration', e); }
	},

	scrolling,
	/* unmarked, for tools/scroll-anchor.mjs — see `_lateWhy` */
	lateWhy: () => _lateWhy,
	lateTrail: () => _lateTrail.slice(),
	anchorWhy: () => _anchorWhy,
	anchorTrail: () => _anchorTrail.slice(),
	deferMeasurement,

	/* -> the offset this file last took a reference at, so a probe does not measure the guard instead
	 * of the anchor. No probe marker: packaging strips those, and the sweep reads the installed package. */
	restAt: () => _restAt,

	/* -> whether the engine is still trusted with a refill; unmarked, like `restAt` above */
	engineTrusted: () => _engineTrusted,

	forgetRest,

	armGate,

	schedule,

	frame(fn) {
		let pending = false;
		return () => {
			if (pending) return;
			pending = true;
			requestAnimationFrame(() => { pending = false; fn(); });
		};
	},

	touches(mutations, sel) {
		for (const m of mutations)
			for (const n of m.addedNodes) {
				if (n.nodeType !== 1) continue;
				if (n.matches(sel) || n.querySelector(sel)) return true;
			}
		return false;
	},

	roomFor(el) {
		const p = el && el.parentElement;
		if (!p) return Infinity;
		const cs = getComputedStyle(p);
		return p.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
	},

	/* The browser's own answer is the whole test — a canvas approximation cost ~1ms per pass and claimed
	 * 144px where the engine's floor is 93 on a 114-row table — and the box's own width is the half
	 * `scrollWidth` cannot see (2px at 1440). */
	overflows(el) {
		const room = this.roomFor(el);
		const grown = el.getBoundingClientRect().width;
		return Math.max(el.scrollWidth, grown) > room + 1;	/* +1: sub-pixel rounding */
	},

	/* Is somebody else already scrolling this? A 598px `div.resizeable` came out as cards on a 1280px
	 * screen, where the page had 1224px of room. The walk stops at the content root. */
	inScroller(el) {
		for (let p = el.parentElement; p && p.id !== 'view' && p.id !== 'modal_overlay'; p = p.parentElement)
			if ((/(auto|scroll)/).test(window.getComputedStyle(p).overflowX)) return true;
		return false;
	}

});
