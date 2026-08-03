'use strict';
'require baseclass';

/* fs-fit — the theme's ONE "does it still fit?" engine; add fit logic here, do not grow a second
 * observer. No CSS query can ask what the CONTENT needs (media = viewport, container =
 * container): does the menu fit beside the brand, is a table still readable? Both were once
 * breakpoints (one @media, five @container thresholds) — guessed numbers that real routers got
 * wrong, useless for a third-party luci-app-* table of unknown column count.
 *
 * THREE RULES, each a bug that was hit:
 *  1. MEASURE UNCOLLAPSED — a collapsed thing always "fits" (a stacked table is a pile of flex
 *     rows): read it as it stands and it un-collapses, next frame re-collapses. Oscillation.
 *  2. RE-FIT SYNCHRONOUSLY ON A MUTATION — the poll re-renders content once a second and the
 *     fresh element has lost our class. A MutationObserver callback is a microtask (pre-paint),
 *     rAF runs AT paint: deferring there painted a stacked table one frame at full width —
 *     19-109px of overflow, once a second, on Firewall/DHCP/Wireless.
 *  3. COALESCE ON RESIZE — every fit forces a synchronous layout.
 *
 * ResizeObserver, not onresize: a rail collapse and a layout toggle change the content width
 * without resizing the window. */

const _fitters = [];
let _rafPending = false;
let _ro = null, _mo = null;

/* Run every fitter NOW, synchronously. A fitter must be idempotent — this fires on every
 * relevant mutation. */
function run() {
	for (const fit of _fitters) {
		try { fit(); }
		/* one broken fitter must take neither the others nor the poll's MutationObserver
		 * callback with it — that would silently stop ALL re-fitting */
		catch (e) { console.error('fs-fit: a fitter threw', e); }
	}
}

/* Next frame, at most once per frame (rule 3). */
function schedule() {
	if (_rafPending) return;
	_rafPending = true;
	requestAnimationFrame(() => { _rafPending = false; run(); });
}

/* Watch an element's size. Any change re-fits everything — the fitters are cheap and few. */
function watch(el) {
	if (!el) return;
	if (!_ro) {
		if (!window.ResizeObserver) {			/* no RO: fall back to the window */
			window.addEventListener('resize', schedule);
			return;
		}
		_ro = new ResizeObserver(schedule);
	}
	_ro.observe(el);
}

/* Rule 2's mutation side. Deliberately NOT filtered by node type: a filter is a second place to
 * get wrong (the table fitter's own once said `table.table`, and LuCI renders most of its tables
 * as DIVs — so the poll never re-measured at all), and run() is a handful of measurements. */
function observeContent() {
	if (_mo) return;
	const host = document.getElementById('view') || document.body;
	_mo = new MutationObserver(run);
	_mo.observe(host, { childList: true, subtree: true });
	watch(host);
}

return baseclass.extend({
	/* Register a fitter and run it once. A fitter selects its own elements, strips its class
	 * (rule 1), measures, re-applies. */
	add(fit) {
		if (typeof fit !== 'function') return;
		_fitters.push(fit);
		observeContent();
		fit();
	},

	/* Re-fit on the next frame, coalesced. (There is no exported `run`: everything that changes
	 * the available room — the layout toggle, the rail collapse — schedules. Only the mutation
	 * observer re-fits synchronously, and that is rule 2's whole point.) */
	schedule,

	/* Coalesce ANY callback into one call per frame (rule 3, for non-fitters): schedule() runs
	 * EVERY fitter, so a caller wanting only its own work batched cannot use it — three had
	 * hand-rolled the identical five lines. NOT for the per-element case: menu-footstrap.js's
	 * clamp keeps a rAF handle per <li> so it can CANCEL a pending measure, which a one-flag
	 * coalescer cannot express. */
	frame(fn) {
		let pending = false;
		return () => {
			if (pending) return;
			pending = true;
			requestAnimationFrame(() => { pending = false; fn(); });
		};
	},

	/* Did this batch add anything matching `sel`? The poll rewrites content once a second, so a
	 * MutationObserver here needs that cheap question before its document-wide queries. */
	touches(mutations, sel) {
		for (const m of mutations)
			for (const n of m.addedNodes) {
				if (n.nodeType !== 1) continue;
				if (n.matches(sel) || n.querySelector(sel)) return true;
			}
		return false;
	},

	/* Room for `el` = its PARENT's content box. Measuring against ITSELF does not work: a
	 * `display: table` box with width:100% still grows past it when min-content needs more (auto
	 * layout beats the declared width), so scrollWidth and clientWidth grow together and the
	 * overflow is invisible. The parent is an ordinary block and does not grow. */
	roomFor(el) {
		const p = el && el.parentElement;
		if (!p) return Infinity;
		const cs = getComputedStyle(p);
		return p.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
	},

	/* Does `el` need more width than it has been given? */
	overflows(el) {
		return el.scrollWidth > this.roomFor(el) + 1;	/* +1: sub-pixel rounding */
	},

	/* How many LINE BOXES of text does `el` render? The fact behind "this column has been
	 * squeezed into a tower" — a cell that has to break its own words is a column that has run
	 * out of width, which is a thing no viewport query can ask.
	 *
	 * NOT height / line-height: the assoclist's first cell is an `.ifacebadge`, a flex COLUMN
	 * with a 32px icon over the text, so a third of that height is not text at all. Ranges over
	 * the TEXT NODES only, so an <img> cannot be counted as a line.
	 *
	 * Cluster by the rect's TOP, not by vertical overlap: consecutive lines OVERLAP. Measured on
	 * the router — tops 15-16px apart while each rect is 17-18px tall (the font's box is taller
	 * than the line advance), so an overlap test merged an 8-line tower into ONE line and the
	 * whole check silently never fired. Half a line of tolerance also merges what belongs on one
	 * line: a `<small>` shares the baseline but sits a few px lower, and is not a new line. */
	textLines(el) {
		const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
		const range = document.createRange();
		const rects = [];
		for (let n; (n = walker.nextNode());) {
			if (!n.nodeValue.trim()) continue;
			range.selectNodeContents(n);
			for (const r of range.getClientRects())
				if (r.width > 0.5 && r.height > 0.5) rects.push(r);
		}
		rects.sort((a, b) => a.top - b.top);
		let lines = 0, top = -Infinity;
		for (const r of rects)
			if (r.top - top > r.height * 0.5) { lines++; top = r.top; }
		return lines;
	}
});
