'use strict';
'require baseclass';
'require fs-menutree as tree';
'require fs-prefs as prefs';
'require fs-router as router';
'require fs-widgets as widgets';

/* Find a page by typing its name instead of knowing which section owns it. A loaded router
 * carries ~200 menu nodes across 11 sections, and a tab such as Firewall -> Port Forwards appears
 * in no menu list until you are already there; this indexes every node the dispatcher would
 * render, tabs included.
 *
 * It costs no request: the tree is the same ACL-filtered /admin/menu blob the chrome loaded
 * (fs-menutree), so the palette lists exactly the pages this session may open. The index is built
 * on the first open, not at init — a user who never searches pays nothing, and only a full load
 * can change the tree.
 *
 * Navigation is deliberately not a call into the router: every result is a real <a href>, so a
 * click bubbles to the router's own document-level handler and no copy of that decision lives
 * here. Enter synthesises the same click. */

/* ---- the index ---------------------------------------------------------- */

/* How deep below the mode the walk goes. `depth` counts recursion levels starting at 1 on a node
 * that already has two segments, so 4 admits admin/<section>/<page>/<tab>/<subtab> — one level
 * more than LuCI renders, so a deeper third-party node is still findable and the depth term in
 * search() ranks it last. */
const MAX_DEPTH = 4;

let _index = null;

/* The node's own children, ACL- and title-filtered as ui.menu.getChildren() filters them, but not
 * through getChildren(): on an alias node it returns the alias TARGET's children, which is right
 * for drawing a menu and wrong for indexing — Network -> Firewall aliases onto the `firewall/zones`
 * leaf, so all five of its tabs vanish from the index (78 nodes instead of 238).
 *
 * Order does not matter (search ranks by score), so only the two filters are reimplemented, not
 * the sort. */
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
		/* the chrome carries its own Logout (partials/logout.ut); indexing it would let a search
		 * open a confirmation the user did not ask for */
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
			/* Three haystacks, in this order of preference (see tokenScore()). The English
			 * node name is indexed on purpose: a translated UI otherwise hides the page from
			 * an admin who knows OpenWrt by its English docs. */
			t: title.toLowerCase(),
			p: trail.join(' ').toLowerCase(),
			/* …minus the root segment, `admin`, which every node shares: indexed, every
			 * substring of it ("ad", "min", …) hits all ~200 pages and fills the result cap */
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

/* Built once per document: it projects the client menu tree, which `ui.menu.load()` caches for
 * the life of the document, so the palette is exactly as fresh as the sidebar beside it.
 * Invalidating only this half would let the two disagree, which is worse than both being stale;
 * the reload a package install prompts for refreshes them together. */
function index() {
	if (!_index) _index = buildIndex();
	return _index;
}

/* ---- extra sources -------------------------------------------------------
 *
 * An optional package can add rows to the same list — one indexes the SECTION titles inside each
 * page, so "footstrap" finds System -> Appearance. A source hands over entries in the shape
 * buildIndex() produces and nothing else: the matching, the ranking and the rendering stay here,
 * or two lists would disagree about what a hit is. Two fields are the source's alone: `onTake`,
 * called when the row is chosen, and `key`, what the recents list stores it under when its `path`
 * is not its own (see keyOf).
 *
 * Registration is a GLOBAL ARRAY, not an export a package requires. This module is fetched on the
 * first gesture and most sessions never make it; a package that had to `require` it to register
 * would pull it onto every page and pay its 4.5 KB for a palette nobody opened. Pushing a function
 * onto `window.__fsSearchSources` costs the package nothing and names no one in either direction.
 *
 * `window.__fsSearchGen` is how a source says its data grew — a harvester fills in over a session
 * — and the stamp below is what rebuilds the pool when it does. */
const _sources = [];
let _pool = null, _stamp = -1;

function globalSources() {
	return Array.isArray(window.__fsSearchSources) ? window.__fsSearchSources : [];
}

function addSource(fn) {
	_sources.push(fn);
	_pool = null;
}
function refresh() {
	_pool = null;
}
function pool() {
	const all = _sources.concat(globalSources());
	const stamp = all.length + (window.__fsSearchGen || 0);
	if (_pool && stamp === _stamp) return _pool;
	_stamp = stamp;
	_pool = all.reduce((rows, fn) => {
		try { return rows.concat(fn() || []); }
		catch (e) { console.error('footstrap: a search source threw', e); return rows; }
	}, index().slice());
	return _pool;
}

/* ---- matching ----------------------------------------------------------- */

/* Every whitespace-separated token must hit something: a second word means AND. Deliberately not
 * a fuzzy subsequence match — on a two-letter query that matches nearly every entry and leaves the
 * ranking to decide everything, which reads as random. */
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
	for (const e of pool()) {
		let sum = 0;
		for (const tok of toks) {
			const s = tokenScore(e, tok);
			if (s === HIT_NONE) { sum = HIT_NONE; break; }
			sum += s;
		}
		if (sum !== HIT_NONE)
			hits.push({ e: e, score: sum + (e.depth * 0.1) });	/* ties: shallower page first */
	}
	hits.sort((a, b) => a.score - b.score);
	return hits.slice(0, limit).map((h) => h.e);
}

/* ---- recently visited --------------------------------------------------- */

/* What the palette shows before anything is typed: an admin lives in three or four pages, so the
 * empty state is its most-used view.
 *
 * Only the KEY is stored, never the title — the title is resolved through the pool on every
 * render, so it follows the UI language and a row whose package went away drops out instead of
 * lingering as a dead row. A page's key is its menu path; a row from a source carries its own
 * `key`, because a section has no dispatcher node and therefore no path that is only its own —
 * the sections source keys one `admin/system/system#Footstrap`, the page it is on plus its own
 * heading. */
const RECENT_KEY = 'fs-recent';
const RECENT_MAX = 8;

/* the string a row is remembered under, and the one menu-footstrap-common's remember() writes */
function keyOf(e) {
	return e.key || e.path;
}

/* The list is WRITTEN by menu-footstrap-common.js, which is on every page — this module is not any
 * more, and a palette that only loads when it is opened cannot be what records where the admin has
 * been. Read here, at open time, so it is always current. `prefs.lsGetArr` owns the parse, the
 * corruption guard and the Array check; only the "these are keys" filter belongs here. */
function recentEntries() {
	const recent = prefs.lsGetArr(RECENT_KEY).filter((x) => typeof x === 'string');
	/* pool(), not index(): a section is recalled exactly as a page is. Against the index alone a
	 * section key resolved to nothing and the row silently vanished, so taking "Footstrap" left
	 * only "System" in the list — the page path is all either row carries. */
	const byKey = new Map(pool().map((e) => [ keyOf(e), e ]));
	return recent.map((k) => byKey.get(k)).filter(Boolean).slice(0, RECENT_MAX);
}

/* ---- the palette -------------------------------------------------------- */

const MAX_RESULTS = 20;

/* Built on the first open and kept — the overlay, its listeners and the index survive for the life
 * of the document, so a second Ctrl+K costs nothing. Until then this module is not even fetched:
 * menu-footstrap-common.js holds the shortcut and requires this on the first gesture. */
let _built = null;

function build() {
	const btn = document.getElementById('fs-search-btn');
	if (!btn) return null;

	/* the list's id, said three times below as an id, a class and aria-controls (measured: 17 B x3
	 * -> 26 B, 25 B saved) */
	const ID_SEARCH_LIST = 'fs-search-list';
	/* the attribute name toggled below and stated once more as its own starting value (measured:
	 * 15 B x3 -> 27 B, 18 B saved) */
	const ATTR_EXPANDED = 'aria-expanded';
	const input = E('input', {
		'type': 'text',
		'class': 'fs-search-input',
		'role': 'combobox',
		'aria-controls': ID_SEARCH_LIST,
		[ATTR_EXPANDED]: 'true',
		'aria-autocomplete': 'list',
		'aria-label': _('Search pages', 'footstrap'),
		'placeholder': _('Search pages…', 'footstrap'),
		'autocomplete': 'off',
		'autocapitalize': 'off',
		'spellcheck': 'false'
	});
	const list = E('div', { 'id': ID_SEARCH_LIST, 'class': ID_SEARCH_LIST, 'role': 'listbox', 'aria-label': _('Pages', 'footstrap') });
	const note = E('div', { 'class': 'fs-search-note' });
	const ico = E('span', { 'class': 'fs-search-ico' });
	ico.innerHTML = widgets.svgIcon('<circle cx="11" cy="11" r="7"/><path d="M16.5 16.5 21 21"/>');
	const box = E('div', { 'class': 'fs-search-box' }, [
		E('div', { 'class': 'fs-search-row' }, [ ico, input ]),
		/* the note captions the rows below it ("Recently visited") and doubles as the empty
		 * state, so it belongs above the list in both readings */
		note,
		list
	]);
	/* data-fs-chrome marks a zone-1 root (docs/third-party-apps.md): this overlay is parented to
	 * <body>, outside the <nav> that carries the mark in header.ut, so without it the fence does
	 * not cover the palette — the shape that once left the Appearance popover unfenced */
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

	/* Warm the highlighted page's module chain, debounced: render() re-runs setActive(0) on every
	 * keystroke, so warming at once would pull the top result of "w", "wi", "wir"… Only arrow keys
	 * and typing need this — the rows are real anchors, so a mouse over one already reaches the
	 * router's pointerover listener. fs-router's warmClass() dedupes, so a row revisited costs
	 * nothing. */
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
			/* role="option" on the <a> itself: an option may not contain an interactive element,
			 * and the anchor must stay a real link — it carries the click to the router and keeps
			 * middle-click and "copy link" working */
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
			/* close before the click reaches the router, which re-renders the chrome underneath;
			 * no focus return, the user is going elsewhere.
			 *
			 * `onTake` is how a row from an extra source finishes the job the href cannot: a
			 * section row's href can only reach the PAGE, so the source that produced it opens the
			 * tab and scrolls to the section itself. It fires for a click and for Enter alike —
			 * Enter synthesises this very click. */
			a.addEventListener('click', () => {
				close(false);
				if (typeof e.onTake === 'function') e.onTake();
			});
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
		btn.setAttribute(ATTR_EXPANDED, 'true');
		input.value = '';
		render('');
		input.focus();
	}

	function close(returnFocus = true) {
		if (ov.hidden) return;
		ov.hidden = true;
		btn.setAttribute(ATTR_EXPANDED, 'false');
		if (returnFocus) btn.focus();
	}

	input.addEventListener('input', () => render(input.value.trim()));

	/* keys are handled on the overlay, not the input: a click on the scrim moves focus to the
	 * overlay itself, where Escape must still close */
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
			/* a synthetic click carries detail 0, which the router reads as a keyboard
			 * activation, so focus lands where a keyboard navigation puts it */
			opts[at].click();
			return;
		case 'Tab':
			/* aria-modal="true" promises Tab cannot walk out into the page behind, and the input
			 * is the dialog's only tabbable element. Escape or an outside click is the way out,
			 * both handing focus back to the trigger. */
			ev.preventDefault();
			input.focus();
			return;
		}
	});

	/* a click on the scrim — anywhere outside the box — closes */
	ov.addEventListener('click', (ev) => { if (ev.target === ov) close(); });

	btn.addEventListener('click', () => { ov.hidden ? open() : close(); });

	/* Back and Forward are navigations no listener above can see — every other close is a user act
	 * on the document — so without this an open palette rides a popstate onto the next page,
	 * aria-modal and Tab-trapped. returnFocus=false: the router places focus itself. */
	router.onNavigate(() => close(false));

	/* Ctrl/Cmd+K and `/`, the two shortcuts users already have. `/` only when the user is not
	 * typing somewhere — an <input>, a contenteditable, or a .cbi-dropdown, where fs-select.js's
	 * typeahead reads it as a search character. */
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

	return { open, close };
}

/* the one entry point: build if this is the first gesture, then open */
function openPalette() {
	if (!_built) _built = build();
	if (_built) _built.open();
}

return baseclass.extend({
	open: openPalette,
	/* the seam an optional package registers through; see addSource() */
	addSource, refresh
});
