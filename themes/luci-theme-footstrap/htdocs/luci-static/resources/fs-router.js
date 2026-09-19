'use strict';
'require baseclass';
'require ui';
'require rpc';
'require fs-menutree as tree';
'require fs-chrome as chrome';
'require fs-sheets as sheets';
'require fs-fit as fit';

/* ---- SPA client router ----
 *
 * Kills the full page reload for `view`-type menu nodes — 54 of 74 menu leaves (~73%) on the dev
 * router; the rest are call/function/template. LuCI already renders every page client-side into
 * #view; only NAVIGATION is server-dispatched. So intercept link clicks and re-instantiate the
 * target view in place — what the dispatcher's view.ut does via ui.instantiateView(), minus the
 * reload. Purely additive: anything that is not a satisfied `view` node (call/function/template/
 * alias/firstchild, external, download, cross-origin, modified click) or any error falls through to
 * a normal navigation, and deep links / F5 keep working because we pushState the real URL.
 *
 * Re-instantiation: L.require('view.x') returns a cached SINGLETON whose __init__ (the render)
 * already ran, so calling it again repaints nothing. Take the class off the instance
 * (prototype.constructor) and `new v.constructor()` for a fresh __init__ → load()+render(), which is
 * what a full load does anyway. docs/spa-router.md.
 *
 * The path->node half lives in fs-menutree.js (the chrome needs it too); the "has a view poisoned
 * this document with its CSS?" half in fs-sheets.js.
 *
 * `docs/…`, `tools/…` and `tests/…` in these comments name the theme's own repository
 * (https://github.com/VizzleTF/luci-theme-footstrap), not the tree this file is read in: the
 * package ships the runtime and nothing else. */

/* --- stray-interval teardown for SPA nav ---
 * A full load kills every window.setInterval the outgoing page set; SPA nav does not, so a view's
 * poller keeps firing against a page that is gone. Track view-set ids and clear them on navigation,
 * keeping L.Poll's own 1 s tick (also a setInterval); L.Poll's queue is flushed in navigate().
 * Hooked at module eval, before any view render can set a timer. */
const _viewIntervals = (window.__fsViewIntervals || (window.__fsViewIntervals = new Map()));
(function hookIntervals() {
	if (window.__fsIntervalsHooked) return;
	window.__fsIntervalsHooked = true;
	const _si = window.setInterval, _ci = window.clearInterval;
	/* The id the caller got is the id it keeps, whatever the pause below does underneath: the map is
	 * keyed by that first id and the entry carries `live`, the id armed right now (null while
	 * paused), so a view holding its handle can still stop its own poller after a trip through a
	 * hidden tab. The arguments are kept because a `setInterval` id carries none of them back. */
	window.setInterval = function (fn, ms) {
		const id = _si.apply(window, arguments);
		_viewIntervals.set(id, { fn, ms, rest: Array.prototype.slice.call(arguments, 2), live: id });
		return id;
	};
	window.clearInterval = function (id) {
		const spec = _viewIntervals.get(id);
		_viewIntervals.delete(id);
		/* a paused timer is already disarmed and its number is the platform's to hand out again, so
		 * clearing it here would stop whatever timer holds it now. Untracked ids fall through: the
		 * hook stays a pass-through for everything it did not arm. */
		if (spec) return (spec.live == null) ? undefined : _ci.call(window, spec.live);
		return _ci.apply(window, arguments);
	};
	/* A hidden tab must not keep calling the router. `wireVisibility()` below stops LuCI's own poll,
	 * which is most of the traffic, but a view is free to run a plain `setInterval` of its own and
	 * those keep hammering ubus for as long as the tab stays open. The registry navigation already
	 * uses to clear them is enough to pause them: disarmed on hide, re-armed on show with the same
	 * callback and period.
	 *
	 * A paused timer stays IN the registry, armed on nothing. Held in a list beside it, the
	 * navigation sweep cannot see it — hide the tab while a navigation is in flight and coming back
	 * re-arms the timers of the page that navigation already replaced. */
	document.addEventListener('visibilitychange', () => {
		if (document.hidden) {
			/* LuCI's own tick is not ours to pause. `L.Poll.start()` arms it with a plain
			 * `setInterval`, so the hook above catches it like any other id — and pausing it here
			 * re-arms it under an id L.Poll knows nothing about, after which `start()` arms a
			 * second one because `active()` has nothing to see: two ticks per interval after one
			 * hide/show, three after two.
			 *
			 * So the tick is skipped here and wireVisibility() keeps both halves of it. When it
			 * cannot be told apart from a view's timer, NOTHING is paused: a view's poller in a
			 * hidden tab costs a wasted RPC, re-arming LuCI's tick behind its back costs a doubling
			 * that never stops. */
			const keep = pollTickId();
			if (keep === false) return;
			for (const [ id, spec ] of _viewIntervals) {
				if (id === keep || spec.live == null) continue;
				_ci.call(window, spec.live);
				spec.live = null;
			}
		}
		else {
			for (const spec of _viewIntervals.values()) {
				if (spec.live != null) continue;
				/* `_si`, not the hook: this timer is already in the registry under the id its
				 * caller holds, and re-registering it would key a second entry to a number nobody
				 * has. The fresh id lives in `spec.live` alone and is never a key. */
				spec.live = _si.call(window, spec.fn, spec.ms, ...spec.rest);
			}
		}
	});
})();
/* Which id is LuCI's own tick, asked in one place because both callers — the navigation sweep and
 * the hidden-tab pause above — pay the same price for getting it wrong.
 *
 * `L.Poll.timer` is that id, and it is private state: `add`/`remove`/`start`/`stop`/`active` are the
 * documented surface, and the whole `L.Poll` alias is already deprecated (`'require poll'` replaces
 * it, but no supported release ships poll.js yet). Read blind, a renamed field would make LuCI's
 * tick look like a view's — cleared on the next navigation, every poll on every later page silently
 * dead. So a missing field is a reason to do nothing, once, loudly.
 *
 * Asked through the documented half first: `active()` says whether the tick is running, and `timer`
 * is deleted by `stop()`, so an absent field is the ordinary "nothing to protect" case. The anomaly
 * worth reporting is the pair disagreeing — a tick running while the id it runs on has no name we
 * know.
 *
 * The alias itself is guarded for the same reason: the sweep runs inside the staged render, and a
 * TypeError there would leave every click showing the previous page's content under the new page's
 * title. */
/* -> the tick's id; null when LuCI is not polling; false when the two cannot be told apart, which
 * every caller reads as "leave every interval alone" */
function pollTickId() {
	if (!L.Poll) {
		warnPollUnreadable('footstrap: L.Poll is gone from this luci-base, so LuCI\'s own tick cannot be '
			+ 'told apart from a view\'s timers — leaving view intervals alone. fs-router.js needs '
			+ 'updating for this luci-base.');
		return false;
	}
	const running = (typeof L.Poll.active === 'function') ? L.Poll.active() : (L.Poll.timer != null);
	if (running && L.Poll.timer == null) {
		warnPollUnreadable('footstrap: LuCI is polling but L.Poll.timer is not readable — leaving view '
			+ 'intervals alone rather than risking its tick. fs-router.js needs updating for this '
			+ 'luci-base.');
		return false;
	}
	return running ? L.Poll.timer : null;
}
function clearViewIntervals() {
	const keep = pollTickId();
	if (keep === false) return;
	/* Map, not Set: the key is the timer id and the value is what it takes to re-arm it */
	_viewIntervals.forEach((spec, id) => { if (id !== keep) window.clearInterval(id); });
}
/* one line per document: this runs on every navigation, and a router that cannot read L.Poll
 * cannot read it on the next click either */
let _pollWarned = false;
function warnPollUnreadable(msg) {
	if (_pollWarned) return;
	_pollWarned = true;
	console.error(msg);
}

/* --- uci cache teardown for SPA nav ---
 * `uci.load()` does not answer "is this config present?" — it answers "which of these packages did
 * THIS call fetch", skipping every package already in its document-scoped cache. Several shipped
 * views read that return value as an existence check and abort on an empty array, so under SPA the
 * SECOND visit renders as "no config found", unstickable short of a reload.
 *
 * The apps' reading of `load()` is wrong, but the divergence is ours: a cache that outlives the
 * page that filled it is state a fresh load does not have, like the poll queue and the intervals
 * above. So drop it on navigation and let the incoming view fetch what it needs.
 *
 * `unload()` is upstream's own idiom for this — `uci.save()` ends with
 * `self.unload(pkgs); return self.load(pkgs)`. Pending local edits go with it, as they do on a full
 * load; saved changes are on the server and the Unsaved-changes banner reads them from there.
 *
 * Read through `window.L.uci` rather than a `'require uci'` pragma: the class attaches to L's
 * prototype when the first requirer compiles it, so this sees the instance the pages use, while
 * requiring it would bind it to our prototypal L (the two-L trap) and pull uci.js onto pages that
 * never touch uci.
 *
 * Returns the refill below as a promise the caller must wait on, or null. It never rejects: a
 * navigation is not the place to lose a page over a config the incoming view may not read. */
function flushUciCache() {
	const uci = window.L ? window.L.uci : null;
	if (!uci || typeof uci.unload !== 'function') return null;
	/* `state.values` and `loaded` are private, so the L.Poll.timer rule applies: an unrecognised
	 * shape means do nothing, once, loudly. The two hold different halves of the cache (a package
	 * whose load is in flight is in `loaded` alone) and unload() clears both. */
	if (!uci.state || typeof uci.state.values !== 'object' || typeof uci.loaded !== 'object') {
		if (!_uciCacheWarned) {
			_uciCacheWarned = true;
			console.error('footstrap: LuCI.uci keeps its cache somewhere this router does not know, so '
				+ 'it is left alone. An app that reads uci.load()\'s return value as an existence check '
				+ 'will report a missing config on the second SPA visit. fs-router.js needs updating for '
				+ 'this luci-base.');
		}
		return null;
	}
	const names = Object.keys(uci.state.values).concat(Object.keys(uci.loaded));
	if (!names.length) return null;
	uci.unload(names);
	/* `state.reorder` is the half unload() does not clear, and is left alone: with `values` gone,
	 * reorderSections() finds no sections, emits no call and clears the map itself on the next
	 * save. */

	/* …and put back the three packages luci-base's network.js reads but will never load again.
	 *
	 * initNetworkState() loads `network`, `wireless` and `luci` once and from then on answers every
	 * caller from its own `_state` — but what it answers WITH is the uci cache (`getWifiDevices()`
	 * is `uci.sections('wireless', 'wifi-device')`). So dropping those packages does not make
	 * network.js refetch them, it makes every consumer read an EMPTY config until the next full
	 * load: Channel Analysis with no band tabs, Network -> Switch with no VLAN sections, both
	 * correct again after F5. tools/spa-parity.mjs reproduces it; tools/upstream-contract.mjs
	 * notices if the list of three moves.
	 *
	 * navigate() waits for the refill, because a cached module resolves within a microtask and the
	 * view would read the cache we just emptied. Only when network.js is really in the document.
	 * The ubus half of `_state` stays as stale as upstream leaves it.
	 *
	 * The wait costs one uci `get` in front of the render on a warm navigation (136 -> 159 ms
	 * median). Leaving the three OUT of the unload instead is free and was rejected: a view calling
	 * `network.flushCache()` reloads its ubus half but calls `uci.load()` for the uci half, a no-op
	 * while the package is cached, so Interfaces and Wireless would render fresh device state over
	 * config values from whenever the document first touched them. */
	if (!window.L.network) return null;
	const refill = [ 'network', 'wireless', 'luci' ].filter((p) => names.indexOf(p) !== -1);
	if (!refill.length) return null;
	return uci.load(refill).catch((e) => {
		console.error('footstrap: reloading uci ' + refill.join(', ') + ' after a navigation failed', e);
	});
}
let _uciCacheWarned = false;

/* ---- a dead session ends the document, and the router must not browse through it ----
 *
 * luci-base answers an expired session with `notifySessionExpiry()`: `Poll.stop()` plus a modal
 * whose only button reloads the page, which the dispatcher answers with the login form. Every
 * navigation of ours does the opposite of both halves (`ui.hideModal()`, `L.Poll.stop()+start()`),
 * so the first click after the session died dismissed that warning and carried on, leaving the page
 * on "Loading view…" with every call behind it failing.
 *
 * So the router learns that the session is gone and stops claiming navigations; the next click is a
 * real one and the dispatcher turns it into the login page. Nothing is reset — the flag dies with
 * the document, as the session did.
 *
 * The two signals are luci-base's own decision points (luci.js, `setupDOM`):
 *
 *   1. a `403` carrying `X-LuCI-Login-Required: yes` on any `L.Request`;
 *   2. the `session.access` probe luci-base fires after a `-32002`, when that probe REJECTS.
 *
 * `access: false` is deliberately not one of them: the probe is declared `expect: { access: true }`,
 * so rpc.js resolves it rather than rejecting, and it is an ACL answer — treating it as a dead
 * session would drop a restricted user out of the SPA over a permission they do not have.
 *
 * The probe's rejection is read off the frame the interceptor is handed, since that is all an
 * interceptor sees: `handleCallReply()` rejects on a frame that is not JSON-RPC 2.0 or on an `error`
 * carrying both a code and a message. Somebody else's failing `session.access` call would also
 * match, at a cost of one document of full loads.
 *
 * Neither interceptor may throw: luci-base runs both through `Promise.all(...).catch(req.reject)`,
 * so an exception here would reject the caller's request. Hence the try/catch around each body. */
let _expired = false;
let _sessionWired = false;
function markExpired() {
	if (_expired) return;
	_expired = true;
	/* once per document, at the least alarming level the house rules allow (eslint no-console
	 * permits warn and error only): nothing is broken, the session simply ended */
	console.warn('footstrap: the LuCI session is gone — every navigation from here is a full load.');
}
/* The verdict is not a latch. An interceptor sees `msg` only once the transport succeeded and the
 * body parsed, so a missing frame is not a network flap — but it is a captive portal's page, a
 * proxy's error body, one truncated reply, any of which would take the router off for the rest of
 * the document with the session alive throughout.
 *
 * A clean `session.access` is the same call the failing one was, so it is evidence the other way.
 * If the session really has ended no clean one arrives, every ubus call carrying the same dead
 * sid. */
function markAlive() {
	if (!_expired) return;
	_expired = false;
	console.warn('footstrap: the LuCI session answers again — client navigation is back on.');
}
function sessionExpired() { return _expired; }
function watchSession() {
	if (_sessionWired) return;
	_sessionWired = true;

	const req = window.L ? window.L.Request : null;
	if (req && typeof req.addInterceptor === 'function')
		req.addInterceptor((res) => {
			try {
				if (res && res.status === 403 && res.headers &&
				    res.headers.get('X-LuCI-Login-Required') === 'yes')
					markExpired();
			}
			catch (e) { /* see above: an interceptor that throws rejects the caller's request */ }
		});

	if (rpc && typeof rpc.addInterceptor === 'function')
		rpc.addInterceptor((msg, r) => {
			try {
				if (!r || r.object !== 'session' || r.method !== 'access') return;
				if (!msg || msg.jsonrpc !== '2.0') return;
				/* an `error` carrying both a code and a message is what handleCallReply() rejects
				 * on, and a rejected session probe is the signal. A frame that is not JSON-RPC 2.0
				 * is rejected there too, but says nothing about the session. */
				if (msg.error && msg.error.code && msg.error.message) { markExpired(); return; }
				/* Only `access: true` says the session is there. A dead sid does not make this call
				 * fail — `session.access` answers `[0, {access:false}]` with HTTP 200 and no error
				 * frame, the `-32002` arriving on the ordinary call that made luci-base fire the
				 * probe — so "the reply parsed" would read as "the session is back" and clear the
				 * verdict a 403 just reached. `access:false` stays out of both answers, an ACL
				 * denial looking exactly the same. */
				if (Array.isArray(msg.result) && msg.result[1] && msg.result[1].access === true)
					markAlive();
			}
			catch (e) { /* ditto */ }
		});
}

/* ---- throw an element away the way luci-base throws one away ----
 *
 * `dom.data()` does not live on the element: luci.js keeps it in `dom.registry`, keyed by a
 * `data-idref` attribute, and only `dom.content()` ever deletes an entry. A plain `remove()`
 * therefore leaves the entry — and through it the element and whatever class instance it held —
 * reachable for the life of the document.
 *
 * `#view` is not affected, the incoming view's own `dom.content()` reaping the outgoing page. What
 * the router removes by hand is the rest: the siblings a template emitted next to `#view`, and the
 * runtime notification banners.
 *
 * Nothing the sweeps remove carries a `data-idref` on the stands today, and the registry does not
 * grow across laps (83 entries after the first lap of four pages, 83 after the third), so this
 * fixes no measurable leak — it closes the class, for the coverage reason the table selector
 * gives.
 *
 * The bin is what makes the element's OWN entry go too: `dom.content()` reaps descendants of the
 * node it is given, never the node itself, so the element is moved into a detached container first,
 * which also takes it out of the live tree. Public API only; no reaching into `dom.registry`. */
function discard(el) {
	try {
		const dom = window.L ? window.L.dom : null;
		if (!dom || typeof dom.content !== 'function') { el.remove(); return; }
		const bin = document.createElement('div');
		bin.appendChild(el);
		dom.content(bin, null);
	}
	catch (e) {
		el.remove();
	}
}

let _wired = false;
/* the pathname whose view is currently rendered; popstate compares against it to tell a real
 * navigation from a fragment change */
let _curPath = window.location.pathname;
/* nav generation token: two quick clicks race their async require()s, so a resolved require whose
 * generation is stale renders nothing */
let _navGen = 0;

/* ---- Back must restore the scroll of whichever element is the scroller ----
 * The two layouts scroll different elements: the sidebar layout gives overflow-y to .fs-main
 * (#maincontent), the top layout lets the document scroll. A browser restores an inner scrollable
 * region only across full loads, never on a same-document traversal.
 *
 * Both offsets are recorded and replayed, the document scroller included: the UA restores it at the
 * traversal, i.e. BEFORE this handler swaps #view, so the height collapses under the restored
 * offset and the clamp takes it back to 0 with nothing left to re-apply it. The offset that is not
 * this layout's scroller is 0 and skipped.
 *
 * Not by replaceState on scroll: Safari rate-limits history writes (100 per 30 s) and a scroll
 * listener trips it. Each SPA entry carries a session-unique id (fsid) in history.state and the
 * offsets live in an in-memory Map, lost on a full load — which is exactly when the browser's own
 * restoration takes over. The id is session-prefixed because a bare counter restarts with every
 * document, and an entry stamped by a previous document of this tab would collide with a fresh
 * one. */
const _scrollMem = new Map();
const _scrollSess = Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
let _histN = 0;
let _curId = null;
/* …and it is bounded, because this document outlives every page in it. A browser keeps ~50 entries
 * per tab and the ones past that cannot be traversed back to, so remembering more offsets can never
 * be read. Least-recently-saved goes first: a Map iterates in insertion order and `set` on an
 * existing key does not refresh it, so the re-save below is delete-then-set. */
const SCROLL_MEM_MAX = 50;
/* the offset a popstate replay must land on, consumed by the commit that puts the page on screen —
 * see the popstate handler for why it cannot be replayed earlier */
let _pendingRestore = null;
function newEntryId() { return _scrollSess + ':' + (++_histN); }

/* adopt the entry we are standing on: reuse its fsid, or stamp one (an entry created by a full load
 * carries state === null) */
function adoptEntry() {
	const st = history.state;
	if (st && st.fsid) { _curId = st.fsid; return; }
	_curId = newEntryId();
	try { history.replaceState(Object.assign({}, st, { fsid: _curId }), '', window.location.href); } catch (e) {}
}

/* the outgoing DOM is still on screen at both call sites (the click, the popstate), so this must
 * run BEFORE _curId moves on to the incoming entry */
function saveScroll() {
	if (!_curId) return;
	const sc = document.getElementById('maincontent');
	_scrollMem.delete(_curId);
	_scrollMem.set(_curId, { win: Math.round(window.scrollY) || 0, main: sc ? sc.scrollTop : 0 });
	while (_scrollMem.size > SCROLL_MEM_MAX)
		_scrollMem.delete(_scrollMem.keys().next().value);
}

/* Put the scrollers back where the entry left them, but only once the incoming view has grown that
 * much height: restoring before the content exists is clamped to 0 and reads as "worked". The view
 * renders behind an RPC, so poll by frame; a newer navigation cancels via the generation, and a
 * page that never reaches the old height is left at the top. Each offset is waited for on its own
 * scroller, so a layout switched between the two entries restores whichever half it can. */
function restoreScroll(pos, gen) {
	if (!pos || (!pos.win && !pos.main)) return;
	/* a deadline, not a frame count: 300 frames is 5 s at 60 Hz and 10 s on a 30 Hz panel. Frames
	 * stay the tick, being when a paint could have changed the height. */
	const until = Date.now() + 5000;

	/* The user outranks the saved position: waiting up to five seconds for a slow view means the
	 * reader may have started using the page, and jumping them somewhere else then is worse than
	 * opening at the top, which is what a full load does. Any sign that the scroll is theirs
	 * cancels the restore for good.
	 *
	 * Two kinds of sign, because neither covers the other: the three input events are intent even
	 * when nothing moves yet, while `scroll` catches what they cannot see (a scrollbar drag,
	 * Find-in-page, an anchor jump, assistive tech). `scroll` also fires for our own writes,
	 * asynchronously, so a flag around the write would already be false — the position last written
	 * is remembered instead, and a scroll landing exactly there is ours.
	 *
	 * Passive listeners: this must never sit in front of the scroll it watches for.
	 *
	 * AND ONLY ON AN AXIS THIS `pos` ACTUALLY CARRIES. One `cancelled` flag serves both scrollers, so
	 * an event on the axis this layout does NOT use — a stray write to the other scroller, from
	 * anywhere in the document, while THIS one is still waiting for its content to grow tall enough —
	 * used to read as "the reader scrolled" and cancel the whole restore, killing the axis that WAS
	 * legitimately pending over one that was never being restored at all. Reproduced without a real
	 * router: a bare `window.scrollTo(0, 111)` from an unrelated
	 * script while the sidebar layout's `#maincontent` restore was still pending left the reader at 0
	 * for the rest of the 5 s window instead of the parked 3000; scoping the check to the axis `pos`
	 * carries fixes it, samples unchanged (3000).
	 *
	 * A SAME-axis false alarm survives that fix: the browser's OWN traversal restore lands on the
	 * scroller BEFORE this handler swaps `#view` (see the comment above the function), and the swap
	 * that follows briefly leaves the incoming page shorter than the saved offset — `commitStage()`
	 * moves the outgoing page's nodes out before the incoming page's have finished growing under
	 * their own RPCs. The engine then clamps the scroller BACK to whatever height exists NOW, firing
	 * an ordinary `scroll` event that looks exactly like a reader's, and it lands before this tick has
	 * ever written anything (`wroteWin`/`wroteMain` still -1), so the "our own write coming back"
	 * check above cannot catch it either. Measured live (owrt2512b @1440, `/admin/status/overview` <-
	 * package-manager, Back): the UA restores `window.scrollY` to the parked 2684 in the same tick
	 * `popstate` fires, `commitStage()` leaves the document ~900px tall for one frame, and the next
	 * native `scroll` event reports `y=0` a whole 5 s before this function's own deadline — cancelling
	 * a restore that had not yet had the height to attempt. A clamp cannot land anywhere but the
	 * scroller's OWN current ceiling, and the reader cannot have scrolled PAST a height that does not
	 * exist yet, so a scroll landing exactly there while that ceiling is still short of the saved
	 * offset is the engine settling, not input — every real gesture that could produce it (a
	 * scrollbar drag past the same limit, in particular) already flows through the direct
	 * wheel/touchstart/keydown listeners below regardless of what onScroll decides. */
	let cancelled = false, wroteWin = -1, wroteMain = -1;
	const stop = () => { cancelled = true; off(); };
	const onScroll = (ev) => {
		const t = ev.target;
		const isWin = (t === document || t === document.documentElement || t === document.body);
		if (isWin) {
			if (!pos.win) return;
			if (Math.round(window.scrollY) === wroteWin) return;	/* our own write coming back */
			const de = document.documentElement;
			const ceiling = Math.max(0, de.scrollHeight - de.clientHeight);
			if (ceiling < pos.win && Math.round(window.scrollY) === ceiling) return;	/* the page settling */
		}
		else {
			if (!pos.main) return;
			if (t && t.scrollTop === wroteMain) return;	/* our own write coming back */
			const ceiling = t ? Math.max(0, t.scrollHeight - t.clientHeight) : 0;
			if (ceiling < pos.main && t && t.scrollTop === ceiling) return;	/* the page settling */
		}
		stop();
	};
	/* the keys that scroll, and only those: typing in a field must not cancel anything */
	const SCROLL_KEYS = new Set([ 'PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown', ' ', 'Spacebar' ]);
	const onKey = (ev) => { if (SCROLL_KEYS.has(ev.key)) stop(); };
	const opts = { passive: true, capture: true };
	function off() {
		window.removeEventListener('wheel', stop, opts);
		window.removeEventListener('touchstart', stop, opts);
		window.removeEventListener('keydown', onKey, opts);
		window.removeEventListener('scroll', onScroll, opts);
	}
	window.addEventListener('wheel', stop, opts);
	window.addEventListener('touchstart', stop, opts);
	window.addEventListener('keydown', onKey, opts);
	/* capture, so the inner scroller is seen too: `scroll` does not bubble from an element, but it
	 * does travel down the capture phase */
	window.addEventListener('scroll', onScroll, opts);

	(function tick() {
		if (cancelled) return;
		if (gen !== _navGen || Date.now() > until) { off(); return; }
		const de = document.documentElement;
		const sc = document.getElementById('maincontent');
		let pending = false;
		if (pos.main) {
			if (sc && sc.scrollHeight - sc.clientHeight >= pos.main) { wroteMain = pos.main; sc.scrollTop = pos.main; }
			else pending = true;
		}
		if (pos.win) {
			if (de.scrollHeight - de.clientHeight >= pos.win) { wroteWin = pos.win; window.scrollTo(0, pos.win); }
			else pending = true;
		}
		if (pending) requestAnimationFrame(tick);
		else off();
	})();
}

/* ---- the host half of "<host> | <page>" is read once ----
 * head.ut stamps it and it cannot change within a document. Re-deriving it from the live
 * document.title on every hop makes any page that renames the tab the host for every page after it
 * — third-party log viewers and dashboards do rename it. Captured at seed(); the lazy branch is for
 * a document whose chrome came up without seed() having run. */
let _titleHost = null;
function titleHost() {
	if (_titleHost === null)
		_titleHost = (document.title.split('|')[0] || '').trim();
	return _titleHost;
}


/* the exact URL LuCI.require() will fetch for a class name, cache-bust and all: matching it
 * byte-for-byte is what makes a hover prefetch a warm cache hit for the later require() */
function moduleUrl(className) {
	const v = L.env.resource_version ? ('?v=' + L.env.resource_version) : '';
	return (L.env.base_url || '') + '/' + className.replace(/\./g, '/') + '.js' + v;
}

/* ---- link prefetch: warm the module cache for a page the user is about to open ----
 *
 * A plain fetch(), not require(): require() instantiates, and a view's __init__ IS its render, so it
 * would paint another page into #view. fetch() only fills the browser's HTTP cache, which the later
 * require()'s XHR hits. Deduped per class; failures are silent.
 *
 * Transitive, which is where most of the win is: warming the view class alone leaves its own
 * `require` pragmas one round trip behind it (418 -> 296 ms on a first visit at 120 ms RTT; over six
 * pages 1713 ms cold, 1184 warmed, 1052 warmed transitively). The bytes are in hand either way, so
 * the scan is free.
 *
 * The scan must not be line-anchored: the shipped files are minified and every pragma sits on one
 * line, so /^'require …'$/m matches nothing at all, silently. luci.js lexes the leading string
 * literals; this reads the same head of the file with one regex. */
const PRAGMA_HEAD = 2000;	/* bytes of leading literals to scan — luci.js stops at the first non-string token */
const PREFETCH_DEPTH = 3;

function pragmaDeps(src) {
	const re = /(['"])require[ \t]+([^'"]+?)\1/g;
	const head = src.slice(0, PRAGMA_HEAD);
	const out = [];
	let m;
	while ((m = re.exec(head)))
		out.push(m[2].split(/[ \t]+as[ \t]+/)[0]);
	return out;
}

/* Which class names are worth a prefetch: the DOTTED ones. A LuCI class name is a path
 * (`tools.widgets` is tools/widgets.js), so a name with no dot is either one of the six virtual
 * classes luci.js seeds its registry with — which have no file, so fetching one is a guaranteed 404
 * in the user's console — or one of the flat libraries, which are already loaded by the time any
 * prefetch runs (the chrome requires `network`, dragging in firewall/uci/rpc/validation, and `ui`
 * comes with the widgets). Declining the flat half outright costs nothing measurable — on the
 * stands every flat library was already an instance on arrival, and a seven-page prefetch walk
 * fetched 10 files, every one of them nested — needs no list of built-ins to keep current, and
 * covers a future one before it ships.
 *
 * The dotted half is asked properly: require() attaches a class at its path, so `tools.widgets`
 * reads back as L.tools.widgets once some form page has pulled it. `instanceof L.Class` rather than
 * a truthiness test, because L.env, L.url and L.get are members too. */
function classLoaded(name) {
	if (name.indexOf('.') < 0) return true;
	try {
		let ptr = window.L;
		for (const part of name.split('.')) {
			ptr = ptr[part];
			if (ptr == null) return false;
		}
		return ptr instanceof window.L.Class;
	}
	catch (e) { return false; }
}

const _seen = new Set();
const _prefetched = new Set();
/* className -> the promise of its own body being in the HTTP cache; navigate() waits on that.
 * Deliberately the body and not the subtree — see _committed below. */
const _warming = new Map();
/* Roots a navigation has taken over. Speculation below them stops: require() is now fetching the
 * same graph and pipelines its parse and eval against those fetches, so descending would only race
 * it (658 ms waiting for the whole subtree against 525 ms racing, at 120 ms RTT). Deps have not been
 * asked for when a click arrives, so there is nothing in flight to collide with. */
const _committed = new Set();

function warmClass(name, depth, root) {
	if (_prefetched.has(name)) return;
	_prefetched.add(name);
	if (classLoaded(name)) return;
	let req;
	try { req = fetch(moduleUrl(name), { credentials: 'same-origin' }); }
	catch (e) { return; }
	const body = req.then((res) => (res.ok ? res.text() : '')).catch(() => '');
	_warming.set(name, body.then(() => {}, () => {}));
	/* the visited set is global and the depth capped, so the walk terminates whatever the pragmas
	 * say: require() raises DependencyError on a cycle, but only for classes it actually loads */
	if (depth < PREFETCH_DEPTH)
		body.then((src) => {
			if (_committed.has(root)) return;
			for (const d of pragmaDeps(src)) warmClass(d, depth + 1, root);
		});
}

/* Warm the view a menu path resolves to, plus its dependency tree. `segs` is the menu path
 * (`admin/network/routes`), the shape fs-search stores its recents in. */
function prefetchSegs(segs) {
	if (!Array.isArray(segs) || !segs.length) return;
	const res = tree.resolveSegs(segs);
	const className = tree.viewClassFor(res && res.node);
	if (className) warmClass(className, 0, className);
}

function prefetchView(pathname) {
	const segs = tree.segsFromPath(pathname);
	if (segs) prefetchSegs(segs);
}

/* Wait for an in-flight prefetch of `className` instead of racing it — see the call site. Capped,
 * because a wedged prefetch must never wedge a navigation: on a stalled connection require()'s own
 * XHR and error path are the better place to end up. */
const WARM_WAIT_MS = 5000;
function warmedThen(className) {
	_committed.add(className);
	const body = _warming.get(className);
	if (!body) return Promise.resolve();
	/* the loser of the race is cancelled: a prefetch that lands in 40 ms would otherwise leave a
	 * 5 s timer armed behind every navigation, keeping its closure alive */
	let t = 0;
	return Promise.race([ body, new Promise((r) => { t = window.setTimeout(r, WARM_WAIT_MS); }) ])
		.finally(() => window.clearTimeout(t));
}

/* The page we are standing on arrived as a full load, so LuCI has already required — hence
 * instantiated and rendered — its view. Seed `_seen`, or the first SPA nav back to this page takes
 * require()'s cached instance, skips the re-instantiation and renders nothing. */
function seed() {
	const here = tree.viewClassFor(tree.currentNode());
	if (here)
		_seen.add(here);
	titleHost();	/* before any view can rename the tab — see there */
	/* the served page's entry needs an id too, or the first Back TO it has nothing to look up */
	adoptEntry();

	/* Page-scoped CSS keys off `#view[data-page]` and `.fs-content[data-page]` (commitStage). The
	 * server stamps `body` and `.fs-content` (header.ut); `#view` is luci-base's markup, so it gets
	 * the same value here. Copied from `body`, not recomputed: the served value is the resolved
	 * dispatch path, and a re-derivation could disagree with it. */
	const curPage = document.body ? (document.body.getAttribute('data-page') || '') : '';
	const contentHost = document.querySelector('.fs-content');
	if (contentHost) contentHost.setAttribute('data-page', curPage);

	/* The document's own first render is the first link in the chain. A navigation waits for the
	 * previous render because a LuCI view chain resolves `#view` at paint time and would otherwise
	 * paint into the newer navigation's stage — and the first chain, `view.ut`'s inline
	 * `instantiateView()`, is subject to the same rule. Untracked, at 350 ms of latency a click 150 ms after
	 * DOMContentLoaded ends with the URL, title and menu on the new page and the old one painted
	 * over it.
	 *
	 * So the chain starts here, watching the live `#view` with the same observer a staged render
	 * uses; if the first view has already painted, `renderedIn()` resolves at once. The `.catch`
	 * keeps a document whose first view never renders from turning every later click into a
	 * rejected promise. */
	const vp = document.getElementById('view');
	if (vp) {
		vp.setAttribute('data-page', curPage);
		_inflight = renderedIn(vp).catch(() => {});
	}
}

/* ---- the incoming page is rendered off screen and swapped in when it is ready ----
 *
 * Emptying `#view` and letting the incoming view render into the live page instead means the user
 * watches an empty page for as long as the module and its data take (1800 ms on a first visit at
 * 600 ms latency), and a superseded render cannot be stopped, so the damage has to be repaired
 * afterwards — which took three mechanisms.
 *
 * `stageView()` puts a fresh `<div id="view">` inside a hidden wrapper as the FIRST child of
 * `.fs-content`, and `getElementById` returns the first match in tree order — which is what LuCI's
 * own view chain calls, once in `View.__init__` for the spinner and again when the render resolves.
 * So the incoming view writes into the stage while the page the user is reading stays on screen.
 *
 * Hidden but LAID OUT: `visibility: hidden; height: 0; overflow: clip`, never `display: none`.
 * Several views size themselves from the element they render into (`view.offsetWidth - 2`), so a
 * `display: none` stage would hand them a zero width they keep for the life of the instance. The
 * stage's width is the container's, exactly what it will be after the swap — measured rather than
 * assumed: the Load graph comes out 1222px wide whether the page is reached by a full load or by a
 * click.
 *
 * The swap MOVES THE NODES rather than swapping the element: inserting the staged `#view` and
 * deleting the old one would change the identity of `#view`, and fs-fit's content observer and
 * fs-appearance's view observer are bound to the node that existed at chrome init — both would end
 * up watching a detached node and the fitters would silently stop. So the live `#view` keeps its
 * identity and its children are replaced through `dom.content()`, which also reaps the outgoing
 * page's `data-idref` entries.
 *
 * Renders are SERIALIZED, and that is what retires the repair machinery. Neither an in-flight LuCI
 * XHR nor a running `View.__init__` chain can be cancelled, and every chain resolves `#view` at
 * paint time, so an older navigation's chain would paint into the newer one's stage. A navigation
 * therefore waits for the previous one to finish; the older chain paints into its own stage, which
 * is dropped unswapped. The cost is that a click during a slow first load waits for that load.
 *
 * Completion is observed, not assumed: `renderedIn()` resolves when a child that is not the spinner
 * appears, or when a mutation leaves the stage empty, which is how a view that renders nothing
 * finishes. A render that has not completed within RENDER_TIMEOUT is a FAILURE — swapping a spinner
 * in and releasing the serialization would let the still-running chain paint into a later
 * navigation's stage — so it rejects into the full-load fallback. */
const RENDER_TIMEOUT = 15000;
/* the promise of the render currently in flight; this initial value only covers a document whose
 * chrome came up without seed() having run */
let _inflight = Promise.resolve();

function stageView(contentHost) {
	const wrapper = document.createElement('div');
	wrapper.className = 'fs-staging';
	const view = document.createElement('div');
	view.id = 'view';
	wrapper.appendChild(view);
	/* first in tree order, or getElementById() would keep answering with the live one */
	contentHost.insertBefore(wrapper, contentHost.firstChild);
	return { wrapper, view };
}

function renderedIn(view) {
	/* `.spinning` is luci-base's placeholder, written by View.__init__ before load() runs; a
	 * <script> is what a template shell replays. Neither is the page. */
	const painted = () => view.querySelector(':scope > :not(.spinning):not(script)') !== null;
	if (painted()) return Promise.resolve();
	return new Promise((resolve, reject) => {
		const timer = window.setTimeout(() => {
			finish(() => reject(new Error('the view did not render within ' + RENDER_TIMEOUT + ' ms')));
		}, RENDER_TIMEOUT);
		const mo = new MutationObserver(() => {
			/* an empty render finishes too: the spinner is replaced by nothing, a mutation that
			 * leaves no element children. No "has it started" flag is needed — `painted()` was
			 * asked before the observer existed, and an observer fires only on a mutation. */
			if (painted() || view.childElementCount === 0) finish(resolve);
		});
		function finish(settle) {
			window.clearTimeout(timer);
			mo.disconnect();
			settle();
		}
		mo.observe(view, { childList: true });
	});
}

function dropStage(stage) {
	if (stage && stage.wrapper && stage.wrapper.parentNode) discard(stage.wrapper);
}

/* Put the staged page on screen: clear what the outgoing page left beside `#view`, move the staged
 * children into the live `#view` through `dom.content()`, drop the wrapper. */
function commitStage(stage, contentHost) {
	/* the outgoing page is going off screen now, so the sheets it owned may be darkened — the half
	 * navigate() spared while it was still being read */
	sheets.scopeToCurrentPage();
	sweepAround(contentHost);
	const live = liveView(contentHost, stage);
	/* …and the page-scoped CSS identity moves forward with it. `stage.view` carries the incoming
	 * page's name from navigate() (spared there the same way the sheets above were); this is the
	 * commit that finally moves it onto the element the reader is about to see and onto
	 * `.fs-content`, which the same CSS uses for content that sits beside `#view` rather than
	 * inside it (the Overview's stray `<h2 name="content">`, styles/pages/20-overview.css). Until
	 * this line the LIVE `#view` and `.fs-content` still carried the OUTGOING page's name, so its
	 * own page-scoped rules kept matching for the whole staging window. */
	const page = stage.view.getAttribute('data-page');
	if (page != null) {
		live.setAttribute('data-page', page);
		if (contentHost) contentHost.setAttribute('data-page', page);
	}
	const nodes = Array.from(stage.view.childNodes);
	const dom = window.L ? window.L.dom : null;
	if (live && dom && typeof dom.content === 'function')
		dom.content(live, nodes);
	else if (live)
		live.replaceChildren(...nodes);
	dropStage(stage);
}

/* ---- the swap is a DOM move, and nothing wraps it ----
 *
 * 0.14.4 wrapped `commitStage()` in `document.startViewTransition()` to cross-fade the swap, on the
 * reasoning that the commit is one synchronous DOM move and so the API would be animating a frame
 * rather than a render. What that reasoning did not cover is the CAPTURE, which the engine performs
 * before it enters the update callback and which the page cannot bound: measured on WebKit at
 * 390px, a client navigation to /admin/system/system spent 2,143 ms in a single main-thread task
 * with the transition and 213 ms without it, and the swap itself landed at 3,728 ms against 206 ms.
 * The reader spends that time looking at the page they navigated away from, under the new URL —
 * which is what a report of "the section is not where I expect it, F5 fixes it" looks like from the
 * outside (issue #42), F5 being a full load and starting no transition.
 *
 * A deadline was tried and does not hold: `skipTransition()` runs the update callback at once
 * (3-5 ms on WebKit, Chromium and Firefox alike), but it has to be called from a timer, and the
 * capture is holding the thread that timer needs — the 150 ms deadline fired at 1,944 ms, after the
 * callback it was there to pre-empt. Chromium captures the same navigations in 15-40 ms and pays
 * none of this; an effect that is free on one engine and seconds on another, with no way to tell
 * them apart before spending them, is not worth a reader's navigation. It can come back when a
 * capture can be measured without one. */

/* The `#view` the document keeps between navigations, i.e. the one the observers are bound to:
 * whichever `#view` is not the stage. A document that has none gets one, once. */
function liveView(contentHost, stage) {
	for (const el of contentHost.querySelectorAll(':scope > #view'))
		if (el !== stage.view) return el;
	const v = document.createElement('div');
	v.id = 'view';
	contentHost.appendChild(v);
	return v;
}

/* Clear what the outgoing page left as a SIBLING of #view inside .fs-content: dom.content()
 * replaces only #view's own children, so anything a page emitted next to it rides along — the
 * Overview template's `<h2 name="content">Status</h2>` is hidden by a `.fs-content[data-page=…]`
 * rule (styles/pages/20-overview.css) and would show on every later page. Keep only the chrome
 * that legitimately outlives a page (tabs, server notices, <noscript>) and the stage.
 *
 * …and the RUNTIME notifications, which live one level up: `ui.addNotification()` inserts into
 * #maincontent while the sweep above reaches only children of .fs-content. A full load clears them,
 * so without this every banner stacks up over each following page. The .fs-content banners kept
 * above are the server's notices and do outlive a page. */
function sweepAround(contentHost) {
	Array.from(contentHost.children).forEach((c) => {
		if (c.id !== 'view' && c.id !== 'tabmenu' && !c.classList.contains('fs-staging') &&
		    !c.classList.contains('alert-message') && c.nodeName !== 'NOSCRIPT')
			discard(c);
	});
	const mainHost = document.getElementById('maincontent');
	if (mainHost)
		Array.from(mainHost.children).forEach((c) => {
			if (c.classList.contains('alert-message')) discard(c);
		});
}

/* ---- and something has to say that a slow navigation IS a navigation ----
 *
 * With the outgoing page left on screen until the incoming one is ready, a cold route looks like a
 * click that did nothing: the chrome switches instantly while the content does not move for as long
 * as the module and its first RPC take.
 *
 * A hairline at the top of the content, shown only when the navigation outlives `PROGRESS_DELAY` —
 * below that a bar flashes on and off on every warm click, which reads as a glitch. The counter is
 * what makes overlapping navigations share one bar; reduced motion is handled in CSS. */
const PROGRESS_DELAY = 150;
let _progressPending = 0;
let _progressTimer = 0;
function progressBar() {
	let bar = document.getElementById('fs-nav-progress');
	if (!bar) {
		bar = document.createElement('div');
		bar.id = 'fs-nav-progress';
		/* the live region already announces the page, so a decorative bar in the accessibility tree
		 * would be noise on every navigation */
		bar.setAttribute('aria-hidden', 'true');
		/* on <body>, not in the content column: it is `position: fixed`, and `.fs-shell` carries
		 * `contain: paint` in the sidebar layout, which would position it against the shell and clip
		 * it; inside `.fs-main`, a column flex container, its 2px shrink to zero */
		document.body.insertBefore(bar, document.body.firstChild);
	}
	return bar;
}
function progressStart() {
	_progressPending++;
	window.clearTimeout(_progressTimer);
	_progressTimer = window.setTimeout(() => { progressBar().dataset.state = 'active'; }, PROGRESS_DELAY);
}
function progressEnd() {
	if (--_progressPending > 0) return;
	_progressPending = 0;
	window.clearTimeout(_progressTimer);
	const bar = progressBar();
	if (bar.dataset.state !== 'active') return;
	bar.dataset.state = 'done';
	_progressTimer = window.setTimeout(() => {
		if (bar.dataset.state === 'done') delete bar.dataset.state;
	}, 300);
}

/* Attempt an in-place navigation to `pathname`. Returns true if handled as a
 * SPA nav (caller should preventDefault), false to let the browser do a normal
 * full navigation. `push` adds a history entry (false when replaying popstate).
 * `kbd` — the navigation was activated from the keyboard (see the focus block). */
function navigate(pathname, push, kbd) {
	const segs = tree.segsFromPath(pathname);
	if (!segs) return false;

	/* the view on screen injected CSS that can repaint any page: this document is spent, and the
	 * only exit leaving both pages correct is a real navigation (fs-sheets.js) */
	if (sheets.documentPoisoned()) return false;

	/* …and a document whose session has died is spent the same way: the only page it can render
	 * correctly is the login form, and only a real navigation gets there (watchSession) */
	if (_expired) return false;

	/* `segs` is what the user clicked, `rsegs` the leaf it resolves to; they differ for an
	 * alias/firstchild link, and a full load keeps both — URL and pathinfo as requested,
	 * requestpath/dispatchpath/nodespec/title resolved. Mirror that split, or an F5 lands somewhere
	 * the click did not. */
	const res = tree.resolveSegs(segs);
	const node = res && res.node;
	const className = tree.viewClassFor(node);
	if (!className)
		return false;

	/* A page whose stylesheet only the server can emit is not ours to swap into.
	 *
	 * A menu.d node may name its own sheet (`"css": "view/foo/foo.css"`), which the server links
	 * from <head> on a full load. A swap replaces #view's children rather than re-rendering a
	 * document, so reaching such a page by CLICK would show it with the app's CSS missing while a
	 * URL or F5 showed it styled.
	 *
	 * So decline, as the poisoned-document bail above does. The cost is one full load per ENTRY into
	 * a document that lacks the sheet: head.ut emits the link for the dispatched node only, so each
	 * full load starts a document carrying exactly one such sheet and the page is a swap from then
	 * on — but two `css`-bearing pages alternating are a full load in both directions. No in-tree
	 * node sets `css` today.
	 *
	 * Injecting the <link> here would work and is deliberately not done: it would put the theme in
	 * charge of fetching and ordering a foreign stylesheet, which the server already does correctly.
	 * Which sheets a document carries is fs-sheets.js's question (documentCarries); what is decided
	 * here is only what to do about the answer.
	 *
	 * `node.css` reaches the client because /admin/menu serves the dispatcher's own tree and ui.js's
	 * scrubMenu() only rewrites `satisfied`; a luci-base predating the `css` schema entry drops the
	 * property server-side, where this is simply never true. */
	if (typeof node.css === 'string' && node.css !== '' && !sheets.documentCarries(node.css))
		return false;

	const rsegs = res.segs;

	/* from here on the navigation is committed */
	const gen = ++_navGen;
	/* the saved offset belongs to THIS navigation, so it leaves the module slot here rather than
	 * being read at the swap: left there, a Back offset outlives its own navigation and scrolls a
	 * page the user clicked instead. Clearing it on the superseded path is not the answer either —
	 * a second popstate may legitimately have put its offset there by then. */
	const restoreTo = _pendingRestore;
	_pendingRestore = null;
	_curPath = pathname;	/* what is on screen from now on — read by the popstate handler */

	const contentHost = document.querySelector('.fs-content');
	if (!contentHost) return false;

	/* the page being left, captured before L.env is re-pointed below: the sheet scoping spares it
	 * until the swap takes it off screen */
	const leaving = (L.env.dispatchpath || []).slice();

	/* the outgoing page's links are about to become a detached tree — do not hold one of them */
	_lastHovered = null;
	/* Run every registered navigation callback. The seam is inverted on purpose: a registrant calls
	 * onNavigate() and the router names nobody, so an optional module that is not installed cannot
	 * be a DependencyError taking out the whole chrome.
	 *
	 * The RESOLVED segments are passed in, because this runs before L.env is re-pointed below and a
	 * callback reading L.env.dispatchpath would record the page being left.
	 *
	 * A throwing registrant is isolated but logged: the loop must finish, and an empty catch makes
	 * a registrant that throws on every navigation indistinguishable from one never registered. */
	for (const fn of _navCbs) {
		try { fn(rsegs); }
		catch (e) { console.error('footstrap: a navigation callback threw', e); }
	}
	/* ui.js defines hideModal unconditionally, so there is no feature to test; what is caught is a
	 * modal's own teardown throwing, which must not take the navigation with it */
	try { ui.hideModal(); }
	catch (e) { console.error('footstrap: hideModal threw during a navigation', e); }

	/* point the runtime env at the new node so views, tabs and highlighting read the right path;
	 * for a fully-matched leaf, request == dispatch path */
	L.env.requestpath  = rsegs.slice();
	L.env.dispatchpath = rsegs.slice();
	L.env.pathinfo     = '/' + segs.join('/');
	/* `readonly` is not decoration: luci.js implements hasViewPermission() as
	 * `!env.nodespec.readonly`, and views plus luci.js's Save/Apply footer key their disabled state
	 * off it, so dropping it hands a read-only user live Save/Apply buttons that a full load
	 * disables. It must come from the whole PATH, not the leaf — see readonlyForSegs(). */
	L.env.nodespec     = { satisfied: true, action: node.action, title: node.title,
	                       depends: node.depends, readonly: tree.readonlyForSegs(rsegs) };

	/* Re-navigating to the page already on screen must replace its history entry, not push a second
	 * one: clicking the active menu item is ordinary, and a duplicate entry makes Back do nothing —
	 * popstate fires, the path is unchanged, and the fragment guard below correctly returns. */
	if (push) {
		const same = pathname === window.location.pathname;
		/* a new entry gets a new id; re-navigating in place keeps the entry and its id (seed()
		 * adopted one before wire() made this function reachable) */
		if (!same) _curId = newEntryId();
		history[same ? 'replaceState' : 'pushState']({ fsnav: true, fsid: _curId }, '', pathname);
	}

	document.title = node.title ? (titleHost() + ' | ' + _(node.title)) : titleHost();
	const tmain = document.querySelector('.fs-title-main');
	if (tmain && node.title)
		tmain.textContent = _(node.title);

	chrome.renderChrome();

	/* A full load starts at the top and the in-place swap must too, or navigating away from a long
	 * page opens the next one mid-scroll. Both scrollers are reset, since which one scrolls depends
	 * on the layout — in the sidebar layout the window does not scroll, `.fs-shell` being 100dvh
	 * with `.fs-main` owning overflow-y (issue #7) — and scrollTo on the other is a no-op.
	 *
	 * The WRITE is at commitStage now, not here — see there. `_rest` is forgotten here regardless:
	 * it is the reference fs-fit tells a reader-caused scroll from an engine's clamp with, and the
	 * reader is committed to leaving this page from this point on, so a mutation the outgoing page's
	 * own poller makes during the staging window (before clearViewIntervals, further down this
	 * chain) must not be read against a reference that belongs to a page about to go away.
	 *
	 * A popstate replay resets nothing: both scrollers are restored there from _scrollMem.
	 * scrollRestoration stays 'auto' — the UA's own attempt lands before the swap and is undone by
	 * it, so it neither helps nor hurts, while 'manual' would take away the genuine full load.
	 *
	 * `forgetRest()` was gated on `push` despite the comment above already claiming "regardless" — a
	 * Back replay is leaving this page exactly as much as a click does, so the outgoing page's stale
	 * anchoring reference survived a popstate and could still be read against the page being
	 * restored into once fs-fit's own mutation observer next fires on it. */
	fit.forgetRest();

	/* ---- what a full load does for a keyboard/screen-reader user, and the SPA does not ----
	 * renderChrome() has just emptied #topmenu, so the <a> the user activated with Enter no longer
	 * exists: focus falls back to <body>, the next Tab restarts at the skip link, and nothing says
	 * the page changed. So do what a real navigation would, and where matters (Sutton's
	 * five-prototype study, docs/spa-router.md, "Accessibility of a route change"): a KEYBOARD
	 * activation (ev.detail === 0) moves focus to the skip link, a small target whose :focus
	 * overlay says where they are and whose Enter jumps to the content, with text that complements
	 * rather than repeats the live region below. A pointer activation — and a popstate replay,
	 * whose modality is unknowable — keeps the wrapper focus, since focusing the skip link there
	 * would flash its overlay on every mouse click. preventScroll, because the scroll position is
	 * the OUTGOING page's own — untouched until commitStage — and must stay that way here too. */
	const skip = kbd ? document.querySelector('.fs-skip') : null;
	const main = skip || document.getElementById('maincontent');
	if (main) main.focus({ preventScroll: true });
	const live = document.getElementById('fs-nav-status');
	if (live) live.textContent = node.title ? _(node.title) : '';

	/* Require through the runtime singleton `window.L`, not the bare `L` a module factory is handed:
	 * the dispatcher builds `window.L = new LuCI()` and `ui` augments THAT instance, so a view
	 * required via the bare `L` throws "L.itemlist is not a function" mid-render (the two-L trap,
	 * docs/spa-router.md). require/instanceof errors fall back to a real navigation; render-time
	 * errors are handled inside LuCI.view, as on a full load.
	 *
	 * When to re-instantiate is the subtle part: require() caches an INSTANCE, so requiring a class
	 * not seen before constructs it, and a view's __init__ IS its render. On a first visit the
	 * require has already painted, and a `new view.constructor()` after it paints a second time —
	 * two renders, two pollers. Only on a revisit does require() return a singleton whose __init__
	 * already ran, and `_seen` must be read BEFORE the require resolves, since the require is what
	 * fills LuCI's cache.
	 *
	 * The Overview's three template globals are defined in menu-footstrap-common.js, which every
	 * page evaluates before this router exists: the router has no business owning
	 * luci-mod-status's globals. */
	const RT = window.L;
	const cached = _seen.has(className);
	/* Wait for an in-flight prefetch of this class rather than racing it: two requests for the same
	 * URL do not coalesce, so a click landing before the prefetch downloads the module twice, both
	 * at full latency, for nothing. That is the normal case on a touch device, where pointerover
	 * fires the same moment as the tap, and waiting costs nothing — the XHR would have waited for
	 * exactly those bytes.
	 *
	 * `_seen` is marked after the wait, not before, because it means "this class has been through
	 * require()" and the wait introduces a window in which we may never get there: marked up front,
	 * the next navigation takes the cached branch and renders twice.
	 *
	 * The previous render is waited for, not raced, for the reason the staging block above gives.
	 * The wait rides alongside the prefetch wait, both being already in flight. */
	const previous = _inflight;
	let release;
	_inflight = new Promise((r) => { release = r; });
	progressStart();

	Promise.all([ warmedThen(className), previous.catch(() => {}) ]).then(() => {
		/* superseded while waiting: never start the require. On a first visit the require IS the
		 * render, so it would spend a module fetch and a round of RPCs on a page already left. */
		if (gen !== _navGen) return null;

		/* ---- teardown, now that the previous render is finished and cannot re-register ----
		 *
		 * Drop the outgoing view's pollers, then put the poll loop back into the state a fresh load
		 * leaves it in. The only non-view poller LuCI adds is the transient apply/reboot
		 * reachability check, so flushing the queue is safe.
		 *
		 * The re-arm matters: LuCI runs one 1 s tick and fires a queue entry only when
		 * `tick % interval == 0`, so leaving the outgoing page's tick running makes the incoming
		 * poller wait up to a full `pollinterval` — Wireless drew its station list 4950 ms after
		 * arrival against ~360 ms on a full load.
		 *
		 * stop() alone is not the fix: it deletes `tick`, and Poll.add() only auto-starts when
		 * `tick != null`, so the incoming pollers would never start. stop()+start() on an empty
		 * queue leaves what a fresh document has, and the view's first poll.add() then starts it —
		 * upstream's own sequence. */
		if (L.Poll && L.Poll.queue) {
			L.Poll.queue.length = 0;
			L.Poll.stop();
			L.Poll.start();
		}
		/* kill the outgoing view's plain setInterval pollers too, as a full load would; L.Poll's own
		 * tick survives */
		clearViewIntervals();
		/* and drop uci's document-scoped config cache, which a full load would not carry into the
		 * incoming page either (flushUciCache); what it hands back is the refill, awaited below */
		const uciWarm = flushUciCache();

		/* Keep <body data-page> in sync with the route: the server stamps the dispatch path on every
		 * full load, and fs-chrome/fs-fit/fs-overview/menu-footstrap-common read it off `body` as the
		 * ROUTE'S identity — a cache-invalidation key and a "did the page change" flag, never a CSS
		 * scope. `rsegs` is the resolved leaf, so a firstchild URL yields the same value however it
		 * is reached. It sits before the staged render because those modules' own fitting and module
		 * loading must react to the incoming route before that render runs, same as always.
		 *
		 * Page-scoped CSS no longer keys off `body[data-page]` — see the #view/`.fs-content` stamps
		 * below, which is where that identity now actually lives. Measured before the split: this
		 * write alone stopped 33 rules in styles/pages/20-overview.css from matching the OUTGOING
		 * page for the whole staging window (1407 ms on a cold require), growing the document 211px
		 * and moving the reader 140px — corrected here, not "visible today only as the Overview's
		 * stray heading" as this comment used to claim. docs/spa-router.md, "The staging window". */
		document.body.setAttribute('data-page', rsegs.join('-'));

		/* …and hand the new page to fs-sheets, which darkens every foreign sheet belonging to a
		 * different page and re-lights this page's own. That is what lets an invasive sheet stay in
		 * the document without spending it. After the stamp above and before the view renders, so
		 * nothing paints through a sheet that no longer owns the page.
		 *
		 * In two halves: enabling the incoming page's sheets is what the staged render needs, while
		 * disabling the outgoing page's would strip an app's stylesheet off content the user is
		 * still reading for the whole staging window. The page being left is swept at the swap
		 * instead (commitStage). */
		sheets.scopeToCurrentPage(rsegs, leaving);

		const stage = stageView(contentHost);
		/* The stage's OWN identity, so the incoming render measures itself under its own page-scoped
		 * CSS (styles/pages/*.css keys off `#view[data-page]` now, not `body[data-page]`) while it is
		 * still hidden. The LIVE `#view` and `.fs-content` are not touched here — they keep the
		 * OUTGOING page's value, set at that page's own commitStage, until this navigation reaches
		 * its own commitStage and moves it forward. Same two-phase shape fs-sheets uses above:
		 * the incoming half is spared for the render, the outgoing half is swept at the swap. */
		stage.view.setAttribute('data-page', rsegs.join('-'));
		const painted = renderedIn(stage.view);
		_seen.add(className);
		/* Name the owner for the length of this require, and only when the module has yet to be
		 * evaluated: on a first visit the require IS the render, so any <style> the module injects
		 * belongs to this page. Without it fs-sheets credits such a sheet to whichever page was
		 * stamped when it landed and binds it there for the life of the document. A cached require
		 * injects nothing, so it has no business naming an owner. */
		if (!cached) sheets.attributeTo(rsegs, gen);

		/* `uciWarm` is awaited before the construct: a cached module resolves within a microtask,
		 * well before the refill lands, and the view would read the cache we just emptied. It never
		 * rejects, so it cannot cost a full reload. */
		return Promise.resolve(uciWarm)
			.then(() => RT.require(className))
			.finally(() => { if (!cached) sheets.attributeTo(null, gen); })
			.then((view) => {
				if (!(view instanceof RT.view))
					throw new TypeError('Loaded class ' + className + ' is not a view');
				/* only a revisit has a singleton whose __init__ must be re-run; on a first visit the
				 * require has already painted into the stage. See the require block above. */
				if (cached) new view.constructor();
				return painted;
			})
			.then(() => {
				/* superseded while rendering: the chain painted into its own stage, so drop it and
				 * leave the live page to the newer navigation */
				if (gen !== _navGen) { dropStage(stage); return; }
				commitStage(stage, contentHost);
				/* Reset both scrollers to the top HERE, in the same synchronous turn as the content
				 * swap above: a full load starts a new page at the top, and doing it here — rather
				 * than at the click, where it used to sit — means the reader keeps reading the
				 * OUTGOING page from wherever they were for the whole staging window instead of
				 * being thrown to its top the moment they click. Measured with the require held open
				 * (1.2 s): `y` used to hit 0 within 12 ms of
				 * the click and stay there through the swap; moved here it stays at the reader's own
				 * offset for the whole window and reaches 0 in the same frame the new page appears.
				 * docs/anchoring.md, "The scroll reset". */
				if (push) {
					window.scrollTo(0, 0);
					const sc = document.getElementById('maincontent');
					if (sc) sc.scrollTo(0, 0);
				}
				/* now, and only now, is there one height to read: the incoming page's */
				if (restoreTo) restoreScroll(restoreTo, gen);
			})
			.catch((e) => { dropStage(stage); throw e; });
	}).catch((e) => {
		/* the full reload is a correct fallback, but swallowing the reason makes every SPA-router
		 * regression look like a slow page */
		console.error('footstrap: SPA nav to ' + className + ' failed, falling back to a full load', e);
		if (gen === _navGen) window.location = pathname;
	}).then(() => {
		progressEnd();
		release();
	});

	return true;
}

/* The same-origin nav URL an event's link points at, or null when the link is not ours to handle
 * (new-tab target, download, bare #hash, cross-origin, unparsable). Shared by the click router and
 * the hover prefetch, so the filter cannot drift between them. */
function linkUrlFrom(ev) {
	const a = ev.target.closest?.('a[href]');
	if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download'))
		return null;
	const raw = a.getAttribute('href');
	if (!raw || raw.charAt(0) === '#') return null;
	let url;
	try { url = new URL(a.href, window.location.href); } catch (e) { return null; }
	return url.origin === window.location.origin ? url : null;
}

/* Warm the view module behind an event's link — one filter for all three prefetch triggers, and the
 * same one the click router applies below: navigate() pushes a bare path, so a link carrying ?query
 * or #hash full-loads and warming its module spends a request on a page the SPA path can never
 * open. */
function prefetchFrom(ev) {
	const url = linkUrlFrom(ev);
	if (url && !url.search && !url.hash)
		prefetchView(url.pathname);
}

/* The last <a> a pointer crossed, kept only to stop `pointerover` re-firing per child span. Cleared
 * on every navigation: an element holds its parent, so retaining one anchor retains the whole
 * detached tree the content swap just threw away. */
let _lastHovered = null;

/* ---- a document the router could not have rendered is not one it may navigate away from ----
 *
 * A `call`, `cbi` or `function` node — and any `template` other than the Overview — is a page this
 * theme did not build and cannot rebuild. Such a page may carry inline scripts and timers set
 * before this module was evaluated, which the interval hook above never saw and no teardown of ours
 * can retire; only the document's death does. So the first click away from one is a full load.
 *
 * Narrower than "did the current path resolve", deliberately: a path that resolves to nothing is a
 * wildcard URL (nodeForSegs() stops at the first unknown segment), and refusing to wire there would
 * turn the router off for the whole document on some of the most-used pages in LuCI. Only a node we
 * can see and cannot serve disables it. */
function bootDocumentIsOurs() {
	const node = tree.currentNode();
	if (!node || !node.action)
		return true;	/* unknown to the tree: a wildcard page, where the router is right to run */
	return tree.viewClassFor(node) != null;
}

/* ---- the boot contract: the luci-base surfaces this router calls, looked up before it wires ----
 *
 * Every module here is written against parts of somebody else's code that were never an API:
 * `L.Poll` is a deprecated alias, `L.dom.content` and `ui.instantiateView` are what `view.ut`
 * happens to use, `Request.addInterceptor` is how the session probe hears a 403.
 * tools/upstream-contract.mjs asks whether they still BEHAVE as assumed, but only against the two
 * userlands this repo owns. On a router carrying a luci-base that moved, the first anyone learns of
 * it is a click that opens nothing.
 *
 * So existence is checked at boot, once, and a missing name turns the router OFF rather than
 * on-and-broken: the page is then the server-dispatched MPA the theme was before the router
 * existed, and the console names which surface is gone.
 *
 * Existence only: a probe that called these would have to run them for effect (there is no dry
 * `instantiateView`), and a boot check that navigates is worse than the fault it looks for.
 *
 * The list is what THIS file calls. `uci` (flushUciCache) and `L.network` are read through their own
 * guards at their use, being optional there. */
const CONTRACT_FNS = [
	'L.require',
	/* classLoaded() tests `instanceof L.Class` to tell a loaded module from L.env/L.url/L.get */
	'L.Class',
	'L.dom.content',
	/* a slash in the leaf is several functions on one object: the pair is only ever there or gone
	 * together, so one name in the report is the whole finding */
	'L.Poll.start/stop',
	'L.Request.addInterceptor',
	'rpc.addInterceptor',
	'ui.instantiateView',
	'ui.hideModal',
	'ui.hideIndicator',
	'ui.addNotification'
];

/* the roots are resolved per probe, not once: `window.L` is what the two-L trap makes load-bearing
 * (docs/spa-router.md), and `ui`/`rpc` are this module's own requires */
function hasFns(path) {
	const seg = path.split('.');
	const leaf = seg.pop();
	let node = { L: window.L, ui: ui, rpc: rpc }[seg.shift()];
	for (const k of seg) node = node[k];
	return leaf.split('/').every((n) => typeof node[n] === 'function');
}

/* the two surfaces that are not functions */
const CONTRACT_REST = [
	/* the L.env keys navigate() re-points, plus the base_url moduleUrl() reads */
	[ 'L.env.{base_url,dispatchpath,requestpath,pathinfo,nodespec}', () => {
		const env = window.L.env;
		return !!env && [ 'base_url', 'dispatchpath', 'requestpath', 'pathinfo', 'nodespec' ]
			.every((k) => k in env);
	} ],
	[ 'L.Poll.queue', () => Array.isArray(window.L.Poll.queue) ]
];

/* -> the names that are not there, in list order; empty means the document can be navigated. A
 * probe that throws counts as missing: `L` itself may be a shape nobody here expected. */
function contractBreaks() {
	const gone = (probe) => {
		try { return !probe(); }
		catch (e) { return true; }
	};
	return CONTRACT_FNS.filter((path) => gone(() => hasFns(path)))
		.concat(CONTRACT_REST.filter(([ , probe ]) => gone(probe)).map(([ name ]) => name));
}

function wireRouter() {
	if (_wired) return;
	_wired = true;

	const broken = contractBreaks();
	if (broken.length) {
		/* the URL, not a repository path: this package also ships inside openwrt/luci, where no
		 * `docs/` directory exists, and this is the line a stranger is asked to quote */
		console.error('footstrap: this luci-base has no ' + broken.join(', ') +
			' — the client router stays off and every link is a full page load, which is what the ' +
			'theme did before it existed. Please report this line: ' +
			'https://github.com/VizzleTF/luci-theme-footstrap/blob/main/docs/spa-router.md');
		return;
	}

	if (!bootDocumentIsOurs())
		return;

	document.addEventListener('click', (ev) => {
		if (ev.defaultPrevented || ev.button !== 0 ||
		    ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.altKey)
			return;

		const url = linkUrlFrom(ev);
		if (!url) return;

		/* navigate() carries only the pathname, so pushState-ing a bare path for a link that
		 * promised ?query / #hash would strip both from the URL and from the view, which reads
		 * location.search */
		if (url.search || url.hash) return;

		/* record the outgoing page's offset under the entry we are still on; harmless when
		 * navigate() declines, a full load throwing the whole Map away */
		saveScroll();
		if (navigate(url.pathname, true, ev.detail === 0))
			ev.preventDefault();
	}, false);

	/* Warm the view module cache when the pointer enters a nav link. `pointerover` bubbles from
	 * every element the pointer crosses — dragging across a table fires it hundreds of times — so
	 * bail on the element first: the same <a> re-fires for every child span, and a non-link target
	 * is the common case. */
	document.addEventListener('pointerover', (ev) => {
		const a = ev.target.closest?.('a[href]');
		if (!a || a === _lastHovered) return;
		_lastHovered = a;
		prefetchFrom(ev);
	}, { passive: true });

	/* The pointer is not the only way a link gets chosen. A keyboard user Tabs to it and presses
	 * Enter, firing no pointer event at all: focusin is the keyboard's hover, and the Tab-to-Enter
	 * gap is human-scale. pointerdown adds the one pointer case pointerover cannot see — a link that
	 * scrolled under a stationary pointer crosses no boundary. (A touch user's pointerover fires at
	 * the same moment as the tap, which is what the in-flight wait in navigate() is for.) Neither
	 * needs the lastHovered guard: both fire once per interaction, and warmClass() dedupes. */
	document.addEventListener('focusin', prefetchFrom, { passive: true });
	document.addEventListener('pointerdown', prefetchFrom, { passive: true });

	window.addEventListener('popstate', () => {
		/* an entry carrying a query belongs to a full load, this router only ever pushing bare
		 * paths: replaying it as a bare-path SPA nav would drop the query the view expects */
		if (window.location.search) {
			window.location.reload();
			return;
		}

		/* A fragment change is not a navigation. Chrome fires `popstate` for a same-document
		 * fragment nav, so an `<a href="#">` inside a view — a common idiom for in-page controls —
		 * arrives here as if Back had been pressed, and re-running navigate() re-instantiates the
		 * view and wipes the state the click just set (issue #3). The view changed only if the PATH
		 * changed. */
		if (window.location.pathname === _curPath)
			return;

		/* the outgoing DOM is still up: record its offset under the entry we are leaving, then
		 * adopt the entry we arrived on and look up what it recorded when it was left */
		saveScroll();
		adoptEntry();
		/* Handed to navigate() rather than started here: restoreScroll() writes as soon as the
		 * scroller is tall enough for the saved offset, and while the incoming page renders off
		 * screen the OUTGOING one is still on it, so the height satisfying the test can be the old
		 * page's — restored at 386, then clamped to 197 when the swap brought in a shorter page.
		 * Started after the commit, there is only one height it can read. */
		_pendingRestore = _scrollMem.get(_curId) || null;
		if (!navigate(window.location.pathname, false)) {
			_pendingRestore = null;
			window.location.reload();
		}
	});
}

/* ---- the poll indicator must not outlive the poll ----
 *
 * LuCI shows the "Refreshing" pill on `poll-start`, flips it to "Paused" on `poll-stop` and never
 * hides it again (core calls ui.hideIndicator() only for `uci-changes`). That is invisible on a full
 * load, since Poll.start() dispatches `poll-start` only for a non-empty queue — but this router
 * flushes the queue and calls stop() on every navigation, so walking from a polled page to an
 * unpolled one leaves a "Paused" pill reporting on a poll that does not exist. The pill exists iff
 * there is something to poll. Registered at module eval, i.e. after luci.js's own listener, so this
 * runs second. */
document.addEventListener('poll-stop', () => {
	if (L.Poll && L.Poll.queue && L.Poll.queue.length === 0) {
		try { ui.hideIndicator('poll-status'); }
		catch (e) { console.error('footstrap: hideIndicator threw on poll-stop', e); }
	}
});

/* At module eval, like the listener above: the session can die during the first view's own data
 * calls, before anything has called wire(), and an interceptor registered later never sees it. */
watchSession();

/* Pause LuCI's 1 s poll loop while the tab is hidden: LuCI has no visibilitychange handler, so an
 * overview left open in a background tab hammers ubus around the clock, iwinfo getAssocList
 * included. stop() only clearInterval()s and the queue survives; start() re-arms and runs one
 * immediate step(), so data is fresh on refocus. A poller added while hidden does not auto-start
 * (stop() deletes the tick) and start() picks it up on show. */
let _visWired = false;
function wireVisibility() {
	if (_visWired) return;
	_visWired = true;
	/* respect a manual pause: the user can stop polling from the "Refreshing" indicator, and an
	 * unconditional start() on tab-show would undo it. Resume only what we paused. */
	let wasActive = true;
	document.addEventListener('visibilitychange', () => {
		if (!L.Poll) return;
		try {
			if (document.hidden) {
				wasActive = L.Poll.active();
				if (wasActive) L.Poll.stop();
			}
			/* …but never resume a poll the session can no longer answer: luci-base stopped it when
			 * it put its "Session expired" modal up, and restarting would spend a burst of failing
			 * calls behind a page the user cannot use */
			else if (wasActive && !_expired) {
				L.Poll.start();
			}
		} catch (e) { console.error('footstrap: the poll pause/resume threw', e); }
	});
}

/* Callbacks to run on every SPA navigation, each handed the resolved segments of the INCOMING page
 * (they run before L.env is re-pointed). The registry is inverted on purpose: a registrant calls in
 * and the router names nobody, so it cannot grow a static dependency on a module that may not be
 * installed. */
const _navCbs = [];
function onNavigate(fn) { if (typeof fn === 'function') _navCbs.push(fn); }

return baseclass.extend({
	seed,
	wire: wireRouter,
	wireVisibility,
	onNavigate,
	/* exported for tests/router-contract.test.mjs (no tests ship in the package), where it is driven
	 * against a hand-broken `L`: the one way to see the off branch */
	/* likewise out-of-package: interval-pause.test.mjs drives the navigation sweep around a
	 * visibilitychange and session-expiry.test.mjs reads the verdict the interceptors reached.
	 * navigate() is the real caller of the first and `_expired` gates the second. */
	/* fs-search warms its recents and the arrow-key-highlighted result, neither of which the
	 * pointer/focus triggers above can see. The edge points search -> router, because the router
	 * must keep no dependency on the palette. */
	prefetchSegs
});
