'use strict';
'require baseclass';
'require ui';
'require fs-menutree as tree';
'require fs-chrome as chrome';
'require fs-sheets as sheets';

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
 * this document with its CSS?" half in fs-sheets.js. */

/* --- stray-interval teardown for SPA nav ---
 * A full load kills every window.setInterval the outgoing page set; SPA nav does not, so a view's
 * poller keeps firing against a page that is gone (luci-app-podkop's log tailer runs
 * `podkop check_logs` forever after you navigate away). Track view-set ids and clear them on nav,
 * keeping L.Poll's own 1s tick (also a setInterval); L.Poll's queue is flushed in navigate().
 * Hooked at module eval — before any view render can set a timer, and LuCI resolves a module's
 * dependencies BEFORE running the dependent's factory, so this runs no later than it used to when
 * it sat in menu-footstrap-common.js itself. */
const _viewIntervals = (window.__fsViewIntervals || (window.__fsViewIntervals = new Set()));
(function hookIntervals() {
	if (window.__fsIntervalsHooked) return;
	window.__fsIntervalsHooked = true;
	const _si = window.setInterval, _ci = window.clearInterval;
	window.setInterval = function () {
		const id = _si.apply(window, arguments);
		_viewIntervals.add(id);
		return id;
	};
	window.clearInterval = function (id) {
		_viewIntervals.delete(id);
		return _ci.apply(window, arguments);
	};
})();
function clearViewIntervals() {
	const keep = (L.Poll && L.Poll.timer) || null;
	_viewIntervals.forEach((id) => { if (id !== keep) window.clearInterval(id); });
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
 * (docs/spa-router.md §2): Back opened the incoming page at 0, because the swap empties #view,
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
 * much height (docs/spa-router.md §5: restoring before the content exists is clamped to 0 and reads as
 * "worked"). The view renders behind an RPC, so poll by frame; a newer navigation cancels via the
 * generation, and a page that never reaches the old height again is simply left at the top. Each
 * offset is waited for on its OWN scroller, so a layout switched between the two entries restores
 * whichever half it can rather than blocking on the half that no longer scrolls. */
function restoreScroll(pos, gen) {
	if (!pos || (!pos.win && !pos.main)) return;
	let tries = 300; /* ~5 s at 60 fps — outlasts a slow RPC without polling forever */
	(function tick() {
		if (gen !== _navGen || --tries < 0) return;
		const de = document.documentElement;
		const sc = document.getElementById('maincontent');
		let pending = false;
		if (pos.main) {
			if (sc && sc.scrollHeight - sc.clientHeight >= pos.main) sc.scrollTop = pos.main;
			else pending = true;
		}
		if (pos.win) {
			if (de.scrollHeight - de.clientHeight >= pos.win) window.scrollTo(0, pos.win);
			else pending = true;
		}
		if (pending) requestAnimationFrame(tick);
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

/* The view class the page CURRENTLY on screen wants (what _curPath resolves to). Read by the
 * stale-render repair below to tell "the superseded render happened to paint the right view
 * anyway" from "it painted the wrong one". */
function currentViewClass() {
	const segs = tree.segsFromPath(_curPath);
	const res = segs && tree.resolveSegs(segs);
	return tree.viewClassFor(res && res.node);
}

/* ---- a superseded FIRST render cannot be cancelled, so undo it ----
 *
 * _navGen stops a stale require() from calling `new view.constructor()` — but only on the CACHED
 * path. On a FIRST visit the require() IS the render (see navigate()): it constructs the view, whose
 * __init__ runs load() → render() → dom.content(#view) and registers its pollers, inside a promise
 * we do not own. Nothing to cancel.
 *
 * So the fast double-click is a real bug: click Firewall (uncached), click Wireless 100 ms later.
 * navigate(Wireless) flushes L.Poll's queue BEFORE Firewall's poller is added; Firewall then paints
 * into the #view that now belongs to Wireless and registers a poller the flush can no longer catch —
 * leaving Wireless's URL/title/menu/data-page, Firewall's content, and Firewall's poller running on
 * every page afterwards.
 *
 * Repair by re-running the current navigation: navigate() is exactly the "put the document back the
 * way a fresh load leaves it" routine. push=false — the URL never moved, only the DOM under it; if
 * it declines (the superseded view injected CSS), the reload does it the hard way. The className
 * check terminates this: if the superseded render painted the class the current path wants anyway
 * (A → B → A while A was still loading), the DOM and its poller are correct — and with two uncached
 * views racing it is also what stops a repair triggering a repair. */
function repairStaleRender(className) {
	if (className === currentViewClass())
		return;
	console.warn('footstrap: a superseded view (' + className + ') rendered into the live page; re-rendering ' + _curPath);
	if (!navigate(_curPath, false))
		window.location.reload();
}

/* ---- the generation must be checked at the PAINT, not at the dispatch ----
 *
 * _navGen is checked once, in the require() callback, i.e. BEFORE `new view.constructor()`. But a
 * view's __init__ is async — `ready.then(this.load).then(this.render).then(nodes =>
 * dom.content(document.getElementById('view'), nodes))` — so the DOM write happens two awaits later,
 * and every await is a point at which the whole event loop runs, another navigation included. The
 * dispatch-time check has expired by the time it matters.
 *
 * Measured on the router: leave the (cached) package manager for System after 150 ms, and the paints
 * into #view land 16010 System, 16490 package-manager — the view we walked away from paints LAST and
 * wins, permanently. URL, <title>, data-page and the menu highlight all say System; #view shows
 * Software. Only a reload clears it. The cached path is the COMMON one — after warm-up every
 * navigation takes it — and it had no guard at all: repairStaleRender() is called only when !cached.
 *
 * The fix has to be a paint-time check, and there are two constraints on where it can live.
 * ClassConstructor DISCARDS __init__'s return value (`this.__init__.apply(this, arguments)`, no
 * return), so the construction promise is unreachable — nothing to await. But __init__ resolves
 * `this.render` while it builds its chain, i.e. during `new`, so a wrapper installed on the
 * prototype BEFORE the construct is the one that gets bound. `new` then returns synchronously (the
 * first load() is already a microtask), which is what makes stamping the generation on the INSTANCE
 * right after it safe — and it must be the instance, not a map keyed by class name, or A → B → A
 * with everything cached would have the second construct's generation overwrite the first's.
 *
 * A superseded render resolves to a promise that never settles: the chain simply stops before
 * dom.content(), so nothing paints and addFooter() never runs. Returning empty nodes instead would
 * paint the emptiness over the live page, and throwing would hand LuCI's own .catch an error box to
 * render into the page we just opened.
 *
 * A view instance we did not construct (the singleton require() builds on a FIRST visit — the render
 * IS the require, so there is no window in which to arm anything) carries no stamp and is left alone:
 * that path is repairStaleRender()'s, and stays its. */
const _guarded = new WeakSet();
function armRenderGuard(cls) {
	if (_guarded.has(cls)) return;
	_guarded.add(cls);
	const orig = cls.prototype.render;
	cls.prototype.render = function () {
		/* unstamped: not ours to judge (see above) */
		const stale = () => this.__fsGen !== undefined && this.__fsGen !== _navGen;
		if (stale())
			return new Promise(() => {});
		return Promise.resolve(orig.apply(this, arguments)).then((nodes) => {
			/* re-check: render() itself awaits (an RPC, usually), which re-opens the window */
			return stale() ? new Promise(() => {}) : nodes;
		});
	};
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

/* SIX CLASS NAMES HAVE NO FILE, and fetching one is a guaranteed 404 in the user's console. luci.js
 * seeds its class registry with them at load — `const classes = { baseclass: Class, dom: DOM,
 * poll: Poll, request: Request, session: Session, view: View }` — so require() answers them from
 * memory and never asks the network, while `ls /www/luci-static/resources` has no baseclass.js,
 * dom.js, poll.js, request.js or session.js at all. Every view file's pragmas name `view` and
 * `baseclass`, so a dependency walk hits this on its very first step: measured, warming the recents
 * at idle put 404s for view.js and poll.js in the console of every page load, and the first hover
 * added baseclass.js. A require() that 404s is noise this theme refuses to make, and the same
 * standard applies here.
 *
 * A future LuCI adding a seventh built-in would cost one 404 per session — `_prefetched` makes it
 * at most one — and the list is a literal from luci.js, not a guess about it. */
const BUILTIN_CLASSES = new Set([ 'baseclass', 'dom', 'poll', 'request', 'session', 'view' ]);

/* Is this class already instantiated? require() attaches its singleton to the LuCI prototype
 * (`ptr[parts[idx]] = instance`), so a SINGLE-segment name reads back as L[name] — which covers the
 * libs a loaded page has already pulled in (ui, form, uci, rpc, fs, validation, and network/firewall
 * once some network page has been open). Skipping them spends no request on a cache hit nobody needs.
 * `instanceof L.Class` rather than a truthiness test: L.env, L.url and L.get are members too, and a
 * dep whose name collided with one of those would otherwise be skipped without ever being loaded —
 * which is why this cannot be the guard for the six above either: they are seeded as CONSTRUCTORS
 * (and under other names — L.Poll, L.Request, L.Class), so no `instanceof` probe sees them. A DOTTED
 * name (tools.network) is not attached unless its parent already exists, so it is simply fetched —
 * and those are the ones the win comes from. */
function classLoaded(name) {
	if (BUILTIN_CLASSES.has(name)) return true;
	try { return name.indexOf('.') < 0 && window.L[name] instanceof window.L.Class; }
	catch (e) { return false; }
}

/* view classes already required, i.e. the ones LuCI has an instance cached for. A class NOT in
 * here is rendered by the require() itself (see navigate). */
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

	/* `segs` is what the user clicked, `rsegs` the leaf it resolves to; they differ for an
	 * alias/firstchild link, and a full load keeps BOTH — URL and pathinfo as requested,
	 * requestpath/dispatchpath/nodespec/title resolved. Mirror that split exactly, or an F5
	 * lands somewhere the click did not. */
	const res = tree.resolveSegs(segs);
	const node = res && res.node;
	const className = tree.viewClassFor(node);
	if (!className)
		return false;
	const rsegs = res.segs;

	/* from here on the navigation is committed */
	const gen = ++_navGen;
	_curPath = pathname;	/* what is on screen from now on — read by the popstate handler */

	/* Ensure a #view, and clear what the OUTGOING page left as a SIBLING of #view inside .fs-content:
	 * dom.content() replaces only #view's OWN children, so anything a page emitted next to it rides
	 * along — the Status→Overview template emits <h2 name="content">Status</h2> there, hidden only
	 * by a body[data-page='admin-status-overview'] rule, so after an SPA nav the orphan showed on
	 * EVERY page until a full reload. Keep only the chrome that legitimately outlives a page (tabs,
	 * server notices, <noscript>); this also gives a template page that emits no #view a fresh one. */
	const contentHost = document.querySelector('.fs-content');
	if (!contentHost) return false;
	Array.from(contentHost.children).forEach((c) => {
		if (c.id !== 'view' && c.id !== 'tabmenu' &&
		    !c.classList.contains('alert-message') && c.nodeName !== 'NOSCRIPT')
			c.remove();
	});
	/* …and the RUNTIME notifications, which live one level up and therefore survived every
	 * navigation. `ui.addNotification()` does `mc.insertBefore(msg, mc.firstElementChild)` on
	 * #maincontent — this theme's <main class="fs-main"> — while the sweep above only reaches
	 * children of .fs-content, a descendant of it. A full load clears them; SPA never did, so
	 * "Upload request failed" and every third-party banner stacked up over each following page for
	 * the rest of the session (reproduced: the banner outlives a nav, and only F5 removes it).
	 * The .fs-content banners kept above are the SERVER's notices (notices.ut) and legitimately
	 * outlive a page; these are not the same thing. */
	const mainHost = document.getElementById('maincontent');
	if (mainHost)
		Array.from(mainHost.children).forEach((c) => {
			if (c.classList.contains('alert-message')) c.remove();
		});
	if (!document.getElementById('view')) {
		const v = document.createElement('div');
		v.id = 'view';
		contentHost.appendChild(v);
	}

	/* SAY THAT SOMETHING IS LOADING, on a route whose module has never been fetched.
	 *
	 * The chrome switches instantly — title, URL, body[data-page], the menu highlight — but the
	 * sweep above deliberately does not touch the children of #view, and LuCI's own spinner is
	 * written by `View.__init__`, i.e. only once the view module has ARRIVED. So between the click
	 * and the last round-trip of the module chain the user reads the PREVIOUS page's content under
	 * the new page's title, with nothing moving. Measured on the router at 600 ms latency: at 150 ms
	 * and 400 ms #view still held the System page while everything else said Processes; the
	 * "Loading view…" spinner appeared at 900 ms and the content at 1800 ms. A full load would have
	 * shown the browser's own progress for that whole window.
	 *
	 * Only for a COLD route: `_seen` means the class has already been through require(), where
	 * View.__init__ paints its spinner synchronously and there is no gap to fill.
	 *
	 * Deliberately the SAME markup and the SAME msgid luci-base uses, not a skeleton of our own:
	 * when View.__init__ replaces it there is nothing to see, and the string arrives already
	 * translated in the ~40 languages this theme ships no catalogue for (the chrome rule — a
	 * context-free msgid is how we inherit luci-base's translation). */
	if (!_seen.has(tree.viewClassFor(node))) {
		const vp = document.getElementById('view');
		if (vp) {
			const s = document.createElement('div');
			s.className = 'spinning';
			s.textContent = _('Loading view…');
			vp.replaceChildren(s);
		}
	}

	/* teardown: drop the outgoing view's pollers, then put the poll loop back into the state a FRESH
	 * LOAD leaves it in. The only non-view poller LuCI adds is the transient apply/reboot
	 * reachability check, so flushing the queue is safe.
	 *
	 * The re-arm matters: LuCI runs one 1 s tick and fires a queue entry only when
	 * `tick % interval == 0`, so leaving the OUTGOING page's tick running makes the incoming poller
	 * wait for the next multiple of its interval — up to `pollinterval`, 5 s. Wireless draws its
	 * station list from the first poll and sat spinning for 4950 ms against ~360 ms on a full load.
	 *
	 * stop() alone is NOT the fix: it deletes `tick`, and Poll.add() only auto-starts when
	 * `tick != null`, so the incoming pollers would never start at all. stop()+start() on an EMPTY
	 * queue leaves what a fresh document has (`tick = 0`, no timer armed); the view's first
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
	try { if (typeof ui.hideModal === 'function') ui.hideModal(); } catch (e) {}

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

	/* Keep <body data-page> in sync with the route: the server stamps the dispatch path
	 * (`ctx.path`) on every full load, and page-scoped CSS keys off it. `rsegs` is the RESOLVED
	 * leaf, so a firstchild URL like /admin/status yields the same "admin-status-overview" whether
	 * it arrives as a full load or a client nav. Without the re-stamp the incoming page keeps the
	 * previous page's data-page and its scoped styles silently do not apply. */
	document.body.setAttribute('data-page', rsegs.join('-'));

	/* …and immediately hand the new page to fs-sheets, which darkens every foreign sheet that
	 * belongs to a DIFFERENT page and re-lights the ones that belong to this one. This is what lets
	 * an invasive sheet stay in the document without spending it — the alternative was a full load
	 * on the way out of any page carrying one, which stock LuCI's five realtime views all do (see
	 * the page-ownership block in fs-sheets.js). It must run AFTER the stamp above and BEFORE the
	 * view renders, so nothing paints through a sheet that no longer owns the page. */
	sheets.scopeToCurrentPage(rsegs);

	/* Re-navigating to the page already on screen must REPLACE its history entry, not push a
	 * second one. Clicking the active menu item is ordinary, and a duplicate entry makes Back do
	 * nothing: popstate fires, `location.pathname === _curPath`, and the fragment guard below
	 * correctly returns — one dead Back press per stray click. A full load has no such trap. */
	if (push) {
		const same = pathname === window.location.pathname;
		if (_curId == null) _curId = newEntryId();
		/* a NEW entry gets a new id; re-navigating in place keeps the entry and therefore its id */
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
	 * swap and is undone by it (§2), so it neither helps nor hurts, and 'manual' would only take away
	 * the case that does work — a genuine full load. */
	if (push) {
		window.scrollTo(0, 0);
		const sc = document.getElementById('maincontent');
		if (sc) sc.scrollTo(0, 0);
	}

	/* ---- what a full load does for a keyboard/screen-reader user, and the SPA did not ----
	 * renderChrome() has just done `#topmenu.innerHTML = ''`, so the very <a> the user activated with
	 * Enter no longer exists: focus falls back to <body>, the next Tab restarts at the skip link, and
	 * nothing says the page changed — URL, title and #view all moved in silence. So do what a real
	 * navigation would, and where matters (Sutton's five-prototype study, docs/spa-router.md §3): a KEYBOARD
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
	 * arrival never defines. fs-overview.js defines them at its own module eval — which, as a
	 * chrome module, happens at chrome init, i.e. before any SPA navigation can occur. Not here:
	 * the router has no business owning luci-mod-status's globals. */
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
	warmedThen(className).then(() => {
		/* superseded while waiting: never start the require. On a first visit the require IS the
		 * render, so starting it here would paint a page the user has already left and hand
		 * repairStaleRender() a mess that only exists because a require in flight cannot be stopped. */
		if (gen !== _navGen) return null;
		_seen.add(className);
		return RT.require(className);
	}).then((view) => {
		if (view == null) return;
		if (!(view instanceof RT.view))
			throw new TypeError('Loaded class ' + className + ' is not a view');
		if (gen !== _navGen) {
			/* A newer navigation superseded this one. On the CACHED path nothing has happened
			 * yet — skipping the constructor below is the whole cancellation. On the FIRST-visit
			 * path the require() has ALREADY rendered into the live page and registered its
			 * pollers, with nothing to cancel: undo it. See repairStaleRender(). */
			if (!cached)
				repairStaleRender(className);
			return;
		}
		if (cached) {
			/* singleton: its __init__ already ran, re-run it. Arm the paint-time guard BEFORE the
			 * construct (__init__ binds this.render as it builds its chain) and stamp the
			 * generation right after it (the first load() is a microtask, so this lands first) —
			 * this navigation can still be superseded while that render awaits its RPC. */
			const cls = view.constructor;
			armRenderGuard(cls);
			const inst = new cls();
			inst.__fsGen = gen;
		}
	}).catch((e) => {
		/* the full reload is a correct fallback, but swallowing the reason made every SPA-router
		 * regression look like "the page is just slow to load". Log, then fall back. */
		console.error('footstrap: SPA nav to ' + className + ' failed, falling back to a full load', e);
		if (gen === _navGen) window.location = pathname;
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

function wireRouter() {
	if (_wired) return;
	_wired = true;

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
		const target = _scrollMem.get(_curId);
		if (!navigate(window.location.pathname, false))
			window.location.reload();
		else
			restoreScroll(target, _navGen);
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
		try { ui.hideIndicator('poll-status'); } catch (e) {}
	}
});

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
			else if (wasActive) {
				L.Poll.start();
			}
		} catch (e) {}
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
	/* fs-search warms the pages this admin actually uses (its recents) and the arrow-key-highlighted
	 * result, both of which the pointer/focus triggers above cannot see. The edge points that way
	 * round — search → router — because the router must keep no dependency on the palette. */
	prefetchSegs
});
