'use strict';
'require baseclass';
'require ui';
'require fs-fit as fit';
'require fs-prefs as prefs';
'require fs-widgets as widgets';
'require menu-footstrap-common as common';

/* The theme's ONE menu renderer: a vertical #topmenu the CSS also turns into the top bar and the
 * rail flyouts — same markup, no second renderer (docs/chrome.md). The disclosure primitives it builds
 * sections on come from fs-widgets and the auto-collapse preference from fs-prefs; the rest of the
 * chrome (mode menu, tabs, rail, router, Appearance tab) is bootstrapped by menu-footstrap-common, which
 * this file composes with by injecting renderMainMenu into common.init — a callback, not an
 * override, because a required LuCI module is a singleton and cannot be subclassed (docs/conventions.md).
 * Spec: docs/chrome.md */

/* A NULL PROTOTYPE, because `ICONS[key]` is a lookup by a MENU NODE NAME — a string a third-party
 * package chooses in its menu.d, not one this theme knows. A plain object literal answers
 * `constructor` and `__proto__` out of Object.prototype, so a node with either name resolved to a
 * truthy non-string, skipped the `|| ICONS._default` fallback, and iconSvg() concatenated it into
 * link.innerHTML below — `function Object() { [native code] }` and `[object Object]` respectively
 * (measured). The dotted reads (ICONS.vpn, ICONS._default) are unaffected. */
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

/* `.open` means two things: in the expanded sidebar, an unfolded accordion section (several may
 * be open, the active one starts open); in the rail or the bar, a popup panel (exactly one open,
 * hover drives it, a tap toggles it, cleared on outside click and once a real mouse enters). */
/* Is a section's panel a POPUP (flyout / bar dropdown) rather than an unfolded accordion? Must
 * read the same input the STYLESHEET does: `data-narrow` (fitShell() in fs-chrome.js
 * stamps it before the menu renders). NEVER a viewport breakpoint: it used to be
 * matchMedia('(max-width: 767px)') while the CSS turns the sidebar into a bar as soon as the
 * content column drops below --fs-content-min — 780px with the sidebar expanded. At 770-775px on
 * the router the chrome was a bar while the menu still believed it was an accordion: Escape and
 * click-outside did not close a panel (widgets.wireDismiss gates on this) and clampDropdown
 * refused to place it. */
function flyoutMode() {
	return prefs.currentRail() || prefs.isTopLayout() ||
	       document.documentElement.hasAttribute('data-narrow');
}

/* The trigger — a bare <a>. widgets.setOpen keeps `.open` and aria-expanded in step. */
const TRIGGER = ':scope > a';
const OPEN_LI = '#topmenu > li.open';

/* ---- dropdown edge-clamp (the BAR, every width and every bar state) ------
 * A bar panel hangs off its OWN item (li position:relative, ul left:0 — theme/20-shell.css), so an
 * item near the right edge would push its panel past the viewport. Nudge it back inside. Runs at
 * ANY width now that the top bar is measured (no 768 floor); the rail flies panels out sideways
 * and needs a different placement, so it is excluded below. */
/* how close the panel may come to the viewport edge before it is nudged back in */
const EDGE_GAP = 8;
/* Is this panel a BAR dropdown (anchored under its item) rather than a rail flyout (anchored
 * beside it)? Ask what the STYLESHEET asks, exactly as flyoutMode() does: `data-narrow` is what
 * turns the sidebar layout into a bar, and it also disables the rail (the rail's rules are all
 * scoped `:not([data-narrow])`), so a narrow window is a bar even with the rail on. Gating this on
 * isTopLayout() alone was issue #19's second half: the panel was anchored per item by the CSS but
 * the clamp declined to place it, so an item near the right edge overflowed the viewport. */
function barDropdown() {
	return prefs.isTopLayout() || document.documentElement.hasAttribute('data-narrow');
}
function clampDropdown(li) {
	if (!barDropdown()) return;
	const menu = li.querySelector(':scope > ul');
	if (!menu) return;

	/* One pending measure per item: sweeping the pointer across the bar otherwise queues a
	 * frame per item crossed, each a write-then-read of layout, none cancelled once the
	 * pointer has moved on. */
	if (li._fsClampRaf) window.cancelAnimationFrame(li._fsClampRaf);
	li._fsClampRaf = window.requestAnimationFrame(() => {
		li._fsClampRaf = 0;
		menu.style.left = '';			/* back to the CSS anchor before measuring */
		const r = menu.getBoundingClientRect();
		if (!r.width) return;			/* still hidden — nothing to place */

		/* measured after a frame: on pointerenter the :hover rule that reveals the panel
		 * has not applied yet, so it would still measure 0x0 */
		const overflowRight = r.right - (window.innerWidth - EDGE_GAP);
		if (overflowRight > 0)
			menu.style.left = -Math.min(overflowRight, r.left - EDGE_GAP) + 'px';
	});
}
/* a nudge computed for the old width, or for a bar we have since left, is wrong — drop them
 * and let the next hover/tap recompute. */
function clearClamps() {
	document.querySelectorAll('#topmenu ul').forEach((m) => { m.style.left = ''; });
}

function setOpen(li, on) {
	widgets.setOpen(li, on, TRIGGER);
}

function closeFlyouts(except) {
	document.querySelectorAll(OPEN_LI).forEach((o) => {
		if (o !== except) setOpen(o, false);
	});
}

/* Restore the accordion after LEAVING flyout mode (rail expanded, window grew). closeFlyouts()
 * alone used to run on both transitions — right going IN (a stuck popup is worse than a folded
 * section), wrong coming OUT: it stripped `.open` from everything, and since the markup is not
 * rebuilt on a rail toggle the remembered set was never re-applied, so expanding the rail folded
 * every section and "Keep open" quietly meant nothing. */
function restoreAccordion() {
	const auto = prefs.currentAutoCollapse();
	document.querySelectorAll('#topmenu > li.has-sub').forEach((li) => {
		const name = li.dataset.name || '';
		setOpen(li, li.classList.contains('active') || (!auto && _openSections.has(name)));
	});
}

/* Which top-level sections are unfolded, by node name. renderChrome() rebuilds #topmenu on every
 * SPA nav, so without this a section the user opened (Keep open) would refold on every tab
 * switch. Only consulted in the expanded sidebar with auto-collapse off; flyouts and
 * auto-collapse only ever re-open the active one. Persisted in localStorage because a
 * module-level Set does not survive a full page load, and plenty of LuCI pages are not SPA-able
 * (non-`view` nodes, any F5). */
const OPEN_KEY = 'fs-menu-open';
/* prefs.lsGetArr owns the parse, the corruption guard and the Array check; this list is a SET
 * (membership is the only question asked of it), which is the one part that differs. */
function loadOpenSections() {
	return new Set(prefs.lsGetArr(OPEN_KEY));
}
function saveOpenSections() {
	prefs.lsSet(OPEN_KEY, JSON.stringify(Array.from(_openSections)));
}
const _openSections = loadOpenSections();

/* main sections -> vertical sidebar list (#topmenu), collapsible */
function renderMainMenu(tree, url, level) {
	const ul = level ? E('ul', {}) : document.querySelector('#topmenu');
	const children = ui.menu.getChildren(tree);

	if (!ul || children.length === 0 || level > 1)
		return E([]);

	/* dispatchpath = [mode, section, subsection, …]; sections sit at
	 * index (level+1) because the first call gets the mode. */
	const idx = (level || 0) + 1;

	children.forEach((child) => {
		/* the chrome carries its own Logout entry (partials/logout.ut, in every layout), so
		 * drop the tree's top-level admin/logout node or it shows up twice */
		if (!level && child.name === 'logout')
			return;

		const submenu = renderMainMenu(child, url + '/' + child.name, (level || 0) + 1);
		const hasSub = !!submenu.firstElementChild;
		const isActive = (L.env.dispatchpath[idx] === child.name);

		/* expanded sidebar + Keep open: a section starts open if it is the active one OR was
		 * left open before this re-render. Auto-collapse and flyout mode ignore the set. */
		const keepOpen = hasSub && !level && !flyoutMode() && !prefs.currentAutoCollapse();
		const startOpen = hasSub && !flyoutMode() &&
			(isActive || (keepOpen && _openSections.has(child.name)));
		if (keepOpen && startOpen && !_openSections.has(child.name)) {
			_openSections.add(child.name);
			saveOpenSections();
		}
		const chevron = hasSub
			? '<svg class="fs-chevron" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>'
			: '';

		/* `active` is a CLASS: it paints the item and says nothing to a screen reader, so the
		 * menu had no "you are here" at all. aria-current="page" belongs on the LEAF only — a
		 * section header is a disclosure button, not a link to the current page. */
		const link = E('a', {
			'href': hasSub ? '#' : L.url(url, child.name),
			'class': (isActive && !hasSub) ? 'active' : '',
			'aria-current': (isActive && !hasSub) ? 'page' : null
		});
		link.innerHTML = (level ? '' : iconSvg(child.name)) + '<span class="fs-label"></span>' + chevron;
		link.querySelector('.fs-label').textContent = _(child.title);

		/* collapsed rail: the label is hidden, so carry it as an attribute — CSS renders it as
		 * the flyout's heading (sections) or as a tooltip (leaves) */
		if (!level) {
			link.setAttribute('data-label', _(child.title));
			if (hasSub)
				submenu.setAttribute('data-title', _(child.title));
		}

		const li = E('li', {
			'class': [
				isActive ? 'active' : '',
				hasSub ? 'has-sub' : '',
				/* pre-opening the active section is an accordion affordance; in flyout
				 * mode it would pop a panel open on page load */
				startOpen ? 'open' : ''
			].join(' ').trim()
		}, [ link, submenu ]);
		/* for restoreAccordion(): the markup is not rebuilt on a rail toggle, so the
		 * remembered set has to be matched back to live <li>s by name */
		if (!level) li.dataset.name = child.name;

		if (hasSub) {
			/* W3C APG disclosure-navigation: a section header is a BUTTON owning a panel, not
			 * a link to "#". Not role="menu" — APG is explicit that site navigation must not
			 * take on the menubar pattern's arrow-key semantics. */
			/* THE ID MUST BE INJECTIVE, because a menu node name is a string a third-party
			 * package picks in its own menu.d and two of them may differ only in punctuation.
			 * `[^a-z0-9]+` -> '-' folded `foo.bar` and `foo-bar` onto ONE id, so two sections at
			 * the same level emitted the same `id` and both triggers' aria-controls resolved to
			 * whichever panel stands first in the document — a screen reader is then told the
			 * closed section owns the open one's contents. Escaping to the code point keeps the
			 * id readable for the ordinary all-alphanumeric case and cannot collide. */
			const subId = 'fs-sub-' +
				String(child.name).replace(/[^a-z0-9]/gi, (c) => '_' + c.charCodeAt(0).toString(16)) +
				'-' + idx;
			submenu.id = subId;
			link.setAttribute('role', 'button');
			link.setAttribute('aria-controls', subId);
			link.setAttribute('aria-expanded', startOpen ? 'true' : 'false');

			link.addEventListener('click', (ev) => {
				ev.preventDefault();
				const open = li.classList.contains('open');
				/* flyout panels are exclusive, but must NOT touch the remembered set: it
				 * mirrors the desktop "Keep open" state, and wiping it here meant one tap
				 * in the phone flyout lost the user's open sections back on desktop */
				if (flyoutMode()) {
					closeFlyouts();
					setOpen(li, !open);
					if (!open) clampDropdown(li);	/* tap-opened panel must fit too */
					return;
				}
				/* the expanded-sidebar accordion folds the others back only when asked
				 * (Appearance -> Submenus) */
				if (prefs.currentAutoCollapse()) { closeFlyouts(); _openSections.clear(); }
				setOpen(li, !open);
				/* remember the accordion state so any navigation restores it (Keep open) */
				if (!open) _openSections.add(child.name);
				else _openSections.delete(child.name);
				saveOpenSections();
			});

			widgets.wireSpaceKey(link);

			/* hybrid devices: once a real MOUSE enters, drop the tap-opened panel so hover is
			 * authoritative and two panels never stack. Guarded on pointerType — a touch tap
			 * fires pointerenter ('touch') BEFORE the click, and clearing there would break
			 * tap-to-close. */
			li.addEventListener('pointerenter', (ev) => {
				if (ev.pointerType === 'mouse' && flyoutMode())
					closeFlyouts();
				/* the bar opens this panel on hover (pure CSS), so it must be placed on
				 * hover too, not only when a tap sets .open */
				clampDropdown(li);
			});
		}

		ul.appendChild(li);
	});

	return ul;
}

return baseclass.extend({
	__init__() {
		common.init(renderMainMenu);

		/* Click-outside and Escape close an open flyout. Gated on flyoutMode(): outside it
		 * `.open` means "unfolded accordion", which must not fold on a click elsewhere. */
		widgets.wireDismiss({
			when: flyoutMode,
			inside: '#topmenu > li.has-sub',
			open: OPEN_LI,
			trigger: TRIGGER,
			close: () => closeFlyouts()
		});

		/* Entering flyout mode: fold everything, or a section left open as an accordion
		 * reappears as a popup panel stuck on screen. Leaving it: restoreAccordion().
		 *
		 * Watch the ATTRIBUTE, not the rail button: fs-chrome's wireRail() registers its click
		 * handler from inside the ui.menu.load() promise, i.e. AFTER this runs, so a listener
		 * added here would fire first and read the old data-rail. data-layout rides along —
		 * toggling the layout live is the same transition, so it needs no menu re-render. */
		const modeChanged = () => {
			clearClamps();
			flyoutMode() ? closeFlyouts() : restoreAccordion();
		};
		/* data-narrow is the third attribute flyoutMode() reads (fitShell() writes it). It was
		 * missing here, so dragging a window 800 -> 770px turned the sidebar into a bar with
		 * the accordion still unfolded inside it, and no transition handler ran. */
		new MutationObserver(modeChanged).observe(document.documentElement, {
			attributes: true, attributeFilter: [ 'data-rail', 'data-layout', 'data-narrow' ]
		});
		/* No 768 media-query listener any more: the top bar is measured at every width
		 * (fitChrome, no floor), so crossing 768 no longer flips the chrome — nothing to
		 * transition that the attribute observer and the resize clamp-clear below don't cover. */

		/* a clamp computed at the old width is wrong at the new one; coalesced via fit.frame
		 * (the shared coalescer) because resize fires dozens of times a second while a window
		 * is dragged.
		 *
		 * WIDTH ONLY, for the reason fs-fit's observer states at length: every browser on iOS
		 * fires `resize` continuously while the URL bar slides away, and a clamp computed for a
		 * width that did not change is work done on a page the user is scrolling. */
		let lastWidth = window.innerWidth;
		const reclamp = fit.frame(clearClamps);
		window.addEventListener('resize', () => {
			if (window.innerWidth === lastWidth) return;
			lastWidth = window.innerWidth;
			reclamp();
		});

		/* Appearance -> Submenus -> auto-collapse. fs-prefs.js owns the stored value and says only
		 * that it changed; applying it is entirely ours, because every piece of the state is —
		 * the remembered set, the `.open` class and the aria-expanded that setOpen keeps in step.
		 *
		 * restoreAccordion() already IS "apply the current auto-collapse setting": with the set
		 * cleared and auto ON it computes open = the active section alone, and with auto OFF it
		 * restores what "Keep open" remembered. Skipped in flyout mode — a section there is a
		 * popup, and force-opening the active one would leave it stuck on screen. */
		document.addEventListener('fs-autocollapse', (ev) => {
			if (ev.detail && ev.detail.on) {
				_openSections.clear();
				saveOpenSections();
			}
			if (!flyoutMode()) restoreAccordion();
		});
	}
});
