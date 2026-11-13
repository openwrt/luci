'use strict';
'require baseclass';
'require ui';
'require fs-menutree as tree';
'require fs-chrome as chrome';
'require fs-router as router';
'require fs-prefs as prefs';
'require fs-sheets as sheets';

/* Chrome bootstrap: load the menu tree once, hand it to the parts that need it and wire them in
 * order; it renders nothing itself. */

/* Page modules: `fs-overview` adds to a stock page rather than owning a route, so it is required
 * only there: a `require` pragma would fetch it on every admin page. A map from `data-page` to
 * module name drives the lazy load. */
const PAGE_MODULES = {
	'admin-status-overview': 'fs-overview'
};
function wirePageModules() {
	/* through window.L, never the factory's `L`: the factory's `L` has no ui helpers, and require() caches the first requirer's binding */
	const RT = window.L;
	const load = () => {
		const name = PAGE_MODULES[document.body.getAttribute('data-page') || ''];
		if (!name) return;
		RT.require(name).then((m) => m.wire()).catch((e) => {
			console.error('footstrap: ' + name + ' did not load', e);
		});
	};
	new MutationObserver(load).observe(document.body, { attributes: true, attributeFilter: [ 'data-page' ] });
	load();
}

/* ---- the search palette, held at arm's length ----
 * The palette is 5 KB and opens on a keystroke most sessions never press, so it is not required
 * here: it is fetched on the first gesture. */
const RECENT_WARM = 5;

/* A key is a menu path — what the router can navigate to and what warmRecent() prefetches. */
function remember(key) {
	if (!key) return;
	prefs.lsSet(prefs.RECENT_KEY, JSON.stringify([ key ].concat(prefs.recentPaths().filter((p) => p !== key)).slice(0, prefs.RECENT_MAX)));
}

/* ---- warm the pages this admin actually uses ----
 * The router's per-link prefetch needs a hover, tap or focus first, so the recently visited pages
 * are warmed ahead. */
function warmRecent() {
	if (navigator.connection?.saveData) return;
	const here = (L.env.dispatchpath || []).join('/');
	/* already de-duplicated: remember() drops the key from its old slot before re-adding it */
	const paths = prefs.recentPaths().filter((p) => p !== here).slice(0, RECENT_WARM);
	if (!paths.length) return;
	const go = () => paths.forEach((p) => router.prefetchSegs(p.split('/')));
	if (typeof window.requestIdleCallback === 'function')
		window.requestIdleCallback(go, { timeout: 4000 });
	else
		window.setTimeout(go, 2000);
}

function wireSearch() {
	const btn = document.getElementById('fs-search-btn');
	const RT = window.L;

	const rememberSegs = (segs) => remember((segs || []).join('/'));
	rememberSegs(L.env.dispatchpath);
	router.onNavigate(rememberSegs);
	warmRecent();

	/* One fetch, on the first gesture; `require` is a singleton, so every later gesture reaches the
	 * same palette. This is the only owner of the button. */
	let pending = false;
	const gesture = (act) => {
		if (pending) return;
		pending = true;
		RT.require('fs-search').then((m) => { pending = false; m[act](); },
			(e) => { pending = false; console.error('footstrap: fs-search did not load', e); });
	};

	btn.addEventListener('click', () => gesture('toggle'));
	/* `/` must not steal a keystroke from someone typing into a field, a contenteditable, or a
	 * .cbi-dropdown (fs-select's typeahead) */
	document.addEventListener('keydown', (ev) => {
		if (ev.defaultPrevented) return;
		if ((ev.ctrlKey || ev.metaKey) && !ev.altKey && (ev.key === 'k' || ev.key === 'K')) {
			ev.preventDefault(); gesture('toggle'); return;
		}
		if (ev.key !== '/' || ev.ctrlKey || ev.metaKey || ev.altKey) return;
		if (ev.target.closest?.('input, textarea, select, [contenteditable], .cbi-dropdown')) return;
		ev.preventDefault(); gesture('open');
	});
}

/* The three template globals Status -> Overview needs (progressbar, renderBox, renderBadge), which
 * stock includes call bare and an SPA arrival never defines. */
function ensureOverviewHelpers() {
	/* eslint-disable no-var -- these three bodies are copies of LuCI's admin_status/index.ut so
	   they can be diffed against upstream when it changes. Modernising the `var`s would break
	   that property, which is what makes carrying the copies safe. */
	if (typeof window.progressbar !== 'function')
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

return baseclass.extend({
	init() {
		/* First, and outside the promise: a third-party sheet that outranks the chrome is already painting
		 * (fs-sheets). */
		sheets.watchViewSheets();
		prefs.guardDarkStamp();		/* same, for a third party stamping :root */
		prefs.watchThemeColor();	/* the mobile address bar, from the live page colour */
		chrome.wireMenu();		/* flyout dismissal listeners: no wait on the menu fetch either */

		ui.menu.load().then((menu) => {
			tree.setTree(menu);

			/* the view this full load already rendered — see fs-router's seed() */
			router.seed();

			chrome.start();
			wireSearch();
			/* before router.wire(): the router restamps body[data-page] on every SPA navigation,
			 * and that attribute is what the page modules key off */
			wirePageModules();
			router.wire();
			/* no sane partial recovery — a throw above loses the menu, the router and the Appearance
			 * page together — so the .catch fails loudly rather than silently */
		}).catch((e) => console.error('footstrap: chrome init failed', e));
	}
});
