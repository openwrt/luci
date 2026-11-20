'use strict';
'require baseclass';

/* fs-fit — the theme's one "does it still fit?" engine and the one place the reader's scroll
 * position is corrected. Add fit logic here, never a second observer: no CSS query can ask what the
 * content needs (media = viewport, container = container). Three rules, each a bug that was hit:
 * rule 1, measure uncollapsed, since a collapsed thing always fits; rule 2, re-fit synchronously on
 * a mutation, since deferring a poll tick to rAF paints one frame of a stacked table at full width
 * (19-109px of overflow); rule 3, coalesce on resize, since every fit forces a layout. */

/* Exported, not armed at module eval: only fs-select.js clears the rule this raises, and arming
 * without it left every data table invisible. */
function armGate() {
	if (!fittersEnabled()) return;
	document.documentElement.dataset.fsFit = '1';
}

const _fitters = [];
let _ro = null, _mo = null;

function runAll(list, what) {
	for (const fit of list) {
		try { fit(); }
		catch (e) { console.error('fs-fit: a ' + what + ' threw', e); }
	}
}

/* dev switch */
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
 * growth, all 120px. The selector covers what `dom.content()` empties: a section body, a table
 * (a table's body climbs to the same box), and luci-mod-dashboard's KPI row, charts and tab map,
 * which sit straight under `.Dashboard`. Without their floor WebKit 27.2 put a reader 526px down
 * the dashboard at 0 on every poll, at 1280, 820 and 390px alike. */
const SHRINKS = '.cbi-section > div, .table, .Dashboard > div';

const FLOORED = '[data-fs-floor]';

/* One floor per container, cleared and re-measured in one batched pass: not while the reader
 * scrolls, and not on a table box — `min-height` is undefined there (CSS 2.1 §10.7) and a 313px
 * floor still collapsed to 30px on WebKit. The clear is what keeps the answer honest. */
function holdFloor(records) {
	if (scrolling() || !fittersEnabled()) return;
	const host = document.getElementById('view');
	if (!host) return;			/* a call, cbi or template page has no #view */
	const boxes = new Set();
	host.querySelectorAll(SHRINKS).forEach((el) => {
		let box = el, cs = window.getComputedStyle(el);
		while (box !== host && cs.display.startsWith('table')) {
			box = box.parentElement;
			cs = window.getComputedStyle(box);
		}
		if (box !== host) boxes.add(box);
	});
	host.querySelectorAll(FLOORED).forEach((box) => boxes.add(box));

	let dirty = [...boxes];
	if (records && records.length) {
		const targets = new Set();
		for (const r of records) if (r.target) targets.add(r.target);
		dirty = dirty.filter((box) => {
			for (const t of targets) if (box.contains(t) || t.contains(box)) return true;
			return false;
		});
	}
	if (!dirty.length) return;

	const page = scroller() || document.documentElement;
	const at = scrollTop(), tall = page.scrollHeight;
	dirty.forEach((box) => { box.style.minHeight = ''; });
	/* The box's own rect height, not `offsetHeight`'s rounding: 22 floors half a pixel too tall made
	 * the document 2px taller, and the next clear handed that back as a clamp — 6 of 12 refills
	 * corrected against 12 of 12. */
	const hs = dirty.map((box) => box.getBoundingClientRect().height);
	dirty.forEach((box, i) => {
		if (hs[i] > 0) { box.style.minHeight = hs[i] + 'px'; box.setAttribute('data-fs-floor', ''); }
		else box.removeAttribute('data-fs-floor');
	});
	/* And where the scroller stayed shorter the shrink is real: the clamp gave back only the 60px the
	 * document lost at its bottom. */
	const landed = scrollTop();
	if (landed >= at) return;
	if (page.scrollHeight >= tall) writeOffset(at); else _clampedTo = landed;
}

/* Is the page moving? asked of the position, never of the events: on iOS momentum carries the page
 * long after the finger has gone, and one offset read per frame sees it. SCROLL_IDLE is how long the
 * page must hold still before put-off work may run: 137-256px of roughness at 200ms against 59px —
 * one pixel of rounding per frame, the floor — at 250ms and above. */
const SCROLL_IDLE = 400;
let _deferred = false;
function deferMeasurement() { _deferred = true; }
let _movingUntil = 0;
let _lastOffset = null;
let _sampling = false;
let _ownWrite = null;
function sawOwnWrite(y) {
	if (_ownWrite === null) return true;
	if (Math.abs(y - _ownWrite) < 1) return false;
	_ownWrite = null;
	return true;
}
/* Where the browser's clamp last put the offset, read by `applyAnchor()` alone — `scrolling()`
 * keeps answering for the whole theme. */
let _clampedTo = null;
function sawClamp() {
	if (scrollTop() === _clampedTo) return true;
	_clampedTo = null;
	return false;
}
function writeOffset(value) {
	const sc = scroller();
	if (sc) sc.scrollTop = value; else window.scrollTo(0, value);
	_ownWrite = scrollTop();
}

/* Which element scrolls, cached per width: a probe per frame is a forced layout mid-flick, and the
 * stylesheet decides it. */
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
function docHeight() {
	return (scroller() || document.documentElement).scrollHeight;
}

function scrolling() { return Date.now() < _movingUntil; }
function sampleMotion() {
	const y = scrollTop();
	if (y !== _lastOffset) {
		const own = !sawOwnWrite(y);
		_lastOffset = y;
		if (!own) _movingUntil = Date.now() + SCROLL_IDLE;
	}
	if (scrolling()) { requestAnimationFrame(sampleMotion); return; }
	_sampling = false;
	/* The offset's own response to the write below, not a reference element's drift: one re-established
	 * on wrong ground shows none. */
	/* Only a box wholly above the viewport moves the reader when it gives its floor up. */
	const floorsAbove = [..._deferredFloors].filter((b) => b.isConnected && b.getBoundingClientRect().bottom <= 0)
		.map((b) => [ b, parseFloat(b.style.minHeight) || 0 ]);
	_deferredFloors.clear();
	const offsetBefore = scrollTop();
	holdFloor();
	let shrink = 0;
	for (const [ b, h ] of floorsAbove) shrink += h - (parseFloat(b.style.minHeight) || 0);
	if (shrink > 1) settleDeferredFloor(offsetBefore, shrink);
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

/* Read on the next frame, never in the scroll event: a layout forced while WebKit dispatches one
 * skips its anchoring adjustment and leaves the scroller marked as queued, so the engine anchors
 * nothing for the rest of the document's life (ScrollAnchoringController::
 * adjustScrollPositionForAnchoring returns before it clears the mark). Any sticky or fixed box —
 * `.th`, `#modal_overlay`, the bar — leaves layout dirty there, so one `scrollY` read is enough. */
const noteScroll = frame(noteMotion);

(function watchMotion() {
	const opts = { passive: true, capture: true };
	window.addEventListener('scroll', noteScroll, opts);
	for (const name of [ 'wheel', 'touchmove' ])
		window.addEventListener(name, noteUser, opts);
	for (const name of [ 'mousedown', 'keydown', 'touchstart' ])
		window.addEventListener(name, noteIntent, opts);
})();

function frame(fn) {
	let pending = false;
	return () => {
		if (pending) return;
		pending = true;
		requestAnimationFrame(() => { pending = false; fn(); });
	};
}
const schedule = frame(run);

/* Width only: iOS resizes the viewport height as the URL bar slides away, and twenty height-only
 * steps rewrote 1054 class attributes. */
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
	if (!_ro) _ro = new ResizeObserver(onResize);
	_ro.observe(el);
}

/* ---- scroll anchoring, where the engine has none ----
 * Safari and iOS before 27 have no `overflow-anchor`, and a tick's growth above the reader moves
 * them by all of it. Whether the engine anchors is asked of the platform, never of a browser name;
 * where it does, the observer leaves the reader to it. Elsewhere the drift is computed from a
 * reference element, never from the offset. */
const ENGINE_ANCHORS = CSS.supports('overflow-anchor', 'auto');

let _rest = null;
let _restAt = null, _restPage = null;
/* Every floored box a tick refilled while the reader scrolled: one tick refills several, and keeping
 * one lost the lease table's 172px. */
const _deferredFloors = new Set();
function pageStamp() {
	return document.body.getAttribute('data-page') || '';
}
function forgetRest() {
	_rest = null;
	_restAt = null;
	_restPage = null;
}
/* `force`: only for the caller that has just written the offset itself, since the engine's own
 * compensation leaves `scrolling()` true for milliseconds after it — `moved 0, 0, -59` without,
 * `0, 0, 0` with it. */
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
	_rest = ref ? { el: ref.el, top: ref.top, at: _restAt, sec: ref.sec, secTop: ref.secTop, tall: ref.tall } : null;
}

function anchorFor() {
	const at = scrollTop();
	const clamped = (_restAt != null && at < _restAt && !scrolling() && _restPage === pageStamp());
	if (!_rest || !_rest.el.isConnected) {
		if (clamped) return { by: _restAt - at };
		if (_rest && _rest.sec && _rest.sec.isConnected && at === _restAt)
			return { el: _rest.sec, top: _rest.secTop, slack: 0, tall: _rest.tall };
		return anchorRef();
	}
	if (at !== _rest.at && !clamped) return null;
	return { el: _rest.el, top: _rest.top, slack: Math.max(0, _rest.at - at), tall: _rest.tall };
}

function anchorRef() {
	if (scrolling()) return null;

	const host = document.getElementById('view');
	if (!host) return null;
	const box = host.getBoundingClientRect();
	const x = Math.round(box.left + (Math.min(box.width, window.innerWidth || box.width) / 2));
	let y = 1;
	let el = document.elementFromPoint(x, y);
	const chrome = el && el.closest('[data-fs-chrome]');
	if (chrome) y = Math.max(1, Math.round(chrome.getBoundingClientRect().bottom) + 1);

	const floor = Math.max(1, Math.round(window.innerHeight || 800));
	const pick = (yy) => {
		for (const cand of document.elementsFromPoint(x, yy))
			if (cand !== host && host.contains(cand)) return cand;
		return null;
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
	if (!el.getClientRects().length) return null;
	let keep = el.parentElement;
	while (keep && keep !== host && !keep.classList.contains('cbi-section')
			&& !keep.classList.contains('cbi-map') && !keep.classList.contains('fs-ovl'))
		keep = keep.parentElement;
	if (keep === host) keep = null;
	return { el, top: el.getBoundingClientRect().top,
		sec: keep, secTop: keep ? keep.getBoundingClientRect().top : 0, tall: docHeight() };
}

let _anchorPending = null;
function anchorEnabled() {
	try { return localStorage.getItem('fsAnchor') !== 'off'; }
	catch (e) { return true; }
}
/* Floors `holdFloor()` could not clear while the reader scrolled, cleared once they let go: written
 * in the frame the floors came off, so no frame is painted with the reader moved. The offset as
 * laid out after the clear tells whether the engine already gave it back. */
function settleDeferredFloor(offsetBefore, shrink) {
	if (!anchorEnabled() || Date.now() < _userUntil) return;
	const seen = scrollTop();
	const gap = offsetBefore - shrink - seen;
	/* 16: a 32-36 row lease table rounds by 8-12.25px at 390 wide */
	if (Math.abs(gap) <= 16) return;		/* the engine already gave it back */
	/* no cap at the viewport: four leases stacked at 390px give up 1032px, all of it above */
	writeOffset(seen + gap);
	if (_rest) { _rest.top -= gap; if (_rest.sec) _rest.secTop -= gap; _rest.at = scrollTop(); }
	_restAt = scrollTop();
}

function scheduleAnchor(ref) {
	if (!ref) return;
	if (!anchorEnabled()) return;
	if (_anchorPending) return;
	_anchorPending = ref;
	requestAnimationFrame(() => {
		const pending = _anchorPending;
		_anchorPending = null;
		const wrote = applyAnchor(pending);
		rememberRest(wrote);
	});
}
function applyAnchor(ref) {
	/* Not into a moving page — unless the motion is the clamp this correction is for, which held a
	 * correct -60px correction unwritten. */
	if (scrolling() && !sawClamp()) return;
	const at = scrollTop();
	if (ref.by != null) {
		if (ref.by < 1) return;
		writeOffset(at + ref.by);
		return true;
	}
	if (at <= 0) return;
	if (!ref.el.isConnected) return;
	const drift = ref.el.getBoundingClientRect().top - ref.top;
	if (Math.abs(drift) < 1) return;			/* nothing needed correcting here */
	/* The cap: one viewport, or what the document grew or shrank since `ref`, whichever is more. A
	 * subtree swap moves a reference by thousands while the height holds; five leases at 390px move it
	 * 1290px, past an 844px viewport's 1044px, and the document grew all 1290. */
	const grew = Math.abs(docHeight() - ref.tall);
	if (Math.abs(drift) > Math.max(window.innerHeight || 0, grew) + 200 + (ref.slack || 0)) return;
	writeOffset(at + drift);
	return true;
}

function observeContent() {
	if (_mo) return;
	const hosts = [ document.getElementById('view') || document.body, document.getElementById('modal_overlay') ]
		.filter(Boolean);
	const viewHost = hosts[0];
	_mo = new MutationObserver((records) => {
		const ref = ENGINE_ANCHORS ? null : anchorFor();
		const wasScrolling = scrolling();
		/* every floored box a record sits in, since `dom.content()` refills a node inside the pinned box
		 * on 1 of 12 nodes, and one batch refills several: only the first lost the lease table's.
		 * Only a box already floored before run(): one run() floors now has nothing to settle later. */
		if (wasScrolling)
			for (const m of records) {
				const b = m.type === 'childList' && m.target.closest(FLOORED);
				if (b && (parseFloat(b.style.minHeight) || 0) > 0) _deferredFloors.add(b);
			}
		run(records);
		if (!wasScrolling) _deferredFloors.clear();
		/* `#view` itself emptied and refilled is a page swap: a reference measured mid-swap is read 431px
		 * out and written over a correct restoreScroll(). */
		let gone = 0, came = 0;
		for (const m of records)
			if (m.target === viewHost) { gone += m.removedNodes.length; came += m.addedNodes.length; }
		if (gone && came) {
			forgetRest();
			return;
		}
		scheduleAnchor(ref);
	});
	for (const host of hosts) {
		_mo.observe(host, { childList: true, subtree: true });
		watch(host);
	}
	const _moFlag = new MutationObserver(() => run());
	_moFlag.observe(document.body, { attributes: true, attributeFilter: [ 'class' ] });

	/* A tab switch, a closing fold and a `depends()` row mutate no node, and `min-height` beats the
	 * `height: 0` they collapse with: 1299px of blank left standing. A same-value write is not a
	 * change, though: the fitters re-apply classes every pass, and an unguarded `class` watch froze
	 * the tab, 391 callbacks in 432ms. */
	const _moTabs = new MutationObserver((records) =>
		records.some((r) => r.oldValue !== r.target.getAttribute(r.attributeName)
			&& (r.attributeName !== 'class' || r.target.dataset.field)) && run());
	for (const host of hosts)
		_moTabs.observe(host, { attributes: true, attributeOldValue: true,
			attributeFilter: [ 'data-tab-active', 'hidden', 'aria-expanded', 'class' ], subtree: true });

}

return baseclass.extend({
	add(fit) {
		_fitters.push(fit);
		observeContent();
		try { fit(); }
		catch (e) { console.error('fs-fit: a fitter threw on registration', e); }
	},

	scrolling,
	deferMeasurement,

	forgetRest,

	armGate,

	schedule,

	frame,

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
