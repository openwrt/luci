'use strict';
'require baseclass';
'require dom';
'require network';
'require fs-fit as fit';

/* Footstrap overview LAYOUT-only module: renders NOTHING of its own, only re-arranges the STOCK
 * sections — wrapping System / Memory / Storage in a grid so Memory and Storage sit in a right
 * column beside System. Content, data and styling stay luci-mod-status's. (Do not go back to the
 * old 05_footstrap_dashboard.js: re-rendering a custom tree every poll flickered and reset mobile
 * scroll.) The stock poll updates each section IN PLACE via dom.content() and never rebuilds the
 * .cbi-section wrapper, so once moved into our grid the wrappers stay put across polls.
 *
 * IT USED TO LIVE IN LuCI'S GLOBAL INCLUDE DIR (view/status/include/05_footstrap_overview_layout.js)
 * and that was a real defect, not a filing preference: luci-mod-status loads EVERY *.js in that
 * directory, so this file was fetched, parsed and evaluated on the overview of every router running
 * a DIFFERENT theme. Measured with a headless browser against the dev container with `bootstrap`
 * active: the request is right there beside 10_system.js and 20_memory.js. The `L.env.media` gate
 * silenced it, but only after it had already been downloaded and run — a theme package reaching
 * into another module's namespace, which is exactly what this project refuses to do to third-party
 * apps (docs/conventions.md, the three zones). It is a chrome module now, loaded by the chrome, so a router on
 * another theme never sees it at all.
 *
 * WHAT THAT COST, and why the code below looks the way it does: the old location bought two timing
 * guarantees for free, because LuCI evaluated the file INSIDE index.load(). Both had to be paid for
 * explicitly — see ensureOverviewHelpers() and patchOverview() at the bottom. */
function isFootstrapTheme() {
	return String(L.env.media || '').indexOf('footstrap') >= 0;
}

/* section title -> grid role. _() with NO msgctxt on purpose: these must resolve to exactly what
 * luci-mod-status resolves to, or the titles stop matching. Built once — it used to cost an
 * allocation plus three _() lookups per poll tick. */
const ROLES = { [_('System')]: 'sys', [_('Memory')]: 'mem', [_('Storage')]: 'sto' };

function sectionTitle(sec) {
	/* TWO title markups, one per release: 25.12 wraps the heading (`.cbi-title > h3`), 24.10
	 * emits a bare `<h3>` as the section's first child. Matching only the wrapped one meant the
	 * grid never applied on 24.10 at all — measured on the dev container: every section tagged
	 * `none`, `.fs-ovl` never built, silently. */
	const h = sec.querySelector('.cbi-title h3, :scope > h3');
	return (h && h.firstChild) ? String(h.firstChild.nodeValue || '').trim() : '';
}

/* the wrapper we built, so the poll-tick fast path costs one property read */
let _wrapEl = null;

function arrange() {
	/* the SPA nav can leave this _observer wired while another page renders into #view — detach as
	 * soon as the route stops being the overview. Both the server template and the SPA router
	 * stamp body[data-page] with the DISPATCH path, so /admin/status (firstchild -> overview)
	 * matches too. */
	if ((document.body.getAttribute('data-page') || '') !== 'admin-status-overview') {
		stopWatch();
		return;
	}
	const view = document.getElementById('view');
	if (!view) return;

	/* Fast path — the poll lands here once a second, forever. The stock poll never rebuilds the
	 * .cbi-section wrappers, so the grid survives and there is nothing to do; proving that used
	 * to cost a querySelectorAll over #view plus a sectionTitle() dig per section, every tick.
	 * Deliberately NOT a disconnect(): if a future luci-mod-status ever DOES rebuild a section,
	 * the wrapper loses its children and the slow path below rebuilds the grid — self-healing. */
	if (_wrapEl && _wrapEl.isConnected && _wrapEl.parentElement === view && _wrapEl.children.length === 3)
		return;

	const found = {};
	view.querySelectorAll(':scope > .cbi-section').forEach((sec) => {
		const r = ROLES[sectionTitle(sec)];
		if (r && !found[r]) found[r] = sec;
	});
	/* wait until all three stock sections exist */
	if (!(found.sys && found.mem && found.sto)) return;
	/* already wrapped? (first tick after a rebuild re-finds the existing grid) */
	if (found.sys.parentElement && found.sys.parentElement.classList.contains('fs-ovl')) {
		_wrapEl = found.sys.parentElement;
		return;
	}
	const wrap = document.createElement('div');
	wrap.className = 'fs-ovl';
	found.sys.parentNode.insertBefore(wrap, found.sys);
	found.sys.classList.add('fs-ovl-sys'); wrap.appendChild(found.sys);
	found.mem.classList.add('fs-ovl-mem'); wrap.appendChild(found.mem);
	found.sto.classList.add('fs-ovl-sto'); wrap.appendChild(found.sto);
	_wrapEl = wrap;
}

/* Stock sections render async and repaint every poll, so watch #view and re-run arrange()
 * (coalesced, ONE _observer per #view node — a per-poll _observer leak would slow the page down).
 * The SPA router may REPLACE the #view element between visits, so re-attach when the node we
 * observed is no longer the current one: a singleton bound to the first #view would silently
 * watch a detached tree and the grid would never apply on a later SPA visit. */
let _observer = null, _observedView = null, _routeObserver = null;
function stopWatch() {
	if (_observer) _observer.disconnect();
	_observer = null;
	_observedView = null;
	_wrapEl = null;	/* the grid belongs to the #view we are leaving */
}
function watch() {
	const view = document.getElementById('view');
	if (_observer && _observedView !== view)
		stopWatch();
	arrange();
	/* The route check is what the stock include's render() used to provide implicitly — it only ran
	 * when luci-mod-status rendered THIS page. A chrome module is alive on every page, so without
	 * this an observer would be attached to #view on, say, the firewall page and re-run arrange()
	 * for every mutation of a table it has no business watching. */
	if (_observer || !view ||
	    (document.body.getAttribute('data-page') || '') !== 'admin-status-overview')
		return;
	_observedView = view;
	/* one arrange() per frame, however many mutations a poll tick delivers (fit.frame — the
	 * theme's shared coalescer, fs-fit.js) */
	_observer = new MutationObserver(fit.frame(arrange));
	_observer.observe(view, { childList: true, subtree: true });
}

/* WHAT REPLACED render(). The include was instantiated by luci-mod-status once per overview render,
 * which is how it knew a visit had happened; a chrome module is instantiated once per PAGE LOAD and
 * then has to notice SPA navigation itself. `body[data-page]` is the signal — both the server
 * template and fs-router stamp it with the dispatch path — so one attribute observer covers arriving
 * at the overview, leaving it, and coming back.
 *
 * The empty `.cbi-section` wrapper stock used to build around this include is gone with it, and so
 * is the `.fs-ovl-marker` element that existed only to let CSS hide that wrapper. */
function wire() {
	if (_routeObserver || !isFootstrapTheme() || !document.body)
		return;
	_routeObserver = new MutationObserver(() => {
		if ((document.body.getAttribute('data-page') || '') === 'admin-status-overview')
			onOverview();
		else
			stopWatch();
	});
	_routeObserver.observe(document.body, { attributes: true, attributeFilter: [ 'data-page' ] });
	if ((document.body.getAttribute('data-page') || '') === 'admin-status-overview')
		onOverview();
}

/* Everything that must happen on ARRIVAL at the overview, from either direction: a full page load
 * that lands here, or an SPA navigation that restamps data-page. patchOverview() is idempotent
 * (the __fsProgressive flag), so the two paths cannot double-patch. */
function onOverview() {
	patchOverview();
	watch();
}

/* ---- progressive paint -----------------------------------------------------
 *
 * Stock `view.status.index` calls poll_status(first_load=true), which Promise.all's over EVERY
 * include's load(), and render() does not return the tree until it resolves — so #view stays
 * EMPTY for as long as the slowest include takes. Measured on the dev router (warm SPA nav):
 * 182 ms of blank page, of which System/CPU/Memory/Storage/DHCP/Network were ready at 88 ms and
 * were simply waiting on 29_ports and 60_wifi (180 ms each).
 *
 * Replacing poll_status does two things:
 *  1. Each section paints when ITS OWN data lands: first content halves, 182 -> ~90 ms. Nothing
 *     jumps — the frames are already in the DOM (built before poll_status is called), a section
 *     just goes hidden -> filled, exactly as on a stock poll tick.
 *  2. Kills the redundant re-fetch: stock adds the poller only after the first load completes
 *     and Poll.add() steps at once, so the overview re-fetched EVERYTHING (~250 ms of ubus)
 *     right after the first paint. The in-flight guard joins that to the run already going.
 *
 * NOT a re-implementation — frames, toggles, includes and their render() stay upstream's.
 * fillSection() transcribes stock's own loop in the same order so it can be diffed against
 * index.js when luci-mod-status changes; if that shape is gone, the patch is skipped and the
 * page runs stock. */
function fillSection(inc, container, res) {
	if (inc.failed)
		return;
	let content = null;
	if (typeof inc.render === 'function')
		content = inc.render(res);
	else if (inc.content != null)
		content = inc.content;
	if (typeof inc.oneshot === 'function') {
		inc.oneshot(res);
		inc.oneshot = null;
	}
	if (content != null) {
		container.parentNode.style.display = '';
		container.parentNode.classList.add('fade-in');
		if (!inc.hide)
			dom.content(container, content);
	}
}

let _inflight = null;

function pollProgressive(includes, containers, first_load) {
	/* A run is already fetching exactly this data — join it instead of starting a second
	 * stampede of the same RPCs. This is what kills the duplicate load. */
	if (_inflight)
		return first_load ? Promise.resolve() : _inflight;

	const run = network.flushCache().then(() => Promise.all(
		includes.map((inc, i) => {
			if (inc.hide && !first_load)
				return null;
			const loaded = (typeof inc.load === 'function')
				? Promise.resolve(inc.load()).catch(() => { inc.failed = true; })
				: Promise.resolve(null);
			/* the point of the patch: fill THIS section the moment ITS data is here,
			 * not at the end of a Promise.all over all of them */
			return loaded.then((res) => {
				try { fillSection(inc, containers[i], res); }
				catch (e) { console.error('footstrap: overview section failed', e); }
			});
		}).filter(Boolean)
	)).then(() => {
		const ssi = document.querySelector('div.includes');
		if (ssi) { ssi.style.display = ''; ssi.classList.add('fade-in'); }
	});

	_inflight = run.finally(() => { _inflight = null; });
	/* NOBODY AWAITS THIS ON THE FIRST LOAD — the line below hands the caller a fresh
	 * Promise.resolve() so index.render() can return at once — so a rejection here has no handler
	 * and surfaces as an unhandled rejection in the console. `run` rejects for one ordinary reason:
	 * network.flushCache() failing on an expired session, i.e. exactly when the user is already
	 * being redirected to the login page and the noise is least useful. The sections' own failures
	 * cannot reach it (fillSection is called inside a try/catch and inc.load() has its own .catch),
	 * so there is nothing to report that the page has not reported already. */
	_inflight.catch(() => {});

	/* First load: resolve NOW so index.render() returns its tree and the frames reach #view
	 * immediately; the sections fill themselves. A poll tick resolves when the data is in —
	 * that is what the poller expects. */
	return first_load ? Promise.resolve() : _inflight;
}

/* Patch the stock overview view: replace poll_status so each section paints when its own data lands.
 *
 * TIMING, AND WHAT MOVING THE FILE COST. As an include this ran at module eval — which LuCI performs
 * inside index.load(), i.e. after the view instance exists and before render() calls poll_status:
 * the exact window the patch needs, for free, on both a full load and an SPA nav.
 *
 * A chrome module evaluates much earlier, so that window has to be aimed at rather than inherited,
 * and it is called from the ROUTE (see wire()) instead of at eval. Two reasons it is not called at
 * module eval any more: `L.require('view.status.index')` would pull the whole stock overview view
 * into memory on every page, including pages that are not the overview; and on a full page load the
 * require would race index.load() — which is why the patch is idempotent, guarded by the
 * `__fsProgressive` flag on the prototype, and why failing to land is harmless. If it misses, the
 * page simply renders the stock way: one Promise.all, ~90 ms later. Never broken, sometimes slower.
 */
function patchOverview() {
	/* `window.L`, NEVER the bare `L` this factory was handed — and the reason is NOT this module's
	 * own convenience, it is what the STOCK view ends up holding. `require()` passes the object it
	 * was called on into the loaded module's factory (`const L = this` in luci.js), and
	 * `view/status/index.js` then loads its own includes with that same `L` inside `load()`
	 * (`L.require('view.status.include.' + …)`), so whichever `L` reaches index.js reaches
	 * 30_network.js too — which calls `L.itemlist(...)` directly. `ui` hangs itemlist/showModal/…
	 * on the RUNTIME INSTANCE that the dispatcher builds (`window.L = new LuCI()`), and a chrome
	 * module like this one is loaded as a dependency, i.e. through `LuCI.prototype.require`, so our
	 * `L` is the PROTOTYPE and has none of them.
	 *
	 * `require()` caches by class name, so the FIRST caller decides this for everybody: patching
	 * through the bare `L` cached view.status.index bound to the prototype, and the overview then
	 * died mid-render on "L.itemlist is not a function" with the page stuck on "Loading view…"
	 * (issue #22 follow-up). It only bit on an SPA arrival — a full page load has the dispatcher
	 * require the view through `window.L` before this observer ever fires — and only when this
	 * patch won the race against fs-router's own `RT.require`, which is exactly the "sometimes,
	 * coming from another page" the report described. Same trap as the itemlist calls below
	 * (docs/spa-router.md), reached from the other side. */
	window.L.require('view.status.index').then((idx) => {
		const proto = idx ? Object.getPrototypeOf(idx) : null;
		if (!proto || proto.__fsProgressive || typeof proto.poll_status !== 'function')
			return;
		proto.__fsProgressive = true;
		proto.poll_status = function(includes, containers, first_load) {
			return pollProgressive(includes, containers, first_load);
		};
	}).catch((e) => console.error('footstrap: overview progressive paint not applied', e));
}

/* Status→Overview is a `template` node whose server template (admin_status/index.ut) defines 3
 * globals the stock status includes use (18_cpu/20_memory/25_storage/…) and then instantiates
 * view.status.index. Arriving by the theme's SPA router never runs that inline <script>, so define
 * them here, guarded, so a full load's copies (any theme) are not clobbered.
 *
 * This is the OTHER thing the include location used to give for free, and the one that survived the
 * move intact: the definitions had to exist before any include renders, which module eval inside
 * index.load() guaranteed. A chrome module evaluates once, at chrome init — i.e. before any SPA
 * navigation can possibly happen — so the guarantee is now stronger rather than weaker. On a full
 * load of the overview the template's own copies win the race and these are no-ops, as before.
 *
 * Bodies are verbatim from upstream except L.itemlist → window.L.itemlist (the two-L trap,
 * docs/spa-router.md). */
function ensureOverviewHelpers() {
	/* eslint-disable no-var -- these three bodies are copied VERBATIM from LuCI's
	   admin_status/index.ut so they can be diffed against upstream when it changes.
	   Modernising the `var`s would silently break that property, which is the whole
	   reason the copies are safe to carry. */
	if (typeof window.progressbar !== 'function')
		window.progressbar = function(query, value, max, byte) {
			var pg = document.querySelector(query),
			    vn = parseInt(value) || 0,
			    mn = parseInt(max) || 100,
			    fv = byte ? String.format('%1024.2mB', value) : value,
			    fm = byte ? String.format('%1024.2mB', max) : max,
			    pc = Math.floor((100 / mn) * vn);
			if (pg) {
				pg.firstElementChild.style.width = pc + '%';
				pg.setAttribute('title', '%s / %s (%d%%)'.format(fv, fm, pc));
			}
		};
	if (typeof window.renderBox !== 'function')
		window.renderBox = function(title, active, childs) {
			childs = childs || [];
			childs.unshift(window.L.itemlist(E('span'), [].slice.call(arguments, 3)));
			return E('div', { class: 'ifacebox' }, [
				E('div', { class: 'ifacebox-head center ' + (active ? 'active' : '') },
					E('strong', title)),
				E('div', { class: 'ifacebox-body left' }, childs)
			]);
		};
	if (typeof window.renderBadge !== 'function')
		window.renderBadge = function(icon, title) {
			return E('span', { class: 'ifacebadge' }, [
				E('img', { src: icon, title: title || '' }),
				window.L.itemlist(E('span'), [].slice.call(arguments, 2))
			]);
		};
	/* eslint-enable no-var */
}
/* Unconditional: the typeof guards make it a no-op wherever the real definitions already exist. */
ensureOverviewHelpers();

return baseclass.extend({
	/* Called by menu-footstrap-common's init, once. Everything route-dependent hangs off the
	 * data-page observer inside. */
	wire,
});
