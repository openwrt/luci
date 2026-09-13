'use strict';
'require baseclass';
'require ui';

/* fs-fit — the theme's ONE "does it still fit?" engine; add fit logic here, do not grow a second
 * observer. No CSS query can ask what the CONTENT needs (media = viewport, container =
 * container): does the menu fit beside the brand, is a table still readable? Both were once
 * breakpoints (one @media, five @container thresholds) — guessed numbers that real routers got
 * wrong, useless for a third-party luci-app-* table of unknown column count.
 *
 * THREE RULES, each a bug that was hit:
 *  1. MEASURE UNCOLLAPSED — a collapsed thing always "fits" (a stacked table is a pile of flex
 *     rows): read it as it stands and it un-collapses, next frame re-collapses. Oscillation.
 *  2. RE-FIT SYNCHRONOUSLY ON A MUTATION — the poll re-renders content once a second and the
 *     fresh element has lost our class. A MutationObserver callback is a microtask (pre-paint),
 *     rAF runs AT paint: deferring there painted a stacked table one frame at full width —
 *     19-109px of overflow, once a second, on Firewall/DHCP/Wireless.
 *  3. COALESCE ON RESIZE — every fit forces a synchronous layout.
 *
 * ResizeObserver, not onresize: a rail collapse and a layout toggle change the content width
 * without resizing the window. */

/* THE STYLESHEET MAY ONLY HIDE WHAT THIS FILE WILL SHOW, AND THE ARM BELONGS TO THE DISARM.
 * `theme/30-tables.css` keeps a data table out of the layout until something marks it `.fs-fitted`.
 * This attribute is what arms that rule — and it used to be written here, at module eval, while the
 * only code that ever writes `.fs-fitted` lives in fs-select.js, which the footer requires
 * SEPARATELY (`partials/footer.ut`: one require for menu-footstrap, another for fs-select, with no
 * dependency edge between them). A document that loaded this file and not that one — a failed
 * fetch, a parse error, a throw in fs-select's own init — armed a rule nobody could clear, and every
 * data table on Status/Leases/Processes/Wireless rendered as nothing at all, silently.
 *
 * So the arming is exported instead, and the module that clears the rule is the one that raises it.
 * A document where fs-select never ran carries no attribute and shows every table exactly as it did
 * before the rule existed. */
function armGate() {
	if (!fittersEnabled()) return;
	try { document.documentElement.dataset.fsFit = '1'; } catch (e) { /* no document, no gate */ }
}

const _fitters = [];
let _rafPending = false;
let _ro = null, _mo = null, _moFlag = null;

/* ---- A PASS THAT READS LAYOUT MAY NOT RUN WHILE THE READER SCROLLS ----
 *
 * Reading layout — `getBoundingClientRect()`, `clientWidth`, `scrollWidth` — forces the engine to
 * lay the page out synchronously. Once a second, from a poll tick, in the middle of a flick on a
 * phone, that is what iOS holds the main thread back to prevent, and it was the largest part of the
 * shaking reported from an iPhone; a stock theme has no JS in that path at all.
 *
 * The rule is stated by each pass rather than by this file, and that is not an oversight — the
 * central version was written, measured and reverted, because moving the decision here also moved
 * WHEN the deferred work lands and the device started shaking again. A pass that reads layout asks
 * `scrolling()` and calls `deferMeasurement()`; a pass that only writes does neither and runs
 * always. The one that must run always is the marking of a freshly polled table: the stylesheet
 * keeps an unmarked data table out of the layout, so waiting would leave it invisible for as long
 * as the reader keeps scrolling. */
function runAll(list, what) {
	for (const fit of list) {
		try { fit(); }
		/* one broken fitter must take neither the others nor the poll's MutationObserver
		 * callback with it — that would silently stop ALL re-fitting */
		catch (e) { console.error('fs-fit: a ' + what + ' threw', e); }
	}
}

/* Everything that may run right now, with the reader kept where they were.
 *
 * ONE PATH: the mutation observer, the coalesced re-fit and the pass that was put off during a
 * scroll all come through here, so the order — reference, work, correction — is stated once.
 * `anchorRef()` answers null while the reader scrolls and the correction below does nothing with a
 * pass that happens mid-scroll costs neither of the two layout reads.
 *
 * WHAT MAY RUN MID-SCROLL IS EACH PASS'S OWN ANSWER, not this function's. A pass that only writes —
 * marking a freshly polled table, which cannot wait because the stylesheet holds an unmarked table
 * out of the layout — runs always; a pass that reads layout asks `scrolling()` first and calls
 * `deferMeasurement()`. Deciding it here instead was tried and reverted: it changed WHEN the
 * deferred work lands, and the device that had the problem started shaking again. */
/* DEV SWITCH: `localStorage.fsFit = 'off'` stops every fitter. It exists because the only way to
 * tell "the theme's measuring is what shakes this phone" from "something else is" is to turn the
 * measuring off ON THAT PHONE, and a laptop cannot answer it. */
function fittersEnabled() {
	try { return localStorage.getItem('fsFit') !== 'off'; }
	catch (e) { return true; }
}
function run() {
	if (!fittersEnabled()) return;
	runAll(_fitters, 'fitter');
	/* the page is settled now: this is the height the NEXT tick may not go below, and the position
	 * the next mutation must be measured against — the latter unless a correction is already on its
	 * way, which would make this reference the drifted one */
	holdFloor();
	if (!_anchorPending) rememberRest();
}

/* ---- THE DOCUMENT MAY NOT GET SHORTER WHILE A TICK IS IN FLIGHT ----
 *
 * The correction below puts a reader back after the engine has moved them. This is the other half,
 * and it is the half that means they were never moved: `dom.content()` — what every LuCI poll calls
 * to refresh a section — empties the container before it refills it, and a document that is briefly
 * shorter than the offset the reader is at is a document the engine clamps the offset into. Nothing
 * puts that back afterwards, because the shortening was never real.
 *
 * So the CONTENT COLUMN keeps a floor: `min-height`, set to the height it had at the last settled
 * moment and held until the next one. A section emptying inside it takes nothing off the document,
 * there is no shorter document to clamp into, and the tick is invisible. The floor is re-measured
 * after every settled batch, so a page that genuinely got shorter is shorter one frame later.
 *
 * WHY THE FLOOR IS ON `.fs-content` AND NOT ON THE CONTAINER BEING SWAPPED. A version of this
 * shipped in fs-overview.js, pinning the container and releasing it in the same statement sequence —
 * `dom.content()` performs no layout, so no layout ever saw the pin and it did nothing at all
 * (measured: 1882px still clamped away with the pin in place). The fix reported from the field wraps
 * `dom.content()` itself and releases two frames later, which does work — at the price of patching
 * a luci-base API every app on the router shares, and up to seven read/write pairs per call. One
 * element that the theme owns, measured once per settled batch, is the same protection: measured on
 * a live router with the corrections switched off, the wrapper and this floor both hold the reader
 * at 0px against a 337px drift without either, at 16 measurements against 154 wrapped calls.
 *
 * NOT WHILE THE READER SCROLLS. Clearing the floor to re-measure is a layout read, and the flick is
 * where this file spends its comments avoiding those; the floor simply stays where it was, which is
 * still a floor. */
function holdFloor() {
	/* ONLY WHERE THE THEME IS RESPONSIBLE, same rule as the correction and for a measured reason: an
	 * engine that anchors by itself reads the held height as one more thing that moved. On Chromium
	 * in the sidebar layout at 1440 the reader ended 15px off with the floor held and 0px without it,
	 * reproducibly, while the floor bought that engine nothing — it puts the reader back on its own. */
	if (ENGINE_ANCHORS || scrolling()) return;
	const el = document.querySelector('.fs-content');
	if (!el) return;			/* the login page has no content column */
	/* cleared BEFORE the read, or the floor would measure itself and never come down */
	el.style.minHeight = '';
	const h = el.offsetHeight;
	if (h > 0) el.style.minHeight = h + 'px';
}

/* ---- IS THE PAGE MOVING RIGHT NOW? — ASKED OF THE POSITION, NEVER OF THE EVENTS ----
 *
 * A pass that reads layout must not run while the page moves: on a phone every such read forces a
 * synchronous layout in the middle of a flick, which is the work iOS holds the main thread back to
 * prevent. So the passes ask this before measuring, and what they skipped is run once the movement
 * stops.
 *
 * THE FIRST VERSION ASKED THE EVENTS — `scroll`, `wheel`, `touchmove`, plus 200 ms of quiet — and it
 * was wrong in the one place it mattered. On iOS the momentum keeps carrying the page long after the
 * finger has gone, and events do not reliably arrive through it; the timer then declared the reader
 * still and dropped the whole deferred pass — every table stripped and measured, the chrome
 * re-fitted — into the middle of the glide. That is a stall and a relayout while the page is
 * visibly moving, and it is the shaking that came BACK when a refactor made less work happen during
 * the scroll and more of it land in that burst. The measurement that named it: the same device
 * shook more with strictly less work in the scroll path.
 *
 * So movement is read from the SCROLL POSITION. A frame in which the offset differs from the last is
 * movement, whatever the event stream is doing; the sampler runs only while there is reason to
 * think the page moves, and stops itself when the offset has held for SCROLL_IDLE. Momentum,
 * rubber-banding and a programmatic `scrollTo` all look the same to it, which is the point.
 *
 * The offset read is one per frame, and it is the cheapest question there is — no geometry, no
 * element, no forced layout beyond what the frame already needs. */
/* HOW LONG THE PAGE MUST HOLD STILL BEFORE THE PUT-OFF WORK MAY RUN, and the number is the fix for
 * the shaking, not a tuning knob.
 *
 * 200ms was shorter than the pauses a slow reader leaves. Rocking a page gently at the tables — the
 * reader's own description of when it happens — the offset stops for a moment between one movement
 * and the next, this timer called that a stop, and the whole deferred pass landed in the middle of
 * the gesture: every table stripped of its marks, measured, marked again. That is a full relayout
 * while the page is visibly moving, and it is what "jerks back and forth" was.
 *
 * Measured on a stand with the reader's motion imitated (a slow rock, 60 frames, the error between
 * what the wheel asked for and what the page did, summed): 137-256px of roughness at 200ms with
 * every twentieth frame off by 40px, and 59px — the floor, one pixel of rounding per frame, the same
 * as switching the fitters off entirely — at 250ms and above. 400 is that floor with room to spare,
 * and still well inside the time a reader takes to look at what they scrolled to. */
const SCROLL_IDLE = 400;
/* set by a pass that skipped its measurement because the page was moving; consumed by the sampler
 * below the moment it stops */
let _deferred = false;
function deferMeasurement() { _deferred = true; }
let _movingUntil = 0;
let _lastOffset = null;
let _sampling = false;

/* WHICH ELEMENT SCROLLS, ASKED ONCE PER WIDTH RATHER THAN ONCE PER FRAME.
 *
 * This function is the one every other pass consults before it dares to measure, and it ran in the
 * frame loop below for as long as the page moved — so the `scrollHeight`/`clientHeight` probe it
 * used to make WAS a forced synchronous layout, once per frame, in the middle of the flick this file
 * exists to keep clear. Worse, a poll tick lands as a microtask that writes classes, so the very
 * next frame's probe paid for a layout that had just been dirtied; and `touchstart` starts the
 * sampler, so a plain tap on a button bought ~24 of them.
 *
 * WHAT IS ASKED IS ALSO NOT WHAT IT USED TO ASK. "Does this element currently overflow" is a
 * property of the CONTENT, and it was being memoised against a stamp that only moves when a WIDTH
 * does: open a short page (no overflow, answer cached as "the window scrolls"), navigate to a tall
 * one — `#view` keeps its identity and its width, so nothing bumps the stamp — and every pass went
 * on reading `window.scrollY`, which in the sidebar layout is pinned at 0 by
 * `.fs-shell { height: 100svh; overflow: hidden }`. The offset then never appeared to move, the
 * sampler never extended `_movingUntil`, and every mid-scroll guard in this file was inert on
 * exactly the pages tall enough to scroll.
 *
 * The question is "which element does this layout scroll", and the STYLESHEET is what decides it:
 * `theme/20-shell.css` gives `.fs-main` `overflow-y: auto` for the desktop sidebar layout and
 * nothing else, so the computed value IS the answer — no content-height probe, no viewport literal
 * copied out of a media query, and correct the moment the CSS changes. `getComputedStyle` resolves
 * style, not layout, and the verdict is cached against the resize stamp AND the two attributes that
 * carry a layout change (`data-layout`, `data-narrow`), so the frame loop reads neither. */
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
/* how many times the offset has moved in this stretch: >1 is a scroll, 1 is a compensation */
let _steps = 0;

function sampleMotion() {
	const y = scrollTop();
	if (_lastOffset === null || y !== _lastOffset) {
		/* HOW MANY TIMES the offset has moved inside this stretch of movement, not just that it did.
		 * One step is what a compensation looks like — the engine puts the offset somewhere and it
		 * stays there. A scroll is a SERIES. `lateDrift()` is the only caller that needs to tell the
		 * two apart, and this is the cheapest thing that can: it is counted in a loop that already
		 * runs, from a value it already reads. */
		if (_lastOffset !== null) _steps++;
		_lastOffset = y;
		_movingUntil = Date.now() + SCROLL_IDLE;
	}
	if (scrolling()) { requestAnimationFrame(sampleMotion); return; }
	_sampling = false;
	_steps = 0;
	/* the reader has stopped: this is a still moment, so the floor and the reference both belong to
	 * where the page now stands */
	holdFloor();
	rememberRest();
	/* the page has held still for SCROLL_IDLE: whatever was put off may run now */
	if (_deferred) {
		_deferred = false;
		/* NO CORRECTION FOR THIS BATCH, and that is deliberate. What runs here is work the fitters
		 * put off because the reader was moving; the page they are about to change is a page the
		 * reader has just scrolled through, and the two references available are both wrong for it.
		 * A FRESH one describes the page after the scroll — against an offset WebKit may not have
		 * laid out yet, which made the theme undo the reader's own move (measured at 1440, top,
		 * Compact: parked at 591, put back to 0). The one from the last STILL page describes where
		 * the reader was before the flick, and correcting to it drags them back there — the gate
		 * caught exactly that as a 231px jump landing inside a scroll, on all three engines. Nothing
		 * here is a poll tick: the fitters do not grow the page under anybody, they re-measure what
		 * the scroll already showed. The next mutation corrects against a reference taken while the
		 * page was still, which is the one that is true. */
		run();
	}
}

function noteMotion() {
	_movingUntil = Date.now() + SCROLL_IDLE;
	if (_sampling) return;
	_sampling = true;
	requestAnimationFrame(sampleMotion);
}

/* `passive: true` and `capture: true`: this must never sit in front of the scroll it is watching,
 * and `scroll` does not bubble from an element — it only travels down the capture phase, which is
 * how the sidebar layout's inner scroller is seen as well as the document. The events only START
 * the sampler; whether the page is still moving is the sampler's answer, not theirs. */
/* IS THE READER DRIVING, as opposed to the page moving?
 *
 * `scrolling()` above cannot tell those apart, and must not: every pass that reads layout has to
 * stay out of a moving page whoever is moving it. `lateDrift()` asks the other question — a scroll
 * offset that changed because the ENGINE compensated a mutation is precisely what it exists to
 * inspect, and gating it on `scrolling()` made it fire never (measured: `late:busy` on every tick,
 * because the engine's own correction starts the motion sampler). A gesture is what says the reader
 * is driving, so the gesture is what it asks about. `mousedown` is in the list for the scrollbar
 * thumb and `keydown` for Page Down, neither of which produces a wheel or a touch — but those two
 * answer THIS question only, never `scrolling()`; see the note on the listeners below. */
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
	/* a gesture that IS the scroll: it says both "the reader is driving" and "the page is moving" */
	for (const name of [ 'wheel', 'touchstart', 'touchmove' ])
		window.addEventListener(name, noteUser, opts);
	/* INTENT ONLY. A scrollbar drag and a Page Down do move the page, but they say so themselves —
	 * both fire `scroll`, which is wired to `noteMotion` above. Feeding them to `noteMotion` as well
	 * would make `scrolling()` answer yes for 400ms after ANY click and EVERY keystroke, and that
	 * answer gates every pass in this file that reads layout: measured while typing into a form with
	 * the window resizing under it, 9 of 10 floor and reference passes were skipped and landed in one
	 * burst afterwards — the exact failure the note above SCROLL_IDLE describes. */
	for (const name of [ 'mousedown', 'keydown' ])
		window.addEventListener(name, noteIntent, opts);
})();

/* Next frame, at most once per frame (rule 3). */
function schedule() {
	if (_rafPending) return;
	_rafPending = true;
	requestAnimationFrame(() => { _rafPending = false; run(); });
}

/* WIDTH ONLY, and this is not an optimisation — it is what makes the theme usable on a phone.
 *
 * Every browser on iOS grows and shrinks the viewport HEIGHT while the user scrolls, because the
 * URL bar slides away and comes back; each step of that animation is a resize, and a ResizeObserver
 * on #view reports it. Measured with the bar's travel simulated on a 390px viewport — twenty
 * height-only steps, width untouched — the fitters ran often enough to rewrite 1054 class
 * attributes, each one a forced synchronous layout of a page the user is scrolling. That is the
 * juddering reported from an iPhone.
 *
 * Nothing a fitter asks is about height: `roomFor()`/`overflows()` compare a table against its
 * column, `fitChrome()` asks whether the menu fits beside the brand, the rail and the density axes
 * change widths. A height-only change cannot alter any of those answers — and the one case that
 * looks like a counter-example is not one: a vertical scrollbar appearing takes WIDTH from the
 * content box, so the observer sees it as the width change it is.
 *
 * Per element, because the roots are observed separately and a dialog can resize while #view does
 * not. The first entry for an element always counts as a change, so nothing is lost at start-up. */
/* bumped whenever an observed root changes WIDTH — the only thing that can change which element
 * scrolls, and therefore what `scroller()` above may cache */
let _resizeSeq = 0;
const _lastWidth = new WeakMap();
function onResize(entries) {
	let widthMoved = false;
	for (const e of entries) {
		/* contentRect, not getBoundingClientRect(): the observer already measured it, and asking
		 * again inside the callback is the forced layout this function exists to avoid. */
		const w = Math.round(e.contentRect.width);
		if (_lastWidth.get(e.target) !== w) {
			_lastWidth.set(e.target, w);
			widthMoved = true;
		}
	}
	if (widthMoved) { _resizeSeq++; schedule(); }
}

/* Watch an element's size. A change in WIDTH re-fits everything — the fitters are cheap and few. */
function watch(el) {
	if (!el) return;
	/* No feature test: the shipped CSS needs :has() and container queries, both years younger than
	 * ResizeObserver in every engine, so a browser that can render this theme at all has it. The
	 * window-resize fallback that used to sit here was worse than nothing anyway — it cannot see a
	 * rail collapse or a layout toggle, which is the pair this file uses an observer FOR. */
	if (!_ro) _ro = new ResizeObserver(onResize);
	_ro.observe(el);
}

/* ---- SCROLL ANCHORING, WHERE THE ENGINE HAS NONE ----
 *
 * A poll tick changes the height of what is ABOVE the reader: a lease expires, a station joins, a
 * section renders one row fewer. An engine with scroll anchoring absorbs that — it moves the scroll
 * offset by the same amount, so the page under the reader does not move. WebKit has none, and it is
 * every browser on iOS: measured on the reporter's own router, `content +133px, +134px, +123px,
 * +108px…` one after another, each next to a `child +1/-1` in a polled section. That is the shaking,
 * and it is not the tall-intermediate problem the rest of this file solves — the height change here
 * is REAL, and simply nobody compensates for it.
 *
 * So this compensates for it, and only when nobody else did. A reference is taken from the elements
 * that survive a poll — the section frames — choosing the one that crosses the top of the viewport,
 * because that is the boundary a reader perceives as "where I am". The fitters run, the reference is
 * read again, and the offset is moved by however far it drifted.
 *
 * WHY THIS IS SAFE ON AN ENGINE THAT DOES ANCHOR, which an earlier attempt got wrong by measuring
 * the wrong thing: the correction is computed from the REFERENCE, not from the scroll offset. An
 * anchoring engine has already put the reference back where it was by the time this reads it — the
 * read forces layout, and the adjustment happens during layout — so the drift is zero and this does
 * nothing at all. Measuring the offset instead reads an anchoring adjustment as a fault and corrects
 * a correction, which is exactly how a previous version made Chromium worse (16 movements, 1827px).
 *
 * It never fights the user: a page at the very top has no offset to give back and is left alone, and
 * a drift under a pixel is rounding rather than movement. */
/* DOES THE ENGINE ANCHOR AT ALL? Chromium and Firefox compensate a height change above the viewport
 * by themselves — the reader stays where they were and the scroll offset moves under them. WebKit
 * did not implement it until recently, so on an older Safari and on every iPhone of that vintage the
 * same poll tick moves the page (a current WebKit anchors, and gets the COLLAPSE case wrong instead —
 * lateDrift() below):
 * measured with the engine's anchoring suppressed, a 120px growth above the fold moves the reader
 * 120px, and 0px with it on.
 *
 * The theme cannot do this job everywhere, only where nobody else is: correcting the offset in an
 * engine that also corrects it means two corrections and a page that jumps the other way. So it is
 * asked of the platform rather than of a browser name — `overflow-anchor` is the property that turns
 * the feature off, and an engine that does not know the property does not have the feature. */
const ENGINE_ANCHORS = (() => {
	/* DEV SWITCH, and the reason the fallback can be gated at all: `localStorage.fsEngineAnchor =
	 * 'off'` makes any engine take the path Safari takes. Without it the branch could only be
	 * exercised on a machine with Safari on it, which is neither CI nor most of the people who work
	 * on this — the same reason `fsFit` and `fsAnchor` exist. */
	try { if (localStorage.getItem('fsEngineAnchor') === 'off') return false; }
	catch (e) { /* no storage, no switch */ }
	try { return typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('overflow-anchor', 'auto'); }
	catch (e) { return true; }		/* unreadable: assume it is handled rather than fight it */
})();

/* WHAT THE READER WAS LOOKING AT, CAPTURED WHILE THE PAGE WAS STILL.
 *
 * `anchorRef()` below is called from the mutation observer, which runs AFTER the DOM changed: it
 * captures a position the poll has already moved, which is exactly right for the FITTERS (they have
 * not run yet) and blind to the mutation itself. On an engine that anchors, that split does not
 * matter — the engine covers the other half. On one that does not, this is the half nobody covers,
 * so the reference is kept from the last still moment instead. */
let _rest = null;
/* THE OFFSET IS REMEMBERED EVEN WHEN THE ELEMENT IS NOT, and that is the difference between putting
 * the reader back on 25.12 and putting them back everywhere. See anchorFor(). `_restPage` goes with
 * it because a page the reader NAVIGATED away from is not a page whose offset means anything: the
 * router resets both scrollers on a client navigation and replays them on a Back, and neither is a
 * clamp to undo. */
let _restAt = null, _restPage = null;
function pageStamp() {
	return (document.body && document.body.getAttribute('data-page')) || '';
}
/* -> the memo is void: whoever calls this owns the offset now (see the export below) */
function forgetRest() {
	_rest = null;
	_restAt = null;
	_restPage = null;
}
function rememberRest() {
	if (scrolling()) return;
	/* A PAGE AT THE TOP HAS NOTHING TO BE PUT BACK TO, so it does not pay for a reference. Every
	 * correction here gives back offset the reader lost; at offset 0 there is none to lose, and the
	 * hit test plus rect that anchorRef() costs (0.2ms typical, 6ms worst on a poll-dirtied WebKit
	 * layout, measured on the stands) buys nothing. The offset is still remembered — it is one read,
	 * and `anchorFor()`'s clamp test is written in terms of it. */
	if (ENGINE_ANCHORS && scrollTop() <= 0) {
		_rest = null;
		_restAt = 0;
		_restPage = pageStamp();
		return;
	}
	const ref = anchorRef();
	/* the offset it was taken at travels with it: a reference is only about the page, and the page
	 * moving under the reader is a different fact from the reader moving through it */
	_restAt = scrollTop();
	_restPage = pageStamp();
	_rest = ref ? { el: ref.el, top: ref.top, at: _restAt, sec: ref.sec, secTop: ref.secTop } : null;
}

/* -> the reference to correct against, on the path where the ENGINE does no anchoring of its own.
 * That is the only caller: where the engine anchors, the mutation observer holds the pre-mutation
 * reference itself and hands it to `lateDrift()` instead. A remembered reference is worth using
 * only while it still describes the reader's position — an element that left the document, or that
 * the reader has since scrolled a screen away from, is not one. */
function anchorFor() {
	const at = scrollTop();
	/* AN OFFSET THAT DROPPED WITH NOBODY SCROLLING, ON THE PAGE IT WAS TAKEN ON, IS A CLAMP.
	 * All three of those conditions are load-bearing. A clamp only ever moves the offset DOWN — it is the
	 * page running out of length, never gaining it — and a reader who moved is a reader `scrolling()`
	 * still answers for: their scroll starts the sampler, while the clamp's own scroll event arrives
	 * in the rendering step AFTER this microtask. The page stamp is the third: fs-router resets both
	 * scrollers on a client navigation and replays them on a Back, and neither of those is a clamp to
	 * undo — restoring there would drag the reader down a page they had just left. */
	const clamped = (_restAt != null && at < _restAt && !scrolling() && _restPage === pageStamp());
	/* THE REFERENCE DID NOT SURVIVE THE TICK, WHICH IS THE COMMON CASE RATHER THAN AN EDGE ONE.
	 * `dom.content()` replaces a section's children with NEW nodes, so the element that happened to
	 * sit at the top of the content area is gone by the time this runs. Measured on a 24.10 stand,
	 * where the theme cannot reach the poll at all — `view.status.index` there keeps its step
	 * function in a closure (no `poll_status` on the prototype), so fs-overview's height pin has
	 * nothing to hook and every tick empties its sections the hard way: the reference was
	 * disconnected on the tick that mattered, the fallback took a fresh one, measured a drift the
	 * ceiling then refused, and the reader stayed 1206px from where they had been.
	 *
	 * With no element there is no drift to measure — but there is still a number known exactly, and
	 * it is the one the engine took: the offset dropped by this much and nothing else happened.
	 * Giving it back IS the correction, and it cannot run away with the page — if the document really
	 * is shorter now, the browser clamps the write straight back and the reader keeps the offset they
	 * already had. The element path below stays preferred where it survives, because it compensates
	 * the height change the tick brought with it as well. */
	if (!_rest || !_rest.el.isConnected) {
		if (clamped) return { by: _restAt - at };
		/* the element is gone but its section is not — see anchorRef() for why that is the common
		 * case rather than an edge one */
		if (_rest && _rest.sec && _rest.sec.isConnected && at === _restAt)
			return { el: _rest.sec, top: _rest.secTop, slack: 0 };
		return anchorRef();
	}
	/* THE READER MOVED, NOT THE PAGE. A reference taken at one offset says nothing about a document
	 * seen from another: correcting against it would drag the page back to where the reader had
	 * scrolled FROM. So an offset that is not the one the reference was captured at normally means
	 * take a fresh one — which, on the mutation path, is the same as not correcting this tick.
	 *
	 * EXCEPT WHEN THE ENGINE MOVED IT, and that exception is the whole reason a poll tick could
	 * still throw the Overview across the screen with the compensation above already in place.
	 * `dom.content()` — what every LuCI poll calls to refresh a section — empties the container
	 * before it refills it, and for that moment the document is SHORTER than the offset the reader
	 * is at. The engine clamps the offset to what is left, the container fills again and nothing
	 * puts the offset back; the reader is simply somewhere else. Measured in WebKit with the
	 * engine's own anchoring off, a 30-row section swapped for a 35-row one two screens above the
	 * reader: the offset clamped by 130px and the page moved 255px under them.
	 *
	 * The test above cannot tell that from a reader who scrolled, because both changed the offset —
	 * so it threw away the one reference that describes where the page WAS and took a fresh one
	 * after the clamp, which measures a drift of zero and corrects nothing. Two facts separate them:
	 * a clamp only ever moves the offset DOWN (it is the page running out of length, never gaining
	 * it), and a reader who moved is a reader `scrolling()` still answers for — a scroll of theirs
	 * fires the event that starts the sampler, while the clamp's own scroll event arrives in the
	 * rendering step AFTER this microtask. An offset that dropped with nobody scrolling is the
	 * engine's doing, and the remembered reference is exactly what puts the reader back.
	 *
	 * Measured on the same harness with the reader flicking while the swap lands: the theme writes
	 * no offset at all, before this change and after it. */
	/* THE READER MOVED, SO THERE IS NOTHING TO PUT BACK — and taking a fresh reference here is worse
	 * than taking none. `anchorRef()` reads a rect, and a scroll that has only just landed leaves
	 * WebKit reporting the NEW `scrollTop` against the OLD layout: the reference then describes the
	 * page from before the scroll, the correction a frame later measures the scroll itself, and the
	 * reader is dragged back to where they started. Measured on the 24.10 stand at 1440, top layout,
	 * Compact density: parked at 591, put back to 0, every run, on both the engine-anchoring path and
	 * the fallback. A tick that lands right after a scroll compensates nothing; the next still moment
	 * takes a reference that is true. */
	if (at !== _rest.at && !clamped) return null;
	/* HOW MUCH OF THE DRIFT IS ALREADY ACCOUNTED FOR. applyAnchor() refuses a correction bigger than
	 * a viewport because a drift that size normally means the view replaced its whole subtree and
	 * the reference is describing a page that no longer exists. A clamp is the one drift that big
	 * with a receipt: the offset dropped by exactly this much with nobody scrolling, so the ceiling
	 * is raised by that measured amount and by nothing else. Without it the worst clamps — the ones
	 * that hurt, 690px in a 300px viewport on the harness — were the ones refused. */
	return { el: _rest.el, top: _rest.top, slack: Math.max(0, _rest.at - at) };
}

function anchorRef() {
	/* NOT WHILE THE READER SCROLLS. Every rect read here is a forced layout, and this runs on every
	 * content mutation — i.e. once a second, in the middle of a flick, which is the work iOS holds
	 * the main thread back to avoid. The compensation exists for a page the reader is looking at,
	 * not for one they are already moving; while they scroll there is nothing to keep still. */
	if (scrolling()) return null;

	/* WHAT THE READER IS LOOKING AT, ASKED OF THE PAGE RATHER THAN OF A SELECTOR LIST.
	 *
	 * This walked a list of frames and took the one the fold cut through, which misses the case that
	 * matters: a poll tick that grows something INSIDE that frame, above the viewport, leaves the
	 * frame's own top exactly where it was — drift 0, measured — while everything after it moves.
	 * Taking the deepest element AT the fold instead is both cheaper (one hit test, no rect walk)
	 * and the same thing the engine's own anchoring picks, so the two agree about what "still" means.
	 *
	 * A data table is never the anchor: the fit pass deliberately falsifies its layout inside one
	 * pass, so the theme excludes it from the engine's anchoring too (`overflow-anchor: none`,
	 * theme/30-tables.css). Climbing to the nearest ancestor that is not one keeps a reference that
	 * does not lie. */
	const host = document.getElementById('view');
	if (!host) return null;
	const box = host.getBoundingClientRect();
	const x = Math.round(box.left + (Math.min(box.width, window.innerWidth || box.width) / 2));
	/* BELOW THE CHROME, not at y=1: the bar is sticky and owns the first rows of the viewport, so a
	 * hit test at the very top returns the chrome and the page gets no anchor at all (measured: at
	 * 390px the hit was `nav.fs-sidebar` every time and no correction ever ran). The chrome says
	 * where it ends — `[data-fs-chrome]` is the mark it already carries, so nothing here names a
	 * height or a selector that a layout change could move. */
	let y = 1;
	let el = document.elementFromPoint(x, y);
	const chrome = el && el.closest ? el.closest('[data-fs-chrome]') : null;
	if (chrome) y = Math.max(1, Math.round(chrome.getBoundingClientRect().bottom) + 1);

	/* THE HIT IS A SEARCH, NOT A SINGLE PROBE, and neither the host nor anything outside it counts.
	 *
	 * `elementFromPoint` answers with whatever is topmost, and two of those answers are useless here.
	 * `#view` itself comes back wherever the point lands in a GAP — the margin between two sections,
	 * the gutter of the Overview's two-column grid — and the host's own top does not move when a poll
	 * changes something inside it, so a drift measured against it is zero on every tick, for ever.
	 * And a point above the first section answers with `.fs-content`, which is not inside the host at
	 * all: the first version returned null there without trying anywhere else, so on 25.12's Overview
	 * at 1440 the theme had no reference AT ALL and a 120px growth moved the page 120px.
	 *
	 * So: take the whole STACK at the point (what a gap belongs to is directly underneath it), and if
	 * that yields nothing inside the host, step down the viewport and ask again. */
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
	/* `getClientRects()`, not `offsetParent` plus a `getComputedStyle` fallback: the question is only
	 * "is this box in the layout at all", an element the table gate is holding out of it has no rects,
	 * and resolving style on every settled pass to learn that would cost more than the rect already
	 * read above. A box with no rects reports a top of 0 — a reference to nowhere. */
	if (!el.getClientRects().length) return null;
	/* AND A SECOND REFERENCE THAT SURVIVES THE TICK. `dom.content()` replaces a section's CHILDREN,
	 * so the element the hit landed on is usually gone by the time the correction runs — and where
	 * the tick also grew the page, nothing was clamped either, so the "give back what the engine
	 * took" path has no number and the theme takes a fresh reference and measures a drift of zero.
	 * That is a section swap nobody compensates: measured on 25.12's Overview at 1440 with the
	 * engine's anchoring suppressed, the page moved 136px under the reader.
	 *
	 * The wrapper is what survives — the stock poll refreshes a `.cbi-section` in place and never
	 * rebuilds it — so it is kept alongside, and used only when the precise reference is gone. */
	/* the nearest ANCESTOR that a tick does not replace — `closest()` on the element itself is not it:
	 * where the hit already climbed to the `.cbi-section` (which is what happens on any page whose
	 * section is one table), `closest('.cbi-section')` answers with that same element, and a fallback
	 * that is the reference is no fallback at all. */
	let keep = el.parentElement;
	while (keep && keep !== host && !keep.classList.contains('cbi-section')
			&& !keep.classList.contains('cbi-map') && !keep.classList.contains('fs-ovl'))
		keep = keep.parentElement;
	if (!keep || keep === host || !host.contains(keep)) keep = null;
	return { el, top: el.getBoundingClientRect().top,
		sec: keep, secTop: keep ? keep.getBoundingClientRect().top : 0 };
}

let _anchorPending = null;
let _anchorFrame = 0;
/* DEV SWITCH, for the device that has the problem: `localStorage.fsAnchor = 'off'` stops the theme
 * from ever writing the scroll offset, which is the one thing here that can move a page nobody is
 * touching. It exists to answer a question a laptop cannot — whether the correction is the cure or
 * the disease — and comes out with the answer. */
function anchorEnabled() {
	try { return localStorage.getItem('fsAnchor') !== 'off'; }
	catch (e) { return true; }
}
/* ---- WHAT THE ENGINE'S OWN ANCHORING LEAVES BEHIND ----
 *
 * Scroll anchoring keeps a reference element still while things above it change size. It is not the
 * same promise as "a section can vanish and come back": `dom.content()` — every LuCI poll — empties
 * a container before it refills it, the offset is clamped into a document that is briefly shorter,
 * and what the engine does on the way back is its own business. Chromium lands exactly where it
 * started. WebKit OVERSHOOTS — measured on the 24.10 stand's Overview at 390 and at 1440, in both
 * layouts: a swap that grew a section by 120px moved the offset by 180, so the reader ended 60px
 * up the page on every tick. That is what a Safari user sees as the page creeping while they read.
 *
 * WHY THE OFFSET CANNOT ANSWER THIS, and why this is not a browser test. The first version compared
 * the offset with what it had been and gave back the difference; it never fired, because the offset
 * came back LARGER, not smaller. A `CSS.supports('overflow-anchor')` test cannot separate the two
 * behaviours either — WebKit shipped the property, so every engine now claims it — and a synthetic
 * probe that performs the collapse itself calls Firefox broken as well, because a real page puts
 * layout and a frame between the collapse and the refill and a probe does not. Both were measured,
 * both were wrong, and the second one cost Chromium and Firefox 15px of drift they did not have.
 *
 * So nothing is assumed: the element the reader was looking at is asked where it is now, TWO FRAMES
 * after the mutation — long enough for the engine to have finished its own correction. An engine
 * that got it right reports a drift of zero and this does nothing at all. What is left over is what
 * nobody put back, and it is given back here. The same guards as the main correction: not while the
 * reader scrolls, not across a navigation, and never more than a viewport — a drift that size means
 * the reference is describing a page that no longer exists. */
let _lateFrame = 0;
function lateDrift(ref) {
	/* the reference from BEFORE this tick, captured by the caller: `run()` re-remembers it on its way
	 * through, and a reference taken after the mutation describes the page as the mutation left it —
	 * the drift it would report is zero by construction */
	if (_lateFrame || !ref) return;
	_lateFrame = requestAnimationFrame(() => {
		_lateFrame = requestAnimationFrame(() => {
			_lateFrame = 0;
			/* NOT `scrolling()`: the engine's own compensation moves the offset and therefore starts
			 * the motion sampler, so gating on that skipped every tick this exists for (measured —
			 * the check reported "busy" on all of them). Two narrower questions instead: is the
			 * reader driving (a gesture), and is the offset STREAMING (moving repeatedly, which a
			 * one-shot compensation never does but a scroll always does). Either one means hands off. */
			if (!anchorEnabled() || Date.now() < _userUntil || (scrolling() && _steps > 1)) return;
			if (_restPage !== pageStamp()) return;
			/* THE TICK USUALLY REPLACES THE ELEMENT THIS WAS TAKEN ON. `dom.content()` swaps a
			 * section's children, so the node the hit test landed on is gone by the time this runs;
			 * the section around it is not, and `rememberRest()` stores it for exactly this. Without
			 * the fallback the correction returned having done nothing on the tick it exists for.
			 * Same reference, one level out: a section that survived the swap moved by whatever the
			 * engine failed to put back. */
			let el = ref.el, was = ref.top;
			if (!el || !el.isConnected) {
				if (!ref.sec || !ref.sec.isConnected || ref.secTop == null) return;
				el = ref.sec; was = ref.secTop;
			}
			const drift = el.getBoundingClientRect().top - was;
			if (Math.abs(drift) < 1) return;			/* the engine put it back */
			if (Math.abs(drift) > (window.innerHeight || 800)) return;
			const sc = scroller();
			const at = sc ? sc.scrollTop : window.scrollY;
			if (sc) sc.scrollTop = at + drift; else window.scrollTo(0, at + drift);
			/* THE OFFSET IS BROUGHT FORWARD; THE REFERENCE DOES NOT NEED TO BE. The write moves the
			 * page by exactly the drift just measured, which puts the reference back at the top it
			 * was remembered at — so `_rest.top` still describes where it stands and the next tick
			 * measures zero, not the same drift twice. `_restAt` is the one field the write does
			 * change (and the write may have been clamped short), so it is re-read here rather than
			 * assumed. `rememberRest()` cannot do this job: the write starts the motion sampler, and
			 * that function returns early while the page is moving. */
			_restAt = scrollTop();
		});
	});
}

function scheduleAnchor(ref) {
	if (!ref || !anchorEnabled()) return;
	if (_anchorPending) return;
	_anchorPending = ref;
	if (_anchorFrame) return;
	_anchorFrame = requestAnimationFrame(() => {
		_anchorFrame = 0;
		const pending = _anchorPending;
		_anchorPending = null;
		applyAnchor(pending);
		/* AFTER the correction, never before: the reference this file keeps for engines with no
		 * anchoring of their own must describe the page as the reader now sees it, or the next tick
		 * measures a drift that has already been paid and pays it twice. */
		rememberRest();
	});
}
function applyAnchor(ref) {
	if (!ref) return;
	/* NOT INTO A MOVING PAGE. The correction is scheduled from the mutation and applied a frame
	 * later, and the reader can start scrolling in between — the reference is then describing a page
	 * they have already left, and putting them back on it is the jump this whole file exists to
	 * prevent. `anchorRef()` refuses to TAKE a reference during a flick for the same reason; nothing
	 * refused to USE one, and the gate caught it as a 231px correction landing inside a scroll on
	 * all three engines once the reference stopped being re-read at apply time. */
	if (scrolling()) return;
	/* through scroller(), not a second probe of its own: the two asked the same question in the
	 * same two lines and could already answer differently within one frame */
	const sc = scroller();
	const at = sc ? sc.scrollTop : window.scrollY;
	/* THE ELEMENT-FREE FORM: give back exactly what the engine clamped away, no geometry read at all
	 * (anchorFor() explains when this is the only form available). No ceiling here and none wanted:
	 * the number is not an estimate of where the reader was, it is what the offset lost, and the
	 * document's own length is what bounds the write.
	 *
	 * It runs BEFORE the "a page at the top is left alone" rule below, and has to: a collapse deep
	 * enough clamps the offset to zero, and that is the worst version of this fault rather than the
	 * one case to sit out. The rule below is about a drift measured from a reference, where an offset
	 * of zero means there is nothing to give back. */
	if (ref.by != null) {
		if (ref.by < 1) return;
		if (sc) sc.scrollTop = at + ref.by;
		else window.scrollTo(0, at + ref.by);
		return;
	}
	if (at <= 0) return;
	if (!ref.el.isConnected) return;
	const drift = ref.el.getBoundingClientRect().top - ref.top;
	if (Math.abs(drift) < 1) return;
	/* A CORRECTION IS A SCROLL THE READER DID NOT ASK FOR, so an absurd one is a bug rather than a
	 * fix: a view that replaced its whole subtree can move a reference by thousands of pixels, and
	 * jumping there is worse than leaving the page where it is. One viewport is the most a single
	 * tick can honestly account for — plus whatever the engine is on record for having clamped away
	 * (`slack`, see anchorFor()), which is measured rather than assumed. */
	if (Math.abs(drift) > (window.innerHeight || 0) + 200 + (ref.slack || 0)) return;
	if (sc) sc.scrollTop = at + drift;
	else window.scrollTo(0, at + drift);
}

/* Rule 2's mutation side. Deliberately NOT filtered by node type: a filter is a second place to
 * get wrong (the table fitter's own once said `table.table`, and LuCI renders most of its tables
 * as DIVs — so the poll never re-measured at all), and run() is a handful of measurements. */
/* THE CONTENT IS IN TWO PLACES, and watching one of them was a bug with a phone screenshot behind it.
 *
 * `ui.showModal` builds its dialog inside `#modal_overlay`, which ui's `__init__` appends to `<body>`
 * beside #view — so a dialog's content mutates NOTHING inside the observed host. A table opened in the
 * wireless scan dialog was therefore measured only if some unrelated mutation in #view happened to
 * run the fitters, and its rows (which that dialog re-renders once a second) were never re-measured
 * at all. Both roots get the same observer and the same ResizeObserver.
 *
 * `require ui` above is what makes the overlay exist by the time this runs: it is created in ui's
 * constructor, and luci-base instantiates a class exactly once, at the first require. */
function observeContent() {
	if (_mo) return;
	_mo = new MutationObserver(() => {
		/* what the reader is looking at, before the poll's mutation and the fitters move anything —
		 * see anchorFor(): where the engine does no anchoring of its own that reference comes from
		 * the last still moment, because by the time this callback runs the poll has already moved
		 * the page */
		/* ONE CORRECTION PER ENGINE, and which one depends on whether the engine is doing the job.
		 *
		 * Where it anchors, the immediate correction is not just redundant, it is harmful: the
		 * reference it uses is read HERE, in the same instant the poll mutated the page, and after a
		 * scroll WebKit hands back the new `scrollTop` before the layout that goes with it. The drift
		 * then measures the reader's own move and the correction undoes it — measured on the 24.10
		 * stand at 1440 in the top layout at Compact: the page went back to 0 from 591, every run.
		 * What that engine needs is the RESIDUE, two frames later, once its own anchoring has run
		 * and the layout is settled — which is lateDrift().
		 *
		 * Where it does not anchor, nobody else will put the reader back within the frame, so the
		 * immediate correction stays, measured against the reference from the last still page. */
		const settled = _rest;
		const ref = ENGINE_ANCHORS ? null : anchorFor();
		run();
		/* one or the other, never a fallthrough from one to the other: where the engine does not
		 * anchor, `anchorFor()` returning nothing means it has DECIDED not to correct this tick (the
		 * reader moved, or there is no reference worth using), and handing that case to the deferred
		 * path corrects it two frames later instead — measured as a 320px correction landing inside
		 * a flick, on all three engines. */
		if (ENGINE_ANCHORS) lateDrift(settled);
		else scheduleAnchor(ref);
	});
	for (const host of [ document.getElementById('view') || document.body, document.getElementById('modal_overlay') ]) {
		if (!host) continue;
		_mo.observe(host, { childList: true, subtree: true });
		watch(host);
	}
	/* AND THE MOMENT THE DIALOG BECOMES VISIBLE, which no mutation inside it announces: `showModal`
	 * writes the content FIRST and adds `modal-overlay-active` to <body> after, so the pass that the
	 * content mutation triggers still sees a closed dialog (fs-select.js skips one — a hidden overlay
	 * shrink-fits, so it would be measuring a width the dialog will never have). Nothing else changes
	 * afterwards, so without this the dialog's table would wait for its first poll to be fitted. One
	 * attribute, on one element.
	 *
	 * A SECOND OBSERVER, and it has to be one — this is a spec fact, not a preference.
	 * `MutationObserver.observe()` REPLACES the options of an existing registration for the same node,
	 * so calling it here on `document.body` would have silently dropped the `{childList, subtree}`
	 * registration above on any page where `#view` does not exist and `body` IS the content host: the
	 * fitters would then never run on a content mutation again, and nothing would say so.
	 *
	 * Merging the two into one call is the other wrong answer: `subtree: true` plus an attribute
	 * filter wakes `run()` on every class change anywhere in the document, and the poll rewrites
	 * classes on rows once a second. Two observers, one narrow node each, same callback. */
	_moFlag = new MutationObserver(run);
	_moFlag.observe(document.body, { attributes: true, attributeFilter: [ 'class' ] });
}

return baseclass.extend({
	/* Register a fitter and run it once. A fitter selects its own elements, strips its class
	 * (rule 1), measures, re-applies. */
	add(fit) {
		if (typeof fit !== 'function') return;
		_fitters.push(fit);
		observeContent();
		/* Caught for the same reason runAll() catches, and this was the one run that was not: a
		 * fitter that throws on its FIRST run propagated out of add() and out of the theme's init(),
		 * so every registration after it was never made. With the gate already raised that is a page
		 * whose data tables are `display: none` for good — nothing left to write `.fs-fitted`. The
		 * five passes in fs-select.js are registered separately precisely so each fails alone. */
		try { fit(); }
		catch (e) { console.error('fs-fit: a fitter threw on registration', e); }
	},

	/* Is the reader scrolling, and "I could not measure, wake me when they stop". A pass that has to
	 * read layout asks the first and calls the second; a pass that only writes does neither. */
	scrolling,
	deferMeasurement,

	/* -> the offset this file last took a reference at, or null before it has taken one.
	 *
	 * FOR THE GATES, and it is not a convenience: every correction here is measured against a
	 * reference captured while the page was still, so a probe that grows the page before that
	 * reference exists measures the guard rather than the anchor. There is no way to ask that from
	 * outside — "is it scrolling" answers a different question, and answers "no" both before the
	 * motion sampler starts and after it finishes, which in WebKit are 1.5 seconds apart. Waiting a
	 * flat interval instead made tools/scroll-anchor.mjs report a jump on every WebKit run and none
	 * on the other two engines, with the theme identical on all three. */

	/* "THE OFFSET IS MINE NOW, FORGET WHAT YOU REMEMBERED." Called by fs-router where it resets both
	 * scrollers for an incoming page, and it is not a courtesy — without it the correction below
	 * fights that reset. The router resets synchronously and stamps `body[data-page]` an await later,
	 * so between the two there is a window, as long as the incoming view takes to arrive, in which a
	 * poll tick from the OUTGOING page still fires: the offset is 0, the remembered one is where the
	 * reader was, nobody is scrolling and the stamp still names the page they came from — every term
	 * of "the engine clamped this" is true, and the reader would be dragged back down a page they
	 * have left, with the new page committing mid-scroll. Reported in review on the upstream
	 * proposal. The stamp cannot close it alone, because it is written afterwards. */
	forgetRest,

	/* Raise the stylesheet's "an unanswered table takes no room" rule. Called by the module that
	 * answers — see armGate above; nothing else may call it. */
	armGate,

	/* Re-fit on the next frame, coalesced. (There is no exported `run`: everything that changes
	 * the available room — the layout toggle, the rail collapse — schedules. Only the mutation
	 * observer re-fits synchronously, and that is rule 2's whole point.) */
	schedule,

	/* Coalesce ANY callback into one call per frame (rule 3, for non-fitters): schedule() runs
	 * EVERY fitter, so a caller wanting only its own work batched cannot use it — three had
	 * hand-rolled the identical five lines. NOT for the per-element case: menu-footstrap.js's
	 * clamp keeps a rAF handle per <li> so it can CANCEL a pending measure, which a one-flag
	 * coalescer cannot express. */
	frame(fn) {
		let pending = false;
		return () => {
			if (pending) return;
			pending = true;
			requestAnimationFrame(() => { pending = false; fn(); });
		};
	},

	/* Did this batch add anything matching `sel`? The poll rewrites content once a second, so a
	 * MutationObserver here needs that cheap question before its document-wide queries. */
	touches(mutations, sel) {
		for (const m of mutations)
			for (const n of m.addedNodes) {
				if (n.nodeType !== 1) continue;
				if (n.matches(sel) || n.querySelector(sel)) return true;
			}
		return false;
	},

	/* Room for `el` = its PARENT's content box. Measuring against ITSELF does not work: a
	 * `display: table` box with width:100% still grows past it when min-content needs more (auto
	 * layout beats the declared width), so scrollWidth and clientWidth grow together and the
	 * overflow is invisible. The parent is an ordinary block and does not grow. */
	roomFor(el) {
		const p = el && el.parentElement;
		if (!p) return Infinity;
		const cs = getComputedStyle(p);
		return p.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
	},

	/* Does `el` need more width than it has been given?
	 *
	 * THE ONE QUESTION LEFT, and it is the browser's own answer. `wordFloor()` and `textLines()`
	 * used to stand beside it — a canvas reimplementation of min-content and a line counter — and
	 * both existed only because the stylesheet lowered every cell's min-content to one character,
	 * so a starved column produced no overflow for this to read. theme/30-tables.css gives a data
	 * table an honest floor for as long as it is a table, so the starvation cannot happen and the
	 * reconstructions are gone: 75 lines of approximation (whitespace-split words, one font per
	 * column, `iiii` ranked above `WWW`) that cost about 1 ms per pass on a 114-row table and, on
	 * `WPA2-PSK/CCMP`, claimed 144px where the engine's own floor is 93. */
	overflows(el) {
		return el.scrollWidth > this.roomFor(el) + 1;	/* +1: sub-pixel rounding */
	}

});
