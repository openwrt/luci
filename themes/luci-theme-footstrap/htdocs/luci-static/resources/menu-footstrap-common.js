'use strict';
'require baseclass';
'require ui';
'require fs-fit as fit';
'require fs-menutree as tree';
'require fs-chrome as chrome';
'require fs-router as router';
'require fs-appearance as appearance';
'require fs-overview as overview';
'require fs-prefs as prefs';
'require fs-sheets as sheets';
'require fs-search as search';

/* The chrome BOOTSTRAP: load the menu tree once, hand it to the parts that need it, and wire them
 * in the right order. It renders nothing itself — every piece lives in its own module:
 *
 *   fs-menutree    path <-> menu node, alias/firstchild resolution (a port of dispatcher.uc)
 *   fs-prefs       the Appearance axes and their localStorage
 *   fs-widgets     disclosure primitives, the seg/slider controls, popup placement
 *   fs-chrome      mode menu, section tabs, the rail toggle, the "does it still fit" measurements
 *   fs-router      the SPA client router (docs/spa-router.md)
 *   fs-sheets      the guard against a view's injected CSS repainting every later page
 *   fs-search      the page-search palette (indexes the same tree, on first open)
 *   fs-appearance  the Appearance controls, appended to the stock System page
 *   fs-overview    the overview grid — a THEME module, not a luci-mod-status include
 *   fs-version     the shipped version string (shown in the Appearance section, no network)
 *
 *
 * They compose by CALLING each other, never by inheriting: LuCI instantiates every required module
 * into a singleton, so `base.extend` across modules throws and a module cannot subclass another
 * (docs/conventions.md — proven, not assumed). The same constraint is why the MAIN menu arrives as a callback:
 * menu-footstrap.js is the one renderer, and it injects renderMainMenu here rather than overriding
 * a method. LuCI raises DependencyError on a require() cycle, so the graph above is a DAG by
 * construction — the shared halves (fs-menutree, fs-prefs) were pulled out precisely so that no two
 * modules have to reach across into each other. */

return baseclass.extend({
	/* entry point: load the menu tree, render the mode menu (which drives the injected
	 * renderMainMenu) and the section tabs, and wire the chrome. */
	init(renderMainMenu) {
		/* FIRST, and outside the promise: a third-party sheet that outranks the chrome is already
		 * painting (fs-sheets: openclash's `* { margin: 0; padding: 0 }`). Nothing below depends on
		 * it, and hanging it off ui.menu.load() only made the broken frame last a round-trip
		 * longer — or forever, since the .catch() below swallows a menu failure into console. */
		sheets.watchViewSheets();
		prefs.guardDarkStamp();		/* a third party stamping :root — same shape, different vector */

		ui.menu.load().then((menu) => {
			tree.setTree(menu);
			chrome.setRenderMain(renderMainMenu);

			/* the view this full load already rendered — see fs-router's seed() */
			router.seed();

			/* the bar's "does the menu fit beside the brand" measurement joins the engine the
			 * tables use: it re-runs on every #view resize (a rail collapse and a layout toggle
			 * produce one) and on content mutations */
			fit.add(chrome.fitChrome);

			chrome.renderChrome();
			/* Both of these ADD to a stock page rather than owning a route: each watches
			 * body[data-page] and does nothing anywhere else. A theme may not register a
			 * dispatcher node — it outlives the theme that registered it. */
			appearance.wire();
			/* after setTree(): the palette indexes that tree — lazily, on its first open, but its
			 * recent-pages list is recorded from the first navigation onwards */
			search.wire();
			chrome.wireRail();
			chrome.wireIndicatorCounts();
			/* BEFORE router.wire(): the router restamps body[data-page] on every SPA navigation,
			 * and that attribute is what fs-overview keys off. Wiring its observer after the
			 * router's would still work today (the first stamp is the server's, already in the
			 * DOM), but it would make a route change racy against a listener that is not attached
			 * yet — cheap to order correctly, expensive to debug. */
			overview.wire();
			router.wire();
			router.wireVisibility();
		/* fs-chrome's renderTabMenu warns about exactly this, and the root chain was left bare: a
		 * throw anywhere in the calls above took out the menu, the router and the Appearance popover
		 * together, silently. It still fails — there is no sane partial recovery — but loudly. */
		}).catch((e) => console.error('footstrap: chrome init failed', e));
	}
});
