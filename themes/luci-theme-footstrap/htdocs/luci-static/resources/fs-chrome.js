'use strict';
'require baseclass';
'require ui';
'require fs-fit as fit';
'require fs-prefs as prefs';
'require fs-menutree as tree';

/* The chrome around the content: the mode menu, the section tabs, the rail toggle and the
 * measurements deciding how much room each gets. The main menu is injected by menu-footstrap.js as
 * a callback (renderMainMenu), since a required LuCI module is a singleton and a renderer cannot
 * subclass the chrome (docs/conventions.md). */

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
		/* aria-current, not just the `active` class, which is paint a screen reader cannot see.
		 * E() drops a null attribute value, so inactive tabs carry nothing. */
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
 * that overflow one row. Rather than wrap, shrink: two density classes (theme/40-tabs.css) trim
 * padding, then gap+font. Floored so a pill never gets tighter than its label; past the floor the
 * strip may wrap. */
function stripFitsOneRow(ul) {
	/* only laid-out children count: a display:none child has offsetTop 0, so taking it as `last`
	 * reads as "one row" on a strip that has wrapped */
	const items = [...ul.children].filter((el) => el.getClientRects().length > 0);
	const first = items[0], last = items[items.length - 1];
	/* one row iff first and last item share a top edge */
	return !first || !last || first.offsetTop === last.offsetTop;
}
function fitTabStrips() {
	/* `.fs-sidebar > ul.nav` is the main menu in every layout, so the flexDirection check below
	 * is what tells a bar (row) from a vertical sidebar (column), where a one-row measure is
	 * meaningless */
	document.querySelectorAll('.tabs, .cbi-tabmenu, .fs-sidebar > ul.nav').forEach((ul) => {
		if (ul.children.length < 2) return;
		if (ul.matches('.fs-sidebar > ul.nav') && getComputedStyle(ul).flexDirection !== 'row') {
			/* vertical list: the measure would floor it at fs-dense2 forever */
			if (ul.classList.contains('fs-dense1') || ul.classList.contains('fs-dense2'))
				ul.classList.remove('fs-dense1', 'fs-dense2');
			return;
		}
		/* steady state (poll tick on an already-fitting strip): one measure, no class writes —
		 * the write-measure-write below forces a reflow per strip, on every tick */
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
/* ---- does the content column still have room, once the sidebar has taken its cut? ----
 *
 * The sidebar gives way to the bar when what is left for the content would be too narrow to read.
 * A viewport breakpoint cannot say that: the cut is 224px expanded and 68px as a rail, so one
 * breakpoint gives both states the same answer and the rail folds away at the same width as the
 * full sidebar. Do not measure the RENDERED sidebar either — the answer would depend on the state
 * it is deciding (as a bar there is no cut, so the content fits, so it un-narrows) and oscillate.
 *
 * The widths come from the stylesheet (02-tokens.css) and are never restated here, or narrowing
 * the rail in CSS leaves this subtracting the old width with no gate able to see it.
 *
 * A custom property is untyped, so `parseFloat(getComputedStyle(root).getPropertyValue(…))` reads
 * `calc(224px * 1)` and returns NaN — silently, since `NaN < NaN` is false and the sidebar simply
 * never yields. Assign the token to a real length property on a throwaway element and read the
 * used value back instead. */
let _probe = null;
/* The probe is a plain <div> in the shared document, so a third-party app's CSS can style it —
 * it carries no chrome mark and the fence deliberately does not spare it. Every declaration is
 * therefore !important, which a style-attribute wins outright: an app carrying
 * `div { min-width: 500px !important }` otherwise wins every read and the sidebar folds into a bar
 * on a 1857px desktop (issue #19) — the cut becomes 500 + 500 + 1000 = 2000 CSS px, which is why it
 * was reported as a zoom bug: Chrome at 90% gives 2063 CSS px and passes, 100% gives 1857 and
 * fails. box-sizing is stated for the same reason — getComputedStyle().width is
 * the content box, so a foreign `border-box` plus padding would shave the reading. */
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

/* Memoised because fitShell runs on every resize and mutation and resolving forces a style recalc,
 * but keyed on the density: that is the one thing changing these widths at runtime
 * (`prefs.applyDensity()` stamps `:root[data-density]` and calls fit.schedule() for exactly that).
 *
 * The defaults are stated once so the fallbacks and the sanity net below cannot restate the
 * stylesheet's widths in two places. Reaching for them means the measurement failed. */
const GEOM_DFLT = { contentMin: 500, sidebarW: 224, railW: 68, contentPad: 56, contentMax: 1280 };
/* the class name toggled below by fitShell's own escalation and by fitCluster's (measured: 16 B x3
 * -> 25 B, 23 B saved) */
const CLASS_IND_COMPACT = 'fs-ind-compact';

let _geom = null, _geomDensity = null, _geomWarned = false;
function shellGeometry() {
	const density = document.documentElement.getAttribute('data-density') || '';
	/* contentMax moves with data-content-width (02-tokens.css), the other three widths do not, but
	 * they are one memo and the axis's own applier calls fit.schedule() same as Density's — folded
	 * into the same key rather than a second one, or a content-width change alone would hit the
	 * density-only key and go on answering the previous contentMax until density also changed */
	const cwidth = document.documentElement.getAttribute('data-content-width') || '';
	const key = density + '|' + cwidth;
	/* the gutter is re-asked even on a memo hit: it moves with the width, not the density */
	if (_geom && _geomDensity === key) return _geom;
	_geomDensity = key;
	const px = (name, dflt) => resolveLen(name, dflt);
	const g = {
		contentMin: px('--fs-content-min', GEOM_DFLT.contentMin),
		sidebarW:   px('--fs-sidebar-w', GEOM_DFLT.sidebarW),
		railW:      px('--fs-rail-w', GEOM_DFLT.railW),
		/* the token is one side's padding; the column loses it twice. It is only the fallback —
		 * measureShell() overwrites this with the gutter the column actually got, which nothing
		 * has measured before the first fitter (and the login page has no `.fs-content`). */
		contentPad: px('--fs-content-pad', GEOM_DFLT.contentPad / 2) * 2,
		/* where the column stops growing, i.e. where surplus becomes margin — see columnWidth() */
		contentMax: px('--fs-content-max', GEOM_DFLT.contentMax)
	};
	/* Plausibility, at the cost of one comparison: the rail is the sidebar collapsed, so
	 * 0 < railW < sidebarW holds by construction. Both known failures destroy it — a hijacked probe
	 * reports one foreign width for all four (issue #19), a renamed or absent token reports 0 for
	 * all four (an abs-positioned empty div shrinks to 0, which is finite, so the per-read fallback
	 * never fires). Only the relation between the numbers gives either away. */
	const sane = (g.railW > 0 && g.railW < g.sidebarW && g.contentMin > 0);
	/* The fallback keeps the chrome laid out, but on built-in literals, so the sidebar folds at a
	 * width nobody chose while the page still looks correct. Say so, or a renamed token ships
	 * green. Once per document — this runs on every resize and mutation. */
	if (!sane && !_geomWarned) {
		_geomWarned = true;
		console.error('footstrap: the chrome widths did not read back from the stylesheet (got '
			+ JSON.stringify(g) + ') — falling back to the built-in defaults. A --fs-* width token was '
			+ 'renamed, or a foreign sheet is reaching the measurement probe.');
	}
	_geom = sane ? g : Object.assign({}, GEOM_DFLT);
	if (_shellPad != null) _geom.contentPad = _shellPad;
	return _geom;
}

/* The window's width and the column's gutter are read here, from a fitter or from
 * `contentWidth()`'s own staleness check below — nowhere else.
 *
 * The gutter is measured where it is applied rather than read off `--fs-content-pad`: below 767px
 * `theme/20-shell.css` re-pads `.fs-content` to `var(--fs-space-4)`, so the token says 28px a side
 * while the real gutter is 16px. The breakpoint may not be restated here — a width literal in JS is
 * what these reads exist to avoid — so the element is asked what it actually got.
 *
 * `clientWidth` is a layout read and `getComputedStyle` resolves style, so a fitter is the one
 * caller allowed to reach BOTH unconditionally: it defers the whole pass during a flick
 * (`fit.scrolling()`, fs-fit.js) rather than pay either mid-scroll. `contentWidth()` reaches only
 * the first (comparison, not the write) on every call, and this function's own body only when
 * that comparison says the width moved — its answer is otherwise the geometry as of the last still
 * moment, exactly what a fitter last measured.
 *
 * A hostile declaration is no threat here: `.fs-content` carries no chrome mark, so if an app
 * re-pads it then that padding IS the column's gutter. Before any fitter has run — the login page
 * has no `.fs-content` — the token stands in. */
let _shellOuter = 0, _shellPad = null, _padAt = null;
function measureShell() {
	/* the window's own width, every time: everything downstream is measured against it */
	_shellOuter = document.documentElement.clientWidth;
	/* The gutter is resolved style and this runs on every mutation batch, so it is memoised on the
	 * three things that move it: the width (a media query re-pads the column below 767px), the
	 * density (the token is a calc over it) and the page. The page is the third term because a
	 * foreign sheet may re-pad `.fs-content`, and `sheets.scopeToCurrentPage()` enables and
	 * disables those sheets per navigation with no width or density change to notice it by;
	 * `body[data-page]` is the one attribute a navigation always restamps. */
	const key = (document.documentElement.getAttribute('data-density') || '') + '|' + _shellOuter +
		'|' + (document.body ? document.body.getAttribute('data-page') || '' : '');
	if (_padAt === key && _shellPad != null) return;
	const host = document.querySelector('.fs-content');
	const cs = host ? getComputedStyle(host) : null;
	const v = cs ? parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) : NaN;
	/* a failed read leaves the key unset, so the next pass retries rather than caching a miss */
	if (Number.isFinite(v) && v >= 0) {
		_shellPad = v;
		_padAt = key;
		if (_geom) _geom.contentPad = v;
	}
}

function columnWidth(g, state) {
	/* narrow OR top: in both the chrome is above the content, not beside it */
	const cut = (state.narrow || state.top) ? 0 : (state.rail ? g.railW : g.sidebarW);
	/* The column stops growing: `.fs-content` is `max-width: var(--fs-content-max); margin: 0
	 * auto`, so past ~1500px the surplus becomes margin, and without the cap this answers ~2280 on
	 * a 2560px window for a column that is 1224 wide. No caller can reach that today (both ask a
	 * lower bound), but this is the exported answer to "how wide is the content column". */
	const room = Math.min(state.outerW - cut, g.contentMax);
	return Math.max(0, room - g.contentPad);
}

function fitShell() {
	const root = document.documentElement;
	/* runs in both branches: the bar layout decides nothing here, but `contentWidth()` still
	 * answers in it */
	measureShell();
	if (prefs.currentLayout() === 'top') {		/* no sidebar, no cut, nothing to decide */
		root.removeAttribute('data-narrow');
		return;
	}
	const g = shellGeometry();
	/* asked uncollapsed: this measurement decides `data-narrow`, so it may not read it */
	const content = columnWidth(g, { outerW: _shellOuter, rail: prefs.currentRail() });
	/* toggleAttribute, not setAttribute: a same-value setAttribute still queues a mutation record,
	 * while toggleAttribute on an already-present attribute queues none. fitShell runs on every
	 * mutation batch inside #view, and menu-footstrap treats each data-narrow record as a mode
	 * change, so on a phone (where the attribute is permanently set) every poll tick would re-fire
	 * closeFlyouts() and snap shut the section the user just opened. */
	root.toggleAttribute('data-narrow', content < g.contentMin);
}

function fitChrome() {
	/* nothing asked here — bar width, menu width, room beside the brand — can change while the
	 * reader scrolls, and each is a layout read landing mid-flick: defer (fs-fit.js) */
	if (fit.scrolling()) {
		fit.deferMeasurement();
		return;
	}

	fitShell();

	const bar = document.querySelector('.fs-sidebar');
	const menu = document.getElementById('topmenu');
	/* The top bar is measured at every width, with no breakpoint floor: the shrink/compact/stack
	 * escalation below runs at any width. (The sidebar layout has its own phone bar, decided by
	 * fitShell's data-narrow, and is untouched here.) */
	const topBar = !!bar && !!menu && prefs.isTopLayout();

	/* THE BAR MAY NOT CHANGE HEIGHT WHILE IT IS BEING MEASURED, IN EITHER DIRECTION. The three
	 * classes below are taken off so the menu can be asked whether it fits on one row (fs-fit
	 * rule 1), and while they are off the bar's OWN box is free to answer any height its content
	 * currently needs — not only shorter. A `min-height` floor alone stops the shrink but not the
	 * grow: with the classes off and `fs-dense1`/`fs-dense2` stripped by `fitTabStrips()`, this pass
	 * measured the bar walking 230 -> 202 -> 164 -> 144 -> 123 -> 131 -> 123px against a settled
	 * 123px on owrt2512 at 767px — 107px of growth a floor never sees, on top of the shrink it does
	 * — each step landing between two of the poll's own separate section refreshes, so the browser
	 * paints in between and the reader is moved by exactly as much, on Chromium and Firefox as well
	 * as Safari (`tools/fit-quiet.mjs`, plus a probe that pauses the layout mid-pass). `min-height`
	 * alone
	 * was measured to `accc451`'s WebKit-only diagnosis instead — WebKit's own scroll anchoring
	 * looked like the whole story only because it is the one engine with no anchoring at all to hide
	 * this walk behind; Chromium and Firefox absorb it the same way they absorb any other layout
	 * change, which is not the same as not producing it.
	 *
	 * So both `min-height` AND `height` are pinned to the SAME value for the whole decision — a hard
	 * pin, not a floor — because nothing this pass measures (`stripFitsOneRow()`'s `offsetTop`,
	 * `clusterFitsBrandRow()`'s widths) reads the BAR's own height; `overflow: visible`
	 * (`theme/20-shell.css`) means a row the pin is too short for still lays out and measures
	 * correctly, it only paints past the pinned box's edge, which is invisible for the one
	 * synchronous pass before the pin comes off. The pin is released only once the final class set
	 * is decided — after `fitCluster()`, before `publishBarHeight()` — which must measure the bar
	 * the reader actually gets. */
	const pinned = bar ? Math.round(bar.getBoundingClientRect().height) : 0;
	const hadMinH = bar ? bar.style.minHeight : '';
	const hadH = bar ? bar.style.height : '';
	if (pinned > 0) { bar.style.minHeight = pinned + 'px'; bar.style.height = pinned + 'px'; }

	if (bar) bar.classList.remove('fs-bar-stack', CLASS_IND_COMPACT, 'fs-bar-actrow');
	fitTabStrips();
	/* ---- does the main menu fit on the brand's row? ----
	 * It depends on how many sections THIS router has (stock 5, a loaded box 11), not on the
	 * viewport, so it is measured — a `max-width: 1199px` breakpoint stacked it on every laptop.
	 * Measured unstacked (the remove above), because a stacked menu owns a whole row, would "fit"
	 * and flip straight back.
	 *
	 * The menu's own pills wrapping is the "does not fit" signal, and only works because the
	 * unstacked top bar is flex-wrap: nowrap (50-toplayout.css) — otherwise the bar wraps, hands
	 * the menu a row and it always fits. Do not measure the bar's children by offsetTop instead:
	 * the bar is align-items:center over children of differing heights, so offsetTop differs even
	 * on one row. */
	if (topBar && !stripFitsOneRow(menu)) {
		/* first step before stacking: collapse the poll pill (~90px) to an icon square and
		 * re-measure — often enough to keep the menu on the brand's row
		 * (theme/50-toplayout.css) */
		bar.classList.add(CLASS_IND_COMPACT);
		fitTabStrips();
		if (!stripFitsOneRow(menu)) {
			bar.classList.add('fs-bar-stack');
			fitTabStrips();
		}
	}

	/* the cluster's own escalation, for every bar; after the menu's, so a menu that did not fit
	 * has already been given a row of its own by .fs-bar-stack */
	if (bar && (topBar || document.documentElement.hasAttribute('data-narrow')))
		fitCluster(bar, menu);

	if (pinned > 0) { bar.style.minHeight = hadMinH; bar.style.height = hadH; }
	publishBarHeight(bar);
}

/* ---- how tall the bar actually is, for whoever sticks underneath it ----
 *
 * A data table's header row sticks while its rows scroll past (theme/30-tables.css), and where the
 * document scrolls it has to clear the sticky bar. `--fs-bar-h` is only the bar's DESIGNED height:
 * it grows when the brand wraps, when the menu takes a row (.fs-bar-stack) or when the cluster does
 * (.fs-bar-actrow), each decided by measurement above. So the measurement is published and the CSS
 * falls back to the token.
 *
 * Written only on a change and rounded to the pixel: this runs on every fit pass, and a custom
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
 * The cluster is four siblings (indicators, Search, Appearance, Log out), which flexbox wraps one
 * at a time: on a narrow bar Log out alone drops to a second row, left-aligned under the hostname.
 * Either the whole cluster shares the brand's row or it takes a row of its own, right-aligned.
 *
 * Two steps, cheapest first: collapse the pills to icon squares (~200px of prose), then give the
 * cluster a row. .fs-ind-compact may already be set by the menu's escalation above and must not be
 * cleared here — whoever asked for it still needs it. */
function fitCluster(bar, menu) {
	bar.classList.remove('fs-bar-actrow');
	if (clusterFitsBrandRow(bar, menu))
		return;

	bar.classList.add(CLASS_IND_COMPACT);
	if (clusterFitsBrandRow(bar, menu))
		return;

	bar.classList.add('fs-bar-actrow');
}

/* Add the widths up rather than read positions, for the offsetTop reason above. The menu is
 * excluded either way: on a row of its own (`ul.nav { flex: 1 1 100% }`) it is not competing, and
 * where it shares the brand's row it is the child that shrinks (`flex: 1 1 auto`), so counting its
 * current width would report the cluster as not fitting whenever the menu happened to be wide. */
function clusterFitsBrandRow(bar, menu) {
	const cs = getComputedStyle(bar);
	const gap = parseFloat(cs.columnGap) || 0;
	const room = bar.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
	let need = -gap;

	for (const el of bar.children) {
		/* offsetParent is null for a display:none child, which is most of them in a bar */
		if (el === menu || el.offsetParent === null)
			continue;
		need += el.offsetWidth + gap;
	}

	return need <= room;
}
/* No observer and no resize listener of our own — fs-fit owns both (docs/conventions.md). A view
 * renders its .cbi-tabmenu into #view, which fs-fit's MutationObserver already watches and re-fits
 * synchronously. #tabmenu is a sibling of #view, but nothing writes it except renderChrome(),
 * which schedules a fit itself. */

/* modes -> #modemenu; drives the injected renderMainMenu for the active mode */
function renderModeMenu(node, renderMainMenu) {
	const ul = document.querySelector('#modemenu');
	const children = ui.menu.getChildren(node);

	children.forEach((child, index) => {
		const isActive = L.env.requestpath.length
			? child.name === L.env.requestpath[0]
			: index === 0;

		/* the main menu must render even where a template has no #modemenu */
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

/* rebuild mode menu + main menu + section tabs from the current L.env, on first load and after
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
		/* `node.children &&`, as fs-menutree's nodeForSegs() walks it: a childless node is an
		 * ordinary leaf, and reading `.children[…]` off one throws out of renderChrome(), taking
		 * the mode menu, the tabs and everything init wires after it */
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
 * <html data-rail> (head.ut re-applies it before paint) and in localStorage; everything else is
 * CSS keyed off that attribute. */
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
		/* the sidebar's cut just changed by ~156px, so the column may now clear or fall below
		 * --fs-content-min: re-measure rather than wait for a resize that is not coming */
		fit.schedule();
	});

	sync();
}

/* An indicator pill carries its meaning as prose ("Unsaved Changes: 2") and the collapsed rail is
 * 68px wide, so the pill wraps onto three lines and hangs past the rail's edge (issue #14). CSS
 * squares the pill there and draws this attribute instead of the label — a text node cannot be
 * reached by a selector, so the badge is lifted into an attribute here.
 *
 * The count is the only part that changes and the only part readable at that size. A pill with no
 * trailing number falls back to a neutral dot; clipping the prose instead renders as garbage
 * ("up pen"), because a centred pill gives an ellipsis no start to anchor to. The full prose
 * stays in the label for screen readers, and in `title` for the pointer. */
const IND_DOT = '•';

/* Idempotent attribute write, so a poll tick that finds nothing changed touches no DOM — same
 * shape as `fsSyncAttr` in menu-footstrap-common.js, restated rather than imported (that file does
 * not export it). */
function syncIndAttr(el, name, value) {
	if (value === null) {
		if (el.hasAttribute(name)) el.removeAttribute(name);
	} else if (el.getAttribute(name) !== value) {
		el.setAttribute(name, value);
	}
}

/* A CLICKABLE `[data-indicator]` (the poll pill, "Unsaved Changes: N", …) ships as a bare
 * span: no role, name or tabindex, so Tab skips it and a screen reader
 * announces a run of text with no name, role or state (WCAG 2.1.1, 4.1.2). ui.showIndicator's own
 * click handler already lives on this exact element — this only adds the second, W3C-APG way to
 * reach it; it does not add a competing one. The name is the pill's own prose ("Refreshing"),
 * never invented. Enter/Space call el.click() because a <span>, unlike an <a>, gets neither key
 * for free (contrast fs-widgets.js's wireSpaceKey, written for an <a role="button">); calling
 * click() cannot double-fire the mouse handler, since a keydown is not a click. */
function wireIndicatorKeyboard(el) {
	if (el.dataset.fsWired) return;
	el.dataset.fsWired = '1';
	el.addEventListener('keydown', (ev) => {
		if (ev.key !== 'Enter' && ev.key !== ' ' && ev.key !== 'Spacebar') return;
		ev.preventDefault();
		el.click();
	});
}

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
			/* Only a CLICKABLE indicator becomes a control. `ui.showIndicator` sets
			 * `data-clickable` only when it was handed a handler, and a status-only pill is
			 * given none (luci-base ui.js; `battstatus.js` calls it with a null handler) — a
			 * `role="button"` tabstop with nothing behind it is worse than the bare span it
			 * replaces. The ring and the pointer cursor in theme/20-shell.css are scoped to
			 * `[data-clickable]` for the same reason; the two must not disagree. */
			if (el.hasAttribute('data-clickable')) {
				syncIndAttr(el, 'role', 'button');
				syncIndAttr(el, 'tabindex', '0');
				syncIndAttr(el, 'aria-label', txt.trim() || null);
				wireIndicatorKeyboard(el);
			}
		});
	}

	/* ui.showIndicator replaces the label's text node on an update and appends the span on the
	 * first change of the session, so childList, subtree and characterData all matter. Our own
	 * attribute writes do not re-enter: attributes are not observed.
	 *
	 * AND THE BAR IS RE-FITTED HERE, because a pill arriving is a layout change the fit engine
	 * cannot see: fs-fit watches `#view` and the dialog, and `#indicators` is in the chrome. The
	 * cluster then wraps — flexbox answers first — and the compact form only follows when something
	 * else happens to wake the pass. Measured on WebKit at 390px in the narrow sidebar bar, a second
	 * indicator beside the poll pill pushed the whole page down 91px and held it there for 708 ms,
	 * until `fs-ind-compact` landed at 771 ms and it snapped back: a lurch down and up, once per
	 * appearance, which is what "the Overview twitches, as if an invisible loading bar came and
	 * went" is from the reader's side. Called from the same callback as `stamp()`, so the decision
	 * is taken in the microtask before paint and the wrapped frame is never drawn. It cannot
	 * re-enter: `fitChrome()` writes classes on the BAR and attributes here, and neither is what
	 * this observer watches.
	 *
	 * ON A PILL ARRIVING OR LEAVING, not on its text: `ui.showIndicator` rewrites the poll pill's
	 * label on every tick, and a fit is a handful of forced layouts — running one per tick to answer
	 * a label that did not change width is the cost this file spends its measurements avoiding. A
	 * childList record is the cluster gaining or losing a member, which is the layout change that
	 * wraps it. */
	new MutationObserver((recs) => {
		stamp();
		if (recs.some((r) => r.type === 'childList' && r.target === box)) fitChrome();
	})
		.observe(box, { childList: true, subtree: true, characterData: true });
	stamp();
}

return baseclass.extend({
	setRenderMain,
	renderChrome,
	wireIndicatorCounts,
	/* registered with fs-fit by the theme's init(): the bar's fit rides the same engine as the
	 * data tables' */
	fitChrome,

	/* The width a page's content column has: the sidebar or rail eats a known amount of the
	 * window and the shell adds a known padding, all memoised for fitShell(). Exported because a
	 * pass answering mid-scroll (fs-select's, for a table the poll just brought in) otherwise has
	 * only the window width, which in the sidebar layout is wrong by exactly the sidebar — at
	 * 800px the column is 520px, so a table judged to have room overflows.
	 *
	 * The arithmetic is columnWidth()'s; this only adds the page's current state. */
	contentWidth() {
		/* `_shellOuter` is refreshed only by measureShell(), which only fitShell() calls, and
		 * fitChrome() steps ASIDE FOR THE WHOLE SCROLL_IDLE WINDOW (400ms, fs-fit.js) whenever
		 * fit.scrolling() answers yes — including for a resize that lands mid-flick, since a
		 * resize is exactly what starts that window (fs-fit.js's resize observer feeds the same
		 * motion sampler `scrolling()` reads). A caller landing in that window, most of all
		 * fs-select's, got the width the PREVIOUS viewport had: at 568px settling to 390px, model
		 * stayed 568 for up to 220ms of the 400 (measured: −178px, exactly 568−390, against a probe
		 * resizing the window mid-settle, and live-audit's `geometry|fs-content` finding on owrt2410,
		 * CI run 34364446910).
		 *
		 * So the window's own width is compared fresh on every call, not only when `_shellOuter`
		 * is still zero. `clientWidth` is the one read the old "no layout read" promise here was
		 * already conditional on: the bootstrap branch (no fitter has run yet) made this exact
		 * call through measureShell(). A plain `!==` compares against the cached width for free —
		 * nothing invalidated layout since the last read, so this costs nothing when nothing
		 * moved — and measureShell()'s own further reads (the resolved gutter) only run when the
		 * comparison says the width actually did. */
		if (document.documentElement.clientWidth !== _shellOuter) measureShell();
		const root = document.documentElement;
		return columnWidth(shellGeometry(), {
			outerW: _shellOuter,
			narrow: root.hasAttribute('data-narrow'),
			top: prefs.isTopLayout(),
			rail: prefs.currentRail()
		});
	},

	/* exported for tests/chrome-geometry.test.mjs (no tests ship in the package): driving the
	 * arithmetic directly is the only way to cover every combination of layout, rail and width
	 * without a browser */
	wireRail
});
