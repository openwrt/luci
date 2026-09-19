'use strict';
'require baseclass';
'require dom';
'require network';
'require fs-fit as fit';
'require menu-footstrap-common as common';

/* Overview layout only: renders nothing of its own, it re-arranges the STOCK System / Memory /
 * Storage sections into a grid. Content, data and styling stay luci-mod-status's — rendering a
 * custom tree every poll instead (the old 05_footstrap_dashboard.js) flickered and reset mobile
 * scroll. The stock poll fills each section in place via dom.content() and never rebuilds the
 * .cbi-section wrapper, so the wrappers stay inside our grid across polls.
 *
 * This must NOT be filed in LuCI's global include dir (view/status/include/): luci-mod-status
 * evaluates every *.js there, so the file would be fetched and run on routers using another theme,
 * with an `L.env.media` gate only silencing it after the fact. As a chrome module it is
 * unreachable except through this theme's footer partial, which is why nothing below re-checks
 * `L.env.media`. That location also supplied two timing guarantees for free, by evaluating inside
 * index.load(); both are paid for explicitly here — patchOverview() below, and
 * ensureOverviewHelpers() in menu-footstrap-common.js. */
/* section title -> grid role. _() with no msgctxt on purpose: these must resolve to exactly what
 * luci-mod-status resolves to, or the titles stop matching. Built once, not per poll tick. */
const ROLES = { [_('System')]: 'sys', [_('Memory')]: 'mem', [_('Storage')]: 'sto' };
/* the data-page value four call sites compare against; a string literal is not mangled, so a
 * repeat is paid in full on flash every time (measured: 24 B x4 -> 37 B, 59 B saved) */

function headerEl(sec) {
	/* two title markups, one per release: 25.12 wraps the heading (`.cbi-title > h3`), 24.10 emits
	 * a bare `<h3>` as the section's first child. Matching only one silently disables the grid on
	 * the other. */
	return sec.querySelector('.cbi-title h3, :scope > h3');
}

function sectionTitle(sec) {
	const h = headerEl(sec);
	if (!h) return '';
	/* the first non-empty TEXT node, not `firstChild`: 25.12 appends a hide/show <span> inside the
	 * same <h3>, so `firstChild` depends on upstream keeping the words first */
	for (const n of h.childNodes) {
		if (n.nodeType !== 3) continue;
		const t = String(n.nodeValue || '').trim();
		if (t) return t;
	}
	return '';
}

/* ---- keyboard disclosure: the card header becomes the toggle, the pill becomes its glyph ----
 *
 * Live on owrt2512 (25.12.4), Status -> Overview carries 14 `[data-clickable]` elements — the
 * topbar poll pill plus one Hide/Show toggle per card — and every one is a bare <span>: no
 * tabindex, no role, no aria-expanded. Tab never reaches one and a screen reader announces a run
 * of text with no name, role or state. WCAG 2.1.1 Keyboard (A), 4.1.2 Name, Role, Value (A).
 * docs/findings.md, "A card cannot be collapsed from the keyboard".
 *
 * index.js's own pill keeps doing the actual show/hide — untouched, so mouse behaviour for anyone
 * clicking it does not change. The header becomes a second, W3C-APG way to reach the SAME handler,
 * not a competing one. */

/* Idempotent attribute write, so a poll tick that finds nothing changed touches no DOM and fires
 * no mutation record. Same shape as `fsSyncAttr` in menu-footstrap-common.js — restated rather than
 * imported, since that file does not export it. */
function syncAttr(el, name, value) {
	if (value === null) {
		if (el.hasAttribute(name)) el.removeAttribute(name);
	} else if (el.getAttribute(name) !== value) {
		el.setAttribute(name, value);
	}
}

/* index.js's own attribute: "inactive" is expanded (the pill reads "Hide"), "active" is collapsed
 * (it reads "Show") — the chevron mirror in pages/20-overview.css reads the same attribute the
 * same way. */
function pillExpanded(label) {
	return label.getAttribute('data-style') !== 'active';
}

/* The panel `data-style` shows or hides is `.cbi-title`'s next sibling in the 25.12 markup this was
 * measured on. 24.10 emits no `.cbi-title` wrapper (headerEl() above) and is left without
 * aria-controls rather than guessed at — role, tabindex, aria-expanded and the keyboard below still
 * apply there; aria-controls is the one piece this function cannot state with confidence. */
function panelFor(h) {
	const holder = h.closest('.cbi-title');
	return holder ? holder.nextElementSibling : null;
}

let _panelSeq = 0;

/* Promote one card's header to a disclosure control. Idempotent: a tick that finds the header
 * already wired touches only aria-expanded, and only when it actually changed; the click/keydown
 * listeners are added once (`dataset.fsWired`), never re-added. */
function wireDisclosure(sec) {
	const h = headerEl(sec);
	const label = h && h.querySelector('.label[data-indicator="poll-status"]');
	if (!h || !label) return;	/* not this card's shape — left alone rather than guessed at */

	const panel = panelFor(h);
	if (panel && !panel.id) panel.id = 'fs-ovl-panel-' + (_panelSeq++);

	syncAttr(h, 'role', 'button');
	syncAttr(h, 'tabindex', '0');
	syncAttr(h, 'aria-controls', panel ? panel.id : null);
	syncAttr(h, 'aria-expanded', pillExpanded(label) ? 'true' : 'false');
	/* the header now carries the pill's name, role and state; a screen reader user tabbing past it
	 * to a second, unlabelled clickable span would hear an unexplained duplicate control — same
	 * reasoning as the aria-hidden on svgIcon()'s output, fs-widgets.js:12 */
	syncAttr(label, 'aria-hidden', 'true');

	if (h.dataset.fsWired) return;
	h.dataset.fsWired = '1';

	h.addEventListener('click', (ev) => {
		/* a click landing on the pill itself already ran index.js's own handler; forwarding here
		 * too would toggle the card twice */
		if (ev.target.closest?.('[data-indicator="poll-status"]') !== label) label.click();
		syncAttr(h, 'aria-expanded', pillExpanded(label) ? 'true' : 'false');
	});
	/* the pill is an <a>-less <span>, so neither key is native here — contrast
	 * fs-widgets.js's wireSpaceKey, written for an <a role="button">, which gets Enter for free
	 * and needs only Space added */
	h.addEventListener('keydown', (ev) => {
		if (ev.key !== 'Enter' && ev.key !== ' ' && ev.key !== 'Spacebar') return;
		ev.preventDefault();
		label.click();
	});
}

/* A `.cbi-section` LuCI still renders when a stock include has nothing to show this tick: title
 * "-", the poll pill its only content, 72px tall on the live Overview — seventh there (a fixture is
 * not proof of position: docs/playground.html puts it first). Real and cosmetic, so it is
 * suppressed rather than left as a rung in the tab order with nothing behind its own name. */
function hideEmptyCard(sec) {
	if (sectionTitle(sec) === '-') sec.classList.add('fs-ovl-empty');
}

function tidyCards(view) {
	view.querySelectorAll('.cbi-section').forEach((sec) => {
		hideEmptyCard(sec);
		wireDisclosure(sec);
	});
}

/* the wrapper we built, so the poll-tick fast path costs one property read */
let _wrapEl = null;

/* A port name the card had to cut stays readable on hover: styles/pages/20-overview.css ellipses
 * it at one line so every card takes the width the row can spare, and the name is the one thing on
 * a card that cannot be guessed from the rest.
 *
 * The tooltip is set unconditionally: testing `scrollWidth` against `clientWidth` per card would
 * force a synchronous layout on every poll tick, since 29_ports.js rebuilds these tiles each time.
 *
 * Runs BEFORE arrange()'s fast path, which returns as soon as the grid is intact while the tiles
 * under it are new elements. */
function nameTooltips(view) {
	for (const icon of view.querySelectorAll('img[src*="/port_"]')) {
		const head = icon.closest('.ifacebox')?.firstElementChild;
		const name = head ? head.textContent.trim() : '';
		/* `!==`: a mutation inside the tree we observe is not cheap, even when the write is */
		if (name && head.title !== name)
			head.title = name;
	}
}

function arrange() {
	/* an SPA nav can leave the observer wired while another page renders into #view: detach as soon
	 * as the route stops being the overview. body[data-page] carries the DISPATCH path from both
	 * the server template and the router, so /admin/status (firstchild -> overview) matches. */
	if ((document.body.getAttribute('data-page') || '') !== /* spelled out, not hoisted: tools/page-modules.mjs reads this value out of the module's
	 * SOURCE to check it against the map in menu-footstrap-common.js */
	'admin-status-overview') {
		stopWatch();
		return;
	}
	const view = document.getElementById('view');
	if (!view) return;

	nameTooltips(view);
	/* 20_memory.js, 25_storage.js and 30_network.js each call their OWN local progressbar(), not
	 * the theme's window.progressbar (menu-footstrap-common.js), so the reading and colour those
	 * bars need are stamped on here instead — on the same poll-tick callback nameTooltips() already
	 * runs on, ahead of the fast-path return below: dom.content() rewrites a section's title every
	 * tick even when the wrapper survives, so a bar's reading is stale on every tick this line is
	 * skipped. */
	common.annotateMeters(view);
	/* Same reasoning, same placement: dom.content() rewrites a card's body every tick even when the
	 * wrapper survives, so a card that is only now getting its title text needs wiring on this
	 * pass, not just the first one. tidyCards() is its own idempotent write (wireDisclosure(),
	 * hideEmptyCard() above), so a tick that changes nothing here touches no DOM either. */
	tidyCards(view);

	/* Fast path: the poll lands here on every tick, forever, and the stock poll never rebuilds
	 * the .cbi-section wrappers, so the grid survives. Deliberately not a disconnect() — if a
	 * future luci-mod-status does rebuild a section, the wrapper loses its children and the slow
	 * path below rebuilds the grid. */
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

/* Stock sections render async and repaint every poll, so watch #view and re-run arrange(),
 * coalesced and one observer per #view node. The SPA router may replace #view between visits, so
 * re-attach when the observed node is no longer the current one — a singleton bound to the first
 * #view would watch a detached tree and the grid would never apply again. */
let _observer = null, _observedRoot = null, _routeObserver = null;
function stopWatch() {
	if (_observer) _observer.disconnect();
	_observer = null;
	_observedRoot = null;
	_wrapEl = null;	/* the grid belongs to the #view we are leaving */
}
function watch() {
	const view = document.getElementById('view');
	/* `#maincontent`, not `#view`: a client navigation builds a fresh `#view` before it is in the
	 * document and swaps it in afterwards, and this runs on the `data-page` stamp, which comes
	 * first — so the observer bound here read `isConnected: false` after one round trip and the
	 * grid stopped being re-arranged on every poll tick, silently, until the next full load. The
	 * shell's column outlives every swap. Same fault, same fix as fs-appearance.js. */
	const root = document.getElementById('maincontent') || view;
	if (_observer && _observedRoot !== root)
		stopWatch();
	arrange();
	/* a chrome module is alive on every page, so without the route check an observer would attach
	 * to #view on, say, the firewall page and re-run arrange() for every table mutation */
	if (_observer || !view ||
	    (document.body.getAttribute('data-page') || '') !== 'admin-status-overview')
		return;
	_observedRoot = root;
	/* one arrange() per frame, however many mutations a poll tick delivers (fit.frame — the
	 * theme's shared coalescer, fs-fit.js) */
	_observer = new MutationObserver(fit.frame(arrange));
	_observer.observe(root, { childList: true, subtree: true });
}

/* A chrome module is instantiated once per page load, so it has to notice SPA navigation itself.
 * `body[data-page]` is the signal — the server template and fs-router both stamp it with the
 * dispatch path — so one attribute observer covers arriving, leaving and coming back. */
function wire() {
	if (_routeObserver || !document.body)
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

/* Arrival at the overview, from a full page load or an SPA navigation. patchOverview() is
 * idempotent (the __fsProgressive flag), so the two paths cannot double-patch. */
function onOverview() {
	patchOverview();
	watch();
}

/* ---- progressive paint ----
 *
 * Stock `view.status.index` calls poll_status(first_load=true), which Promise.all's over every
 * include's load(), and render() withholds the tree until it resolves — #view stays empty for as
 * long as the slowest include takes (measured: 182 ms, of which most sections were ready at 88 ms
 * and waiting on 29_ports and 60_wifi).
 *
 * Replacing poll_status does two things:
 *  1. each section paints when its own data lands (182 -> ~90 ms). Nothing jumps: the frames are
 *     already in the DOM, a section goes hidden -> filled as on any poll tick;
 *  2. drops the redundant re-fetch — stock adds the poller after the first load and Poll.add()
 *     steps at once, re-fetching everything (~250 ms of ubus) right after the first paint.
 *
 * Not a re-implementation: frames, toggles, includes and their render() stay upstream's.
 * fillSection() transcribes stock's loop in the same order so it can be diffed against index.js;
 * if that shape is gone, the patch is skipped and the page runs stock. */
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
/* Which containers the in-flight run is filling. The guard is module-level because the duplicate
 * load it kills is, but frames are per render: joining a run blindly joins one filling somebody
 * else's frames, and the second arrival's sections then stay at `display:none` for a full poll
 * interval (5.9 s against 0.4 s). */
let _inflightFor = null;

function pollProgressive(includes, containers, first_load) {
	/* a run already fetching this data for THESE frames is joined rather than duplicated; a run for
	 * older frames is left to finish into the detached nodes it owns */
	if (_inflight && _inflightFor === containers)
		return first_load ? Promise.resolve() : _inflight;

	const run = network.flushCache().then(() => Promise.all(
		includes.map((inc, i) => {
			if (inc.hide && !first_load)
				return null;
			const loaded = (typeof inc.load === 'function')
				? Promise.resolve(inc.load()).catch(() => { inc.failed = true; })
				: Promise.resolve(null);
			/* the point of the patch: fill this section when its own data lands, not at the
			 * end of a Promise.all over all of them */
			return loaded.then((res) => {
				try { fillSection(inc, containers[i], res); }
				catch (e) { console.error('footstrap: overview section failed', e); }
			});
		}).filter(Boolean)
	)).then(() => {
		const ssi = document.querySelector('div.includes');
		if (ssi) { ssi.style.display = ''; ssi.classList.add('fade-in'); }
	});

	_inflight = run.finally(() => {
		/* only if still ours: a newer render may have replaced it mid-run */
		if (_inflightFor === containers) { _inflight = null; _inflightFor = null; }
	});
	_inflightFor = containers;
	/* Nobody awaits this on the first load (the caller gets a fresh Promise.resolve()), so a
	 * rejection would surface as an unhandled one. `run` rejects for one ordinary reason:
	 * flushCache() on an expired session, when the user is already being redirected to login.
	 * Section failures cannot reach it — fillSection runs in a try/catch and inc.load() has its
	 * own .catch. */
	_inflight.catch(() => {});

	/* first load resolves now, so index.render() returns its tree and the frames reach #view while
	 * the sections fill themselves; a poll tick resolves when its data is in, as the poller
	 * expects */
	return first_load ? Promise.resolve() : _inflight;
}

/* Patch the stock overview view: replace poll_status so each section paints when its own data
 * lands.
 *
 * Called from the route (wire()), not at module eval: requiring 'view.status.index' at eval would
 * pull the whole stock view into memory on every page, and on a full load it would race
 * index.load(). Hence the `__fsProgressive` guard and the fact that missing the window is
 * harmless — the page then renders the stock way, one Promise.all, ~90 ms later. */
function patchOverview() {
	/* `window.L`, never the bare `L` this factory was handed. require() passes the object it was
	 * called on into the loaded module's factory, and index.js loads its own includes with that
	 * same `L` — 30_network.js then calls `L.itemlist(...)`, which lives on the runtime instance
	 * (`window.L = new LuCI()`), not on the prototype a chrome module receives. require() caches
	 * by class name, so the first caller decides this for everybody: through the bare `L` the
	 * overview dies mid-render on "L.itemlist is not a function", stuck on "Loading view…" (issue
	 * #22 follow-up). docs/spa-router.md. */
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

/* `progressbar`, `renderBox` and `renderBadge` are defined in menu-footstrap-common.js, not here:
 * a stock include calls them bare from its own render(), so they must exist before the view class
 * does, and this page module is required during the navigation that races it. `annotateMeters` is
 * required from that same module (see arrange()) rather than duplicated: it is not a template
 * global, so nothing forces it to live there, but the threshold split and label lookup it shares
 * with `window.progressbar` would drift into two copies otherwise. */

return baseclass.extend({
	/* called once by menu-footstrap-common's init; everything route-dependent hangs off the
	 * data-page observer inside */
	wire,
});
