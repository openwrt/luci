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
 * WHERE THE PATHS IN THESE COMMENTS RESOLVE: `docs/…`, `tools/…` and `tests/…` name the theme's own
 * repository (https://github.com/VizzleTF/luci-theme-footstrap), not the tree this file is read in —
 * the package ships the runtime and nothing else, so none of the three directories travels with it.
 * Anything a user is asked to quote carries a URL instead; a comment may name the path. */

/* --- stray-interval teardown for SPA nav ---
 * A full load kills every window.setInterval the outgoing page set; SPA nav does not, so a view's
 * poller keeps firing against a page that is gone (luci-app-podkop's log tailer runs
 * `podkop check_logs` forever after you navigate away). Track view-set ids and clear them on nav,
 * keeping L.Poll's own 1s tick (also a setInterval); L.Poll's queue is flushed in navigate().
 * Hooked at module eval — before any view render can set a timer, and LuCI resolves a module's
 * dependencies BEFORE running the dependent's factory, so this runs no later than it used to when
 * it sat in menu-footstrap-common.js itself. */
const _viewIntervals = (window.__fsViewIntervals || (window.__fsViewIntervals = new Map()));
(function hookIntervals() {
	if (window.__fsIntervalsHooked) return;
	window.__fsIntervalsHooked = true;
	const _si = window.setInterval, _ci = window.clearInterval;
	/* THE ID THE CALLER GOT IS THE ID IT KEEPS, whatever the pause below does underneath. The map is
	 * keyed by that first id and the entry carries `live`, the id the platform has armed RIGHT NOW
	 * (null while paused) — so a view holding its handle can still stop its own poller after a trip
	 * through a hidden tab, which is exactly what re-arming under a fresh id took away from it.
	 * The arguments are kept for the same reason: a `setInterval` id carries none of them back. */
	window.setInterval = function (fn, ms) {
		const id = _si.apply(window, arguments);
		_viewIntervals.set(id, { fn, ms, rest: Array.prototype.slice.call(arguments, 2), live: id });
		return id;
	};
	window.clearInterval = function (id) {
		const spec = _viewIntervals.get(id);
		_viewIntervals.delete(id);
		/* A PAUSED TIMER IS ALREADY DISARMED, and its number is the platform's to hand out again —
		 * clearing it here would stop whatever timer holds it now. Untracked ids fall through
		 * unchanged: the hook must stay a pass-through for everything it did not arm. */
		if (spec) return (spec.live == null) ? undefined : _ci.call(window, spec.live);
		return _ci.apply(window, arguments);
	};
	/* A HIDDEN TAB MUST NOT KEEP CALLING THE ROUTER. `wireVisibility()` below stops LuCI's own poll
	 * when the tab goes away, which is most of the traffic — but a view is free to run a plain
	 * `setInterval` of its own (luci-app-podkop's log tailer does), and those kept hammering ubus in
	 * a background tab for as long as it stayed open. The registry that navigation already uses to
	 * clear them is enough to pause them too: disarmed on hide, re-armed on show with the same
	 * callback and period, so a view that was polling every 3 s is polling every 3 s again and one
	 * that was cleared meanwhile stays cleared.
	 *
	 * A PAUSED TIMER STAYS IN THE REGISTRY, armed on nothing. It was carried in a private list
	 * beside it, and a list is not what the navigation sweep reads: hide the tab while a navigation
	 * is in flight (a click, then straight to another tab), and coming back re-armed the timers of
	 * the page that navigation had already replaced — the sweep had run while they were somewhere
	 * it could not see. In the map, `clearViewIntervals()` takes them like any other. */
	document.addEventListener('visibilitychange', () => {
		if (document.hidden) {
			/* LuCI'S OWN TICK IS NOT OURS TO PAUSE, and taking it made the page poll FASTER the
			 * longer it was left in a background tab. `L.Poll.start()` arms its 1 s tick with a
			 * plain `setInterval`, so the hook above catches it like any other id. This listener is
			 * registered at module eval and wireVisibility()'s in init(), so ours ran first: it
			 * cleared LuCI's tick with the raw `_ci` and dropped it from the map (leaving
			 * `L.Poll.timer` naming a dead id, which made the `L.Poll.stop()` right after a no-op),
			 * and on show it re-armed that tick on an id `L.Poll` knew nothing about — after which
			 * `start()` armed a second one, because `active()` had nothing to see. Two steps per
			 * second after one hide/show, three after two, and so on for as long as the reader kept
			 * coming back. Only a client navigation swept the orphans up.
			 *
			 * So the tick is skipped here and wireVisibility() keeps both halves of it. When it
			 * cannot be told apart from a view's timer, NOTHING is paused: a view's poller running
			 * in a hidden tab costs a wasted RPC, whereas re-arming LuCI's tick behind its back
			 * costs a doubling that never stops. Same judgement as clearViewIntervals(). */
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
				 * caller is holding, and re-registering it would key a second entry to a number
				 * nobody has. The fresh id lives in `spec.live` alone and is never a KEY, so it
				 * cannot collide with an entry — and the platform hands ids out in sequence, so a
				 * re-arm cannot be given a number some earlier caller is still holding either. */
				spec.live = _si.call(window, spec.fn, spec.ms, ...spec.rest);
			}
		}
	});
})();
/* WHICH id IS LuCI'S OWN TICK — asked in ONE place, because two callers need the answer and both
 * pay the same price for getting it wrong: the navigation sweep below, and the hidden-tab pause in
 * the interval hook above (which used to take the tick with the view timers and hand it back on an
 * id L.Poll had never heard of).
 *
 * `L.Poll.timer` is that id, and it is private state — `add`/`remove`/`start`/`stop`/`active` are
 * the documented surface, and upstream has already marked the whole `L.Poll` alias deprecated
 * (`'require poll'` is its replacement, and neither 24.10 nor 25.12 ships poll.js yet, so the alias
 * is still the only way in). If the field is ever renamed, a caller reading it blind would treat
 * LuCI's tick as a view's: cleared on the next navigation, every poll on every later page silently
 * dead. So a missing field is not a null — it is a reason to do NOTHING, once, loudly. A view's
 * leftover interval outliving its page costs a wasted RPC; losing the global tick costs the
 * router's live data.
 *
 * Asked through the DOCUMENTED half first: `active()` says whether the tick is running at all, and
 * `timer` is deleted by `stop()` — so an absent field is the ordinary "nothing to protect" case on
 * a page with no pollers, not a sign that upstream moved anything. The anomaly worth reporting is
 * the pair DISAGREEING: a tick that is running while the id it runs on has no name we know.
 *
 * The alias itself is the first thing that can go, so this cannot be the one place that reads it
 * unguarded either: the sweep is called inside the staged render, after the chrome has switched to
 * the incoming page and before its module is required, and a TypeError there would leave every
 * click showing the previous page's content under the new page's title, the navigation dead in a
 * rejected promise. No alias is the same answer as an unreadable timer.
 */
/* -> the tick's id; `null` when LuCI is not polling and there is nothing to protect; `false` when
 * the two cannot be told apart, which every caller reads as "leave every interval alone". */
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
	/* Map, not Set: the key is the timer id and the value is what it would take to re-arm it */
	_viewIntervals.forEach((spec, id) => { if (id !== keep) window.clearInterval(id); });
}
/* ONE line per document whatever went wrong: this runs on every navigation, and a router that
 * cannot read L.Poll cannot read it on the next click either — a message per click would bury the
 * console the user is reading it in. */
let _pollWarned = false;
function warnPollUnreadable(msg) {
	if (_pollWarned) return;
	_pollWarned = true;
	console.error(msg);
}

/* --- uci cache teardown for SPA nav ---
 * `uci.load()` does not answer "is this config present?" — it answers "which of these packages did
 * THIS call fetch", skipping every package already in its document-scoped cache:
 *
 *     for (…) if (!self.state.values[packages[i]]) { pkgs.push(…); tasks.push(…) }
 *     return Promise.all(tasks).then(() => pkgs);       // uci.js, luci-base
 *
 * Four shipped views read that return value as an existence check and abort on an empty array —
 * luci-app-banip and luci-app-adblock's overview, luci-app-travelmate's overview and stations:
 *
 *     if (!result[3] || result[3].length === 0) { ui.addNotification(…, _('No banIP config found!')); return; }
 *
 * On a full load the cache is empty, so the first visit always gets its package name back and the
 * check passes. Under SPA the document survives, so the SECOND visit gets `[]` and the page renders
 * as "no config found" — reported against banip, where switching between its own tabs and coming
 * back to Overview is the ordinary gesture, and unstickable by anything short of a reload.
 *
 * The apps' reading of `load()` is wrong, but the DIVERGENCE is ours: a cache that outlives the page
 * that filled it is state a fresh load does not have, exactly like the poll queue and the view's
 * intervals above. So drop it on navigation and let the incoming view fetch what it needs.
 *
 * `unload()` is upstream's own idiom for this, not a lever we found: `uci.save()` ends with
 * `self.unload(pkgs); return self.load(pkgs)`. Pending local edits (creates/changes/deletes) go with
 * it — as they do on a full load, which throws away the whole document. Saved changes are already
 * on the server and the Unsaved-changes banner reads them from there, so it is unaffected.
 *
 * Read through `window.L.uci` rather than a `'require uci'` pragma, deliberately: the class attaches
 * itself to L's prototype when the FIRST requirer compiles it, so this sees the instance the pages
 * actually use, and a router that required it would both bind it to its own prototypal L (the two-L
 * trap, docs/spa-router.md) and pull uci.js onto pages that never touch uci. No instance means no
 * cache to flush.
 *
 * Returns the refill below as a promise the caller must wait on, or null when there is nothing to
 * wait for. It never rejects — a failed refill is reported and swallowed, because a navigation is
 * not the place to lose a page over a config the incoming view may not even read. */
function flushUciCache() {
	const uci = window.L ? window.L.uci : null;
	if (!uci || typeof uci.unload !== 'function') return null;
	/* `state.values` and `loaded` are private, so the same rule as L.Poll.timer applies: a shape we
	 * do not recognise is a reason to do nothing, once, loudly — never to guess. The two hold
	 * different halves of the cache (a package whose load is still in flight is in `loaded` alone),
	 * and unload() clears both, so the names are taken from both. */
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
	/* `state.reorder` is the one half unload() does not clear, and it is deliberately left alone
	 * rather than reset by hand: with `values` gone, reorderSections() finds no sections to order,
	 * emits no call and clears the map itself on the next save. Writing to that field would be us
	 * editing another module's private state, for a difference nothing can observe. */

	/* …and put back the three packages luci-base's network.js reads but will never load again.
	 *
	 * initNetworkState() loads `network`, `wireless` and `luci` ONCE, fills its own `_state`, and
	 * from then on answers every caller with `return (_state != null ? Promise.resolve(_state) : _init)`
	 * — no uci call, ever again, for the life of the document. What it answers WITH, though, is the
	 * uci cache: `getWifiDevices()` is `uci.sections('wireless', 'wifi-device')`, and a view like
	 * network/switch reads `uci.sections('network', 'switch')` in its own render(). So dropping those
	 * packages does not make network.js refetch them — it makes every consumer read an EMPTY config
	 * until the next full load.
	 *
	 * Measured on 24.10, one SPA navigation away from Interfaces: `uci.state.values` {}, and
	 * `network.getWifiDevices()` 2 devices -> 0. That is Status -> Channel Analysis painting its title
	 * and its button with no band tabs under them, and Network -> Switch painting its description and
	 * Save/Apply with no VLAN sections — both correct again after F5, which is exactly how it was
	 * reported upstream ("only work after reloading the page"). tools/spa-parity.mjs reproduces it in
	 * one command, and tools/upstream-contract.mjs is what notices if that list of three ever moves.
	 *
	 * Refilling them is what a full load hands the incoming view, so navigate() WAITS for it (see the
	 * Promise.all below): a cached module resolves within a microtask, well before this request lands,
	 * and the view would read the empty cache we just left it. Only when network.js is really in the
	 * document — no module, no derived state to keep in step, and no request to spend. The ubus half
	 * of `_state` stays as stale as upstream leaves it; a view that needs it fresh calls
	 * network.flushCache() itself, and that is not ours to decide.
	 *
	 * WHAT IT COSTS, and why the cheaper shape was not taken. Awaiting this puts one uci `get` in
	 * front of the render on a navigation whose module is already cached — measured on the stand over
	 * 12 alternating navigations between two warm views: 136 ms median without the wait, 159 ms with
	 * it. `uci.load()` also dispatches `uci-loaded`, which luci-base wires to the change indicator, so
	 * a second, unawaited `uci.changes()` rides along that `unload()` alone never triggered.
	 *
	 * The free alternative is to leave these three OUT of the unload rather than drop and refetch
	 * them, and it was rejected on what it does to the pages people edit: `network.flushCache()` — the
	 * one call a view makes when it wants fresh data — reloads its ubus half but calls `uci.load()`
	 * for the uci half, which is a no-op while the package is still cached. Interfaces and Wireless
	 * would then render fresh device state over config values from whenever the document first
	 * touched them, which a full load never does. Dropping and refilling keeps both halves as fresh as
	 * a full load, and keeps pending local edits behaving as they do everywhere else: discarded by the
	 * navigation, exactly like the poll queue and the view's intervals above. */
	if (!window.L.network) return null;
	const refill = [ 'network', 'wireless', 'luci' ].filter((p) => names.indexOf(p) !== -1);
	if (!refill.length) return null;
	return uci.load(refill).catch((e) => {
		console.error('footstrap: reloading uci ' + refill.join(', ') + ' after a navigation failed', e);
	});
}
let _uciCacheWarned = false;

/* ---- A DEAD SESSION ENDS THE DOCUMENT, AND THE ROUTER MUST NOT BROWSE THROUGH IT ----
 *
 * luci-base answers an expired session with `notifySessionExpiry()`: `Poll.stop()` plus a modal
 * whose only button reloads the page, which the dispatcher then answers with the login form. Every
 * navigation of ours does the opposite of both halves — `ui.hideModal()` and `L.Poll.stop()` +
 * `start()` — so the first click after the session died dismissed luci-base's own warning and
 * carried on. Measured on the stand before this existed: kill the session from inside the document,
 * let one rpc reject (`SessionError`, luci-base's modal up, polling stopped), then click a menu
 * link — the router swapped the view, the modal was gone, and the page sat on "Loading view…" with
 * every call behind it failing. Only a reload got the user back to a login form.
 *
 * So the router LEARNS that the session is gone and stops claiming navigations; the next click is a
 * real one and the dispatcher turns it into the login page. Nothing is reset — the flag dies with
 * the document, exactly as the session did.
 *
 * WHICH SIGNALS, and they are luci-base's own two decision points rather than a guess (luci.js,
 * `setupDOM`):
 *
 *   1. a `403` carrying `X-LuCI-Login-Required: yes` on any `L.Request` — upstream calls
 *      `notifySessionExpiry()` on exactly that pair;
 *   2. the `session.access` probe luci-base fires after some other call came back `-32002`, when
 *      that probe REJECTS — which is what upstream's `.catch(notifySessionExpiry)` reacts to.
 *
 * `access: false` is deliberately NOT one of them, and that is where this differs from the same
 * gate in luci-theme-aurora. The probe is declared `expect: { access: true }`, and rpc.js's
 * `handleCallReply()` turns a missing or mistyped key into the expectation's own value and
 * RESOLVES — so a probe answering `access: false` never reaches upstream's catch and never expires
 * anything. It is an ACL answer, and treating it as a dead session would drop a restricted user out
 * of the SPA for the rest of the document over a permission they simply do not have.
 *
 * The probe's rejection is read off the frame the interceptor is handed, because that is all an
 * interceptor can see: `handleCallReply()` rejects on a frame that is not JSON-RPC 2.0 or on an
 * `error` carrying both a code and a message, so those are the two conditions here. A foreign
 * `session.access` call of somebody else's that errors would also match — the cost is one document
 * of full loads, which is the safe direction to be wrong in.
 *
 * NEITHER INTERCEPTOR MAY THROW. luci-base runs both through `Promise.all(...).catch(req.reject)`
 * (`luci.js` for Request, `rpc.js` for rpc), so an exception in here would not just be our bug — it
 * would reject the caller's request, i.e. break the very page we are trying to protect. Hence the
 * try/catch around each body and no optional-chaining shortcuts on shapes we do not own. */
let _expired = false;
let _sessionWired = false;
function markExpired() {
	if (_expired) return;
	_expired = true;
	/* once per document, and it is the console's least alarming level the house rules allow
	 * (eslint no-console permits warn and error only): nothing is broken, the session simply
	 * ended, and the very next click sends the user to a login form. */
	console.warn('footstrap: the LuCI session is gone — every navigation from here is a full load.');
}
/* AND THE VERDICT IS NOT A LATCH. It was, and the shape was wrong for a signal read off somebody
 * else's reply: an interceptor sees `msg` only once the transport succeeded and the body parsed
 * (rpc.js rejects before that), so a missing frame is not a network flap — but it IS a captive
 * portal's page, a proxy's error body, one truncated reply. Any of those took the client router off
 * for the rest of the document while the session was alive throughout, explained by one console
 * line nobody reads until later.
 *
 * A clean `session.access` is the same call the failing one was, so it is evidence in the other
 * direction and it is taken as such. If the session really has ended no clean one arrives, because
 * every ubus call carries the same dead sid — the router stays off exactly as long as it should. */
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
				 * is rejected there too, but it says nothing about the SESSION. */
				if (msg.error && msg.error.code && msg.error.message) { markExpired(); return; }
				/* AND ONLY `access: true` SAYS THE SESSION IS THERE — measured on the stands, because
				 * this is the one place where guessing costs the whole fix. A dead sid does not make
				 * this call fail: `session.access` answers `[0, {access:false}]` with HTTP 200 and no
				 * error frame at all (the `-32002` arrives on the ORDINARY call, which is what makes
				 * luci-base fire this probe in the first place). So "the reply parsed" would have
				 * been read as "the session is back", and the verdict a 403 had just reached would
				 * be cleared by the very probe that confirms it. `access:false` stays out of BOTH
				 * answers: an ACL denial for a restricted user looks exactly the same, which is why
				 * it may not expire a session either. */
				if (Array.isArray(msg.result) && msg.result[1] && msg.result[1].access === true)
					markAlive();
			}
			catch (e) { /* ditto */ }
		});
}

/* ---- throw an element away the way luci-base throws one away ----
 *
 * `dom.data()` does not live on the element: luci.js keeps it in `dom.registry`, keyed by a
 * `data-idref` attribute, and the ONE thing that ever deletes an entry is `dom.content()`
 * (luci.js: it walks `[data-idref]` and deletes each key before emptying the node). A plain
 * `remove()` therefore leaves the entry — and through it the element and whatever class instance
 * was stored on it — reachable for the life of the document.
 *
 * `#view` is not affected, and that is why this is small: the incoming view's own
 * `dom.content(#view, …)` reaps the outgoing page. What the router removes BY HAND is the rest —
 * the siblings a template emitted next to `#view`, and the runtime notification banners — and those
 * it used to drop with `remove()`.
 *
 * MEASURED, before writing it: over three pages on the 25.12 stand nothing the sweeps remove
 * carries a `data-idref` at all (banners: 0, siblings: 0), and the registry does not grow across
 * laps (83 entries after the first lap of four pages, 83 after the third). So this fixes no leak we
 * can see today; it closes the class, for the same reason the stackables selector claims a table
 * with no LuCI classes — coverage is a contract, and the alternative is discovering it from a
 * third-party page nobody here runs.
 *
 * The bin is what makes the element's OWN entry go too: `dom.content()` reaps descendants of the
 * node it is given, never the node itself, so the element is moved into a detached container first
 * — which also takes it out of the live tree, i.e. does the removal. Public API only; no reaching
 * into `dom.registry`. If luci-base ever moves that surface, the fallback is today's behaviour. */
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
/* The pathname whose view is CURRENTLY rendered — popstate compares against it to tell a real
 * navigation from a mere fragment change (see there). Seeded from the served page. */
let _curPath = window.location.pathname;
/* nav generation token: two quick clicks race their async require()s, and without it the FIRST
 * view could render into #view after the second, leaving stale content under the newer
 * URL/title/chrome. A resolved require whose generation is stale renders nothing. */
let _navGen = 0;

/* ---- Back must restore the scroll of WHICHEVER element is the scroller ----
 * The two layouts scroll different elements: the sidebar layout pins .fs-shell to 100dvh and gives
 * overflow-y to .fs-main (#maincontent), the top layout lets the document scroll. A browser restores
 * an INNER scrollable region only across full loads, never on a same-document traversal — measured
 * (docs/spa-router.md, "Scroll"): Back opened the incoming page at 0, because the swap empties #view,
 * scrollHeight collapses and the browser clamps scrollTop.
 *
 * The DOCUMENT scroller was left to the browser's own scrollRestoration ('auto') on the grounds that
 * it is the case a UA does handle — and that is wrong for the same reason, measured on the stand: in
 * the top layout, scroll Processes to 400, open System, press Back, and the page opens at 0 (the
 * sidebar layout, restored here, comes back at 400). The UA restores at the traversal, i.e. BEFORE
 * this handler swaps #view; the height then collapses under the restored offset and the clamp takes
 * it back to 0, with nothing left to re-apply it. So record and replay BOTH offsets; the one that is
 * not this layout's scroller is 0 and skipped.
 *
 * NOT by replaceState on scroll: Safari rate-limits history writes (100 per 30 s) and a scroll
 * listener trips it. Each SPA entry instead carries a session-unique id (fsid) in history.state, and
 * the offsets live in this in-memory Map — lost on a full load, which is exactly when the browser's
 * own scrollable-region restoration takes over. The id is session-prefixed because a bare counter
 * restarts with every document: an entry stamped by a PREVIOUS document of this tab would collide
 * with a fresh one and restore another page's offset. */
const _scrollMem = new Map();
const _scrollSess = Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
let _histN = 0;
let _curId = null;
/* …and it is BOUNDED, because this document outlives every page in it. One entry per history entry
 * per session, never evicted, is the same shape as the leaks this file already fixes elsewhere (the
 * action-column resize listener, the view pollers) — small enough that nobody would see it and
 * unbounded all the same. A browser keeps ~50 entries per tab and the ones past that cannot be
 * traversed back to, so remembering more offsets than that can never be read. Least-recently-SAVED
 * goes first: a Map iterates in insertion order and `set` on an existing key does not refresh it,
 * so the re-save below is delete-then-set. */
const SCROLL_MEM_MAX = 50;
/* The offset a popstate replay must land on, consumed by the commit that puts the page on screen —
 * see the popstate handler for why it cannot be replayed any earlier. */
let _pendingRestore = null;
function newEntryId() { return _scrollSess + ':' + (++_histN); }

/* adopt the entry we are standing on: reuse its fsid if it has one, stamp one otherwise (entries
 * created by a full load carry state === null). replaceState keeps the entry's own scroll record. */
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
	_scrollMem.delete(_curId);	/* re-insert, so this entry counts as the most recently saved */
	_scrollMem.set(_curId, { win: Math.round(window.scrollY) || 0, main: sc ? sc.scrollTop : 0 });
	while (_scrollMem.size > SCROLL_MEM_MAX)
		_scrollMem.delete(_scrollMem.keys().next().value);
}

/* Put the scrollers back where the entry left them — but only once the incoming view has grown that
 * much height (docs/spa-router.md, "Scroll": restoring before the content exists is clamped to 0 and reads as
 * "worked"). The view renders behind an RPC, so poll by frame; a newer navigation cancels via the
 * generation, and a page that never reaches the old height again is simply left at the top. Each
 * offset is waited for on its OWN scroller, so a layout switched between the two entries restores
 * whichever half it can rather than blocking on the half that no longer scrolls. */
function restoreScroll(pos, gen) {
	if (!pos || (!pos.win && !pos.main)) return;
	/* A DEADLINE, not a frame count: this was 300 frames called "~5 s", which holds only at 60 Hz —
	 * the same budget is 10 s on a 30 Hz panel. Frames stay the tick (they are when a paint could
	 * have changed the height); time decides when to stop waiting for an RPC that is not coming. */
	const until = Date.now() + 5000;

	/* THE USER OUTRANKS THE SAVED POSITION. Waiting up to five seconds for a slow view to grow means
	 * the reader may have started using the page in the meantime — and jumping them somewhere else
	 * two seconds after they began reading is worse than opening at the top, which is what a full
	 * load does anyway. So any sign that the scroll is THEIRS cancels the restore for good.
	 *
	 * Two kinds of sign, because neither covers the other. The three input events are intent even
	 * when nothing moves yet (a wheel tick on a page too short to scroll, a touch that becomes a
	 * drag); `scroll` is the catch-all for everything they cannot see — a scrollbar drag, a
	 * trackpad fling, Find-in-page, an anchor jump, assistive tech. `scroll` also fires for OUR
	 * OWN writes, asynchronously, so a flag around the write would still be false by the time it
	 * arrives: the position we last wrote is remembered instead, and a scroll that lands exactly
	 * there is ours. Landing there by hand is indistinguishable and costs nothing — it is the
	 * position we were restoring to.
	 *
	 * Passive listeners: this must never sit in front of the scroll it is watching for. */
	let cancelled = false, wroteWin = -1, wroteMain = -1;
	const stop = () => { cancelled = true; off(); };
	const onScroll = (ev) => {
		const t = ev.target;
		const now = (t === document || t === document.documentElement || t === document.body)
			? Math.round(window.scrollY) : (t && t.scrollTop);
		if (now === wroteWin || now === wroteMain) return;	/* our own write coming back */
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
	/* capture, so the inner scroller (#maincontent in the sidebar layout) is seen too: `scroll`
	 * does not bubble from an element, but it does travel down the capture phase. */
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

/* ---- the host half of "<host> | <page>" is read ONCE ----
 * head.ut stamps it and it cannot change within a document, but navigate() used to re-derive it from
 * the LIVE document.title on every hop — so any page that renames the tab became the host for every
 * page after it, until a full load. Third-party views do rename it (log viewers, dashboards), and it
 * takes only one: measured on the stand, a view setting `document.title = 'ACME Dashboard'` left the
 * next hops reading "ACME Dashboard | Routing", "ACME Dashboard | System". Captured at seed(), i.e.
 * at chrome init on the full load that started the session; the lazy branch is for a document whose
 * chrome came up without seed() having run. */
let _titleHost = null;
function titleHost() {
	if (_titleHost === null)
		_titleHost = (document.title.split('|')[0] || '').trim();
	return _titleHost;
}


/* The exact URL LuCI.require() will fetch for a class name, cache-bust and all. Matching it
 * byte-for-byte is what makes a hover prefetch a warm cache hit for the later require(). */
function moduleUrl(className) {
	const v = L.env.resource_version ? ('?v=' + L.env.resource_version) : '';
	return (L.env.base_url || '') + '/' + className.replace(/\./g, '/') + '.js' + v;
}

/* ---- link prefetch: warm the module cache for a page the user is about to open ----
 *
 * A plain fetch(), NOT require(): require() instantiates, and a view's __init__ IS its render, so it
 * would paint another page into #view. fetch() only fills the browser's HTTP cache, which the later
 * require()'s XHR then hits. Deduped per class; failures are silent (a pure optimisation).
 *
 * TRANSITIVE, and that is where most of the win is: warming the view class alone leaves its own
 * `require` pragmas one round-trip behind it. view/network/routes.js pulls tools/network.js (40.5 KB),
 * and measured on the dev router at 120 ms RTT a first visit cost 418 ms with the view warmed against
 * 296 ms with its deps warmed too — one RTT exactly. Over six pages, 1713 ms cold → 1184 warmed →
 * 1052 warmed transitively. The bytes are in hand either way, so the scan is free.
 *
 * The scan MUST NOT be line-anchored. The shipped files are MINIFIED and every pragma sits on one
 * line (`'use strict';'require view';'require fs';…`), so /^'require …'$/m matches nothing at all —
 * silently, which is how the first attempt at this measured a win of zero. luci.js lexes the leading
 * string literals; this reads the same head of the file with one regex. */
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

/* WHICH CLASS NAMES ARE WORTH A PREFETCH, and the answer is the DOTTED ones — that is the whole
 * rule now, and it used to be a hardcoded list of the six names luci.js seeds its registry with
 * (`baseclass`, `dom`, `poll`, `request`, `session`, `view`). Those have no file, so fetching one is
 * a guaranteed 404 in the user's console — measured before the list existed: warming the recents at
 * idle put 404s for view.js and poll.js into every page load, and the first hover added baseclass.js.
 * The list worked, and it was a literal copied out of luci.js rather than a guess about it, but it
 * was still a copy: a seventh built-in would cost one 404 per name per session until this file
 * caught up with a release of somebody else's software.
 *
 * The shape of the names answers it without the copy. A LuCI class name is a path — `tools.widgets`
 * is tools/widgets.js — so a name with no dot is either one of those six virtual classes or one of
 * the flat libraries (`ui`, `form`, `network`, `uci`, `rpc`, `fs`, `validation`), and those are
 * already loaded by the time any prefetch runs: this theme's own chrome requires `network` for the
 * overview grid, which drags in firewall/uci/rpc/validation, and `ui` comes with the widgets.
 * Measured on the stand from three different landing pages, including the lightest one there is
 * (System -> Reboot): all eight flat libraries were already instances on arrival, and driving the
 * prefetch walk over seven pages fetched 10 files, every one of them nested. So the flat half of the
 * namespace is worth nothing to prefetch and can never be worth a 404 — declining it outright costs
 * nothing measurable, needs no list, and a future built-in is covered before it ships.
 *
 * The dotted half is still asked properly: require() attaches a class at its path (`ptr[parts[i]] =
 * instance`), so `tools.widgets` reads back as L.tools.widgets once some form page has pulled it,
 * and a second navigation there spends no request at all. `instanceof L.Class` rather than a
 * truthiness test: L.env, L.url and L.get are members too. */
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
/* className -> the promise of ITS OWN body being in the HTTP cache; navigate() waits on that.
 * Deliberately the body and not the subtree, see _committed below. */
const _warming = new Map();
/* Roots a navigation has taken over. Speculation below them STOPS: require() is now fetching the same
 * graph and pipelines its parse and eval against those fetches, so descending would only race it —
 * measured at 120 ms RTT, waiting for the whole subtree instead cost 658 ms against 525 ms racing,
 * for the sake of a duplicate that stopping avoids outright. Deps have not been asked for yet when a
 * click arrives (they start only once the root body lands), so there is nothing in flight to collide
 * with: this leaves zero duplicated bytes AND require()'s pipelining. */
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
	/* The visited set is global and the depth capped, so the walk terminates regardless of what the
	 * pragmas say — require() raises DependencyError on a cycle, but only for classes it actually
	 * loads, and this walks files it may never hand to require() at all. */
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
 * XHR and its error path are the better place to end up. */
const WARM_WAIT_MS = 5000;
function warmedThen(className) {
	_committed.add(className);
	const body = _warming.get(className);
	if (!body) return Promise.resolve();
	/* the loser of the race is cancelled: a prefetch that lands in 40 ms otherwise leaves a 5 s
	 * timer armed behind every single navigation, doing nothing but keeping its closure alive */
	let t = 0;
	return Promise.race([ body, new Promise((r) => { t = window.setTimeout(r, WARM_WAIT_MS); }) ])
		.finally(() => window.clearTimeout(t));
}

/* The page we are standing on arrived as a full load, so LuCI has ALREADY required — hence
 * instantiated and rendered — its view. Seed `_seen`, or the first SPA nav BACK to this page would
 * take require()'s cached instance, skip the re-instantiation and render nothing at all. */
function seed() {
	const here = tree.viewClassFor(tree.currentNode());
	if (here)
		_seen.add(here);
	titleHost();	/* before any view can rename the tab — see there */
	/* the served page's entry needs an id too, or the first Back TO it has nothing to look up */
	adoptEntry();

	/* ---- THE DOCUMENT'S OWN FIRST RENDER IS THE FIRST LINK IN THE CHAIN ----
	 *
	 * A navigation waits for the previous render because a LuCI view chain resolves `#view` at paint
	 * time and would otherwise paint into the newer navigation's stage. The very first chain in a
	 * document is not one of ours — `view.ut`'s inline `instantiateView()` is already running when
	 * the chrome comes up — and it is subject to exactly the same rule. Left untracked it was a real
	 * bug, not a theoretical one: measured at 350 ms latency, a click 150 ms after DOMContentLoaded
	 * ended with the URL, title and menu on System and the Processes the document had been loading
	 * painted over it, because that chain finished last and found the stage first in tree order.
	 *
	 * So the chain starts here, watching the live `#view` with the same observer a staged render
	 * uses. If the first view has already painted, `renderedIn()` resolves at once and the first
	 * click waits for nothing. The `.catch` is what keeps a document whose first view never renders
	 * (an error page, a dead RPC) from turning every later click into a rejected promise — and from
	 * logging an unhandled rejection at the 15 s mark on a page nobody clicked. */
	const vp = document.getElementById('view');
	if (vp) _inflight = renderedIn(vp).catch(() => {});
}

/* ---- THE INCOMING PAGE IS RENDERED OFF SCREEN AND SWAPPED IN WHEN IT IS READY ----
 *
 * What this replaces: the router used to empty `#view`, paint luci-base's "Loading view…" spinner
 * on a cold route and let the incoming view render into the live page. Two things came with that.
 * The user watched an empty page for as long as the module and its data took — measured at 600 ms
 * latency, 1800 ms of nothing on a first visit — and a superseded render could not be stopped, so
 * the file carried three mechanisms to repair the damage afterwards: a generation stamped on the
 * instance, a wrapper around `prototype.render` that made a stale paint hang forever, and a
 * re-navigation that undid a stale FIRST render after the fact.
 *
 * Rendering into a stage removes the damage instead of repairing it. `stageView()` puts a fresh
 * `<div id="view">` inside a hidden wrapper as the FIRST child of `.fs-content`, and
 * `getElementById` returns the first match in tree order — which is what LuCI's own view chain
 * calls, twice: once in `View.__init__` for the spinner and again when the render resolves
 * (`DOM.content(document.getElementById('view'), nodes)`). So the incoming view writes into the
 * stage while the page the user is reading stays on screen, untouched, until the swap.
 *
 * HIDDEN, BUT LAID OUT. `visibility: hidden; height: 0; overflow: clip` — never `display: none`.
 * Several views size themselves from the element they render into, and they find it the same way
 * LuCI does: `view/status/load.js` does `document.querySelector('#view')` and then
 * `view.offsetWidth - 2` (bandwidth.js, connections.js and wireless.js repeat it verbatim), so a
 * `display: none` stage would hand them a zero width they keep for the life of the instance. The
 * stage's width is the container's, exactly what it will be after the swap — measured rather than
 * assumed: the Load graph comes out 1222px wide whether the page is reached by a full load or by a
 * click. Only the height is taken away, so the page under it does not move.
 *
 * AND THE SWAP MOVES THE NODES, IT DOES NOT SWAP THE ELEMENT. The other obvious shape — insert the
 * staged `#view` and delete the old one — would change the identity of `#view`, and this theme has
 * observers bound to that element: `fs-fit`'s content MutationObserver and `fs-appearance`'s view
 * observer are registered on the node that existed at chrome init. Swapping the element leaves both
 * watching a detached node, i.e. the fitters silently stop re-running on content mutations. So the
 * live `#view` keeps its identity and its children are replaced through `dom.content()`, which is
 * also what reaps the outgoing page's `data-idref` registry entries.
 *
 * RENDERS ARE SERIALIZED, and this is what actually retires the repair machinery. Neither an
 * in-flight LuCI XHR nor a running `View.__init__` chain can be cancelled — `L.Request` never
 * exposes its handle — and every chain resolves `#view` at PAINT time, so a chain started by an
 * older navigation would paint into whatever stage is first when it finishes, i.e. into the newer
 * navigation's. A navigation therefore waits for the previous one to finish before it stages
 * anything; the older chain paints into its own stage, which is then dropped unswapped. The cost is
 * stated plainly: a click during a slow first load waits for that load. It buys the deletion of
 * three mechanisms that only ever cleaned up afterwards.
 *
 * COMPLETION IS OBSERVED, NOT ASSUMED. `renderedIn()` watches the stage and resolves when a child
 * that is not the spinner appears — or when a mutation leaves it empty, which is how a view that
 * renders nothing at all finishes. A render that has not completed within RENDER_TIMEOUT is a
 * FAILURE, not a completion: swapping a spinner in and releasing the serialization would let the
 * still-running chain paint into a later navigation's stage, so it rejects into the same full-load
 * fallback every other error takes. */
const RENDER_TIMEOUT = 15000;
/* the promise of the render currently in flight — this initial value only covers a document whose
 * chrome came up without seed() having run; seed() replaces it with the document's own first render */
let _inflight = Promise.resolve();

function stageView(contentHost) {
	const wrapper = document.createElement('div');
	wrapper.className = 'fs-staging';
	const view = document.createElement('div');
	view.id = 'view';
	wrapper.appendChild(view);
	/* FIRST in tree order, or getElementById() would keep answering with the live one */
	contentHost.insertBefore(wrapper, contentHost.firstChild);
	return { wrapper, view };
}

function renderedIn(view) {
	/* `.spinning` is luci-base's own placeholder, written by View.__init__ before load() runs;
	 * a <script> is what a template shell replays. Neither is the page. */
	const painted = () => view.querySelector(':scope > :not(.spinning):not(script)') !== null;
	if (painted()) return Promise.resolve();
	return new Promise((resolve, reject) => {
		const timer = window.setTimeout(() => {
			finish(() => reject(new Error('the view did not render within ' + RENDER_TIMEOUT + ' ms')));
		}, RENDER_TIMEOUT);
		const mo = new MutationObserver(() => {
			/* an empty render finishes too: the spinner is replaced by nothing at all, which is a
			 * mutation that leaves no element children behind. No "has it started" flag guards this:
			 * `painted()` was asked before the observer existed, and an observer only ever fires on a
			 * mutation, so an empty stage cannot resolve before the render has touched it. */
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
 * children into the live `#view` through `dom.content()`, and drop the wrapper. */
function commitStage(stage, contentHost) {
	/* the outgoing page is going off screen now, so the sheets it owned may finally be darkened —
	 * the half navigate() spared while it was still being read */
	sheets.scopeToCurrentPage();
	sweepAround(contentHost);
	const live = liveView(contentHost, stage);
	const nodes = Array.from(stage.view.childNodes);
	const dom = window.L ? window.L.dom : null;
	if (live && dom && typeof dom.content === 'function')
		dom.content(live, nodes);
	else if (live)
		live.replaceChildren(...nodes);
	dropStage(stage);
}

/* The `#view` the document keeps between navigations — the one the observers are bound to. It is
 * whichever `#view` is NOT the stage; a document that has none (a template page that emitted no
 * `#view` at all) gets one, once. */
function liveView(contentHost, stage) {
	for (const el of contentHost.querySelectorAll(':scope > #view'))
		if (el !== stage.view) return el;
	const v = document.createElement('div');
	v.id = 'view';
	contentHost.appendChild(v);
	return v;
}

/* Clear what the OUTGOING page left as a SIBLING of #view inside .fs-content: dom.content()
 * replaces only #view's OWN children, so anything a page emitted next to it rides along — the
 * Status→Overview template emits <h2 name="content">Status</h2> there, hidden only by a
 * body[data-page='admin-status-overview'] rule, so after an SPA nav the orphan showed on EVERY page
 * until a full reload. Keep only the chrome that legitimately outlives a page (tabs, server
 * notices, <noscript>) and the stage itself.
 *
 * …and the RUNTIME notifications, which live one level up and therefore survived every navigation.
 * `ui.addNotification()` does `mc.insertBefore(msg, mc.firstElementChild)` on #maincontent — this
 * theme's <main class="fs-main"> — while the sweep above only reaches children of .fs-content, a
 * descendant of it. A full load clears them; SPA never did, so "Upload request failed" and every
 * third-party banner stacked up over each following page for the rest of the session. The
 * .fs-content banners kept above are the SERVER's notices (notices.ut) and legitimately outlive a
 * page; these are not the same thing. */
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
 * With the outgoing page left on screen until the incoming one is ready, a cold route would
 * otherwise look like a click that did nothing: the chrome switches instantly (title, URL, menu),
 * the content does not move for as long as the module and its first RPC take. The spinner this
 * replaced was worse — it threw the page away to say the same thing — but silence is not the
 * answer either.
 *
 * A hairline at the top of the content, shown only when the navigation OUTLIVES `PROGRESS_DELAY`.
 * Below that threshold a bar would flash on and off on every warm click, which reads as a glitch
 * rather than as progress; above it, it is the browser's own affordance for exactly this. The
 * counter is what makes overlapping navigations share one bar. Reduced motion is handled in CSS,
 * where the transitions live. */
const PROGRESS_DELAY = 150;
let _progressPending = 0;
let _progressTimer = 0;
function progressBar() {
	let bar = document.getElementById('fs-nav-progress');
	if (!bar) {
		bar = document.createElement('div');
		bar.id = 'fs-nav-progress';
		/* it says nothing a screen reader needs: the live region already announces the page, and a
		 * decorative bar in the accessibility tree is noise on every navigation */
		bar.setAttribute('aria-hidden', 'true');
		/* ON <body>, not in the content column: it is `position: fixed`, and `.fs-shell` carries
		 * `contain: paint` in the sidebar layout, which would make it position against the shell and
		 * clip it. Inside `.fs-main` — a column flex container — its 2px were shrunk to zero
		 * outright. Both measured; see styles/theme/20-shell.css. */
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

	/* The view on screen injected CSS that can repaint any page: this document is spent, and
	 * the only exit that leaves BOTH pages correct is a real navigation. See fs-sheets.js. */
	if (sheets.documentPoisoned()) return false;

	/* …and a document whose session has died is spent in the same way, for a different reason: the
	 * only page it can still render correctly is the login form, and only a real navigation gets
	 * there. See watchSession(). */
	if (_expired) return false;

	/* `segs` is what the user clicked, `rsegs` the leaf it resolves to; they differ for an
	 * alias/firstchild link, and a full load keeps BOTH — URL and pathinfo as requested,
	 * requestpath/dispatchpath/nodespec/title resolved. Mirror that split exactly, or an F5
	 * lands somewhere the click did not. */
	const res = tree.resolveSegs(segs);
	const node = res && res.node;
	const className = tree.viewClassFor(node);
	if (!className)
		return false;

	/* A PAGE WHOSE STYLESHEET ONLY THE SERVER CAN EMIT IS NOT OURS TO SWAP INTO.
	 *
	 * A menu.d node may name its own sheet (`"css": "view/foo/foo.css"`), and the server links it from
	 * <head> on a full load (partials/head.ut). Nothing here can: a swap replaces #view's children, it
	 * does not re-render a document, so reaching such a page by CLICK would show it with the app's CSS
	 * missing — while reaching the same page by URL or F5 showed it styled. One page, two appearances,
	 * decided by how the user got there.
	 *
	 * So decline, exactly as the poisoned-document bail above does: speed is traded for correctness,
	 * never the other way. The cost is one full load per ENTRY INTO A DOCUMENT that lacks the sheet,
	 * not one per page ever: head.ut emits the link for the DISPATCHED node only, so each full load
	 * starts a document carrying exactly one such sheet and discards what the previous one had
	 * gathered. Within that document the page is a swap from then on (fs-sheets.js owns the sheet and
	 * re-lights it per page) — but two `css`-bearing pages alternating are a full load every time, in
	 * both directions. That is the trade taken knowingly: an unstyled page is worse than a reload, and
	 * no in-tree node sets `css` today.
	 *
	 * Injecting the <link> here instead would work and is deliberately not done: it would put the theme
	 * in charge of fetching and ordering a foreign stylesheet, which is the job fs-sheets.js exists to
	 * keep out of the theme. The server already does it correctly.
	 *
	 * The QUESTION is fs-sheets.js's, not this module's: which sheets a document carries, and which of
	 * them a swap is about to delete, is the one thing that file knows — see documentCarries(). What is
	 * decided here is only what to do about the answer.
	 *
	 * `node.css` reaches the client because /admin/menu serves the dispatcher's own tree and ui.js's
	 * scrubMenu() only rewrites `satisfied`. On a luci-base that predates the `css` schema entry the
	 * property is dropped server-side, so this is simply never true there. */
	if (typeof node.css === 'string' && node.css !== '' && !sheets.documentCarries(node.css))
		return false;

	const rsegs = res.segs;

	/* from here on the navigation is committed */
	const gen = ++_navGen;
	/* THE SAVED OFFSET BELONGS TO THIS NAVIGATION, so it is taken out of the module slot here
	 * rather than read at the swap. Left in the slot it outlives its own navigation: Back sets it,
	 * a click supersedes that render before it commits, and the clicked page — a page the user
	 * never asked to be restored — is scrolled to the Back target's offset, under a generation that
	 * passes because it is the newer one's. Clearing it on the superseded path is not the answer
	 * either: a second popstate may legitimately have put ITS offset there by then. Reported in
	 * review. */
	const restoreTo = _pendingRestore;
	_pendingRestore = null;
	_curPath = pathname;	/* what is on screen from now on — read by the popstate handler */

	const contentHost = document.querySelector('.fs-content');
	if (!contentHost) return false;

	/* the page being LEFT, captured before L.env is re-pointed a few lines down: the sheet scoping
	 * spares it until the swap takes it off screen (see there) */
	const leaving = (L.env.dispatchpath || []).slice();

	/* the outgoing page's links are about to become a detached tree — do not hold one of them */
	_lastHovered = null;
	/* run every registered navigation callback — today the search palette's recent-pages record and
	 * its close-on-navigate. The seam is deliberately inverted: a registrant calls onNavigate()
	 * (below) and the router names nobody, so an optional module that is not installed is not a
	 * DependencyError that takes out the whole chrome.
	 *
	 * The RESOLVED segments are passed in, and that is not convenience: this runs BEFORE L.env is
	 * re-pointed a few lines down, so a callback reading L.env.dispatchpath for "where are we going"
	 * would silently record the page being left. */
	/* Logged, not swallowed. A registrant that throws is still isolated — the loop must finish, or a
	 * broken registrant would take the palette's recents and its close-on-navigate with it — but the
	 * empty catch made a registrant that throws on EVERY navigation indistinguishable from one that
	 * was never registered, which is the failure mode the .catch at the bottom of this file was
	 * given a console.error for. */
	for (const fn of _navCbs) {
		try { fn(rsegs); }
		catch (e) { console.error('footstrap: a navigation callback threw', e); }
	}
	/* ui hard-requires into this module and ui.js defines hideModal unconditionally, so there is no
	 * feature to test; what is caught is a modal's own teardown throwing, which must not take the
	 * navigation with it. Reported, not swallowed — the same rule as the loop above. */
	try { ui.hideModal(); }
	catch (e) { console.error('footstrap: hideModal threw during a navigation', e); }

	/* point the runtime env at the new node so views, tabs and highlighting read the right
	 * path. For a fully-matched leaf, request == dispatch path. */
	L.env.requestpath  = rsegs.slice();
	L.env.dispatchpath = rsegs.slice();
	L.env.pathinfo     = '/' + segs.join('/');
	/* `readonly` is not decoration: luci.js implements hasViewPermission() as
	 * `!env.nodespec.readonly`, and views (network/interfaces, wireless, the package manager)
	 * plus luci.js's Save/Apply footer key their disabled state off it. Dropping it handed a
	 * read-only user LIVE Save/Apply buttons on an SPA nav, where a full load disabled them —
	 * and reading it off the LEAF was still dropping it for two thirds of the readonly pages,
	 * because the dispatcher folds the acls of the whole path into that one flag. See
	 * fs-menutree's readonlyForSegs(). */
	L.env.nodespec     = { satisfied: true, action: node.action, title: node.title,
	                       depends: node.depends, readonly: tree.readonlyForSegs(rsegs) };

	/* Re-navigating to the page already on screen must REPLACE its history entry, not push a
	 * second one. Clicking the active menu item is ordinary, and a duplicate entry makes Back do
	 * nothing: popstate fires, `location.pathname === _curPath`, and the fragment guard below
	 * correctly returns — one dead Back press per stray click. A full load has no such trap. */
	if (push) {
		const same = pathname === window.location.pathname;
		/* a NEW entry gets a new id; re-navigating in place keeps the entry and therefore its id
		 * (seed() adopted one before wire() made this function reachable, so there is always one) */
		if (!same) _curId = newEntryId();
		history[same ? 'replaceState' : 'pushState']({ fsnav: true, fsid: _curId }, '', pathname);
	}

	/* titles: <host> | <page> */
	document.title = node.title ? (titleHost() + ' | ' + _(node.title)) : titleHost();
	const tmain = document.querySelector('.fs-title-main');
	if (tmain && node.title)
		tmain.textContent = _(node.title);

	chrome.renderChrome();

	/* a full load starts at the top; the in-place swap must too, or navigating away from a long
	 * page opens the next one mid-scroll. In the desktop sidebar layout the window does NOT scroll —
	 * .fs-shell is exactly 100dvh with overflow:hidden and .fs-main owns overflow-y, so the sidebar
	 * can be static rather than a composited sticky layer (issue #7) — so reset it too; scrollTo on
	 * whichever of the two is not the scroller is a harmless no-op.
	 *
	 * A popstate replay resets nothing on purpose: BOTH scrollers are restored there from _scrollMem —
	 * see restoreScroll(). scrollRestoration is left at 'auto': the UA's own attempt lands before the
	 * swap and is undone by it (see restoreScroll above), so it neither helps nor hurts, and 'manual' would only take away
	 * the case that does work — a genuine full load. */
	if (push) {
		/* BEFORE the two writes, and the order is the point: fs-fit keeps the offset the reader was
		 * last still at, so it can tell an engine's clamp from a reader who moved. This reset is
		 * neither, and it lands a whole require ahead of the `data-page` stamp fs-fit would otherwise
		 * notice it by — so a poll tick from the page being left would read the reset as a clamp and
		 * put the reader back on it. Told rather than inferred. */
		fit.forgetRest();
		window.scrollTo(0, 0);
		const sc = document.getElementById('maincontent');
		if (sc) sc.scrollTo(0, 0);
	}

	/* ---- what a full load does for a keyboard/screen-reader user, and the SPA did not ----
	 * renderChrome() has just done `#topmenu.innerHTML = ''`, so the very <a> the user activated with
	 * Enter no longer exists: focus falls back to <body>, the next Tab restarts at the skip link, and
	 * nothing says the page changed — URL, title and #view all moved in silence. So do what a real
	 * navigation would, and where matters (Sutton's five-prototype study, docs/spa-router.md,
	 * "Accessibility of a route change"): a KEYBOARD
	 * activation (ev.detail === 0) moves focus to the skip link — a small target whose :focus overlay
	 * tells a sighted keyboard user where they are, with Enter jumping straight to the content; its
	 * text differs from the live region's announcement below, so the double announcement complements
	 * rather than repeats. A pointer activation (and a popstate replay, whose modality is unknowable)
	 * keeps the wrapper focus: focusing the skip link there would flash its overlay on every mouse
	 * click. <main> keeps tabindex="-1" and its outline-less :focus for exactly that path.
	 * preventScroll because the scroll position is decided just above — focus() would otherwise drag
	 * a popstate replay back to the top and undo the restoration. */
	const skip = kbd ? document.querySelector('.fs-skip') : null;
	const main = skip || document.getElementById('maincontent');
	if (main) main.focus({ preventScroll: true });
	const live = document.getElementById('fs-nav-status');
	if (live) live.textContent = node.title ? _(node.title) : '';

	/* Require through the runtime singleton `window.L`, NOT the bare `L` a module factory is handed:
	 * the dispatcher builds `window.L = new LuCI()` and `ui` augments THAT instance with
	 * itemlist/showModal/…, so a view required via the bare `L` throws "L.itemlist is not a
	 * function" mid-render (the two-L trap, docs/spa-router.md). require/instanceof errors fall back to a real
	 * navigation; render-time errors are handled inside LuCI.view, as on a full load.
	 *
	 * WHEN to re-instantiate is the subtle part. require() does not hand back a class — it caches an
	 * INSTANCE, so requiring a class not seen before CONSTRUCTS it, and a view's __init__ IS its
	 * render. On a first visit the require has therefore already painted the page, and a
	 * `new view.constructor()` after it painted a SECOND time — two renders, two pollers, double
	 * RPCs for as long as the user stayed. Only on a REVISIT does require() return the cached
	 * singleton whose __init__ already ran. `_seen` is that distinction, and it must be read BEFORE
	 * the require resolves, since the require is what fills LuCI's cache. */
	/* Status→Overview needs the 3 template globals (progressbar/renderBox/renderBadge) an SPA
	 * arrival never defines. `menu-footstrap-common.js` defines them at its own module eval, which
	 * every page performs before this router exists — the one page module that could have carried
	 * them (fs-overview) now loads DURING the navigation and would race this require. Not here
	 * either way: the router has no business owning luci-mod-status's globals. */
	const RT = window.L;
	const cached = _seen.has(className);
	/* WAIT for an in-flight prefetch of this class rather than racing it. Two requests for the same
	 * URL do not coalesce, so a click landing before the prefetch does downloads the module TWICE,
	 * both at full latency, and gains nothing — measured at 120 ms RTT: the prefetch ran 2664→2788 ms
	 * and the require's XHR 2682→2788 ms for the same 8.6 KB. That is the NORMAL case on a touch
	 * device, where pointerover fires the same moment as the tap. Waiting costs nothing: the XHR
	 * would have waited for exactly those bytes.
	 *
	 * `_seen` is marked here and not before, because it means "this class has been through require()"
	 * and the wait introduces a window in which we may never get there. Marking it up front would
	 * make the NEXT navigation take the cached branch — `new view.constructor()` on a class whose
	 * require() is what renders it — i.e. two renders and two pollers for one page. */
	/* THE PREVIOUS RENDER IS WAITED FOR, not raced. Every LuCI view chain resolves `#view` at PAINT
	 * time, so a chain still running from an older navigation would paint into whatever stage is
	 * first when it finishes — i.e. into this one's. Waiting is what lets the stale chain land in
	 * its own stage, which is then dropped unswapped, and it is what retired the three repair
	 * mechanisms this file used to carry. The wait rides alongside the prefetch wait rather than
	 * after it: both are already in flight. */
	const previous = _inflight;
	let release;
	_inflight = new Promise((r) => { release = r; });
	progressStart();

	Promise.all([ warmedThen(className), previous.catch(() => {}) ]).then(() => {
		/* superseded while waiting: never start the require. On a first visit the require IS the
		 * render, so starting it here would spend a module fetch and a round of RPCs on a page the
		 * user has already left. */
		if (gen !== _navGen) return null;

		/* ---- teardown, now that the previous render is finished and cannot re-register ----
		 *
		 * Drop the outgoing view's pollers, then put the poll loop back into the state a FRESH LOAD
		 * leaves it in. The only non-view poller LuCI adds is the transient apply/reboot
		 * reachability check, so flushing the queue is safe.
		 *
		 * The re-arm matters: LuCI runs one 1 s tick and fires a queue entry only when
		 * `tick % interval == 0`, so leaving the OUTGOING page's tick running makes the incoming
		 * poller wait for the next multiple of its interval — up to `pollinterval`, 5 s. Wireless
		 * draws its station list from the first poll and sat spinning for 4950 ms against ~360 ms on
		 * a full load.
		 *
		 * stop() alone is NOT the fix: it deletes `tick`, and Poll.add() only auto-starts when
		 * `tick != null`, so the incoming pollers would never start at all. stop()+start() on an
		 * EMPTY queue leaves what a fresh document has (`tick = 0`, no timer armed); the view's first
		 * poll.add() then starts it and steps immediately — upstream's own sequence, since on a full
		 * load initDOM() runs Poll.start() on an empty queue before the view renders. */
		if (L.Poll && L.Poll.queue) {
			L.Poll.queue.length = 0;
			L.Poll.stop();
			L.Poll.start();
		}
		/* kill the outgoing view's plain setInterval pollers too (podkop's log tailer) — a full load
		 * would have. L.Poll's own tick survives. */
		clearViewIntervals();
		/* and drop uci's document-scoped config cache, which a full load would not have carried into
		 * the incoming page either (see flushUciCache). What it hands back is the refill of the
		 * packages network.js will never load again — awaited below, before the view renders. */
		const uciWarm = flushUciCache();

		/* Keep <body data-page> in sync with the route: the server stamps the dispatch path
		 * (`ctx.path`) on every full load, and page-scoped CSS keys off it. `rsegs` is the RESOLVED
		 * leaf, so a firstchild URL like /admin/status yields the same "admin-status-overview"
		 * whether it arrives as a full load or a client nav. Without the re-stamp the incoming page
		 * keeps the previous page's data-page and its scoped styles silently do not apply.
		 *
		 * WHERE THIS SITS, AND WHAT IT COSTS. It has to be before the staged render: page-scoped CSS
		 * is keyed on `body[data-page]`, so a view that renders under the wrong value measures itself
		 * through the wrong rules — and the fitters run inside the stage. It cannot be moved to the
		 * swap for the same reason. What that buys is a correct incoming page; what it costs is that
		 * the OUTGOING page, still on screen until the swap, wears the incoming page's name for the
		 * staging window. The one artifact that is visible today is the Overview's own
		 * `<h2 name="content">Status</h2>`, hidden by a `body[data-page='admin-status-overview']`
		 * rule and therefore un-hidden while leaving that page — the same stray heading the sweep at
		 * the swap removes. Moving the stamp later would trade that for a wrongly measured incoming
		 * page, which is worse and lasts longer. Reported in review; stated here rather than left as
		 * a claim the placement does not have. */
		document.body.setAttribute('data-page', rsegs.join('-'));

		/* …and hand the new page to fs-sheets, which darkens every foreign sheet that belongs to a
		 * DIFFERENT page and re-lights the ones that belong to this one. This is what lets an
		 * invasive sheet stay in the document without spending it — the alternative was a full load
		 * on the way out of any page carrying one, which stock LuCI's five realtime views all do (see
		 * the page-ownership block in fs-sheets.js). It must run AFTER the stamp above and BEFORE the
		 * view renders, so nothing paints through a sheet that no longer owns the page.
		 *
		 * IN TWO HALVES, because unlike `data-page` this one can be split. Enabling the incoming
		 * page's sheets is what the staged render needs; DISABLING the outgoing page's is what would
		 * strip an app's own stylesheet off the content the user is still reading — for the whole
		 * staging window, which on a cold route is the 600-1800 ms this design exists to fill. So the
		 * page being left is spared here and swept at the swap (see commitStage). Reported in
		 * review. */
		sheets.scopeToCurrentPage(rsegs, leaving);

		const stage = stageView(contentHost);
		const painted = renderedIn(stage.view);
		_seen.add(className);
		/* NAME THE OWNER for the length of this require, AND ONLY WHEN THE MODULE HAS YET TO BE
		 * EVALUATED. On a first visit the require IS the render, so any <style> the module injects
		 * belongs to THIS page. Without it fs-sheets credited such a sheet to whichever page was
		 * stamped when it landed and bound it there for the life of the document (measured:
		 * luci-app-filemanager's `.cbi-button-save { display: none !important }` disabled on its own
		 * page and live on System -> System, across return visits). A CACHED require injects nothing
		 * — the module was evaluated on the first visit and `require()` hands back the singleton — so
		 * it has no business naming an owner. */
		if (!cached) sheets.attributeTo(rsegs, gen);

		/* `uciWarm` is awaited before the construct, never after: a cached module resolves within a
		 * microtask, well before the refill lands, and the view would read the cache we just emptied.
		 * It never rejects — the refill catches its own failure — so it cannot cost a full reload. */
		return Promise.resolve(uciWarm)
			.then(() => RT.require(className))
			.finally(() => { if (!cached) sheets.attributeTo(null, gen); })
			.then((view) => {
				if (!(view instanceof RT.view))
					throw new TypeError('Loaded class ' + className + ' is not a view');
				/* require() does not hand back a class — it caches an INSTANCE, so requiring a class
				 * not seen before CONSTRUCTS it, and a view's __init__ IS its render. On a first
				 * visit the require has therefore already painted (into the stage); only on a REVISIT
				 * is there a singleton whose __init__ has to be re-run. `cached` was read before the
				 * waits above, since the require is what fills LuCI's cache. */
				if (cached) new view.constructor();
				return painted;
			})
			.then(() => {
				/* superseded while rendering: the chain painted into ITS OWN stage, so there is
				 * nothing to repair — drop it and leave the live page to the newer navigation. */
				if (gen !== _navGen) { dropStage(stage); return; }
				commitStage(stage, contentHost);
				/* now, and only now, is there one height to read: the incoming page's */
				if (restoreTo) restoreScroll(restoreTo, gen);
			})
			.catch((e) => { dropStage(stage); throw e; });
	}).catch((e) => {
		/* the full reload is a correct fallback, but swallowing the reason made every SPA-router
		 * regression look like "the page is just slow to load". Log, then fall back. */
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
 * the hover prefetch, which used to carry drifting copies of this filter. */
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

/* Warm the view module behind an event's link — ONE filter for all three prefetch triggers, and the
 * same one the click router applies two lines further down: navigate() pushes a bare path, so a link
 * carrying ?query or #hash full-loads, and warming its module spends a request on a page the SPA
 * path can never open. The click handler declined those from the start; the three triggers below had
 * each grown a copy of the URL test without that half. */
function prefetchFrom(ev) {
	const url = linkUrlFrom(ev);
	if (url && !url.search && !url.hash)
		prefetchView(url.pathname);
}

/* The last <a> a pointer crossed, kept only to stop `pointerover` re-firing per child span (see the
 * listener). Cleared on every navigation: an element holds its parent, so retaining one anchor
 * retains the whole detached tree the content swap has just thrown away — a small leak, but one that
 * lasts until the pointer happens to cross some other link. */
let _lastHovered = null;

/* ---- a document the router could not have rendered is not one it may navigate AWAY from ----
 *
 * A `call`, `cbi` or `function` node — and a `template` other than the one Status→Overview node we
 * serve — is a page this theme did not build and cannot rebuild. What it leaves behind is the
 * problem: such a page may carry inline scripts and timers of its own, set before this module was
 * even evaluated, so the interval hook at the top of this file never saw them and no teardown of
 * ours can retire them. Only the document's death does. So the first click away from one is a full
 * load, which is what a user got before the router existed.
 *
 * NARROWER THAN "did the current path resolve", deliberately. A path that resolves to nothing is
 * not evidence of a hostile document — a wildcard URL (`admin/network/wireless/radio0.network1`)
 * simply is not in the tree, since nodeForSegs() stops at the first unknown segment, and refusing to
 * wire there would turn the router off for the whole document on some of the most-used pages in
 * LuCI. Only a node we CAN see and CANNOT serve disables it.
 *
 * On the stands this is a no-op today and is written for the case it is not: of 243 menu nodes,
 * the 110 `call` and 8 `function` ones answer with JSON or a redirect and never render this theme
 * at all (a probe on those URLs finds no `L` in the document), and the single `template` node is
 * the Overview, which viewClassFor() maps to `view.status.index`. */
function bootDocumentIsOurs() {
	const node = tree.currentNode();
	if (!node || !node.action)
		return true;	/* unknown to the tree: a wildcard page, and today's behaviour is right */
	return tree.viewClassFor(node) != null;
}

/* ---- the boot contract: the luci-base surfaces this router CALLS, looked up before it wires ----
 *
 * Every module here is written against somebody else's code, and against parts of it that were never
 * an API: `L.Poll` is a deprecated alias, `L.dom.content` and `ui.instantiateView` are what `view.ut`
 * happens to use, `Request.addInterceptor` is how the session probe hears a 403. None of those is a
 * promise anyone made. tools/upstream-contract.mjs asks whether they still BEHAVE as assumed, which
 * is the deeper question — but it only ever runs here, against the two userlands this repo owns. On
 * a router carrying a luci-base that MOVED (a fork, a backport, a distribution that trims luci.js),
 * the first anyone learns of it is a click that opens nothing: the interception ran, the swap threw
 * halfway, and the user is left on a page the theme half tore down.
 *
 * So: existence is checked at boot, once, and a missing name turns the router OFF rather than on-and-
 * broken. The page is then the plain server-dispatched MPA the theme was before the router existed —
 * every link a full load, nothing else lost, and the console says WHICH name is gone so the report
 * that reaches this repo names it too.
 *
 * Deliberately existence-only. A probe that called these to see what they answer would have to run
 * them for effect (there is no dry `instantiateView`), and a boot check that navigates is worse than
 * the fault it looks for. Semantics stay in the live gate, which is why both files point at each
 * other.
 *
 * The list is what THIS file calls, and nothing else: `uci` (flushUciCache) and `L.network` are read
 * through their own guards a few lines from their use, because they are optional there — a document
 * that never loaded network.js has nothing to refill. */
const CONTRACT = [
	[ 'L.require', () => typeof window.L.require === 'function' ],
	/* classLoaded() tests `instanceof L.Class` to tell a loaded module from L.env/L.url/L.get */
	[ 'L.Class', () => typeof window.L.Class === 'function' ],
	[ 'L.dom.content', () => window.L.dom && typeof window.L.dom.content === 'function' ],
	/* the four L.env keys navigate() RE-POINTS: a view reads them to know which page it is on */
	[ 'L.env.{base_url,dispatchpath,requestpath,pathinfo,nodespec}', () => {
		const env = window.L.env;
		return !!env && [ 'base_url', 'dispatchpath', 'requestpath', 'pathinfo', 'nodespec' ]
			.every((k) => k in env);
	} ],
	[ 'L.Poll.queue', () => window.L.Poll && Array.isArray(window.L.Poll.queue) ],
	[ 'L.Poll.start/stop', () => window.L.Poll &&
		typeof window.L.Poll.start === 'function' && typeof window.L.Poll.stop === 'function' ],
	[ 'L.Request.addInterceptor', () => window.L.Request &&
		typeof window.L.Request.addInterceptor === 'function' ],
	[ 'rpc.addInterceptor', () => typeof rpc.addInterceptor === 'function' ],
	[ 'ui.instantiateView', () => typeof ui.instantiateView === 'function' ],
	[ 'ui.hideModal', () => typeof ui.hideModal === 'function' ],
	[ 'ui.hideIndicator', () => typeof ui.hideIndicator === 'function' ],
	[ 'ui.addNotification', () => typeof ui.addNotification === 'function' ]
];

/* -> the names that are NOT there, in list order; empty means the document can be navigated.
 * A probe that throws counts as missing: `L` itself may be a shape nobody here expected. */
function contractBreaks() {
	return CONTRACT.filter(([ , present ]) => {
		try { return !present(); }
		catch (e) { return true; }
	}).map(([ name ]) => name);
}

function wireRouter() {
	if (_wired) return;
	_wired = true;

	const broken = contractBreaks();
	if (broken.length) {
		/* the URL, not a repository path: this package ships inside openwrt/luci as well, where a
		 * `docs/` directory does not exist — and this is the one line a stranger is asked to quote,
		 * on the branch where the theme has already switched half of itself off. */
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

		/* navigate() carries only the pathname: pushState-ing a bare path for a link that
		 * promised ?query= / #hash would strip both from the URL and from the view, which
		 * reads location.search. Let those links full-load. */
		if (url.search || url.hash) return;

		/* record the outgoing page's offset under the entry we are still ON; harmless when
		 * navigate() declines (a full load throws the whole Map away anyway) */
		saveScroll();
		if (navigate(url.pathname, true, ev.detail === 0))
			ev.preventDefault();
	}, false);

	/* Warm the view module cache when the pointer enters a nav link. `pointerover` bubbles from
	 * EVERY element the pointer crosses — dragging across the process table fires it hundreds of
	 * times — so bail on the element first: the same <a> re-fires this for every child span it
	 * contains, and a non-link target is the overwhelmingly common case. */
	document.addEventListener('pointerover', (ev) => {
		const a = ev.target.closest?.('a[href]');
		if (!a || a === _lastHovered) return;
		_lastHovered = a;
		prefetchFrom(ev);
	}, { passive: true });

	/* The pointer is not the only way a link gets chosen, and the other two ways got no prefetch at
	 * all. A KEYBOARD user Tabs to the link and presses Enter — no pointer event ever fires, so the
	 * whole optimisation was invisible to them; focusin is the keyboard's hover, and the Tab→Enter gap
	 * is human-scale, so the module is usually there by the time Enter lands. A TOUCH user gets a
	 * pointerover, but at the same moment as the tap, which is what the in-flight wait in navigate()
	 * is for rather than an earlier trigger. pointerdown adds the one pointer case pointerover cannot
	 * see: a link that scrolled UNDER a stationary pointer crosses no boundary and fires nothing.
	 * Neither needs the lastHovered guard above — they fire once per interaction, not per element
	 * crossed — and warmClass() dedupes per class anyway. */
	document.addEventListener('focusin', prefetchFrom, { passive: true });
	document.addEventListener('pointerdown', prefetchFrom, { passive: true });

	window.addEventListener('popstate', () => {
		/* an entry carrying a query belongs to a full load (we only ever push bare paths):
		 * replaying it as a bare-path SPA nav would drop the query the view expects */
		if (window.location.search) {
			window.location.reload();
			return;
		}

		/* A FRAGMENT CHANGE IS NOT A NAVIGATION. Chrome fires `popstate` for a same-document
		 * fragment nav, so clicking an `<a href="#">` inside a view — a very common idiom for
		 * in-page controls — arrived here as if the user had pressed Back, and we re-ran navigate()
		 * for the path already on screen, RE-INSTANTIATING the view and wiping the state the click
		 * had just set (issue #3, "luci-app-filemanager does not work": its tab strip is four
		 * `<a href="#">` links whose handler does not preventDefault). The view changed only if the
		 * PATH changed; if just the fragment moved, the page owns it. */
		if (window.location.pathname === _curPath)
			return;

		/* the outgoing DOM is still up: record its offset under the entry we are LEAVING, then
		 * adopt the entry we arrived on and look up what IT recorded when it was left */
		saveScroll();
		adoptEntry();
		/* Handed to navigate() rather than started here, and that is not tidiness — it is a bug the
		 * staged swap introduced and this is where it is fixed. restoreScroll() writes as soon as the
		 * scroller is TALL ENOUGH for the saved offset, and while the incoming page renders off
		 * screen the OUTGOING one is still on it, so the height that satisfies the test can be the
		 * old page's. Measured in the top layout: parked at 386, restored at 386 while Processes was
		 * still up, then the swap replaced it with a shorter page and the browser clamped to 197.
		 * Started after the commit instead, there is only one height it can be reading. */
		_pendingRestore = _scrollMem.get(_curId) || null;
		if (!navigate(window.location.pathname, false)) {
			_pendingRestore = null;
			window.location.reload();
		}
	});
}

/* ---- the poll indicator must not outlive the poll ----
 *
 * LuCI shows the "Refreshing" pill on `poll-start`, flips it to "Paused" on `poll-stop`, and never
 * hides it again (core calls ui.hideIndicator() only for `uci-changes`). Invisible on a full load,
 * because Poll.start() dispatches `poll-start` only when the queue is non-empty — an unpolled page
 * never grows a pill. But our router flushes the queue and calls stop() on every nav, and stop()
 * DOES dispatch `poll-stop`, so walking from a polled page to an unpolled one left a "Paused" pill
 * reporting on a poll that does not exist there. Rule: the pill exists iff there is something to
 * poll. Registered at module eval, i.e. AFTER luci.js's own listener, so ours runs second and can
 * take back what that one just painted. */
document.addEventListener('poll-stop', () => {
	if (L.Poll && L.Poll.queue && L.Poll.queue.length === 0) {
		try { ui.hideIndicator('poll-status'); }
		catch (e) { console.error('footstrap: hideIndicator threw on poll-stop', e); }
	}
});

/* At module eval, like the listener above and for the same reason: the session can die during the
 * FIRST view's own data calls, i.e. before anything has called wire(), and an interceptor that was
 * not registered by then never sees the answer that said so. */
watchSession();

/* Pause LuCI's 1s poll loop while the tab is hidden: LuCI has no visibilitychange handler, so an
 * overview left open in a background tab hammers ubus 24/7 (notably the pricey iwinfo getAssocList)
 * on a low-power router. stop() only clearInterval()s (the queue survives); start() re-arms and runs
 * one immediate step(), so data is fresh on refocus. A poller added while hidden will not auto-start
 * (stop() deletes the tick) — start() picks it up on show: deferred, not lost. docs/spa-router.md. */
let _visWired = false;
function wireVisibility() {
	if (_visWired) return;
	_visWired = true;
	/* respect a manual pause: the user can stop polling from the "Refreshing" indicator, and an
	 * unconditional start() on tab-show would silently undo it. Resume only what we paused. */
	let wasActive = true;
	document.addEventListener('visibilitychange', () => {
		if (!L.Poll) return;
		try {
			if (document.hidden) {
				wasActive = L.Poll.active();
				if (wasActive) L.Poll.stop();
			}
			/* …but never resume a poll the session can no longer answer: luci-base stopped it on
			 * purpose when it put its "Session expired" modal up, and restarting it on tab-show
			 * would spend a burst of failing calls behind a page the user cannot use anyway. */
			else if (wasActive && !_expired) {
				L.Poll.start();
			}
		} catch (e) { console.error('footstrap: the poll pause/resume threw', e); }
	});
}

/* Callbacks to run on every SPA navigation, each handed the resolved segments of the INCOMING page
 * (see navigate() — they run before L.env is re-pointed). The registry is INVERTED on purpose: a
 * registrant calls in and the router names nobody, so it can never grow a static dependency on a
 * module that may not be installed. Registrant today: fs-search's recent-pages record and its
 * close-on-navigate. */
const _navCbs = [];
function onNavigate(fn) { if (typeof fn === 'function') _navCbs.push(fn); }

return baseclass.extend({
	seed,
	wire: wireRouter,
	wireVisibility,
	onNavigate,
	/* exported for the unit suite in the theme's own repository (tests/router-contract.test.mjs —
	 * it is not part of the package, which ships no tests), where it is driven against a
	 * hand-broken `L`: the one way to see the OFF branch without a router that ships one */
	/* likewise, and likewise out-of-package: interval-pause.test.mjs drives the navigation sweep
	 * around a visibilitychange and session-expiry.test.mjs reads the verdict the interceptors
	 * reached. navigate() is the real caller of the first and `_expired` gates the second — nothing
	 * else may call either. */
	/* fs-search warms the pages this admin actually uses (its recents) and the arrow-key-highlighted
	 * result, both of which the pointer/focus triggers above cannot see. The edge points that way
	 * round — search → router — because the router must keep no dependency on the palette. */
	prefetchSegs
});
