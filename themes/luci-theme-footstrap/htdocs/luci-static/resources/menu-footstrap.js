'use strict';
'require baseclass';
'require ui';
'require fs-fit as fit';
'require fs-prefs as prefs';
'require fs-widgets as widgets';
'require menu-footstrap-common as common';

/* The theme's one menu renderer: a vertical #topmenu that the CSS also turns into the top bar and
 * the rail flyouts — same markup, no second renderer. Disclosure primitives come from fs-widgets,
 * the auto-collapse preference from fs-prefs; the rest of the chrome is bootstrapped by
 * menu-footstrap-common, which this file composes with by injecting renderMainMenu into
 * common.init — a callback, not an override, since a required LuCI module is a singleton and
 * cannot be subclassed. Spec: docs/chrome.md */

/* Null prototype: `ICONS[key]` is keyed by a menu node name, which a third-party package picks in
 * its own menu.d. On a plain literal a node called `constructor` or `__proto__` resolves out of
 * Object.prototype to a truthy non-string ('[object Object]' for the latter), skips the
 * `|| ICONS._default` fallback and is concatenated into link.innerHTML. */
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

/* `.open` means two things: in the expanded sidebar an unfolded accordion section (several may be
 * open, the active one starts open); in the rail or the bar a popup panel (exactly one open, hover
 * drives it, a tap toggles it, cleared on outside click and once a real mouse enters). */
/* Is a section's panel a popup (flyout / bar dropdown) rather than an unfolded accordion? Reads
 * the same input as the stylesheet: `data-narrow`, stamped by fitShell() in fs-chrome.js before
 * the menu renders. Never a viewport breakpoint — the CSS turns the sidebar into a bar when the
 * content column drops below --fs-content-min, so a media query leaves a band of widths where the
 * chrome is a bar and the menu still believes it is an accordion — a `max-width: 767px` media
 * query left exactly that band at 770-775px. */
function flyoutMode() {
	return prefs.currentRail() || prefs.isTopLayout() ||
	       document.documentElement.hasAttribute('data-narrow');
}

/* The trigger — a bare <a>. widgets.setOpen keeps `.open` and aria-expanded in step. */
const TRIGGER = ':scope > a';
const OPEN_LI = '#topmenu > li.open';

/* ---- dropdown edge-clamp (the bar, at every width) ----
 * A bar panel hangs off its own item (li position:relative, ul left:0 — theme/20-shell.css), so an
 * item near the right edge would push its panel past the viewport. The rail flies panels out
 * sideways and needs a different placement, so it is excluded below. */
/* how close the panel may come to the viewport edge before it is nudged back in */
const EDGE_GAP = 8;
/* Is this panel a bar dropdown (anchored under its item) rather than a rail flyout (anchored
 * beside it)? Same input as the stylesheet: `data-narrow` turns the sidebar into a bar and also
 * disables the rail (its rules are scoped `:not([data-narrow])`), so a narrow window is a bar even
 * with the rail on. Gating on isTopLayout() alone leaves such a panel unclamped (issue #19). */
function barDropdown() {
	return prefs.isTopLayout() || document.documentElement.hasAttribute('data-narrow');
}
function clampDropdown(li) {
	if (!barDropdown()) return;
	const menu = li.querySelector(':scope > ul');
	if (!menu) return;

	/* one pending measure per item: sweeping the pointer across the bar otherwise queues a
	 * write-then-read of layout per item crossed, none cancelled once the pointer moves on */
	if (li._fsClampRaf) window.cancelAnimationFrame(li._fsClampRaf);
	li._fsClampRaf = window.requestAnimationFrame(() => {
		li._fsClampRaf = 0;
		menu.style.left = '';			/* back to the CSS anchor before measuring */
		const r = menu.getBoundingClientRect();
		if (!r.width) return;			/* still hidden — nothing to place */

		/* measured after a frame: on pointerenter the :hover rule revealing the panel has not
		 * applied yet, so it still measures 0x0 */
		const overflowRight = r.right - (window.innerWidth - EDGE_GAP);
		if (overflowRight > 0)
			menu.style.left = -Math.min(overflowRight, r.left - EDGE_GAP) + 'px';
	});
}
/* a nudge computed for the old width, or for a bar we have since left, is wrong: drop it and let
 * the next hover/tap recompute */
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

/* Restore the accordion after leaving flyout mode (rail expanded, window grew). closeFlyouts() is
 * right going in — a stuck popup is worse than a folded section — but wrong coming out: the markup
 * is not rebuilt on a rail toggle, so nothing would re-apply the remembered set and "Keep open"
 * would mean nothing. */
function restoreAccordion() {
	const auto = prefs.currentAutoCollapse();
	document.querySelectorAll('#topmenu > li.has-sub').forEach((li) => {
		const name = li.dataset.name || '';
		setOpen(li, li.classList.contains('active') || (!auto && _openSections.has(name)));
	});
}

/* Which top-level sections are unfolded, by node name: renderChrome() rebuilds #topmenu on every
 * SPA nav, so a section the user opened would otherwise refold on every tab switch. Only consulted
 * in the expanded sidebar with auto-collapse off. Persisted in localStorage because a module-level
 * Set does not survive a full page load, and many LuCI pages are not SPA-able. */
const OPEN_KEY = 'fs-menu-open';
/* prefs.lsGetArr owns the parse, the corruption guard and the Array check; a Set is used because
 * membership is the only question asked of it */
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
		/* the chrome carries its own Logout entry (partials/logout.ut), so the tree's
		 * top-level admin/logout node would show up twice */
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

		/* `active` only paints the item; aria-current is what a screen reader reads, and it
		 * belongs on the LEAF alone — a section header is a disclosure button, not a link to
		 * the current page */
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
		/* for restoreAccordion(): the remembered set is matched back to live <li>s by name */
		if (!level) li.dataset.name = child.name;

		if (hasSub) {
			/* W3C APG disclosure navigation: a section header is a button owning a panel, not
			 * a link to "#". Not role="menu" — APG is explicit that site navigation must not
			 * take on the menubar pattern's arrow-key semantics.
			 *
			 * The id must be injective: node names come from third-party menu.d files and may
			 * differ only in punctuation, and folding them (`[^a-z0-9]+` -> '-') makes two
			 * triggers' aria-controls resolve to the same panel. Escaping to the code point
			 * keeps the ordinary all-alphanumeric case readable and cannot collide. */
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
				/* flyout panels are exclusive, but must not touch the remembered set: it
				 * mirrors the desktop "Keep open" state, which one tap on a phone would
				 * otherwise wipe */
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

			widgets.wireSpaceKey(link);

			/* hybrid devices: once a real mouse enters, drop the tap-opened panel so hover is
			 * authoritative and two panels never stack. Guarded on pointerType, since a touch
			 * tap fires pointerenter ('touch') before the click and clearing there would break
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

		/* click-outside and Escape close an open flyout, gated on flyoutMode(): outside it
		 * `.open` means unfolded accordion, which must not fold on a click elsewhere */
		widgets.wireDismiss({
			when: flyoutMode,
			inside: '#topmenu > li.has-sub',
			open: OPEN_LI,
			trigger: TRIGGER,
			close: () => closeFlyouts()
		});

		/* Entering flyout mode folds everything, or a section left open as an accordion
		 * reappears as a popup stuck on screen; leaving it restores the accordion.
		 *
		 * Watch the attribute, not the rail button: fs-chrome's wireRail() registers its click
		 * handler from inside the ui.menu.load() promise, i.e. after this runs, so a listener
		 * added here would fire first and read the old data-rail. data-layout rides along —
		 * toggling the layout live is the same transition and needs no menu re-render. */
		const modeChanged = () => {
			clearClamps();
			flyoutMode() ? closeFlyouts() : restoreAccordion();
		};
		/* data-narrow is the third attribute flyoutMode() reads (fitShell() writes it): without
		 * it, narrowing the window turns the sidebar into a bar with no transition handler
		 * running and the accordion still unfolded inside it */
		new MutationObserver(modeChanged).observe(document.documentElement, {
			attributes: true, attributeFilter: [ 'data-rail', 'data-layout', 'data-narrow' ]
		});
		/* No media-query listener: the top bar is measured at every width (fitChrome), so no
		 * breakpoint flips the chrome — the attribute observer and the resize clamp-clear
		 * below cover every transition. */

		/* a clamp computed at the old width is wrong at the new one; coalesced via fit.frame
		 * because resize fires dozens of times a second while a window is dragged. Width only:
		 * iOS fires `resize` continuously while the URL bar slides away, and re-clamping for an
		 * unchanged width is work done on a page the user is scrolling. */
		let lastWidth = window.innerWidth;
		const reclamp = fit.frame(clearClamps);
		window.addEventListener('resize', () => {
			if (window.innerWidth === lastWidth) return;
			lastWidth = window.innerWidth;
			reclamp();
		});

		/* Appearance -> Submenus -> auto-collapse: fs-prefs.js owns the stored value and only
		 * announces the change; the remembered set, `.open` and aria-expanded are all ours.
		 * restoreAccordion() is already "apply the current setting" — with the set cleared and
		 * auto on it opens the active section alone. Skipped in flyout mode, where force-opening
		 * the active section would leave a popup stuck on screen. */
		document.addEventListener('fs-autocollapse', (ev) => {
			if (ev.detail && ev.detail.on) {
				_openSections.clear();
				saveOpenSections();
			}
			if (!flyoutMode()) restoreAccordion();
		});
	}
});
