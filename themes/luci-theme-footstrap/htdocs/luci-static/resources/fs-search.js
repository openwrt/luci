'use strict';
'require baseclass';
'require fs-menutree as tree';
'require fs-prefs as prefs';
'require fs-router as router';

/* Find a page by typing its name instead of knowing which section owns it: a loaded router carries
 * ~200 menu nodes across 11 sections. */

/* ---- the index ---- */

/* How deep below the mode the walk goes (`depth` starts at 1 on a node that already has two
 * segments). */
const MAX_DEPTH = 4;

let _index = null;

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
		/* the chrome carries its own Logout (header.ut); indexing it would let a search
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

/* Built once per document: it projects the client menu tree, which ui.menu.load() caches for the
 * life of the document. */
function index() {
	if (!_index) _index = buildIndex();
	return _index;
}

/* ---- matching ---- */

/* Every whitespace-separated token must hit something: a second word means and. Deliberately not a
 * fuzzy subsequence match. */
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
			hits.push({ e: e, score: sum + (e.depth * 0.1) });	/* ties: shallower page first */
	}
	hits.sort((a, b) => a.score - b.score);
	return hits.slice(0, limit).map((h) => h.e);
}

/* ---- recently visited ---- */

/* What the palette shows before anything is typed: an admin lives in three or four pages, so the
 * empty state is its most-used view. Only the path is stored. */

/* The list is written by menu-footstrap-common.js, which is on every page; this module is loaded
 * only on open. */
function recentEntries() {
	const byPath = new Map(index().map((e) => [ e.path, e ]));
	return prefs.recentPaths().map((k) => byPath.get(k)).filter(Boolean);
}

/* ---- the palette ---- */

const MAX_RESULTS = 20;

/* Built on the first open and kept: the overlay, its listeners and the index survive for the life
 * of the document. */
let _built = null;

function build() {
	const SEARCH_PAGES = _('Search pages', 'footstrap');
	const btn = document.getElementById('fs-search-btn');
	if (!btn) return null;

	const ID_SEARCH_LIST = 'fs-search-list';
	const ATTR_EXPANDED = 'aria-expanded';
	const input = E('input', {
		'type': 'text',
		'class': 'fs-search-input',
		'role': 'combobox',
		'aria-controls': ID_SEARCH_LIST,
		[ATTR_EXPANDED]: 'true',
		'aria-autocomplete': 'list',
		'aria-label': SEARCH_PAGES,
		'placeholder': _('Search pages…', 'footstrap'),
		'autocomplete': 'off',
		'autocapitalize': 'off',
		'spellcheck': 'false'
	});
	const list = E('div', { 'id': ID_SEARCH_LIST, 'class': ID_SEARCH_LIST, 'role': 'listbox', 'aria-label': _('Pages', 'footstrap') });
	const note = E('div', { 'class': 'fs-search-note' });
	const ico = E('span', { 'class': 'fs-search-ico' });
	ico.appendChild(btn.querySelector('svg').cloneNode(true));
	const box = E('div', { 'class': 'fs-search-box' }, [
		E('div', { 'class': 'fs-search-row' }, [ ico, input ]),
		note,
		list
	]);
	/* data-fs-chrome marks a zone-1 root: this overlay is parented to <body>, outside the <nav>
	 * that carries the mark in header.ut, so without it the fence does not cover the palette */
	const ov = E('div', {
		'id': 'fs-search-ov',
		'class': 'fs-search-ov',
		'data-fs-chrome': '',
		'role': 'dialog',
		'aria-modal': 'true',
		'aria-label': SEARCH_PAGES,
		'hidden': ''
	}, [ box ]);
	document.body.appendChild(ov);

	let opts = [], ents = [], at = -1;

	/* Warm the highlighted page's module chain, debounced: render() re-runs setActive(0) on every
	 * keystroke, so warming at once would pull the top result of each keystroke. */
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
			/* role="option" on the <a> itself: an option may not contain an interactive element, and the
			 * anchor must stay a real link. */
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
			/* aria-modal="true" promises Tab cannot walk out into the page behind, and the input is the
			 * dialog's only tabbable element. */
			ev.preventDefault();
			input.focus();
			return;
		}
	});

	/* a click on the scrim — anywhere outside the box — closes */
	ov.addEventListener('click', (ev) => { if (ev.target === ov) close(); });

	/* Back and Forward are navigations no listener above can see, so without this an open palette
	 * rides along onto the previous page. */
	router.onNavigate(() => close(false));

	return { open, toggle: () => (ov.hidden ? open() : close()) };
}

/* the one entry point: built on the first gesture, null when the page has no #fs-search-btn */
function palette() {
	if (!_built) _built = build();
	return _built;
}

return baseclass.extend({
	open: () => palette()?.open(),
	toggle: () => palette()?.toggle()
});
