'use strict';
'require baseclass';
'require ui';
'require fs-fit as fit';
'require fs-prefs as prefs';
'require fs-menutree as tree';
'require fs-widgets as widgets';

/* The chrome around the content: the main menu, the mode menu, the section tabs, the rail toggle
 * and the measurements deciding how much room each gets. menu-footstrap-common.js calls wireMenu()
 * and start(); nothing else here needs wiring from outside. Spec: docs/chrome.md */

/* section tabs -> #tabmenu (horizontal) */
function renderTabMenu(node, url, level) {
	/* #tabmenu is emitted whenever this module loads (header.ut, !blank_page) */
	const container = document.querySelector('#tabmenu');
	const ul = E('ul', { 'class': 'tabs' });
	const children = ui.menu.getChildren(node);
	let activeNode = null;

	children.forEach((child) => {
		const isActive = (L.env.dispatchpath[3 + (level || 0)] === child.name);
		ul.appendChild(E('li', { 'class': 'tabmenu-item-%s %s'.format(child.name, isActive ? 'active' : '') }, [
			E('a', { 'href': L.url(url, child.name), 'aria-current': isActive ? 'page' : null }, [ _(child.title) ])
		]));
		if (isActive)
			activeNode = child;
	});

	if (ul.children.length === 0)
		return;

	container.appendChild(ul);
	container.style.display = '';

	if (activeNode)
		renderTabMenu(activeNode, url + '/' + activeNode.name, (level || 0) + 1);
}

/* ---- tab-strip auto-fit ----
 * A strip can carry ~11 pills (luci-app-justclash) that overflow one row: rather than wrap, two
 * density classes (fs-dense1, fs-dense2) shrink it. */
function stripFitsOneRow(ul) {
	const items = [...ul.children].filter((el) => el.getClientRects().length > 0);
	const first = items[0], last = items[items.length - 1];
	/* one row iff first and last item share a top edge */
	return !first || first.offsetTop === last.offsetTop;
}
function fitTabStrips() {
	document.querySelectorAll('.tabs, .cbi-tabmenu, .fs-sidebar > ul.nav').forEach((ul) => {
		if (ul.children.length < 2) return;
		if (ul.matches('.fs-sidebar > ul.nav') && getComputedStyle(ul).flexDirection !== 'row') {
			/* vertical list: the measure would floor it at fs-dense2 forever */
			if (ul.classList.contains('fs-dense1') || ul.classList.contains('fs-dense2'))
				ul.classList.remove('fs-dense1', 'fs-dense2');
			return;
		}
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
 * The sidebar yields to the bar when what is left for the content is too narrow. A viewport
 * breakpoint cannot say that: the cut depends on the slice (224 px expanded, 68 px rail). */
let _probe = null;
/* The probe is a plain <div> in the shared document (no chrome mark; the fence does not spare it),
 * so a third-party app's CSS can style it and every declaration is !important. */
function resolveLen(token, dflt) {
	if (!_probe) {
		_probe = document.createElement('div');
		_probe.id = 'fs-chrome-geom-probe';
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

/* Memoised because fitShell runs on every resize and mutation and resolving forces a style recalc;
 * keyed on the density, the one thing that changes these widths at runtime. */
const GEOM_DFLT = { contentMin: 500, sidebarW: 224, railW: 68, contentPad: 56 };
const CLASS_IND_COMPACT = 'fs-ind-compact';

let _geom = null, _geomKey = null, _geomWarned = false;
function shellGeometry() {
	const density = document.documentElement.getAttribute('data-density') || '';
	if (_geom && _geomKey === density) {
		_geom.contentPad = _shellPad ?? GEOM_DFLT.contentPad;
		return _geom;
	}
	_geomKey = density;
	const g = {
		contentMin: resolveLen('--fs-content-min', GEOM_DFLT.contentMin),
		sidebarW:   resolveLen('--fs-sidebar-w', GEOM_DFLT.sidebarW),
		railW:      resolveLen('--fs-rail-w', GEOM_DFLT.railW)
	};
	/* Plausibility, one comparison: the rail is the sidebar collapsed, so 0 < railW < sidebarW holds
	 * by construction; a hijacked probe reports a foreign width and fails it. */
	const sane = (g.railW > 0 && g.railW < g.sidebarW && g.contentMin > 0);
	if (!sane && !_geomWarned) {
		_geomWarned = true;
		console.error('footstrap: the chrome widths did not read back from the stylesheet (got '
			+ JSON.stringify(g) + ') — falling back to the built-in defaults. A --fs-* width token was '
			+ 'renamed, or a foreign sheet is reaching the measurement probe.');
	}
	_geom = sane ? g : Object.assign({}, GEOM_DFLT);
	_geom.contentPad = _shellPad ?? GEOM_DFLT.contentPad;
	return _geom;
}

/* The window's width and the column's gutter are read here (from a fitter or from
 * `contentWidth()`'s staleness check) and nowhere else; the gutter is measured where it is
 * applied. */
let _shellOuter = 0, _shellPad = null, _padAt = null;
function measureShell() {
	/* the window's own width, every time: everything downstream is measured against it */
	_shellOuter = document.documentElement.clientWidth;
	/* memoised on what moves the gutter: the width (a media query re-pads the column below 767px) and
	 * the density */
	const key = (document.documentElement.getAttribute('data-density') || '') + '|' + _shellOuter +
		'|' + (document.body ? document.body.getAttribute('data-page') || '' : '');
	if (_padAt === key) return;
	const host = document.querySelector('.fs-content');
	const cs = host ? getComputedStyle(host) : null;
	const v = cs ? parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) : NaN;
	/* a failed read leaves the key unset, so the next pass retries rather than caching a miss */
	if (Number.isFinite(v) && v >= 0) {
		_shellPad = v;
		_padAt = key;
	}
}

function columnWidth(g, state) {
	/* narrow or top: in both the chrome is above the content, not beside it */
	const cut = (state.narrow || state.top) ? 0 : (state.rail ? g.railW : g.sidebarW);
	return Math.max(0, state.outerW - cut - g.contentPad);
}

function fitShell() {
	const root = document.documentElement;
	measureShell();
	if (prefs.currentLayout() === 'top') {		/* no sidebar, no cut, nothing to decide */
		root.removeAttribute('data-narrow');
		return;
	}
	const g = shellGeometry();
	/* asked uncollapsed: this measurement decides `data-narrow`, so it may not read it */
	const content = columnWidth(g, { outerW: _shellOuter, rail: prefs.currentRail() });
	/* toggleAttribute, not setAttribute: a same-value setAttribute still queues a mutation record,
	 * toggleAttribute on a present attribute queues none, and fitShell runs on every mutation batch */
	root.toggleAttribute('data-narrow', content < g.contentMin);
}

function fitChrome() {
	if (fit.scrolling()) {
		fit.deferMeasurement();
		return;
	}

	fitShell();

	const bar = document.querySelector('.fs-sidebar');
	const menu = document.getElementById('topmenu');
	/* The top bar is measured at every width, with no breakpoint floor. */
	const topBar = prefs.isTopLayout();

	/* The bar may not change height while it is being measured, in either direction: with the three
	 * classes off and fs-dense1/2 stripped, the bar's own box answers any height its content needs, so
	 * a min-height pin holds it for the pass (230 -> 123 px inside one pass, 107 px of growth). */
	const pinned = Math.round(bar.getBoundingClientRect().height);
	if (pinned > 0) { bar.style.minHeight = pinned + 'px'; bar.style.height = pinned + 'px'; }

	bar.classList.remove('fs-bar-stack', CLASS_IND_COMPACT, 'fs-bar-actrow');
	fitTabStrips();
	/* ---- does the main menu fit on the brand's row? ----
	 * It depends on how many sections this router has (stock 5, a loaded box 11), so it is
	 * measured, not decided by a `max-width: 1199px` breakpoint. */
	if (topBar && !stripFitsOneRow(menu)) {
		/* first step before stacking: collapse the poll pill (~90px) to an icon square and re-measure */
		bar.classList.add(CLASS_IND_COMPACT);
		fitTabStrips();
		if (!stripFitsOneRow(menu)) {
			bar.classList.add('fs-bar-stack');
			fitTabStrips();
		}
	}

	if (topBar || document.documentElement.hasAttribute('data-narrow'))
		fitCluster(bar, menu);

	if (pinned > 0) bar.style.minHeight = bar.style.height = '';
	publishBarHeight(bar);
}

/* ---- how tall the bar actually is, for whoever sticks underneath it ----
 * A data table's header row sticks (theme/30-tables.css) and must clear the sticky bar;
 * `--fs-bar-h` is only the bar's designed height, so the real one is measured here. */
let _barH = 0;
function publishBarHeight(bar) {
	const root = document.documentElement;
	const h = Math.round(bar.getBoundingClientRect().height);
	if (!(h > 0) || h === _barH) return;
	_barH = h;
	root.style.setProperty('--fs-bar-live', `${h}px`);
}

/* ---- does the right-hand cluster still fit beside the brand? ----
 * The cluster is three siblings (indicators, Search, Log out), which flexbox wraps one at a time:
 * on a narrow bar Log out alone drops to a second row. */
function fitCluster(bar, menu) {
	if (clusterFitsBrandRow(bar, menu))
		return;

	bar.classList.add(CLASS_IND_COMPACT);
	if (clusterFitsBrandRow(bar, menu))
		return;

	bar.classList.add('fs-bar-actrow');
}

/* Add the widths up rather than read offsetTop: align-items:center over children of different
 * heights makes it differ even on one row. The menu is excluded, as on a row of its own it is not
 * competing. */
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

/* Null prototype: `ICONS[key]` is keyed by a menu node name a third-party package picks, and on a
 * plain literal a node called `constructor` or `__proto__` resolves out of Object.prototype. */
const ICONS = Object.assign(Object.create(null), {
	status:   '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
	system:   '<rect x="5" y="5" width="14" height="14" rx="2"/><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/>',
	services: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2.6"/>',
	network:  '<circle cx="6" cy="18" r="2.4"/><circle cx="18" cy="6" r="2.4"/><circle cx="18" cy="18" r="2.4"/><path d="M8 16 16 8M8 18h7.5M18 8.5V16"/>',
	vpn:      '<rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
	docker:   '<rect x="3" y="11" width="4" height="4" rx=".7"/><rect x="8" y="11" width="4" height="4" rx=".7"/><rect x="13" y="11" width="4" height="4" rx=".7"/><rect x="8" y="6" width="4" height="4" rx=".7"/><path d="M18 13c0 4-3 6-8 6-4 0-7-2-7-4"/>',
	_default: '<circle cx="12" cy="12" r="8.5"/>'
});

function iconSvg(name) {
	const key = String(name || '').toLowerCase();
	const body = ICONS[key]
		|| ((/vpn|wireguard|openvpn/).test(key) ? ICONS.vpn : null)
		|| ((/dock|container|lxc/).test(key) ? ICONS.docker : null)
		|| ((/net|wifi|wireless|firewall|dhcp/).test(key) ? ICONS.network : null)
		|| ((/serv|dnsmasq|cron/).test(key) ? ICONS.services : null)
		|| ((/stat|overview|dash/).test(key) ? ICONS.status : null)
		|| ICONS._default;
	return widgets.svgIcon(body);
}

/* Is a section's panel a popup (flyout / bar dropdown) rather than an unfolded accordion? `.open`
 * means two things: in the expanded sidebar an unfolded accordion section (several may be open); in
 * the rail or the bar a popup panel (exactly one open). Reads the stylesheet's own input,
 * `data-narrow`, stamped by fitShell() before the menu renders; never a viewport query. */
function flyoutMode() {
	return prefs.currentRail() || prefs.isTopLayout() ||
	       document.documentElement.hasAttribute('data-narrow');
}

/* The trigger — a bare <a>. setOpen() below keeps `.open` and aria-expanded in step. */
const TRIGGER = ':scope > a';
const OPEN_LI = '#topmenu > li.open';

/* ---- disclosure primitives ----
 * A section header is a W3C-APG disclosure control: an <a role="button"> owning a panel it shows
 * and hides. */

/* Every open and close goes through here so `.open` and aria-expanded cannot disagree. */
function setOpen(li, on) {
	li.classList.toggle('open', on);
	li.querySelector(TRIGGER)?.setAttribute('aria-expanded', on ? 'true' : 'false');
}

/* ---- dropdown edge-clamp (the bar, at every width) ----
 * A bar panel hangs off its own item (theme/20-shell.css), so an item near the inline-end edge
 * overflows the viewport: the panel is nudged back inside. */
/* how close the panel may come to the viewport edge before it is nudged back in */
const EDGE_GAP = 8;
/* Is this panel a bar dropdown (anchored under its item) rather than a rail flyout (anchored
 * beside it)? Same input as the stylesheet: `data-narrow`. */
function barDropdown() {
	return prefs.isTopLayout() || document.documentElement.hasAttribute('data-narrow');
}
function clampDropdown(li) {
	if (!barDropdown()) return;
	const menu = li.querySelector(':scope > ul');
	if (!menu) return;

	if (li._fsClampRaf) window.cancelAnimationFrame(li._fsClampRaf);
	li._fsClampRaf = window.requestAnimationFrame(() => {
		li._fsClampRaf = 0;
		menu.style.insetInlineStart = '';	/* back to the CSS anchor before measuring */
		const r = menu.getBoundingClientRect();
		if (!r.width) return;			/* still hidden — nothing to place */

		/* RTL anchors at right:0, so only the left edge can leave (a 220 px panel on a 390 px viewport
		 * sits at -130 px); both edges use the logical property. */
		const rtl = window.getComputedStyle(menu).direction === 'rtl';
		const over = rtl ? EDGE_GAP - r.left : r.right - (window.innerWidth - EDGE_GAP);
		if (over > 0)
			menu.style.insetInlineStart = -Math.min(over,
				rtl ? window.innerWidth - EDGE_GAP - r.right : r.left - EDGE_GAP) + 'px';
	});
}
function clearClamps() {
	document.querySelectorAll('#topmenu ul').forEach((m) => { m.style.insetInlineStart = ''; });
}

function closeFlyouts() {
	document.querySelectorAll(OPEN_LI).forEach((o) => setOpen(o, false));
}

function restoreAccordion() {
	const auto = prefs.currentAutoCollapse();
	document.querySelectorAll('#topmenu > li.has-sub').forEach((li) => {
		const name = li.dataset.name || '';
		setOpen(li, li.classList.contains('active') || (!auto && _openSections.has(name)));
	});
}

/* Which top-level sections are unfolded, by node name: renderChrome() rebuilds #topmenu on every
 * SPA nav, so an opened section would otherwise refold on every tab switch. */
const OPEN_KEY = 'fs-menu-open';
function loadOpenSections() {
	return new Set(prefs.lsGetArr(OPEN_KEY));
}
function saveOpenSections() {
	prefs.lsSet(OPEN_KEY, JSON.stringify(Array.from(_openSections)));
}
const _openSections = loadOpenSections();

/* main sections -> vertical sidebar list (#topmenu), collapsible */
function renderMainMenu(node, url, level, parentActive = true) {
	const ul = level ? E('ul', {}) : document.querySelector('#topmenu');
	const children = ui.menu.getChildren(node);

	/* #topmenu is emitted whenever this module loads (header.ut, !blank_page) */
	if (children.length === 0)
		return E([]);

	const idx = (level || 0) + 1;

	/* read once per render: the click and pointerenter handlers below re-read at event time */
	const flyout = flyoutMode(), auto = prefs.currentAutoCollapse();

	children.forEach((child, i) => {
		if (!level && child.name === 'logout')
			return;

		const isActive = parentActive && L.env.dispatchpath[idx] === child.name;
		/* only sections carry a panel; a leaf's own children are never rendered */
		const submenu = level ? E([]) : renderMainMenu(child, url + '/' + child.name, 1, isActive);
		const hasSub = !!submenu.firstElementChild;

		const keepOpen = hasSub && !flyout && !auto;
		const startOpen = hasSub && !flyout &&
			(isActive || (keepOpen && _openSections.has(child.name)));
		if (keepOpen && startOpen && !_openSections.has(child.name)) {
			_openSections.add(child.name);
			saveOpenSections();
		}
		const chevron = hasSub
			? widgets.svgIcon('<path d="M9 6l6 6-6 6"/>', 'fs-chevron')
			: '';

		/* `active` only paints the item; aria-current is what a screen reader reads, and belongs on the
		 * leaf alone. */
		const link = E('a', {
			'href': hasSub ? '#' : L.url(url, child.name),
			'class': (isActive && !hasSub) ? 'active' : '',
			'aria-current': (isActive && !hasSub) ? 'page' : null
		});
		link.innerHTML = (level ? '' : iconSvg(child.name)) + '<span class="fs-label"></span>' + chevron;
		link.querySelector('.fs-label').textContent = _(child.title);

		if (!level) {
			link.setAttribute('data-label', _(child.title));
			if (hasSub)
				submenu.setAttribute('data-title', _(child.title));
		}

		const li = E('li', {
			'class': [
				isActive ? 'active' : '',
				hasSub ? 'has-sub' : '',
				startOpen ? 'open' : ''
			].join(' ').trim()
		}, [ link, submenu ]);
		/* for restoreAccordion(): the remembered set is matched back to live <li>s by name */
		if (!level) li.dataset.name = child.name;

		if (hasSub) {
			/* W3C APG disclosure navigation: a section header is a button owning a panel, not a link to "#".
			 * Not role="menu": site navigation must not take on the menubar pattern's arrow-key semantics. */
			const subId = 'fs-sub-' + i;
			submenu.id = subId;
			link.setAttribute('role', 'button');
			link.setAttribute('aria-controls', subId);
			link.setAttribute('aria-expanded', startOpen ? 'true' : 'false');

			link.addEventListener('click', (ev) => {
				ev.preventDefault();
				const open = li.classList.contains('open');
				if (flyoutMode()) {
					closeFlyouts();
					setOpen(li, !open);
					if (!open) clampDropdown(li);	/* tap-opened panel must fit too */
					return;
				}
				/* the sidebar accordion folds the others back only when asked
				 * (Appearance -> Submenus) */
				if (prefs.currentAutoCollapse()) { closeFlyouts(); _openSections.clear(); }
				setOpen(li, !open);
				/* remember the accordion state so any navigation restores it (Keep open) */
				if (!open) _openSections.add(child.name);
				else _openSections.delete(child.name);
				saveOpenSections();
			});

			widgets.wireActivate(link, () => link.click());

			/* hybrid devices: once a real mouse enters, drop the tap-opened panel so hover is authoritative;
			 * guarded on pointerType, since a touch tap fires pointerenter ('touch') first */
			li.addEventListener('pointerenter', (ev) => {
				if (ev.pointerType === 'mouse' && flyoutMode())
					closeFlyouts();
				clampDropdown(li);
			});
		}

		ul.appendChild(li);
	});

	return ul;
}

/* modes -> #modemenu; drives renderMainMenu for the active mode */
function renderModeMenu(node) {
	/* #modemenu is emitted whenever this module loads (header.ut, !blank_page) */
	const ul = document.querySelector('#modemenu');
	const children = ui.menu.getChildren(node);

	children.forEach((child, index) => {
		const isActive = L.env.requestpath.length
			? child.name === L.env.requestpath[0]
			: index === 0;

		ul.appendChild(E('li', { 'class': isActive ? 'active' : '' }, [
			E('a', { 'href': L.url(child.name) }, [ _(child.title) ])
		]));

		if (isActive)
			renderMainMenu(child, child.name);
	});

	if (children.length <= 1)
		ul.classList.add('single');
	if (ul.children.length > 1)
		ul.style.display = '';
}

function renderChrome() {
	const root = tree.tree();
	const modemenu = document.querySelector('#modemenu');
	const topmenu  = document.querySelector('#topmenu');
	const tabmenu  = document.querySelector('#tabmenu');

	modemenu.innerHTML = ''; modemenu.style.display = 'none'; modemenu.classList.remove('single');
	topmenu.innerHTML = '';
	tabmenu.innerHTML = ''; tabmenu.style.display = 'none';

	renderModeMenu(root);

	const segs = L.env.dispatchpath.slice(0, 3);
	const node = segs.length === 3 && tree.nodeForSegs(segs);
	if (node)
		renderTabMenu(node, segs.join('/'));

	fit.schedule();
}

/* Sidebar rail toggle: collapse the sidebar to an icon-only strip. The state lives on <html
 * data-rail> (head.ut re-applies it before paint) and in localStorage. */
function wireRail() {
	/* #fs-rail-toggle is emitted whenever this module loads (header.ut, !blank_page) */
	const btn = document.getElementById('fs-rail-toggle');

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
		fit.schedule();
	});

	sync();
}

/* An indicator pill carries its meaning as prose ("Unsaved Changes: 2") and the collapsed rail is
 * 68px wide, so the pill would wrap onto three lines: CSS squares the pill and draws the count
 * written here. */
const IND_DOT = '•';

/* A clickable `[data-indicator]` (the poll pill, "Unsaved Changes: N", …) ships as a bare span: no
 * role, name or tabindex, so Tab skips it and a screen reader announces text with no role. */
function wireIndicatorKeyboard(el) {
	if (el.dataset.fsWired) return;
	el.dataset.fsWired = '1';
	widgets.wireActivate(el, () => el.click());
}

function wireIndicatorCounts() {
	/* #indicators is emitted whenever this module loads (header.ut, !blank_page) */
	const box = document.getElementById('indicators');

	function stamp() {
		box.querySelectorAll('[data-indicator]').forEach((el) => {
			const txt = el.textContent || '';
			const m = txt.match(/(\d+)\s*$/);
			widgets.syncAttr(el, 'data-fs-badge', m ? m[1] : IND_DOT);
			/* the rail hides the prose; the tooltip is where it stays reachable by pointer */
			widgets.syncAttr(el, 'title', txt);
			/* Only a clickable indicator becomes a control: `ui.showIndicator` sets `data-clickable` only when
			 * it was handed a handler (luci-base ui.js). */
			if (el.hasAttribute('data-clickable')) {
				widgets.syncAttr(el, 'role', 'button');
				widgets.syncAttr(el, 'tabindex', '0');
				widgets.syncAttr(el, 'aria-label', txt.trim() || null);
				wireIndicatorKeyboard(el);
			}
		});
	}

	/* ui.showIndicator sets the label's data on an update and appends the span on the session's first
	 * change, so childList, subtree and characterData matter; attributes are not observed, so our own
	 * writes do not loop. */
	new MutationObserver(() => {
		stamp();
		fitChrome();
	})
		.observe(box, { childList: true, subtree: true, characterData: true });
	stamp();
}

function wireMenu() {
	/* click-outside and Escape close an open flyout, gated on flyoutMode(): outside it `.open` means
	 * an unfolded accordion, which must not fold on a click elsewhere (WCAG 2.2 SC 1.4.13). */
	document.addEventListener('click', (ev) => {
		if (flyoutMode() && !ev.target.closest?.('#topmenu > li.has-sub'))
			closeFlyouts();
	});
	document.addEventListener('keydown', (ev) => {
		/* the search palette preventDefaults the Escape it handles; without this guard the same keypress
		 * also folds a keyboard-opened flyout */
		if (ev.defaultPrevented || ev.key !== 'Escape' || !flyoutMode()) return;
		const open = document.querySelector(OPEN_LI);
		if (!open) return;
		const trigger = open.querySelector(TRIGGER);
		closeFlyouts();
		trigger?.focus();
	});

	/* Entering flyout mode folds everything, or a section left open as an accordion reappears as a
	 * popup stuck on screen; leaving it restores the accordion. Watch the attribute, not the rail
	 * button. */
	const modeChanged = () => {
		clearClamps();
		flyoutMode() ? closeFlyouts() : restoreAccordion();
	};
	/* data-narrow is the third attribute flyoutMode() reads (fitShell() writes it): narrowing the
	 * window must also run the transition handler. */
	new MutationObserver(modeChanged).observe(document.documentElement, {
		attributes: true, attributeFilter: [ 'data-rail', 'data-layout', 'data-narrow' ]
	});
	/* No media-query listener: the top bar is measured at every width (fitChrome), so the attribute
	 * observer and the resize clamp-clear cover every transition. */

	/* a clamp computed at the old width is wrong at the new one; coalesced via fit.frame (resize fires
	 * dozens of times a second while dragging) */
	let lastWidth = window.innerWidth;
	const reclamp = fit.frame(clearClamps);
	window.addEventListener('resize', () => {
		if (window.innerWidth === lastWidth) return;
		lastWidth = window.innerWidth;
		reclamp();
	});

	/* Appearance -> Submenus -> auto-collapse: fs-prefs.js owns the stored value and only announces
	 * the change; the remembered set, `.open` and aria-expanded are ours. */
	document.addEventListener('fs-autocollapse', (ev) => {
		if (ev.detail?.on) {
			_openSections.clear();
			saveOpenSections();
		}
		if (!flyoutMode()) restoreAccordion();
	});
}

/* The one call the theme's init() makes once the menu tree is loaded; the bar's fit joins fs-fit
 * (re-run on every #view resize and mutation) before the first measure. */
function start() {
	fit.add(fitChrome);
	renderChrome();
	wireRail();
	wireIndicatorCounts();
}

return baseclass.extend({
	renderChrome,
	wireMenu,
	start,

	/* The width a page's content column has: the sidebar or rail eats a known amount of the window and
	 * the shell adds a known padding, all memoised for fitShell(). Exported because a pass answering
	 * mid-scroll needs it. */
	contentWidth() {
		/* `_shellOuter` is refreshed only by measureShell(), and fitChrome() steps aside for the whole
		 * SCROLL_IDLE window (400ms, fs-fit.js) while fit.scrolling() answers yes; a resize that moves the
		 * offset first would read a stale one. */
		if (document.documentElement.clientWidth !== _shellOuter) measureShell();
		const root = document.documentElement;
		return columnWidth(shellGeometry(), {
			outerW: _shellOuter,
			narrow: root.hasAttribute('data-narrow'),
			top: prefs.isTopLayout(),
			rail: prefs.currentRail()
		});
	},
});
