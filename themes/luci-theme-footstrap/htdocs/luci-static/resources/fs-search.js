'use strict';
'require baseclass';
'require fs-menutree as tree';
'require fs-prefs as prefs';
'require fs-router as router';
'require fs-widgets as widgets';

/* Find a page by typing its name, instead of remembering which section owns it.
 *
 * A loaded router carries ~200 reachable menu nodes across 11 sections, and the only way to reach
 * one was to know its parent — "Attended Sysupgrade" is under System, "Crontab" under System too,
 * "Port Forwards" is a TAB of Network -> Firewall and appears in no menu list at all until you are
 * already there. This indexes every node the dispatcher would render, tabs included.
 *
 * It costs no request: the tree is the SAME ACL-filtered /admin/menu blob the chrome already
 * loaded (fs-menutree), so the palette knows exactly the pages this session is allowed to open —
 * nothing to leak, nothing to 403 on. The index is built on the FIRST open, not at init: a user
 * who never searches pays nothing, and a full load is the only thing that can change the tree.
 *
 * Navigation is deliberately NOT a call into the router: every result is a real <a href>, so a
 * click bubbles to the router's own document-level handler and takes the SPA path (or falls back
 * to a full load when the node is not SPA-able) with no second copy of that decision here. Enter
 * synthesises the same click. */

/* ---- the index ---------------------------------------------------------- */

/* How deep below the MODE the walk goes. `depth` counts recursion levels and the walk starts at 1
 * on a node that already has two segments, so a node at depth N carries N+1 of them: 4 admits
 * admin/<section>/<page>/<tab>/<subtab>. That is one more than LuCI's own dispatcher renders, and
 * deliberately so — a third-party node nested deeper is worth finding, and the depth term in the
 * score below already ranks it last. */
const MAX_DEPTH = 4;

let _index = null;

/* The node's own children, ACL- and title-filtered exactly as ui.menu.getChildren() filters them
 * — but NOT through getChildren() itself, and that is the whole reason this function exists.
 *
 * On an ALIAS node getChildren() returns a copy whose `children` are the alias TARGET's, which is
 * right for drawing a menu and wrong for indexing: Network -> Firewall is an alias onto the
 * `firewall/zones` VIEW, a leaf, so its five tabs (Port Forwards, Traffic Rules, NAT Rules, IP
 * Sets, Custom Rules) came back as an empty list and "port" found nothing on a router that plainly
 * has a Port Forwards page. Measured on the dev router: 78 indexed nodes through getChildren(),
 * with every tab of every aliased page missing.
 *
 * Order does not matter here (search ranks by score, not by menu weight), so getChildren()'s sort
 * is not reimplemented — only its two filters, which are what "this session may open it" means. */
function childrenOf(node) {
	const kids = node.children || {};
	const out = [];
	for (const name in kids) {
		const c = kids[name];
		if (!c || !c.satisfied || !c.title) continue;
		out.push({ name: name, node: c });
	}
	return out;
}

function walk(node, segs, trail, out, depth) {
	childrenOf(node).forEach((entry) => {
		const child = entry.node;
		/* the chrome carries its own Logout (partials/logout.ut) — searching for it would open a
		 * confirmation the user did not ask for */
		if (depth === 1 && entry.name === 'logout')
			return;

		const title = _(child.title);
		const csegs = segs.concat([ entry.name ]);

		out.push({
			segs: csegs,
			path: csegs.join('/'),
			title: title,
			trail: trail,
			depth: depth,
			/* Three haystacks, searched in this order of preference (see score()). `name` is the
			 * ENGLISH node name and is indexed on purpose: a Russian UI translates "Firewall" to
			 * "Межсетевой экран", and an admin who knows OpenWrt by its English docs types
			 * "firewall". Both find it. */
			t: title.toLowerCase(),
			p: trail.join(' ').toLowerCase(),
			/* …minus the ROOT segment, which is `admin` on every single node. Indexed, it made
			 * every substring of "admin" — a, ad, adm, dmi, min, in — a hit on all ~200 pages, so
			 * `min` returned "Terminal", "Administration", "Attended Sysupgrade" and stopped at the
			 * 20-result cap sorted only by depth (measured). It carries no information precisely
			 * because it is shared by everything. */
			n: csegs.slice(1).join(' ').toLowerCase()
		});

		if (depth < MAX_DEPTH)
			walk(child, csegs, trail.concat([ title ]), out, depth + 1);
	});
}

function buildIndex() {
	const root = tree.tree();
	const out = [];
	if (!root) return out;
	/* the mode (admin) is a container, not a destination: start one level in */
	childrenOf(root).forEach((mode) => {
		walk(mode.node, [ mode.name ], [], out, 1);
	});
	return out;
}

/* Built once per DOCUMENT, and deliberately not re-derived per open: it is a projection of the
 * client menu tree, which `ui.menu.load()` itself caches for the life of the document. So the
 * palette is exactly as fresh as the sidebar beside it — a package installed or removed without a
 * reload is missing from, or still listed in, BOTH. Invalidating only this half would make the two
 * disagree, which is worse than either being stale; the reload the package manager already prompts
 * for is what refreshes them together. (Cheap enough to rebuild if that ever changes: 238 nodes on
 * the dev router.) */
function index() {
	if (!_index) _index = buildIndex();
	return _index;
}

/* ---- matching ----------------------------------------------------------- */

/* Every whitespace-separated token must hit SOMETHING, so "fire port" finds Firewall -> Port
 * Forwards while "fire xyz" finds nothing — an AND is what a user typing a second word means.
 *
 * Deliberately not a fuzzy subsequence match (the "fzf" kind): on a two-letter query it matches
 * almost every entry and the ranking then decides everything, which reads as random. A substring
 * ladder is predictable — what you typed is visibly in what you got. */
const HIT_NONE = 99;
function tokenScore(e, tok) {
	if (e.t.startsWith(tok)) return 0;	/* the title begins with it */
	if (e.t.includes(tok))   return 1;	/* somewhere in the title */
	if (e.n.includes(tok))   return 2;	/* the English path segment */
	if (e.p.includes(tok))   return 3;	/* an ancestor's title */
	return HIT_NONE;
}

function search(q, limit) {
	const toks = q.toLowerCase().split(/\s+/).filter(Boolean);
	if (!toks.length) return [];

	const hits = [];
	for (const e of index()) {
		let sum = 0;
		for (const tok of toks) {
			const s = tokenScore(e, tok);
			if (s === HIT_NONE) { sum = HIT_NONE; break; }
			sum += s;
		}
		if (sum !== HIT_NONE)
			hits.push({ e: e, score: sum + (e.depth * 0.1) });	/* ties: the shallower page first */
	}
	hits.sort((a, b) => a.score - b.score);
	return hits.slice(0, limit).map((h) => h.e);
}

/* ---- recently visited --------------------------------------------------- */

/* What the palette shows before a single character is typed. A router admin lives in three or four
 * pages, so the empty state is the most-used view of this thing — an empty box would waste it.
 *
 * Only the PATH is stored, never the title: the title is resolved back through the index on every
 * render, so it follows the UI language and a page that disappeared with its package simply drops
 * out instead of lingering as a dead row. */
const RECENT_KEY = 'fs-recent';
const RECENT_MAX = 8;

/* prefs.lsGetArr owns the parse, the corruption guard and the Array check; only the
 * "these are paths" filter is this module's business. */
function loadRecent() {
	return prefs.lsGetArr(RECENT_KEY).filter((x) => typeof x === 'string');
}

let _recent = loadRecent();

function remember(segs) {
	if (!Array.isArray(segs) || !segs.length) return;
	const path = segs.join('/');
	_recent = [ path ].concat(_recent.filter((p) => p !== path)).slice(0, RECENT_MAX);
	prefs.lsSet(RECENT_KEY, JSON.stringify(_recent));
}

function recentEntries() {
	const byPath = new Map(index().map((e) => [ e.path, e ]));
	return _recent.map((p) => byPath.get(p)).filter(Boolean).slice(0, RECENT_MAX);
}

/* ---- warm the pages this admin actually uses ----
 *
 * The router's per-link prefetch needs a hover, a tap or a focus first, so the FIRST visit of a
 * session to a page still pays for its module chain. The recents list is the best predictor of that
 * page available anywhere in the theme — an admin lives in three or four of them — and it is already
 * on disk. Walking the whole menu instead would pull every view module on the box, which is the cost
 * docs/spa-router.md warns about; five recents is a handful of files.
 *
 * The current page is skipped: wire() has just remembered it, so it heads the list, and it is loaded
 * by definition. saveData is the user saying "not over this link", and speculation is exactly what
 * has to go then — the per-link prefetch stays, because that one follows a deliberate hover or tap. */
const RECENT_WARM = 5;

function warmRecent() {
	try { if (navigator.connection && navigator.connection.saveData) return; } catch (e) {}
	const here = (L.env.dispatchpath || []).join('/');
	const paths = _recent.filter((p) => p !== here).slice(0, RECENT_WARM);
	if (!paths.length) return;
	/* Nothing waits on this, so it belongs after the page has settled — at idle, with a timeout for a
	 * page that never goes idle (a busy poll). The fallback is deliberately a LONG timeout: nothing
	 * on screen waits for this, so it competes with the view's own module fetches and RPCs and must
	 * lose that race on purpose. */
	const go = () => paths.forEach((p) => router.prefetchSegs(p.split('/')));
	if (typeof window.requestIdleCallback === 'function')
		window.requestIdleCallback(go, { timeout: 4000 });
	else
		window.setTimeout(go, 2000);
}

/* ---- the palette -------------------------------------------------------- */

const MAX_RESULTS = 20;

function wire() {
	const btn = document.getElementById('fs-search-btn');
	if (!btn) return;

	/* Remember the page this full load landed on. The SPA path is covered by onNavigate below;
	 * this covers an F5, a non-SPA-able node and the very first page of a session. */
	remember(L.env.dispatchpath || []);
	/* The callback is handed the RESOLVED segments of the incoming page: reading L.env here would
	 * give the OUTGOING one, since the router fires its callbacks before it re-points L.env. */
	router.onNavigate(remember);
	/* after remember(), so the page we are standing on is the one head of the list that gets skipped */
	warmRecent();

	const input = E('input', {
		'type': 'text',
		'class': 'fs-search-input',
		'role': 'combobox',
		'aria-controls': 'fs-search-list',
		'aria-expanded': 'true',
		'aria-autocomplete': 'list',
		'aria-label': _('Search pages', 'footstrap'),
		'placeholder': _('Search pages…', 'footstrap'),
		'autocomplete': 'off',
		'autocapitalize': 'off',
		'spellcheck': 'false'
	});
	const list = E('div', { 'id': 'fs-search-list', 'class': 'fs-search-list', 'role': 'listbox', 'aria-label': _('Pages', 'footstrap') });
	const note = E('div', { 'class': 'fs-search-note' });
	const ico = E('span', { 'class': 'fs-search-ico' });
	ico.innerHTML = widgets.svgIcon('<circle cx="11" cy="11" r="7"/><path d="M16.5 16.5 21 21"/>');
	const box = E('div', { 'class': 'fs-search-box' }, [
		E('div', { 'class': 'fs-search-row' }, [ ico, input ]),
		/* the note is a CAPTION for the rows below it ("Recently visited") and the box's EMPTY
		 * STATE when there are none, so it belongs above the list in both readings — it sat after
		 * the list at first, which put the caption under the rows it captions */
		note,
		list
	]);
	/* data-fs-chrome marks a Zone 1 ROOT (docs/third-party-apps.md): this is a `position: fixed` overlay parented
	 * to <body>, i.e. outside the <nav> that carries the mark in header.ut — exactly the shape that
	 * once left the Appearance popover unfenced while every test said the chrome was defended. */
	const ov = E('div', {
		'id': 'fs-search-ov',
		'class': 'fs-search-ov',
		'data-fs-chrome': '',
		'role': 'dialog',
		'aria-modal': 'true',
		'aria-label': _('Search pages', 'footstrap'),
		'hidden': ''
	}, [ box ]);
	document.body.appendChild(ov);

	let opts = [], ents = [], at = -1;

	/* Warm the highlighted page's module chain, DEBOUNCED. render() re-runs setActive(0) on every
	 * keystroke, so warming immediately would pull the top result of "w", "wi", "wir"… and only the
	 * last of those is a page anyone asked for. The delay also matches how the list is used: the
	 * highlight settles, then Enter. Only the ARROW KEYS and typing need this — the rows are real
	 * anchors in the document, so a mouse moving over one already reaches the router's own pointerover
	 * listener. warmClass() dedupes per class, so a row revisited costs nothing. */
	let warmT = null;
	function warmActive() {
		if (warmT) window.clearTimeout(warmT);
		warmT = window.setTimeout(() => {
			warmT = null;
			if (ents[at]) router.prefetchSegs(ents[at].segs);
		}, 200);
	}

	function setActive(i) {
		if (!opts.length) { at = -1; input.removeAttribute('aria-activedescendant'); return; }
		at = (i + opts.length) % opts.length;
		opts.forEach((o, n) => {
			const on = (n === at);
			o.classList.toggle('active', on);
			o.setAttribute('aria-selected', on ? 'true' : 'false');
		});
		input.setAttribute('aria-activedescendant', opts[at].id);
		opts[at].scrollIntoView({ block: 'nearest' });
		warmActive();
	}

	function render(q) {
		const entries = q ? search(q, MAX_RESULTS) : recentEntries();
		ents = entries;
		list.innerHTML = '';
		opts = entries.map((e, i) => {
			/* role="option" on the <a> rather than a <div> wrapping one: an option may not contain
			 * an interactive element, and the anchor has to stay a real link — it is what carries
			 * the click to the router, and what keeps middle-click and "copy link" working. */
			const a = E('a', {
				'class': 'fs-search-opt',
				'role': 'option',
				'id': 'fs-search-opt-' + i,
				'aria-selected': 'false',
				'href': L.url.apply(L, e.segs)
			}, [
				E('span', { 'class': 'fs-search-opt-title' }, [ e.title ]),
				e.trail.length ? E('span', { 'class': 'fs-search-opt-path' }, [ e.trail.join(' › ') ]) : ''
			]);
			/* close BEFORE the click reaches the router (which re-renders the chrome underneath),
			 * and without taking focus back — the user is going somewhere else */
			a.addEventListener('click', () => close(false));
			a.addEventListener('pointermove', () => { if (at !== i) setActive(i); });
			list.appendChild(a);
			return a;
		});
		note.textContent = opts.length
			? (q ? '' : _('Recently visited', 'footstrap'))
			: (q ? _('No pages found', 'footstrap') : _('Start typing to find a page', 'footstrap'));
		note.hidden = !note.textContent;
		setActive(0);
	}

	function open() {
		if (!ov.hidden) return;
		ov.hidden = false;
		btn.setAttribute('aria-expanded', 'true');
		input.value = '';
		render('');
		input.focus();
	}

	function close(returnFocus = true) {
		if (ov.hidden) return;
		ov.hidden = true;
		btn.setAttribute('aria-expanded', 'false');
		if (returnFocus) btn.focus();
	}

	input.addEventListener('input', () => render(input.value.trim()));

	/* Keys are handled on the OVERLAY, not the input: the scrim is part of the dialog and a click
	 * on it moves focus to the overlay itself, where an Escape must still close. */
	ov.addEventListener('keydown', (ev) => {
		switch (ev.key) {
		case 'Escape':
			ev.preventDefault();
			close();
			return;
		case 'ArrowDown':
			ev.preventDefault(); setActive(at + 1); return;
		case 'ArrowUp':
			ev.preventDefault(); setActive(at - 1); return;
		case 'Home':
			if (!input.value) { ev.preventDefault(); setActive(0); }
			return;
		case 'End':
			if (!input.value) { ev.preventDefault(); setActive(opts.length - 1); }
			return;
		case 'Enter':
			if (at < 0 || !opts[at]) return;
			ev.preventDefault();
			/* a synthetic click carries detail 0, which is exactly what the router reads as a
			 * KEYBOARD activation — so the focus lands where a keyboard navigation puts it */
			opts[at].click();
			return;
		case 'Tab':
			/* aria-modal="true" is a promise that Tab cannot walk out into the page behind, and
			 * the input is the dialog's only tabbable element, so the trap is: stay. Escape (or a
			 * click outside) is the way out, and both hand focus back to the trigger. */
			ev.preventDefault();
			input.focus();
			return;
		}
	});

	/* a click on the scrim — anywhere outside the box — closes */
	ov.addEventListener('click', (ev) => { if (ev.target === ov) close(); });

	btn.addEventListener('click', () => { ov.hidden ? open() : close(); });

	/* Back and Forward are navigations no listener here can see: every close above is a user act on
	 * the document (Escape, the scrim, the trigger, picking a result). An open palette therefore rode
	 * a popstate onto the next page, aria-modal and Tab-trapped, while the router moved focus behind
	 * it. returnFocus=false because the router places focus itself on a navigation. */
	router.onNavigate(() => close(false));

	/* Ctrl/Cmd+K is the shortcut every command palette has taught users, and `/` is the one every
	 * search field on the web has. `/` only when the user is not already typing somewhere: an
	 * <input>, a contenteditable, or a .cbi-dropdown (fs-select.js gives those their own typeahead,
	 * where a `/` is a search character, not a shortcut). */
	document.addEventListener('keydown', (ev) => {
		if (ev.defaultPrevented) return;
		if ((ev.ctrlKey || ev.metaKey) && !ev.altKey && (ev.key === 'k' || ev.key === 'K')) {
			ev.preventDefault();
			ov.hidden ? open() : close();
			return;
		}
		if (ev.key !== '/' || ev.ctrlKey || ev.metaKey || ev.altKey) return;
		if (ev.target.closest?.('input, textarea, select, [contenteditable], .cbi-dropdown')) return;
		ev.preventDefault();
		open();
	});
}

return baseclass.extend({
	wire
});
