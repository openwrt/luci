'use strict';
'require baseclass';
'require ui';
'require fs-fit as fit';
'require fs-menutree as tree';
'require fs-chrome as chrome';
'require fs-router as router';
'require fs-prefs as prefs';
'require fs-sheets as sheets';

/* Page modules: `fs-overview` (Status -> Overview) adds to a stock page rather than owning a
 * route, so it is required only there. A `require` pragma would make it a hard dependency —
 * luci.js fetches and evaluates before this factory runs — costing 3.8 KB after terser on every
 * admin page that has no overview grid.
 *
 * `fs-appearance` used to be the other entry here (System -> System) until it got a route of its
 * own (`/admin/system/footstrap`, `view/footstrap/appearance.js`) and the tab it had been stapled
 * onto came out; a page reached by menu.d is loaded by the dispatcher, not by this map.
 *
 * The module keeps its own `body[data-page]` observer; `wire()` re-checks the page
 * synchronously, so a module arriving after the stamp still starts watching.
 *
 * The map duplicates a page name that also lives inside the module; `npm run page-modules`
 * derives both sides and fails on drift. */
const PAGE_MODULES = {
	'admin-status-overview': 'fs-overview'
};
const _pageModules = new Map();
function wirePageModules() {
	/* through window.L, never the factory's `L`: that one carries no require() of its own */
	const RT = window.L;
	const load = () => {
		const name = PAGE_MODULES[document.body.getAttribute('data-page') || ''];
		if (!name || _pageModules.has(name)) return;
		_pageModules.set(name, RT.require(name).then((m) => m.wire()).catch((e) => {
			/* a failed page module costs only its own page's extras: drop it and retry the next
			 * time that page comes up */
			_pageModules.delete(name);
			console.error('footstrap: ' + name + ' did not load', e);
		}));
	};
	/* the server's stamp is already in the DOM; every later one is the router's */
	new MutationObserver(load).observe(document.body, { attributes: true, attributeFilter: [ 'data-page' ] });
	load();
}

/* ---- the search palette, held at arm's length ----
 *
 * The palette is 5 KB and opens on a keystroke most sessions never press, so it is not required
 * here: this holds the shortcut and fetches the module on the first gesture. What CANNOT wait is
 * the recents list — it has to be written on every navigation, or it is empty on the first open —
 * and the warm pass that uses it, so both live here, in the file every page already loads.
 *
 * The palette reads the list back from localStorage when it opens, so the two halves share the key
 * and nothing else. */
const RECENT_KEY = 'fs-recent';
const RECENT_MAX = 8;
const RECENT_WARM = 5;

/* A key is a menu path, or a page path plus the heading of a section inside it
 * (`admin/system/system#Footstrap`) — a section has no dispatcher node to name it, and only the
 * source that produced the row can build that half. Exported for exactly that: the writer stays
 * one function, or the two halves would drift on the cap and the de-duplication. */
function remember(key) {
	if (typeof key !== 'string' || !key) return;
	const recent = prefs.lsGetArr(RECENT_KEY).filter((x) => typeof x === 'string');
	prefs.lsSet(RECENT_KEY, JSON.stringify([ key ].concat(recent.filter((p) => p !== key)).slice(0, RECENT_MAX)));
}

/* the page half of a key: what the router can navigate to and what warmRecent() prefetches */
function pageOf(key) {
	const h = key.indexOf('#');
	return h < 0 ? key : key.slice(0, h);
}

/* ---- warm the pages this admin actually uses ----
 *
 * The router's per-link prefetch needs a hover, tap or focus first, so a session's first visit to a
 * page still pays for its module chain. The recents list is the best predictor available and is
 * already on disk; warming the whole menu instead would pull every view module on the box
 * (docs/spa-router.md).
 *
 * The current page is skipped — remember() has just recorded it and it is loaded by definition.
 * Under saveData nothing speculative runs; the per-link prefetch stays, since it follows a
 * deliberate hover or tap. Nothing waits on this, so it runs at idle, with a long fallback delay:
 * it competes with the view's own module fetches and RPCs and must lose that race. */
function warmRecent() {
	try { if (navigator.connection && navigator.connection.saveData) return; } catch (e) {}
	const here = (L.env.dispatchpath || []).join('/');
	/* Keys, not paths: a section key names the page it sits on, and two sections of one page must
	 * warm it once — the module chain is the page's. */
	const keys = prefs.lsGetArr(RECENT_KEY).filter((p) => typeof p === 'string');
	const paths = [ ...new Set(keys.map(pageOf)) ].filter((p) => p !== here).slice(0, RECENT_WARM);
	if (!paths.length) return;
	const go = () => paths.forEach((p) => router.prefetchSegs(p.split('/')));
	if (typeof window.requestIdleCallback === 'function')
		window.requestIdleCallback(go, { timeout: 4000 });
	else
		window.setTimeout(go, 2000);
}

function wireSearch() {
	const btn = document.getElementById('fs-search-btn');
	if (!btn) return;
	const RT = window.L;

	/* the page this full load landed on; onNavigate covers the SPA path afterwards */
	const rememberSegs = (segs) => remember((segs || []).join('/'));
	rememberSegs(L.env.dispatchpath);
	router.onNavigate(rememberSegs);
	warmRecent();

	/* One fetch, on the first gesture. The module builds its overlay and opens itself; every later
	 * gesture reaches the same instance, `require` being a singleton.
	 *
	 * …and then this half stands down: fs-search binds its own toggle to the same button and its
	 * own copies of Ctrl+K and `/`, so while both were live the module's toggle closed the palette
	 * and this one re-opened it in the microtask after, and the button looked broken. */
	let pending = false, loaded = false;
	const open = () => {
		if (pending || loaded) return;
		pending = true;
		RT.require('fs-search').then((m) => { pending = false; loaded = true; m.open(); },
			(e) => { pending = false; console.error('footstrap: fs-search did not load', e); });
	};

	btn.addEventListener('click', () => open());
	/* the same two shortcuts the palette used to own, with the same guard: `/` must not steal a
	 * keystroke from someone typing into a field, a contenteditable, or a .cbi-dropdown, where
	 * fs-select.js's typeahead reads it as a search character */
	document.addEventListener('keydown', (ev) => {
		if (ev.defaultPrevented || loaded) return;
		if ((ev.ctrlKey || ev.metaKey) && !ev.altKey && (ev.key === 'k' || ev.key === 'K')) {
			ev.preventDefault(); open(); return;
		}
		if (ev.key !== '/' || ev.ctrlKey || ev.metaKey || ev.altKey) return;
		if (ev.target.closest?.('input, textarea, select, [contenteditable], .cbi-dropdown')) return;
		ev.preventDefault(); open();
	});
}

/* ---- optional companion packages ----
 *
 * header.ut prints `window.__fsPlugins` from `footstrap.settings.plugin`, a list a package writes
 * from its own uci-defaults; each entry is a LuCI module name, already whitelisted there. The
 * chrome requires each one after everything below is wired — a plugin registers itself through the
 * seams the theme exports (`fs-router.onNavigate`, `fs-search.addSource`) and the theme names
 * nobody. A plugin that throws costs only itself.
 *
 * No plugin, no cost: an empty list is the shipped state and this loop does nothing. */
function loadPlugins() {
	const RT = window.L;
	const names = Array.isArray(window.__fsPlugins) ? window.__fsPlugins : [];
	names.forEach((name) => {
		RT.require(name).catch((e) => console.error('footstrap: plugin ' + name + ' did not load', e));
	});
}

/* warn/danger split for the meter fill (theme/25-progressbar.css): a DECISION, not a measurement —
 * 20% of an 84 MiB overlay and 20% of an 8 GiB disk are different news at the same reading, and a
 * plain percentage is kept anyway so every meter on the page reads the same way. */
const FS_METER_WARN = 80;
const FS_METER_DANGER = 92;
/* The same two thresholds, read off the OTHER end of the bar: forum #134 caught a memory row whose
 * fill is "how much is left", not "how much is used" — a 91% "Total Available" reading is healthy,
 * not a warning, and a 100%-full "Swap free" is the BEST possible reading, not permanent danger
 * (both measured live, docs/design-system.md "Meter polarity"). `100 - FS_METER_WARN/DANGER` rather
 * than a second pair of numbers: an inverted bar and a used-based one are the same health question
 * ("how much headroom is left") asked from opposite ends of one fill, so a future change to the
 * used-based split moves this one with it instead of drifting apart. */
const FS_METER_INVERTED_WARN = 100 - FS_METER_WARN;
const FS_METER_INVERTED_DANGER = 100 - FS_METER_DANGER;

/* Row labels this theme has SEEN misread, matched the same way fs-overview.js's `ROLES` matches a
 * card title: `_(msgid)` against the msgid luci-mod-status's own 20_memory.js used to build the
 * row, no msgctxt, so it resolves to the exact string that include rendered. Verified against
 * modules/luci-base/po/ru/base.po (the i18n-scan target for every luci-mod-status string that
 * carries no msgctxt of its own — the same catalogue "System"/"Memory"/"Storage" already resolve
 * from for `ROLES`): all four msgids below have a `ru` entry there, so they are in the domain
 * loaded on EVERY admin page, not a per-view one — unlike `_('Free')`, which has no entry in that
 * file at all and comes back as the literal English word wherever it is tried. That is what makes
 * evaluating these two Sets once, at module scope, on whichever page happens to load first, safe:
 * the string is the same from every admin page, not only from Status -> Overview.
 *
 * INVERTED: the fill is "how much is left" — the warn/danger split above has to fire on a LOW
 * reading. NEUTRAL: a cache or buffer is the kernel doing its job, not a resource running out;
 * colouring it at any reading says something false, so it gets none, ever. Everything else keeps
 * the plain fill-based rule below — seventeen bars measured live (storage, active connections) are
 * used-based with no name this theme recognises, and a third-party app's own meter is unnamed by
 * construction, so the fill-based default has to stay the FALLBACK, not a shrinking allow-list. */
const FS_METER_INVERTED = new Set([ _('Total Available'), _('Swap free') ]);
const FS_METER_NEUTRAL = new Set([ _('Buffered'), _('Cached') ]);

/* Write an attribute only when the value actually changes, so a poll tick that reads the same
 * numbers back touches no DOM and fires no attribute-mutation observer. `value === null` removes
 * the attribute instead of writing the string "null". */
function fsSyncAttr(el, name, value) {
	if (value === null) {
		if (el.hasAttribute(name)) el.removeAttribute(name);
	} else if (el.getAttribute(name) !== value) {
		el.setAttribute(name, value);
	}
}

/* The meter's name, if the markup already states one — never invented. A `.cbi-value` row's own
 * label (the RSSI/RSRP gallery shape) or a key/value table row's first cell (Memory, Storage, CPU
 * load on Overview) each stand for the whole row; a bare meter with neither (Software's disk-space
 * bar, the package manager) gets no `aria-label` written at all, and Chromium's accessible-name
 * computation then falls back to `title` — which is the reading, not a name ("95 / 100 (95%)"),
 * measured with `Accessibility.getPartialAXTree`. That fallback cannot be closed from here: `title`
 * is the ONLY source `::after { content: attr(title) }` has for the visible percentage
 * (styles/theme/25-progressbar.css), so removing it would blank the bar for a sighted reader too. */
function findProgressbarLabel(pg) {
	const row = pg.closest('.cbi-value');
	let label = row ? row.querySelector('.cbi-value-title') : null;
	if (!label) {
		const tr = pg.closest('.tr');
		if (tr) {
			const own = pg.closest('.td, td');
			const cell = tr.querySelector('.td, td');
			if (cell && cell !== own) label = cell;
		}
	}
	return label;
}

/* The percentage inside a meter's `title`, in any shape a caller writes it in: `window.progressbar`
 * below composes `'%s / %s (%d%%)'`, parenthesised and preceded by the byte/localised reading; a
 * bare meter markup may carry just `'97%'` with nothing around it (docs/gallery.html); and the
 * package-manager's own disk bar (`view/system/packages.js`, not this theme's) leads with it
 * instead — `'6% used (62.91 GiB used of 1006.85 GiB, 943.95 GiB free)'`, measured live, ru
 * `'6% использовано (…)'` the same shape. The first two are anchored at the END of the string, so
 * neither can match a stray "%" earlier in a localised reading; tried first, so an ordinary
 * `'X / Y (Z%)'` title is never misread by the rule below. The third is anchored at the START and
 * tried only when both fail: digits immediately followed by `%`, nothing before them — it cannot
 * match the leading "62" of "62.91 GiB" (a decimal point follows those digits, not `%`), so it
 * cannot pick a wrong number out of a title carrying several. An empty title or one with no
 * percentage in any of the three shapes yields null, on purpose — nothing to annotate. `%d` is the
 * unclamped percentage, so the result can still read past 100 or under 0 and is clamped by the
 * caller, the same way `window.progressbar` clamps its own `level`, below. Exported for
 * tests/meter.test.mjs, which is the only caller that needs the parse on its own. */
function parseMeterPercent(title) {
	if (title == null) return null;
	const m = (/\((-?\d+)%\)\s*$/).exec(title) || (/(-?\d+)%\s*$/).exec(title) || (/^(-?\d+)%/).exec(title);
	return m ? parseInt(m[1], 10) : null;
}

/* The attribute work `window.progressbar` and a bare `.cbi-progressbar` node both need — Status ->
 * Overview's own 20_memory.js, 25_storage.js and 30_network.js (luci-mod-status) declare and call
 * their OWN local `progressbar()`, a straight copy of the same upstream body, so this theme's
 * global never runs on the meters those stock includes actually draw. `annotateMeters()` below
 * walks the DOM after the fact instead of owning every writer; the threshold split and the name
 * logic stay in this one function either way, so the two callers cannot drift apart. */
function annotateMeter(pg) {
	const title = pg.getAttribute('title');
	const pc = parseMeterPercent(title);
	if (pc == null) return;
	const level = pc < 0 ? 0 : (pc > 100 ? 100 : pc);
	fsSyncAttr(pg, 'role', 'progressbar');
	fsSyncAttr(pg, 'aria-valuemin', '0');
	fsSyncAttr(pg, 'aria-valuemax', '100');
	fsSyncAttr(pg, 'aria-valuenow', String(level));
	fsSyncAttr(pg, 'aria-valuetext', title);
	const label = findProgressbarLabel(pg);
	const name = label ? label.textContent.trim() : '';
	fsSyncAttr(pg, 'aria-label', label ? name : null);
	/* Polarity: an unrecognised bar (a third-party app's own meter included — see the Sets above)
	 * keeps the plain fill-based rule, on purpose. A wrong red is worse than a missing colour, but a
	 * MISSING colour on the common case — a used-based fill, which is what an app most often draws —
	 * is worse still, and this theme has no signal at all to tell an unnamed app meter apart from
	 * one of the seventeen used-based bars measured live on Overview alone. */
	let dataLevel = null;
	if (FS_METER_NEUTRAL.has(name)) {
		/* never coloured: see the comment on the Set */
	} else if (FS_METER_INVERTED.has(name)) {
		dataLevel = level <= FS_METER_INVERTED_DANGER ? 'danger'
			: (level <= FS_METER_INVERTED_WARN ? 'warn' : null);
	} else {
		dataLevel = level >= FS_METER_DANGER ? 'danger' : (level >= FS_METER_WARN ? 'warn' : null);
	}
	fsSyncAttr(pg, 'data-fs-level', dataLevel);
}

/* Every `.cbi-progressbar[title]` under `root` — the markup itself, not who last drew it. Called
 * from fs-overview.js's own poll-tick observer (see there for why this file does not run a second
 * one); `fsSyncAttr` above makes a re-run over an unchanged bar a no-op read. */
function annotateMeters(root) {
	(root || document).querySelectorAll('.cbi-progressbar[title]').forEach(annotateMeter);
}

/* The three template globals Status -> Overview needs, defined where ordering is guaranteed.
 *
 * `admin_status/index.ut` defines `progressbar`, `renderBox` and `renderBadge` in an inline script
 * the stock includes (18_cpu, 30_network, 60_wifi…) call bare from their own `render()`. An SPA
 * arrival never runs that script, so the theme is their only definition — and a late definition is
 * a `ReferenceError` from a stock include on a page already committed to the document.
 *
 * They live here rather than in `fs-overview.js` because a page module is required DURING the
 * navigation that needs it, racing the router's own require of the view class with nothing
 * ordering the two. This file is required by the footer on every page and evaluates before the
 * router exists.
 *
 * Bodies are verbatim from upstream except for three deltas: L.itemlist -> window.L.itemlist (the
 * two-L trap, docs/spa-router.md); renderBox's `[title]` — dom.append parses a scalar child as
 * innerHTML (luci.js:1395) and an array member as text (:1383), and this file defines the global on
 * every admin page where upstream defines it on Status -> Overview alone; and progressbar's
 * accessibility attributes (role, aria-value*, data-fs-level) — upstream's copy writes the reading
 * into `title` alone, which nothing reads back for a screen reader off a generated `::after`. Same
 * output on the other two: nothing in 24.10, 25.12 or master calls renderBox, and progressbar's
 * `title` and fill width are untouched.
 *
 * `renderBox`/`renderBadge` keep the `typeof` guard: a full page load runs the template's inline
 * `<script>` first, in document order, before this module evaluates, so upstream has already
 * declared both — the guard just avoids overwriting an identical body. `progressbar` CANNOT reuse
 * that guard: upstream's copy of the same name wins that exact race, and it is the one WITHOUT the
 * accessibility attributes below. Guarded, the theme's version only ever won when a page other than
 * Status -> Overview loaded first and the SPA router then navigated here without a reload — which
 * is a real gap, not the common case. The assignment is unconditional so the accessible copy always
 * wins, on a full load and on an SPA arrival alike. */
function ensureOverviewHelpers() {
	/* eslint-disable no-var -- these three bodies are copies of LuCI's admin_status/index.ut so
	   they can be diffed against upstream when it changes. Modernising the `var`s would break
	   that property, which is what makes carrying the copies safe. */
	window.progressbar = function(query, value, max, byte) {
		var pg = document.querySelector(query),
		    vn = parseInt(value) || 0,
		    mn = parseInt(max) || 100,
		    fv = byte ? String.format('%1024.2mB', value) : value,
		    fm = byte ? String.format('%1024.2mB', max) : max,
		    pc = Math.floor((100 / mn) * vn),
		    reading = '%s / %s (%d%%)'.format(fv, fm, pc);
		if (pg) {
			pg.firstElementChild.style.width = pc + '%';
			pg.setAttribute('title', reading);
			/* Accessible value, colour and name: annotateMeter() re-parses `reading` back out
			 * of `title` rather than reusing `pc` here directly, so a bare `.cbi-progressbar`
			 * this function never touched is annotated the identical way — the clamp, the
			 * label lookup and the warn/danger split stay in that one function. */
			annotateMeter(pg);
		}
	};
	if (typeof window.renderBox !== 'function')
		window.renderBox = function(title, active, childs) {
			childs = childs || [];
			childs.unshift(window.L.itemlist(E('span'), [].slice.call(arguments, 3)));
			return E('div', { class: 'ifacebox' }, [
				E('div', { class: 'ifacebox-head center ' + (active ? 'active' : '') },
					E('strong', [title])),
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

ensureOverviewHelpers();

/* Chrome bootstrap: load the menu tree once, hand it to the parts that need it and wire them in
 * order. It renders nothing itself — every piece lives in its own module:
 *
 *   fs-menutree    path <-> menu node, alias/firstchild resolution (a port of dispatcher.uc)
 *   fs-prefs       the Appearance axes and their localStorage
 *   fs-widgets     the inline-SVG wrapper, the disclosure primitives, the colour control
 *   fs-chrome      mode menu, section tabs, the rail toggle, the "does it still fit" measurements
 *   fs-router      the SPA client router (docs/spa-router.md)
 *   fs-sheets      the guard against a view's injected CSS repainting every later page
 *   fs-search      the page-search palette (indexes the same tree, on first open)
 *   fs-appearance  the Appearance controls, drawn by its own routed page (menu.d, not this map)
 *   fs-overview    the overview grid — a theme module, not a luci-mod-status include
 *   fs-version     the shipped version string
 *
 * They compose by calling, never by inheriting: LuCI makes every required module a singleton, so
 * `base.extend` across modules throws (docs/conventions.md). Hence the main menu arriving as a
 * callback — menu-footstrap.js injects renderMainMenu rather than overriding a method. A
 * require() cycle raises DependencyError, so the graph is a DAG by construction and the shared
 * halves (fs-menutree, fs-prefs) are separate modules. */

return baseclass.extend({
	/* the seam a companion package writes its own rows into the recents list through; see
	 * remember() for what a key is */
	remember,

	/* the seam fs-overview.js calls, on its own already-coalesced poll-tick observer, to annotate
	 * the meters a stock Status -> Overview include draws with its own local progressbar() */
	annotateMeters,

	/* module-private otherwise: tests/meter.test.mjs drives the percent parse and the clamp/threshold
	 * split directly rather than through a live `.cbi-progressbar[title]` walk */

	init(renderMainMenu) {
		/* First, and outside the promise: a third-party sheet that outranks the chrome is already
		 * painting (fs-sheets: openclash's `* { margin: 0; padding: 0 }`). Deferring this to
		 * ui.menu.load() extends the broken frame by a round trip, or forever when the .catch()
		 * below swallows a menu failure. */
		sheets.watchViewSheets();
		prefs.guardDarkStamp();		/* same, for a third party stamping :root */
		prefs.watchThemeColor();	/* the mobile address bar, from the live page colour */

		ui.menu.load().then((menu) => {
			tree.setTree(menu);
			chrome.setRenderMain(renderMainMenu);

			/* the view this full load already rendered — see fs-router's seed() */
			router.seed();

			/* the bar's "does the menu fit beside the brand" measurement joins the engine the
			 * tables use: re-run on every #view resize and on content mutations */
			fit.add(chrome.fitChrome);

			chrome.renderChrome();
			wireSearch();
			chrome.wireRail();
			chrome.wireIndicatorCounts();
			/* before router.wire(): the router restamps body[data-page] on every SPA navigation,
			 * and that attribute is what the page modules key off */
			wirePageModules();
			router.wire();
			router.wireVisibility();
			/* last: a plugin registers against the parts above, and a broken one must not be able
			 * to take the chrome with it */
			loadPlugins();
		/* no sane partial recovery — a throw above loses the menu, the router and the Appearance
		 * tab together — so this fails loudly rather than silently */
		}).catch((e) => console.error('footstrap: chrome init failed', e));
	}
});
