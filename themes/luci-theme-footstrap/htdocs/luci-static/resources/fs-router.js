'use strict';
'require baseclass';
'require ui';
'require rpc';
'require fs-menutree as tree';
'require fs-chrome as chrome';
'require fs-sheets as sheets';
'require fs-fit as fit';

/* The SPA client router. Re-instantiates a `view` node in place instead of a full reload (54 of 74
 * menu leaves on the dev router); anything else, a modified click or any error falls through to a
 * normal navigation. A revisit runs `new v.constructor()` on the cached singleton. Path->node:
 * fs-menutree.js; poisoned documents: fs-sheets.js. */

/* ---- stray-interval teardown ----
 * A full load kills every window.setInterval the outgoing page set; SPA nav does not, so view-set
 * ids are tracked and cleared per navigation. Hooked at module eval. */
const _viewIntervals = (window.__fsViewIntervals || (window.__fsViewIntervals = new Map()));
const _si = window.setInterval, _ci = window.clearInterval;
window.setInterval = function (fn, ms, ...rest) {
	const id = _si.apply(window, arguments);
	_viewIntervals.set(id, { fn, ms, rest, live: id });
	return id;
};
window.clearInterval = function (id) {
	const spec = _viewIntervals.get(id);
	_viewIntervals.delete(id);
	if (spec) return (spec.live == null) ? undefined : _ci.call(window, spec.live);
	return _ci.apply(window, arguments);
};
/* A hidden tab must not keep calling the router: view timers are disarmed on hide and re-armed on
 * show. A paused timer stays in the registry, so the navigation sweep still sees it. */
let _pollWasActive = false;
document.addEventListener('visibilitychange', () => {
	try {
		if (document.hidden) {
			/* remembered so a manual pause (the "Refreshing" indicator) is not undone on show */
			_pollWasActive = !!(L.Poll && L.Poll.active());
			if (_pollWasActive) L.Poll.stop();
			for (const spec of _viewIntervals.values()) {
				if (spec.live == null) continue;
				_ci.call(window, spec.live);
				spec.live = null;
			}
		}
		else {
			for (const spec of _viewIntervals.values()) {
				if (spec.live != null) continue;
				spec.live = _si.call(window, spec.fn, spec.ms, ...spec.rest);
			}
			/* never resume a poll the session can no longer answer (luci-base stopped it behind its modal) */
			if (_pollWasActive && !_expired) L.Poll.start();
		}
	} catch (e) { console.error('footstrap: the hidden-tab pause/resume threw', e); }
});
function clearViewIntervals() {
	/* Map, not Set: the key is the timer id and the value is what it takes to re-arm it */
	for (const id of [ ..._viewIntervals.keys() ]) window.clearInterval(id);
}
function hidePollIndicatorIfEmpty() {
	if (!(L.Poll && L.Poll.queue && L.Poll.queue.length === 0)) return;
	ui.hideIndicator('poll-status');
}

/* ---- uci cache teardown ----
 * uci.load() skips packages in its document-scoped cache, so a view reading it as an existence
 * check rendered "no config found" on the second SPA visit. Navigation drops the cache with
 * unload() via `window.L.uci` (the two-L trap); never rejects. */
function flushUciCache() {
	const uci = window.L.uci;
	if (!uci || typeof uci.unload !== 'function') return null;
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

	/* …and put back the three packages network.js reads but never reloads, or every consumer sees an
	 * empty config until F5. The refill costs one uci `get` (136 -> 159 ms median). */
	if (!window.L.network) return null;
	const refill = [ 'network', 'wireless', 'luci' ].filter((p) => names.indexOf(p) !== -1);
	if (!refill.length) return null;
	return uci.load(refill).catch((e) => {
		console.error('footstrap: reloading uci ' + refill.join(', ') + ' after a navigation failed', e);
	});
}
let _uciCacheWarned = false;

/* ---- a dead session ends the document ----
 * An expired session gets luci-base's modal, which reloads into the login form; navigating on would
 * dismiss it, so the router stops claiming navigations. Signals: a 403 with `X-LuCI-Login-Required:
 * yes`, and a rejected `session.access` probe; `access: false` is an ACL answer. Interceptors must
 * not throw. */
let _expired = false;
function markExpired() {
	if (_expired) return;
	_expired = true;
	console.warn('footstrap: the LuCI session is gone — every navigation from here is a full load.');
}
function markAlive() {
	if (!_expired) return;
	_expired = false;
	console.warn('footstrap: the LuCI session answers again — client navigation is back on.');
}
function watchSession() {
	const req = window.L.Request;
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
				if (msg.error && msg.error.code && msg.error.message) { markExpired(); return; }
				if (Array.isArray(msg.result) && msg.result[1] && msg.result[1].access === true)
					markAlive();
			}
			catch (e) { /* ditto */ }
		});
}

/* ---- throw an element away the way luci-base does ----
 * Only `dom.content()` deletes a `dom.registry` entry; a plain `remove()` keeps the element
 * reachable (83 entries after lap one and after lap three). The node itself is never reaped, so it
 * is first moved into a detached container. */
function discard(el) {
	const bin = document.createElement('div');
	bin.appendChild(el);
	window.L.dom.content(bin, null);
}

/* ---- a page that parks nodes on <body> makes the next navigation a full load ----
 * Some apps append nodes to document.body on every visit (one leaves 7). The recorder is
 * header.ut's first <body> <script>; this file only reads it. */

function strayBodyNode(el) {
	if (!el || el.nodeType !== 1) return false;
	/* never rendered on their own, wherever a script parks them */
	switch (el.nodeName) {
		case 'SCRIPT': case 'STYLE': case 'LINK': case 'TEMPLATE': case 'NOSCRIPT': case 'META':
			return false;
	}
	if (el.dataset && el.dataset.fsChrome !== undefined) return false;
	if (el.id && el.id.indexOf('fs-') === 0) return false;
	for (const c of el.classList) if (c.indexOf('fs-') === 0) return false;
	if (el.id === 'modal_overlay') return false;
	if (el.classList.contains('cbi-tooltip')) return false;
	if (el.nodeName === 'A' && el.hasAttribute('download') && el.style.display === 'none') return false;
	return true;
}

function bodyLittered() {
	const adds = window.__fsBodyAdds;
	if (!adds || !adds.length) return false;
	let littered = false;
	for (let i = adds.length - 1; i >= 0; i--) {
		if (!document.body || adds[i].parentNode !== document.body) { adds.splice(i, 1); continue; }
		if (strayBodyNode(adds[i])) littered = true;
	}
	return littered;
}

/* ---- a flushed menu makes the next navigation a full load ----
 * luci-app-package-manager calls ui.menu.flushCache() after an install, upgrade or removal. The
 * menu tree and every view class this document required may then be stale: a revisit would rerun
 * the old module. */
let _menuFlushed = false;
function watchMenuFlush() {
	const menu = ui.menu;
	if (!menu || typeof menu.flushCache !== 'function') return;
	const flush = menu.flushCache;
	menu.flushCache = function () {
		_menuFlushed = true;
		return flush.apply(this, arguments);
	};
}

let _curPath = window.location.pathname;
let _curSearch = window.location.search;
let _navGen = 0;
let _shown = null;

/* ---- Back must restore the scroll of whichever element is the scroller ----
 * The sidebar layout scrolls #maincontent, the top layout the document; the UA restores the
 * document's offset before #view is swapped and the clamp takes it to 0. Offsets are not saved by
 * replaceState (Safari allows 100 history writes per 30 s): each entry carries a session-prefixed
 * id in history.state, the offsets live in a Map. */
const _scrollMem = new Map();
const _scrollSess = Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
let _histN = 0;
let _curId = null;
const SCROLL_MEM_MAX = 50;
let _pendingRestore = null;
function newEntryId() { return _scrollSess + ':' + (++_histN); }

function adoptEntry() {
	const st = history.state;
	if (st && st.fsid) { _curId = st.fsid; return; }
	_curId = newEntryId();
	try { history.replaceState(Object.assign({}, st, { fsid: _curId }), '', window.location.href); } catch (e) {}
}

/* must run before _curId moves on to the incoming entry */
function saveScroll() {
	if (!_curId) return;
	const sc = document.getElementById('maincontent');
	_scrollMem.delete(_curId);
	_scrollMem.set(_curId, { win: Math.round(window.scrollY) || 0, main: sc ? sc.scrollTop : 0 });
	while (_scrollMem.size > SCROLL_MEM_MAX)
		_scrollMem.delete(_scrollMem.keys().next().value);
}

/* Put the scrollers back once the incoming view is tall enough: restoring earlier is clamped to 0
 * and reads as "worked". Polls by frame; a newer navigation cancels via the generation. */
function restoreScroll(pos, gen) {
	const until = Date.now() + 5000;

	/* The user outranks the saved position. A `scroll` is not intent on an axis `pos` does not carry,
	 * when it is our own write coming back, or when the engine settles (below). */
	let cancelled = false, wroteWin = -1, wroteMain = -1;
	const stop = () => { cancelled = true; off(); };
	/* The engine settling is not input: commitStage() leaves the page shorter than the offset for a
	 * frame and the clamp fires a `scroll` before any write (overview <- package-manager: 2684
	 * restored, `y=0` 5 s early). */
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
			if (t !== document.getElementById('maincontent')) return;
			if (t.scrollTop === wroteMain) return;	/* our own write coming back */
			const ceiling = Math.max(0, t.scrollHeight - t.clientHeight);
			if (ceiling < pos.main && t.scrollTop === ceiling) return;	/* the page settling */
		}
		stop();
	};
	/* the keys that scroll, and only those: typing in a field must not cancel anything */
	const SCROLL_KEYS = new Set([ 'PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown', ' ' ]);
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
 * head.ut stamps it; re-deriving it from document.title would let a page that renames the tab
 * become the host for every later page. */
let _titleHost = '';


function moduleUrl(className) {
	const v = L.env.resource_version ? ('?v=' + L.env.resource_version) : '';
	return (L.env.base_url || '') + '/' + className.replace(/\./g, '/') + '.js' + v;
}

/* ---- link prefetch: warm the module cache for a page the user is about to open ----
 * A plain fetch(), not require(): a view's __init__ is its render. Transitive, which is most of the
 * win: warming the view class alone leaves its `require` pragmas a round trip behind (418 -> 296 ms
 * on a first visit at 120 ms RTT). The scan is not line-anchored: shipped files carry every pragma
 * on one line. */

const PRAGMA_HEAD = 2000;
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

/* Only dotted class names are prefetched: a name with no dot is a virtual class with no file (a
 * 404) or a flat library already loaded (a seven-page walk fetched 10 files, every one nested). */

const _seen = new Set();
const _prefetched = new Set();
const _warming = new Map();
const _committed = new Set();

function warmClass(name, depth, root) {
	if (_prefetched.has(name)) return;
	_prefetched.add(name);
	if (name.indexOf('.') < 0 || _seen.has(name)) return;
	const req = fetch(moduleUrl(name), { credentials: 'same-origin' });
	const body = req.then((res) => (res.ok ? res.text() : '')).catch(() => '');
	_warming.set(name, body.then(() => {}));
	if (depth < PREFETCH_DEPTH)
		body.then((src) => {
			if (_committed.has(root)) return;
			for (const d of pragmaDeps(src)) warmClass(d, depth + 1, root);
		});
}

function prefetchSegs(segs) {
	if (!Array.isArray(segs) || !segs.length) return;
	const res = tree.resolveSegs(segs);
	const className = tree.viewClassFor(res && res.node);
	if (className) warmClass(className, 0, className);
}

/* Capped: a wedged prefetch must never wedge a navigation. */
const WARM_WAIT_MS = 5000;
function warmedThen(className) {
	_committed.add(className);
	const body = _warming.get(className);
	if (!body) return Promise.resolve();
	let t = 0;
	return Promise.race([ body, new Promise((r) => { t = window.setTimeout(r, WARM_WAIT_MS); }) ])
		.finally(() => window.clearTimeout(t));
}

function seed() {
	_shown = (L.env.dispatchpath || []).slice();
	const here = tree.viewClassFor(tree.currentNode());
	if (here)
		_seen.add(here);
	_titleHost = (document.title.split('|')[0] || '').trim();	/* before any view can rename the tab — see there */
	adoptEntry();

	const curPage = document.body.getAttribute('data-page') || '';

	/* The document's own first render is the first link in the chain: a LuCI view chain resolves
	 * `#view` at paint time and would paint into the newer stage (at 350 ms latency a click 150 ms
	 * after DOMContentLoaded ended on the new URL with the old page painted over it). */
	const vp = document.getElementById('view');
	if (vp) {
		vp.setAttribute('data-page', curPage);
		_inflight = renderedIn(vp).catch(() => {});
	}
}

/* ---- the incoming page is rendered off screen and swapped in when ready ----
 * Rendering into the live `#view` shows an empty page while module and data load (1800 ms on a
 * first visit at 600 ms latency). The view writes into a hidden stage, and renders are serialized:
 * a chain paints into whatever `#view` is first at paint time. */

const RENDER_TIMEOUT = 15000;
let _inflight = Promise.resolve();

/* A fresh `<div id="view">` in a hidden wrapper as the first child of `.fs-content`
 * (getElementById returns the first match). Hidden but laid out (`visibility: hidden; height: 0;
 * overflow: clip`, never `display: none`): views size themselves from the element they render
 * into. */
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
	const painted = () => view.querySelector(':scope > :not(.spinning):not(script)') !== null;
	if (painted()) return Promise.resolve();
	return new Promise((resolve, reject) => {
		const timer = window.setTimeout(() => {
			finish(() => reject(new Error('the view did not render within ' + RENDER_TIMEOUT + ' ms')));
		}, RENDER_TIMEOUT);
		const mo = new MutationObserver(() => {
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
	if (stage.wrapper.parentNode) discard(stage.wrapper);
}

/* Put the staged page on screen: move its children into the live `#view` through `dom.content()`,
 * drop the wrapper. The nodes move, not the element: fs-fit's content observer is bound to the
 * `#view` that existed at chrome init. No startViewTransition(): WebKit's capture held the main
 * thread 2,143 ms vs 213 ms at 390px. */
function commitStage(stage, contentHost) {
	sheets.scopeToCurrentPage();
	sweepAround(contentHost, stage);
	const live = liveView(contentHost, stage);
	const page = stage.view.getAttribute('data-page');	/* navigate() stamps it on every stage */
	live.setAttribute('data-page', page);
	contentHost.setAttribute('data-page', page);
	const nodes = Array.from(stage.view.childNodes);
	window.L.dom.content(live, nodes);
	dropStage(stage);
}

function liveView(contentHost, stage) {
	for (const el of contentHost.querySelectorAll(':scope > #view'))
		if (el !== stage.view) return el;
	const v = document.createElement('div');
	v.id = 'view';
	contentHost.appendChild(v);
	return v;
}

/* Clear what the outgoing page left beside #view: keep tabs, server notices, <noscript> and the
 * stage. Only `stage.banners` go (what #maincontent held when staging began): the incoming view's
 * own banner lands before the commit (nftables' "Legacy rules detected") and must survive. */
function sweepAround(contentHost, stage) {
	Array.from(contentHost.children).forEach((c) => {
		if (c.id !== 'view' && c.id !== 'tabmenu' && !c.classList.contains('fs-staging') &&
		    !c.classList.contains('alert-message') && c.nodeName !== 'NOSCRIPT')
			discard(c);
	});
	stage.banners.forEach((b) => { if (b.parentNode) discard(b); });
}

/* ---- a slow navigation is a navigation ----
 * A cold route looks like a click that did nothing. A hairline shows when the navigation outlives
 * `PROGRESS_DELAY`; below it a bar flashes on every warm click. */
const PROGRESS_DELAY = 150;
let _progressPending = 0;
let _progressTimer = 0;
let _fadeTimer = 0;
function progressBar() {
	let bar = document.getElementById('fs-nav-progress');
	if (!bar) {
		bar = document.createElement('div');
		bar.id = 'fs-nav-progress';
		bar.setAttribute('aria-hidden', 'true');
		document.body.insertBefore(bar, document.body.firstChild);
	}
	return bar;
}
function progressStart() {
	_progressPending++;
	window.clearTimeout(_progressTimer);
	_progressTimer = window.setTimeout(() => {
		const bar = progressBar();
		if (bar.dataset.state === 'done') { delete bar.dataset.state; getComputedStyle(bar).transform; }
		bar.dataset.state = 'active';
	}, PROGRESS_DELAY);
}
function progressEnd() {
	if (--_progressPending > 0) return;
	_progressPending = 0;
	window.clearTimeout(_progressTimer);
	const bar = progressBar();
	if (bar.dataset.state !== 'active') return;
	bar.dataset.state = 'done';
	window.clearTimeout(_fadeTimer);
	_fadeTimer = window.setTimeout(() => {
		if (bar.dataset.state === 'done') delete bar.dataset.state;
	}, 300);
}

function navigate(pathname, push, kbd) {
	const segs = tree.segsFromPath(pathname);
	if (!segs) return false;

	if (sheets.documentPoisoned()) return false;

	if (bodyLittered()) return false;

	if (_menuFlushed) return false;

	/* an extension's lodash/underscore replaced window._: LuCI's own `_('x').format()` then throws on every view; a full load restores it */
	if (typeof _ !== 'function' || typeof _('') !== 'string') return false;

	if (_expired) return false;

	/* `segs` is what the user clicked, `rsegs` the leaf it resolves to (they differ for an
	 * alias/firstchild link); a full load keeps URL and pathinfo as requested but the rest resolved */
	const res = tree.resolveSegs(segs);
	const node = res && res.node;
	const className = tree.viewClassFor(node);
	if (!className)
		return false;

	/* A page whose stylesheet only the server can emit (a menu.d node's `"css"`) is not ours to swap
	 * into: a click would show it without the app's CSS. Decline, as the poisoned-document bail does. */
	if (typeof node.css === 'string' && node.css !== '' && !sheets.documentCarries(node.css))
		return false;

	const rsegs = res.segs;

	/* declined before the first write below, or the refusal would still supersede the navigation in
	 * flight */
	const contentHost = document.querySelector('.fs-content');
	if (!contentHost) return false;

	/* from here on the navigation is committed */
	const gen = ++_navGen;
	const restoreTo = _pendingRestore;
	_pendingRestore = null;
	_curPath = pathname;	/* what is on screen from now on — read by the popstate handler */
	_curSearch = '';

	/* Run every registered navigation callback with the resolved segments (before L.env is
	 * re-pointed). A throwing registrant is logged and isolated. */
	for (const fn of _navCbs) {
		try { fn(rsegs); }
		catch (e) { console.error('footstrap: a navigation callback threw', e); }
	}
	ui.hideModal();

	L.env.requestpath  = rsegs.slice();
	L.env.dispatchpath = rsegs.slice();
	L.env.pathinfo     = '/' + segs.join('/');
	/* `readonly` is load-bearing: luci.js's hasViewPermission() is `!env.nodespec.readonly`; it comes
	 * from the whole path (readonlyForSegs()) */
	L.env.nodespec     = { satisfied: true, action: node.action, title: node.title,
	                       depends: node.depends, readonly: tree.readonlyForSegs(rsegs) };

	/* re-navigating to the page on screen replaces its entry: a duplicate makes Back do nothing */
	if (push) {
		const same = pathname === window.location.pathname;
		if (!same) _curId = newEntryId();
		history[same ? 'replaceState' : 'pushState']({ fsid: _curId }, '', pathname);
	}

	const title = node.title ? _(node.title) : '';
	document.title = title ? (_titleHost + ' | ' + title) : _titleHost;
	const tmain = document.querySelector('.fs-title-main');
	if (tmain) tmain.textContent = title || _titleHost;

	chrome.renderChrome();

	/* A full load starts at the top and so must the swap (the write is at commitStage).
	 * `fit.forgetRest()` runs for a click and a Back alike: a mutation the outgoing page's poller
	 * makes during staging must not be read against the old rest. scrollRestoration stays 'auto'. */
	fit.forgetRest();

	/* ---- what a full load does for a keyboard/screen-reader user ----
	 * renderChrome() has emptied #topmenu, so the <a> activated with Enter is gone and focus falls
	 * to <body>. A keyboard activation (ev.detail === 0) moves focus to the skip link; a pointer
	 * activation or a popstate replay keeps the wrapper focus. preventScroll: the scroll is still
	 * the outgoing page's. */
	const skip = kbd ? document.querySelector('.fs-skip') : null;
	const main = skip || document.getElementById('maincontent');
	if (main) main.focus({ preventScroll: true });
	const live = document.getElementById('fs-nav-status');
	if (live) live.textContent = title;

	/* Require through `window.L`, not the bare `L` a factory is handed (the two-L trap: "L.itemlist is
	 * not a function"). On a first visit the require is the render, so only a revisit gets a singleton
	 * whose __init__ already ran: `_seen` is read before the require resolves. */
	const RT = window.L;
	const cached = _seen.has(className);
	/* Wait for an in-flight prefetch of this class: two requests for one URL do not coalesce. `_seen`
	 * is marked after the wait, or a superseded navigation would make the next one render twice. */
	const previous = _inflight;
	let release;
	_inflight = new Promise((r) => { release = r; });
	progressStart();

	Promise.all([ warmedThen(className), previous.catch(() => {}) ]).then(() => {
		if (gen !== _navGen) return null;

		/* ---- teardown, now that the previous render is finished ----
		 * Drop the outgoing view's pollers and re-arm the poll loop: LuCI fires an entry only when
		 * `tick % interval == 0`, so the outgoing tick makes the incoming poller wait up to a full
		 * `pollinterval` (Wireless drew its station list at 4950 ms against ~360 ms on a full
		 * load). stop()+start() is upstream's own sequence. */
		L.Poll.queue.length = 0;
		L.Poll.stop();
		clearViewIntervals();
		L.Poll.start();
		const uciWarm = flushUciCache();

		/* Keep <body data-page> in sync with the route: chrome modules read it as the route'S identity,
		 * never as a CSS scope. Page-scoped CSS keys off the `#view`/`.fs-content` stamps below: keyed off
		 * body, 33 rules of the Overview sheet matched the outgoing page for the whole staging window
		 * (1407 ms), growing the document 211px and moving the reader 140px. */
		document.body.setAttribute('data-page', rsegs.join('-'));

		/* …and hand the new page to fs-sheets, which darkens foreign sheets of other pages so an invasive
		 * one can stay in the document. Enabling the incoming page's sheets is what the staged render
		 * needs; disabling the outgoing page's runs at the swap (commitStage), or it would strip an app's
		 * CSS off content still being read. */
		sheets.scopeToCurrentPage(rsegs, _shown);

		const mainHost = document.getElementById('maincontent');
		const outgoingBanners = mainHost
			? Array.from(mainHost.children).filter((c) => c.classList.contains('alert-message')) : [];
		const stage = stageView(contentHost);
		stage.banners = outgoingBanners;
		stage.view.setAttribute('data-page', rsegs.join('-'));
		const painted = renderedIn(stage.view);
		_seen.add(className);
		if (!cached) sheets.attributeTo(rsegs, gen);

		return Promise.resolve(uciWarm)
			.then(() => RT.require(className))
			.finally(() => { if (!cached) sheets.attributeTo(null, gen); })
			.then((view) => {
				if (!(view instanceof RT.view))
					throw new TypeError('Loaded class ' + className + ' is not a view');
				if (cached) new view.constructor();
				return painted;
			})
			.then(() => {
				if (gen !== _navGen) { dropStage(stage); return; }
				commitStage(stage, contentHost);
				_shown = rsegs.slice();
				const sc = document.getElementById('maincontent');
				const at = restoreTo || {};
				if (push || !at.win) window.scrollTo(0, 0);
				if (sc && (push || !at.main)) sc.scrollTo(0, 0);
				/* now, and only now, is there one height to read: the incoming page's */
				if (at.win || at.main) restoreScroll(restoreTo, gen);
			})
			.catch((e) => { dropStage(stage); throw e; });
	}).catch((e) => {
		console.error('footstrap: SPA nav to ' + className + ' failed, falling back to a full load', e);
		if (gen === _navGen) window.location = pathname;
	}).then(() => {
		progressEnd();
		release();
	});

	return true;
}

/* The same-origin nav URL an event's link points at, or null when it is not ours (new-tab target,
 * download, bare #hash, cross-origin, ?query / #hash). navigate() pushes only the pathname, so a
 * link with ?query or #hash must full-load. */
function linkUrlFrom(ev) {
	const a = ev.target.closest?.('a[href]');
	if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download'))
		return null;
	const raw = a.getAttribute('href');
	if (!raw || raw.charAt(0) === '#') return null;
	let url;
	try { url = new URL(a.href, window.location.href); } catch (e) { return null; }
	return (url.origin === window.location.origin && !url.search && !url.hash) ? url : null;
}

function prefetchFrom(ev) {
	const url = linkUrlFrom(ev);
	if (url) prefetchSegs(tree.segsFromPath(url.pathname));
}

/* ---- a document the router could not have rendered is not one it may navigate away from ----
 * A `call`, `cbi` or `function` node, and any `template` other than the Overview, may carry inline
 * scripts and timers the interval hook never saw, so the first click away is a full load. A
 * wildcard URL resolves to nothing; refusing to wire there would turn the router off on some of the
 * most-used pages. */
function bootDocumentIsOurs() {
	const node = tree.currentNode();
	if (!node || !node.action)
		return true;	/* unknown to the tree: a wildcard page, where the router is right to run */
	return tree.viewClassFor(node) != null;
}

/* ---- the boot contract: the luci-base surfaces this router calls ----
 * These were never an API (`L.Poll` is a deprecated alias). Existence is checked once at boot, and
 * a missing name turns the router off: the page is the server-dispatched MPA and the console names
 * the gone surface. */
const CONTRACT_FNS = [
	'L.require',
	'L.dom.content',
	'L.Poll.start/stop',
	'L.Request.addInterceptor',
	'rpc.addInterceptor',
	'ui.hideModal',
	'ui.hideIndicator'
];

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

function contractBreaks() {
	const gone = (probe) => {
		try { return !probe(); }
		catch (e) { return true; }
	};
	return CONTRACT_FNS.filter((path) => gone(() => hasFns(path)))
		.concat(CONTRACT_REST.filter(([ , probe ]) => gone(probe)).map(([ name ]) => name));
}

function wireRouter() {
	const broken = contractBreaks();
	if (broken.length) {
		/* the URL, not a repository path: this package also ships inside openwrt/luci, where no `docs/`
		 * directory exists */
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

		saveScroll();
		if (navigate(url.pathname, true, ev.detail === 0))
			ev.preventDefault();
	}, false);

	document.addEventListener('pointerover', prefetchFrom, { passive: true });

	document.addEventListener('focusin', prefetchFrom, { passive: true });
	document.addEventListener('pointerdown', prefetchFrom, { passive: true });

	window.addEventListener('popstate', () => {
		const loc = window.location;
		/* A fragment change is not a navigation: Chrome fires `popstate` for a same-document fragment nav,
		 * and re-running navigate() would wipe the state the click set. A query counts only when it is not
		 * the one the page booted with. The entry is adopted (its state is null). */
		if (loc.pathname === _curPath && (!loc.search || loc.search === _curSearch)) {
			adoptEntry();
			return;
		}

		/* an entry carrying a query belongs to a full load: replaying it as a bare path would drop the
		 * query */
		if (loc.search) {
			loc.reload();
			return;
		}

		saveScroll();
		adoptEntry();
		/* handed to navigate(), not started here: while the incoming page renders off screen the outgoing
		 * one satisfies the scroller height (restored at 386, clamped to 197) */
		_pendingRestore = _scrollMem.get(_curId) || null;
		if (!navigate(window.location.pathname, false)) {
			_pendingRestore = null;
			window.location.reload();
		}
	});
}

/* ---- the poll-status pill must not outlive the poll it reports on ----
 * LuCI shows the pill on `poll-start`, flips it to "Paused" on `poll-stop` and never hides it. The
 * queue empties through navigate()'s teardown and `L.Poll.remove()`, both reaching `L.Poll.stop()`.
 * The hide runs a microtask later, after luci.js's own `poll-stop` listener. */
document.addEventListener('poll-stop', () => {
	queueMicrotask(hidePollIndicatorIfEmpty);
});

watchSession();
watchMenuFlush();

const _navCbs = [];
function onNavigate(fn) { if (typeof fn === 'function') _navCbs.push(fn); }

return baseclass.extend({
	seed,
	wire: wireRouter,
	onNavigate,
	prefetchSegs
});
