'use strict';
'require baseclass';
'require ui';
'require fs-fit as fit';
'require fs-prefs as prefs';
'require fs-menutree as tree';

/* The chrome AROUND the content: the mode menu, the section tabs, the rail toggle, and the
 * measurements that decide how much room any of it gets. The MAIN menu is not here — it is injected
 * by menu-footstrap.js as a callback (renderMainMenu), because LuCI instantiates every required
 * module into a singleton and so a renderer cannot be a subclass of the chrome (docs/conventions.md). */

/* the injected main-menu renderer; handed over once by the theme's init() */
let _renderMain = null;
function setRenderMain(fn) {
	_renderMain = fn;
}

/* section tabs -> #tabmenu (horizontal) */
function renderTabMenu(node, url, level) {
	const container = document.querySelector('#tabmenu');
	/* a template without the container must not reject: an unhandled rejection here kills the
	 * whole ui.menu.load() chain, i.e. every menu */
	if (!container)
		return E([]);
	const ul = E('ul', { 'class': 'tabs' });
	const children = ui.menu.getChildren(node);
	let activeNode = null;

	children.forEach((child) => {
		const isActive = (L.env.dispatchpath[3 + (level || 0)] === child.name);
		/* aria-current="page", not just the `active` class: the class is paint, which a screen
		 * reader cannot see. E() drops a null attribute value, so inactive tabs carry nothing. */
		ul.appendChild(E('li', { 'class': 'tabmenu-item-%s %s'.format(child.name, isActive ? 'active' : '') }, [
			E('a', { 'href': L.url(url, child.name), 'aria-current': isActive ? 'page' : null }, [ _(child.title) ])
		]));
		if (isActive)
			activeNode = child;
	});

	if (ul.children.length === 0)
		return E([]);

	container.appendChild(ul);
	container.style.display = '';

	if (activeNode)
		renderTabMenu(activeNode, url + '/' + activeNode.name, (level || 0) + 1);

	return ul;
}

/* ---- tab-strip auto-fit ----
 * A tab strip (#tabmenu, or a view's own .cbi-tabmenu) can carry ~11 pills (luci-app-justclash)
 * that overflow one row. Rather than wrap, shrink: two density classes (styles/theme/40-tabs.css)
 * trim padding, then gap+font. Floored so a pill never gets tighter than its label — past the
 * floor the strip is allowed to wrap. */
function stripFitsOneRow(ul) {
	/* Only laid-out children count: a display:none child has offsetTop 0, so taking it as `last`
	 * read as "one row" while the strip had in fact wrapped, and the density fit never fired. */
	const items = [...ul.children].filter((el) => el.getClientRects().length > 0);
	const first = items[0], last = items[items.length - 1];
	/* one row iff first and last item share a top edge */
	return !first || !last || first.offsetTop === last.offsetTop;
}
function fitTabStrips() {
	/* `.fs-sidebar > ul.nav` is the main menu in EVERY layout — the same list — so the
	 * flexDirection check below is what tells a bar (row) from a vertical sidebar (column),
	 * where a one-row measure is meaningless. */
	document.querySelectorAll('.tabs, .cbi-tabmenu, .fs-sidebar > ul.nav').forEach((ul) => {
		if (ul.children.length < 2) return;
		if (ul.matches('.fs-sidebar > ul.nav') && getComputedStyle(ul).flexDirection !== 'row') {
			/* vertical list: the measure would floor it at fs-dense2 forever. Clear and skip. */
			if (ul.classList.contains('fs-dense1') || ul.classList.contains('fs-dense2'))
				ul.classList.remove('fs-dense1', 'fs-dense2');
			return;
		}
		/* steady state (poll tick on an already-fitting strip): one measure, no class writes —
		 * the write-measure-write dance below forces a reflow per strip, every second. */
		if (!ul.classList.contains('fs-dense1') && !ul.classList.contains('fs-dense2') && stripFitsOneRow(ul))
			return;
		ul.classList.remove('fs-dense1', 'fs-dense2');
		if (stripFitsOneRow(ul)) return;
		ul.classList.add('fs-dense1');
		if (stripFitsOneRow(ul)) return;
		ul.classList.remove('fs-dense1');
		ul.classList.add('fs-dense2');	/* floor: leave wrapped if it still overflows */
	});
}
/* ---- does the CONTENT column still have room, once the sidebar has taken its cut? ----
 *
 * The sidebar gives way to the bar when what is LEFT for the content would be too narrow to read.
 * A viewport breakpoint (`@media (max-width: 767px)`) cannot say that: the cut is not a constant —
 * 224px expanded, 68px collapsed to the rail — so one breakpoint gave both states the same answer,
 * and the rail folded away at the same width as the full sidebar, the ~156px it had just freed
 * buying the user nothing. Do NOT measure the RENDERED sidebar either: the answer would depend on
 * the state it is deciding (once it is a bar there is no cut, so the content "fits", so it
 * un-narrows, so it cuts again) — oscillation.
 *
 * The widths come from the STYLESHEET (02-tokens.css), which is what lays the sidebar out; never
 * restate them here, or narrowing the rail in CSS leaves this subtracting the old width with no gate
 * able to see it. Memoised because fitShell runs on every resize and mutation and getComputedStyle
 * forces a style recalc; the fallbacks stop an empty custom property making the measurement NaN
 * (`NaN < NaN` is false, so the sidebar would simply never yield). */
/* A CUSTOM PROPERTY IS UNTYPED, so its computed value is a token stream and not a length.
 * `parseFloat(getComputedStyle(root).getPropertyValue('--fs-sidebar-w'))` therefore reads
 * `calc(224px * 1)` — a string starting with `c` — and returns NaN, which the fallbacks below turn
 * straight back into the literals this function exists to stop restating. It read correctly until
 * the Density axis wrapped three of the four tokens in `calc(… * var(--fs-density-box))`; only
 * `--fs-content-min`, still a bare `500px`, kept working, which is why the failure was one-sided
 * and silent. Measured on the router: content-min 500, and sidebar/rail/pad all NaN.
 *
 * Resolve them the way the platform actually offers without registering the property: assign the
 * token to a REAL length property on a throwaway element and read the used value back. */
let _probe = null;
/* THE PROBE IS A PLAIN <div> IN THE SHARED DOCUMENT, so a third-party app's CSS can style it, and
 * every one of its declarations is !important for that reason alone. It carries no chrome mark, so
 * `fs-sheets`'s fence deliberately does not spare it (the fence protects the chrome's own elements),
 * and even a fenced sheet still matches an unmarked div. Issue #19: an app whose stylesheet carried
 * `div { min-width: 500px !important }` won every read — all four tokens came back 500 — so the cut
 * the sidebar was said to take became 500 + 2x500 and `fitShell` folded the sidebar into a bar on a
 * 1857px desktop. The threshold that produces is exactly 500 + 500 + 1000 = 2000 CSS px, which is
 * why it was reported as a ZOOM bug: Chrome at 90% gives 2063 CSS px and passed, 100% gives 1857 and
 * failed. Inline !important is what answers it — a style-attribute declaration outranks any author
 * rule at the same importance, so there is nothing left for the app to out-rank.
 * box-sizing is stated for the same reason: getComputedStyle().width is the CONTENT box, so a
 * foreign `border-box` plus padding would shave the reading (the padding/border resets below are
 * important, but only a stated box-sizing makes them provably irrelevant). */
function resolveLen(token, dflt) {
	if (!_probe) {
		_probe = document.createElement('div');
		_probe.setAttribute('aria-hidden', 'true');
		/* out of flow, no box, no ink: it must never affect layout, scroll extent or hit-testing */
		_probe.style.cssText = 'position:absolute!important;visibility:hidden!important;' +
			'pointer-events:none!important;height:0!important;box-sizing:content-box!important;' +
			'min-width:0!important;max-width:none!important;border:0!important;' +
			'padding:0!important;margin:0!important;';
		document.body.appendChild(_probe);
	}
	_probe.style.setProperty('width', 'var(' + token + ')', 'important');
	const v = parseFloat(getComputedStyle(_probe).width);
	return Number.isFinite(v) ? v : dflt;
}

/* Memoised because fitShell runs on every resize and mutation and resolving forces a style recalc —
 * but keyed on the DENSITY, because that is the one thing that changes these widths at runtime
 * (`prefs.applyDensity()` stamps `:root[data-density]` and calls fit.schedule() precisely so they
 * are re-measured). Reading one attribute is free; the memo without the key meant a density change
 * re-measured against the widths of the density before it. */
/* The last resort, stated ONCE so the fallbacks and the sanity net below cannot restate the
 * stylesheet's widths in two different places. Reaching for these means the measurement failed. */
const GEOM_DFLT = { contentMin: 500, sidebarW: 224, railW: 68, contentPad: 56 };

let _geom = null, _geomDensity = null;
function shellGeometry() {
	const density = document.documentElement.getAttribute('data-density') || '';
	if (_geom && _geomDensity === density) return _geom;
	_geomDensity = density;
	const px = (name, dflt) => resolveLen(name, dflt);
	const g = {
		contentMin: px('--fs-content-min', GEOM_DFLT.contentMin),
		sidebarW:   px('--fs-sidebar-w', GEOM_DFLT.sidebarW),
		railW:      px('--fs-rail-w', GEOM_DFLT.railW),
		/* the token is ONE side's padding; the column loses it twice */
		contentPad: px('--fs-content-pad', GEOM_DFLT.contentPad / 2) * 2
	};
	/* Plausibility, and it costs one comparison: the rail IS the sidebar collapsed, so
	 * 0 < railW < sidebarW holds by construction. Both known ways this measurement fails destroy
	 * that — a hijacked probe reports ONE foreign width for all four (issue #19), a renamed or
	 * absent token reports 0 for all four (an abs-positioned empty div with `width:auto` shrinks to
	 * 0, and 0 is finite, so the per-read fallback above never fires). Neither can be seen in the
	 * numbers one at a time; the RELATION between them is what gives it away. */
	_geom = (g.railW > 0 && g.railW < g.sidebarW && g.contentMin > 0) ? g : Object.assign({}, GEOM_DFLT);
	return _geom;
}

function fitShell() {
	const root = document.documentElement;
	if (prefs.currentLayout() === 'top') {		/* no sidebar, no cut, nothing to decide */
		root.removeAttribute('data-narrow');
		return;
	}
	const g = shellGeometry();
	const cut = prefs.currentRail() ? g.railW : g.sidebarW;
	/* clientWidth, not innerWidth: the column the content actually gets excludes a classic
	 * scrollbar, and innerWidth includes it — 15-17px of phantom room on Linux/Windows, i.e. the
	 * 500px floor really fired at ~484. */
	const content = document.documentElement.clientWidth - cut - g.contentPad;
	/* toggleAttribute, NOT setAttribute: a same-value setAttribute still QUEUES a mutation record
	 * (measured in Chromium: 5 identical setAttribute('data-narrow','') -> 5 records; toggleAttribute
	 * on an already-present attribute -> 0). fitShell runs from fitChrome, which fs-fit calls on every
	 * mutation batch inside #view — i.e. once a second on any polled page. menu-footstrap observes
	 * data-narrow and treats each record as a mode CHANGE, so on a phone (390 - 224 - 56 = 110 < 500,
	 * so the attribute is permanently set) every poll tick re-fired closeFlyouts() and the section the
	 * user had just tapped open snapped shut, forever. The bug was one-sided and therefore invisible
	 * on a desktop: the else-branch removeAttribute on an absent attribute already fires 0 records. */
	root.toggleAttribute('data-narrow', content < g.contentMin);
}

function fitChrome() {
	fitShell();

	const bar = document.querySelector('.fs-sidebar');
	const menu = document.getElementById('topmenu');
	/* The top bar is MEASURED at every width — no 768 floor. It used to bail below 768 and hand
	 * the job to a phone-bar media query, which left the sub-768 bar pinning its dropdowns to the
	 * left edge and never collapsing "Refreshing"; the shrink/compact/stack escalation below now
	 * runs at any width for the top layout. (The SIDEBAR layout still has its own phone bar,
	 * decided by fitShell's data-narrow, and is untouched here.) */
	const topBar = !!bar && !!menu && prefs.isTopLayout();

	if (bar) bar.classList.remove('fs-bar-stack', 'fs-ind-compact', 'fs-bar-actrow');
	fitTabStrips();
	/* ---- does the main menu fit on the brand's row? ----
	 * Whether it fits depends on how many sections THIS router has (stock 5, a loaded box 11), not
	 * on the viewport — so it is measured, not a breakpoint. `@media (max-width: 1199px)` stacked
	 * it on every laptop: a stock bar's contents come to ~683px, i.e. one row fits down to ~723px.
	 * Measured UNSTACKED (the remove above): a stacked menu owns a whole row and would "fit",
	 * flipping straight back — oscillation.
	 *
	 * The menu's own pills wrapping IS the "does not fit" signal, but only because the unstacked
	 * top bar is flex-wrap: nowrap (50-toplayout.css); otherwise the BAR wraps, hands the menu
	 * a whole row, and it always "fits". Do NOT measure the bar's children by offsetTop instead:
	 * the bar is align-items:center with children of differing heights, so their offsetTop differs
	 * even on one row (that read as "wrapped" for a 5-section menu). */
	if (topBar && !stripFitsOneRow(menu)) {
		/* First step before stacking: collapse the poll pill ("Refreshing", ~90px) to an icon
		 * square and re-measure — that width alone is often enough to keep the menu on the
		 * brand's row and skip the second row entirely (styles/theme/50-toplayout.css). */
		bar.classList.add('fs-ind-compact');
		fitTabStrips();
		if (!stripFitsOneRow(menu)) {
			bar.classList.add('fs-bar-stack');
			fitTabStrips();
		}
	}

	/* The cluster's own escalation, for EVERY bar — the top layout at any width, and the sidebar
	 * layout once fitShell has stamped data-narrow. It runs after the menu's, because on the top
	 * layout .fs-bar-stack has by then given the menu its own row and taken it out of the sum. */
	if (bar && (topBar || document.documentElement.hasAttribute('data-narrow')))
		fitCluster(bar, menu);
}

/* ---- does the right-hand cluster still fit beside the brand? ----
 *
 * The same question as the menu's, one row up, and it cannot be asked the same way. The cluster is
 * four SIBLINGS — the indicators, Search, Appearance, Log out — so flexbox wraps them ONE AT A
 * TIME: measured on a 380px phone bar, Log out alone dropped onto a second row and sat at its LEFT
 * edge under the hostname, while the other three stayed up top. Either the whole cluster shares the
 * brand's row or it takes a row of its own, right-aligned; there is no useful state in between.
 *
 * Two steps, cheapest first: collapse the pills to icon squares (~200px of prose on a bar showing
 * both), and only if that still overflows give the cluster a row. .fs-ind-compact may already be
 * set by the menu's escalation above — adding it twice is free, and it must NOT be cleared here:
 * whoever asked for it still needs it. */
function fitCluster(bar, menu) {
	bar.classList.remove('fs-bar-actrow');
	if (clusterFitsBrandRow(bar, menu))
		return;

	bar.classList.add('fs-ind-compact');
	if (clusterFitsBrandRow(bar, menu))
		return;

	bar.classList.add('fs-bar-actrow');
}

/* Add the widths up rather than read positions: the bar is align-items:center over children of
 * differing heights, so offsetTop differs even on ONE row — the same trap the menu measurement
 * documents above. The menu is excluded because it owns a full-width row of its own in every bar
 * (`ul.nav { flex: 1 1 100% }`), so it is never what the cluster competes with. */
function clusterFitsBrandRow(bar, menu) {
	const cs = getComputedStyle(bar);
	const gap = parseFloat(cs.columnGap) || 0;
	const room = bar.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
	let need = -gap;

	for (const el of bar.children) {
		/* offsetParent is null for a display:none child, which is most of them in a bar:
		 * .fs-navlabel, .fs-spacer and #modemenu never show there, and #indicators is empty
		 * (and so hidden) until the first poll pill lands. */
		if (el === menu || el.offsetParent === null)
			continue;
		need += el.offsetWidth + gap;
	}

	return need <= room;
}
/* No observer and no resize listener of our own: fs-fit owns both, and this file used to grow the
 * second one docs/conventions.md warns against. A view renders its .cbi-tabmenu into #view, which fs-fit's
 * MutationObserver already watches — and it re-fits SYNCHRONOUSLY (rule 2), where the copy here
 * deferred through fit.schedule(), i.e. the duplicate was strictly the slower path into the same
 * work. #tabmenu is a sibling of #view rather than inside it, but nothing writes it except
 * renderChrome(), which schedules a fit itself. Resize is fs-fit's ResizeObserver on #view (with a
 * window-resize fallback where there is no RO). */

/* modes -> #modemenu; drives the injected renderMainMenu for the active mode */
function renderModeMenu(node, renderMainMenu) {
	const ul = document.querySelector('#modemenu');
	const children = ui.menu.getChildren(node);

	children.forEach((child, index) => {
		const isActive = L.env.requestpath.length
			? child.name === L.env.requestpath[0]
			: index === 0;

		/* the main menu must render even if a template has no #modemenu — only the mode
		 * list itself is skippable chrome */
		if (ul)
			ul.appendChild(E('li', { 'class': isActive ? 'active' : '' }, [
				E('a', { 'href': L.url(child.name) }, [ _(child.title) ])
			]));

		if (isActive)
			renderMainMenu(child, child.name);
	});

	if (!ul)
		return;
	if (children.length <= 1)
		ul.classList.add('single');
	if (ul.children.length > 1)
		ul.style.display = '';
}

/* rebuild mode menu + main menu + section tabs from the current L.env; on first load and after
 * every SPA nav. Containers are cleared first so a re-render does not stack duplicates. */
function renderChrome() {
	const root = tree.tree();
	const modemenu = document.querySelector('#modemenu');
	const topmenu  = document.querySelector('#topmenu');
	const tabmenu  = document.querySelector('#tabmenu');

	if (modemenu) { modemenu.innerHTML = ''; modemenu.style.display = 'none'; modemenu.classList.remove('single'); }
	if (topmenu)  topmenu.innerHTML = '';
	if (tabmenu)  { tabmenu.innerHTML = ''; tabmenu.style.display = 'none'; }

	renderModeMenu(root, _renderMain);

	if (L.env.dispatchpath.length >= 3) {
		let node = root, url = '';
		/* `node.children &&`, exactly as fs-menutree's nodeForSegs() walks it: a node without
		 * children is an ordinary leaf, and reading `.children[…]` off one is a TypeError that
		 * escapes renderChrome() — i.e. it takes out the mode menu, the tabs and, on the init path,
		 * everything menu-footstrap-common wires after it. The walk already tests `node` on each
		 * step; testing only half of what it dereferences is what left the hole. */
		for (let i = 0; i < 3 && node; i++) {
			node = node.children && node.children[L.env.dispatchpath[i]];
			url = url + (url ? '/' : '') + L.env.dispatchpath[i];
		}
		if (node)
			renderTabMenu(node, url);
	}

	fit.schedule();
}

/* Sidebar rail toggle: collapse the sidebar to an icon-only strip. The state lives on
 * <html data-rail> (head.ut re-applies it before paint) and in localStorage; everything else —
 * flyout submenus, hidden labels — is CSS keyed off that attribute. */
function wireRail() {
	const btn = document.getElementById('fs-rail-toggle');
	if (!btn) return;

	function sync() {
		const on = prefs.currentRail();
		btn.setAttribute('aria-expanded', on ? 'false' : 'true');
		const label = on ? _('Expand menu') : _('Collapse menu');
		btn.setAttribute('aria-label', label);
		btn.setAttribute('title', label);
	}

	btn.addEventListener('click', () => {
		prefs.applyRail(!prefs.currentRail());
		sync();
		/* the sidebar's cut just changed by ~156px, so the content column may now clear (or fall
		 * below) --fs-content-min: re-measure rather than wait for a resize that is not coming */
		fit.schedule();
	});

	sync();
}

/* An indicator pill carries its whole meaning as prose — LuCI writes "Unsaved Changes: 2" — and the
 * collapsed rail is 68px wide. Measured on the router: the pill wants 86px, wraps onto three lines
 * and hangs 34px past the rail's edge over the content (issue #14). The rail is an icon strip, so
 * CSS squares the pill there and draws this attribute instead of the label; a text node cannot be
 * reached by a selector, which is why the badge has to be lifted into one here.
 *
 * The COUNT is what it shows — the only part that changes and the only part worth reading at that
 * size. A pill with no trailing number (a third-party app's "Backup pending") falls back to a
 * neutral dot: clipping the prose was tried and rendered "up pen", because a centred pill gives an
 * ellipsis no start to anchor to. Choosing between the two is a decision, so it lives here rather
 * than as a second CSS rule. The full prose stays in the label either way — a screen reader still
 * reads it, and `title` keeps it reachable by pointer. */
const IND_DOT = '•';

function wireIndicatorCounts() {
	const box = document.getElementById('indicators');
	if (!box) return;

	function stamp() {
		box.querySelectorAll('[data-indicator]').forEach((el) => {
			const txt = el.textContent || '';
			const m = txt.match(/(\d+)\s*$/);
			el.setAttribute('data-fs-badge', m ? m[1] : IND_DOT);
			/* the rail hides the prose; the tooltip is where it stays reachable by pointer */
			el.setAttribute('title', txt);
		});
	}

	/* ui.showIndicator REPLACES the label's text node on an update ("Unsaved Changes: 1" -> ": 2")
	 * and appends the span on the first change of the session, so both matter — and characterData
	 * too, for the in-place rewrite. Our own attribute writes do not re-enter: attributes are not
	 * observed. */
	new MutationObserver(stamp).observe(box, { childList: true, subtree: true, characterData: true });
	stamp();
}

return baseclass.extend({
	setRenderMain,
	renderChrome,
	wireIndicatorCounts,
	/* registered with fs-fit by the theme's init(): the bar's "does the menu fit beside the brand"
	 * measurement rides the same engine as the data tables' */
	fitChrome,
	wireRail
});
