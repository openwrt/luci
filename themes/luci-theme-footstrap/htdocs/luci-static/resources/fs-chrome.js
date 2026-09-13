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
const GEOM_DFLT = { contentMin: 500, sidebarW: 224, railW: 68, contentPad: 56, contentMax: 1280 };

let _geom = null, _geomDensity = null, _geomWarned = false;
function shellGeometry() {
	const density = document.documentElement.getAttribute('data-density') || '';
	/* the gutter is re-asked even on the memo hit: it moves with the WIDTH, not with the density */
	if (_geom && _geomDensity === density) return _geom;
	_geomDensity = density;
	const px = (name, dflt) => resolveLen(name, dflt);
	const g = {
		contentMin: px('--fs-content-min', GEOM_DFLT.contentMin),
		sidebarW:   px('--fs-sidebar-w', GEOM_DFLT.sidebarW),
		railW:      px('--fs-rail-w', GEOM_DFLT.railW),
		/* the token is ONE side's padding; the column loses it twice. It is also only the FALLBACK:
		 * measureShell() overwrites this field with the gutter the column actually got, and until it
		 * has (the login page has no `.fs-content`, and nothing has measured before the first
		 * fitter) the token is the honest answer. */
		contentPad: px('--fs-content-pad', GEOM_DFLT.contentPad / 2) * 2,
		/* the cap the column stops growing at, so the model knows where the surplus becomes margin
		 * rather than gutter — see columnWidth() */
		contentMax: px('--fs-content-max', GEOM_DFLT.contentMax)
	};
	/* Plausibility, and it costs one comparison: the rail IS the sidebar collapsed, so
	 * 0 < railW < sidebarW holds by construction. Both known ways this measurement fails destroy
	 * that — a hijacked probe reports ONE foreign width for all four (issue #19), a renamed or
	 * absent token reports 0 for all four (an abs-positioned empty div with `width:auto` shrinks to
	 * 0, and 0 is finite, so the per-read fallback above never fires). Neither can be seen in the
	 * numbers one at a time; the RELATION between them is what gives it away. */
	const sane = (g.railW > 0 && g.railW < g.sidebarW && g.contentMin > 0);
	/* SAY SO when it fires. The fallback keeps the chrome laid out, which is right — but it lays it
	 * out on the literals CLAUDE.md forbids copying into JS, so from there on the sidebar folds at a
	 * width nobody chose while the page still LOOKS correct. Silent, that is how a renamed token
	 * ships green; one console line is the difference between a mystery and a grep. Once per
	 * document — this runs on every resize and every mutation. */
	if (!sane && !_geomWarned) {
		_geomWarned = true;
		console.error('footstrap: the chrome widths did not read back from the stylesheet (got '
			+ JSON.stringify(g) + ') — falling back to the built-in defaults. A --fs-* width token was '
			+ 'renamed, or a foreign sheet is reaching the measurement probe.');
	}
	_geom = sane ? g : Object.assign({}, GEOM_DFLT);
	/* the token is only the fallback; the gutter that counts is the one measureShell() read */
	if (_shellPad != null) _geom.contentPad = _shellPad;
	return _geom;
}

/* THE GUTTER IS MEASURED WHERE IT IS APPLIED, not read off the token that usually supplies it, and
 * SO IS THE WINDOW — but both are read HERE, from a fitter, and nowhere else.
 *
 * `--fs-content-pad` is what `.fs-content` uses at desktop widths, and `theme/20-shell.css` gives
 * the same element `padding: var(--fs-space-4)` below 767px: the token says 28px a side while the
 * column's gutter is 16px there. That is a 24px error in a model this file exists to keep honest,
 * and `live-audit` found it on every page at 320, 390 and 568 — the same trap the alert-message rule
 * under that media query carries a paragraph about, repeated in the JS. The breakpoint itself may
 * NOT come here: a width literal copied into JS is exactly what these reads exist to avoid, and a
 * media query has no `data-*` to key on either. Asking the element what it actually got is the only
 * form that cannot drift.
 *
 * WHY IT IS A SEPARATE FUNCTION AND WHY ONLY A FITTER CALLS IT. `clientWidth` is a LAYOUT read and
 * `getComputedStyle` resolves style; `contentWidth()` below is called mid-scroll, by the one pass in
 * this theme that must answer without reading either (fs-select's, for a table the poll brought in
 * under the reader's thumb). So the numbers are taken when a fitter runs — which is on every resize
 * and every content mutation, and never during a flick, because `fitChrome()` defers exactly like
 * every other measuring pass — and everything after that reads what was stored. Nothing they
 * describe can change without a resize, and a resize schedules a fit; a resize that lands DURING a
 * scroll is deferred with the rest, so a mid-scroll answer is the geometry as of the last still
 * moment, which is the trade this whole file is built on.
 *
 * Unlike the token probe above, a hostile app's declaration is not a threat here: `.fs-content`
 * carries no chrome mark, so an app CAN restyle it, and if it did then that padding IS the column's
 * real gutter. What the probe must not report is a foreign answer for OUR layout; this reports the
 * layout as it stands. Before any fitter has run — the login page has no `.fs-content` at all — the
 * token stands in. */
let _shellOuter = 0, _shellPad = null, _padAt = null;
function measureShell() {
	/* the window's own width, every time: fitShell read it before this function existed and the
	 * value is what everything downstream is measured against */
	_shellOuter = document.documentElement.clientWidth;
	/* The GUTTER, though, is resolved style, and this runs on every mutation batch — once a second
	 * on any polled page. Three things move it: the width (a media query re-paddings the column
	 * below 767px), the density (the token is `calc(28px * var(--fs-density-space))`) and the PAGE.
	 * The third is the one the paragraph above already names and this key used to miss: `.fs-content`
	 * carries no chrome mark, so a foreign sheet may re-pad it — and `sheets.scopeToCurrentPage()`
	 * enables and disables those sheets on every client navigation, with no width and no density
	 * change to notice it by. Navigating off a page whose sheet re-padded the column would otherwise
	 * leave this pinned at that app's gutter for as long as the width held. `body[data-page]` is the
	 * one attribute a navigation always restamps, so it is the third term; an unchanged page still
	 * resolves nothing. Same trade as the token memo above, for the same reason. */
	const key = (document.documentElement.getAttribute('data-density') || '') + '|' + _shellOuter +
		'|' + (document.body ? document.body.getAttribute('data-page') || '' : '');
	if (_padAt === key && _shellPad != null) return;
	const host = document.querySelector('.fs-content');
	const cs = host ? getComputedStyle(host) : null;
	const v = cs ? parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) : NaN;
	/* a failed read leaves the key unset, so the next pass tries again rather than caching a miss */
	if (Number.isFinite(v) && v >= 0) {
		_shellPad = v;
		_padAt = key;
		if (_geom) _geom.contentPad = v;
	}
}

function columnWidth(g, state) {
	/* narrow OR top: in both the chrome is above the content, not beside it */
	const cut = (state.narrow || state.top) ? 0 : (state.rail ? g.railW : g.sidebarW);
	/* AND THE COLUMN STOPS GROWING. `.fs-content` is `max-width: var(--fs-content-max); margin: 0
	 * auto`, so past roughly a 1500px window the surplus becomes margin and not column: without the
	 * cap this answered ~2280 on a 2560px sidebar layout for a column that is 1224 wide. No caller
	 * can reach that today — both ask a LOWER bound (`< --fs-content-min` here, `< CRAMPED` in
	 * fs-select) and the cap only binds where both are clear by a factor of two — but this is the
	 * exported answer to "how wide is the content column", and an answer that is only true below
	 * 1500px is the kind of thing the next caller inherits without being told. */
	const room = Math.min(state.outerW - cut, g.contentMax);
	return Math.max(0, room - g.contentPad);
}

function fitShell() {
	const root = document.documentElement;
	/* the one place the window and the gutter are read — see measureShell(). It runs in BOTH
	 * branches: the bar layout decides nothing here, but `contentWidth()` still answers in it. */
	measureShell();
	if (prefs.currentLayout() === 'top') {		/* no sidebar, no cut, nothing to decide */
		root.removeAttribute('data-narrow');
		return;
	}
	const g = shellGeometry();
	/* asked UNCOLLAPSED — this is the measurement that decides `data-narrow`, so it may not read it */
	const content = columnWidth(g, { outerW: _shellOuter, rail: prefs.currentRail() });
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
	/* Nothing this function asks can change while the reader scrolls — the bar's width, the menu's
	 * width, the room beside the brand — and every one of those questions is a layout read landing
	 * in the middle of a flick. Put off until the scrolling stops; see fs-fit.js. */
	if (fit.scrolling()) {
		fit.deferMeasurement();
		return;
	}

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
	 * layout once fitShell has stamped data-narrow. It runs after the menu's, so that when the menu
	 * did NOT fit, .fs-bar-stack has already given it a row of its own. */
	if (bar && (topBar || document.documentElement.hasAttribute('data-narrow')))
		fitCluster(bar, menu);

	publishBarHeight(bar);
}

/* ---- HOW TALL THE BAR ACTUALLY IS, for whoever has to stick underneath it ----
 *
 * A data table's header row sticks while its rows scroll past (theme/30-tables.css). Where the
 * DOCUMENT scrolls — the top layout, and the sidebar layout once it has become a bar — the sticky
 * bar is what the header has to clear, and `--fs-bar-h` is only its DESIGNED height: the bar grows
 * when the brand wraps, when the menu takes a row of its own (.fs-bar-stack) or when the cluster
 * does (.fs-bar-actrow), and every one of those is decided a few lines above by measurement.
 * So the measurement is published, and the CSS falls back to the token when it is missing.
 *
 * Written only on a CHANGE and rounded to the pixel: this runs on every fit pass, and a custom
 * property write on :root invalidates style for the whole document. */
let _barH = 0;
function publishBarHeight(bar) {
	const root = document.documentElement;
	if (!bar) return;
	const h = Math.round(bar.getBoundingClientRect().height);
	if (!(h > 0) || h === _barH) return;
	_barH = h;
	root.style.setProperty('--fs-bar-live', `${h}px`);
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
 * documents above. The menu is excluded either way. Where it wraps to a row of its own it plainly
 * is not competing (`ul.nav { flex: 1 1 100% }` — the sidebar-layout bar, and the top bar once
 * .fs-bar-stack is set); where it does share the brand's row, un-stacked at `flex: 1 1 auto`
 * (theme/50-toplayout.css), it is the one child that SHRINKS, so counting its current width would
 * report the cluster as not fitting whenever the menu happened to be wide. What the cluster has to
 * fit beside is the brand and the other actions. */
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
 * renderChrome(), which schedules a fit itself. Resize is fs-fit's ResizeObserver on #view. */

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

	/* The width a page's content column has, WITHOUT reading layout. The sidebar (or the rail) eats
	 * a known amount of the window and the shell adds a known padding, and all three are already
	 * memoised against the density attribute for `fitShell()`. It is exported because a pass that
	 * must answer mid-scroll — fs-select's, for a table the poll has just brought in — otherwise has
	 * only the window's own width, which in the sidebar layout is the wrong number by exactly the
	 * sidebar: at an 800px window the column is 520px, so the cheap judgement said "plenty of room"
	 * for a table that then overflowed and was clipped.
	 *
	 * The arithmetic itself is columnWidth()'s, shared with fitShell — see there. All this adds is
	 * the page's current state, which fitShell is in the middle of deciding and this one reads. */
	contentWidth() {
		/* NO LAYOUT READ, and that is the whole point of this export: the window's width and the
		 * column's gutter are whatever the last fitter measured (measureShell), and the three
		 * attributes below are style, not layout. The bootstrap read is for a caller that arrives
		 * before any fitter has run, which cannot happen mid-scroll. */
		if (!_shellOuter) measureShell();
		const root = document.documentElement;
		return columnWidth(shellGeometry(), {
			outerW: _shellOuter,
			narrow: root.hasAttribute('data-narrow'),
			top: prefs.isTopLayout(),
			rail: prefs.currentRail()
		});
	},

	/* exported for the unit suite in the theme's own repository (tests/chrome-geometry.test.mjs — no
	 * tests ship in the package): the cut is pure arithmetic over a handful of measured numbers, and
	 * driving it directly is the only way to hold every combination of layout, rail and width
	 * without a browser */
	wireRail
});
