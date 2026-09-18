'use strict';
'require baseclass';
'require ui';
'require dom';
'require fs-fit as fit';
/* for the content column's width without a layout read — see the mid-scroll branch in fitTables */
'require fs-chrome as chrome';

/* Theme plain LuCI <select> fields (ui.Select, widget:'select') by rendering a styled
 * cbi-dropdown beside them — a native <select> popup cannot be CSS-styled.
 *
 * The native <select> stays the form field and MUST remain frameEl.firstChild:
 * ui.Select.getValue() returns `this.node.firstChild.value`. Inserting our widget BEFORE it made
 * getValue read a <div> and return `undefined`, which broke Save. So insert AFTER, and mirror the
 * value both ways. Sharing the frameEl also ties our node to the widget's lifecycle, so a CBI
 * re-render disposes of it — no orphans.
 *
 * Runs theme-wide (required from the footer); watches for selects added later by client CBI. */

function readChoices(sel) {
	const choices = {};
	Array.prototype.forEach.call(sel.options, (o) => { choices[o.value] = o.textContent; });
	return choices;
}

/* cheap identity of the option list, to detect a script rebuilding it
 * (select.replaceChildren, dependency-driven re-population, …) */
function choicesKey(sel) {
	return Array.prototype.map.call(sel.options, (o) => o.value + '\u0000' + o.textContent).join('\u0001');
}

/* Undo enhance(): drop the widget, unhide the select and cut every listener enhance() installed.
 * resync() calls teardown()+enhance() every time a script rebuilds the option list, which CBI
 * dependencies do constantly, so a surviving listener accumulates one per rebuild, each closing
 * over a dead ui.Dropdown and its detached subtree. AbortController is the only way to drop an
 * anonymous listener. */
function teardown(sel) {
	if (sel._fsAbort) sel._fsAbort.abort();
	if (sel._fsNode && sel._fsNode.parentNode)
		sel._fsNode.parentNode.removeChild(sel._fsNode);
	delete sel.dataset.fsSelect;
	sel._fsDd = sel._fsNode = sel._fsKey = sel._fsAbort = null;
	sel.removeAttribute('aria-hidden');
	sel.style.display = '';
}

/* keep an enhanced select and its widget in step when a script drives the native element directly:
 * ui.Select.setValue() rewrites value/options without dispatching `change`, so enhance()'s mirror
 * never fires and the widget shows the old value while Save reads the new one */
function resync(sel) {
	const dd = sel._fsDd;
	if (!dd || !sel._fsNode) return;
	if (sel.disabled) { teardown(sel); return; }	/* disabled later: back to native */
	const key = choicesKey(sel);
	if (key !== sel._fsKey) {
		teardown(sel);
		enhance(sel);
		return;
	}
	if (dd.getValue() !== sel.value)
		dd.setValue(sel.value);
}

/* A value written through the IDL is invisible to every observer: `sel.value = x` and
 * `options[i].selected = true` — what `ui.Select.setValue()` does, and form.js calls it on every
 * dependency pass — set no content attribute and add no node, so no MutationRecord exists for
 * relevant() to wake on and the widget shows the old label while Save reads the new value.
 *
 * So this runs from the fitter, once per content mutation batch, and is deliberately the cheap half
 * of resync(): a value compare per enhanced select, no choicesKey() over every option. Re-keying
 * stays behind relevant(), which sees an option-list rebuild. */
function resyncValues() {
	for (const sel of document.querySelectorAll('select[data-fs-select]')) {
		const dd = sel._fsDd;
		if (!dd || !sel._fsNode || sel.disabled) continue;
		if (dd.getValue() !== sel.value)
			dd.setValue(sel.value);
	}
}

function enhance(sel) {
	if (sel.dataset.fsSelect || sel.disabled) return;	/* disabled: NOT marked — it may be enabled later */
	/* `multiple` and "not in a CBI field" are permanent, so mark it and stop re-testing on
	 * every scan */
	if (sel.multiple || !sel.closest('.cbi-value-field, .cbi-value')) {
		sel.dataset.fsSelect = 'skip';
		return;
	}

	const choices = readChoices(sel);

	let dd;
	try {
		dd = new ui.Dropdown(sel.value, choices, {
			sort: false,
			optional: Object.prototype.hasOwnProperty.call(choices, '')
		});
	} catch (e) {
		/* marked, not merely returned from: unmarked, the same select is re-selected on every
		 * mutation frame and throws again, forever. One loud failure, then left as a stock
		 * <select>. */
		sel.dataset.fsSelect = 'skip';
		console.error('footstrap: a select could not be enhanced', e);
		return;
	}

	const node = dd.render();
	const ac = new AbortController();
	sel.dataset.fsSelect = '1';
	sel.style.display = 'none';
	/* the hidden <select> leaves the CBI <label for=…> pointing at something no screen reader
	 * announces, and the visible widget nameless: move the name over and drop the select from the
	 * a11y tree */
	const title = sel.closest('.cbi-value')?.querySelector('.cbi-value-title');
	/* a table section has no .cbi-value and no .cbi-value-title — form.js builds a bare
	 * `td.cbi-value-field` — so the widget would be left nameless there. The cell's `data-title` is
	 * the column heading, which LuCI fills for the card stack. */
	const name = (title && title.textContent.trim()) ||
		(sel.closest('.td')?.getAttribute('data-title') || '').trim();
	if (name)
		node.setAttribute('aria-label', name);
	/* Clicking the field's caption must reach the widget: form.js wires that label to the native
	 * <select>, which this theme has set `display: none` on, so the click does nothing at all.
	 * Focus only, which is the parity stock gets — its `elem.click()` on a `<select>` opens no list
	 * either. */
	if (title)
		title.addEventListener('click', () => node.focus(), { signal: ac.signal });
	sel.setAttribute('aria-hidden', 'true');
	sel._fsDd = dd;
	sel._fsNode = node;
	sel._fsKey = choicesKey(sel);
	sel._fsAbort = ac;

	/* after the select: it must stay frameEl.firstChild for ui.Select to read its value on save */
	sel.parentNode.insertBefore(node, sel.nextSibling);

	/* stops our own dd->sel dispatch from echoing back through the sel->dd listener */
	let syncing = false;

	/* our widget -> native select (user picked an option) */
	node.addEventListener('cbi-dropdown-change', () => {
		const v = dd.getValue();
		if (sel.value === v) return;
		syncing = true;
		sel.value = v;
		sel.dispatchEvent(new Event('change', { bubbles: true }));
		syncing = false;
	}, { signal: ac.signal });

	/* native select -> our widget (a script/CBI dependency changed and dispatched change on
	 * the select) — keeps the visible widget from going stale */
	sel.addEventListener('change', () => {
		if (syncing) return;
		if (dd.getValue() !== sel.value)
			dd.setValue(sel.value);
	}, { signal: ac.signal });
}

/* Tag standalone data tables so the stacking rules key off a static `.fs-dt` instead of a live
 * `:has(.tr.table-titles)` the style engine re-evaluates on every mutation of these polled tables.
 * Not a .cbi-section-table — config forms keep their own layout.
 *
 * `.table`, not `table.table`, and a bare `<table>` counts too: a third-party app may emit a
 * `<div class="table">`, or a table with no LuCI class at all, and neither would be tagged,
 * measured or carded (docs/conventions.md: coverage is a contract). The bare-table half matches
 * nothing on the dev stand — a census over all 196 menu pages found zero — which is the point.
 *
 * No `:not(.fs-dt)`: these tables are polled, and ui.Table.update() and every hand-rolled
 * equivalent replace the rows inside the element they already have. Claiming a table once means the
 * fresh rows arrive without `.tr`/`.td` or `data-title` on a table that may by then be `.fs-stacked`
 * and clipped with no scrollbar. Both functions below are additive, skip what is already done and
 * re-decide nothing.
 *
 * `#view` is not the only place a table lands: `ui.showModal` parks its dialog on `#modal_overlay`,
 * a SIBLING of #view, so a table in the wireless-scan dialog was reached by none of this and stood
 * 56px past the dialog's edge at 390px. So the roots are listed once here and every table query is
 * built from them: the overlay is the scroll container (base/60-modal.css) and theme/70-modal.css
 * already keeps a wide child from scrolling the dialog off the screen, and a table is the widest
 * child there is.
 *
 * A CLOSED dialog is not a content root, though it is still in the DOM: `hideModal()` only drops a
 * class off <body> and the dialog keeps its markup, but the overlay then shrink-fits, so a table
 * inside it would be judged against a width the dialog will never have. `body.modal-overlay-active`
 * is the same fact the CSS uses. The flag flips AFTER the content is written, so this is asked per
 * PASS rather than fixed at load, and fs-fit.js watches that class. */
const ROOTS = [ '#view', '#modal_overlay' ];
const inRoots = (sel, roots) => roots.map((r) => `${r} ${sel}`).join(', ');
const liveRoots = () => (document.body.classList.contains('modal-overlay-active') ? ROOTS : ROOTS.slice(0, 1));

const foreignTables = () => inRoots('.table:not(.cbi-section-table)', liveRoots()) + ', ' +
	inRoots('table:not(.table):not(.cbi-section-table)', liveRoots());

/* The fourth header markup, and the one only a foreign table produces: `<table><tr><th>…`, with no
 * `<thead>` for the parser to imply and none of LuCI's class names.
 *
 * "Every cell in the first row is a `<th>`" is the whole test, and it has to be EVERY: a data row
 * whose first cell is a row header would otherwise be read as the header row and every value below
 * it captioned with a value. A table with no `<th>` at all returns null and keeps the scroll
 * fallback. */
function headerRow(t) {
	const row = t.rows && t.rows[0];
	if (!row || !row.cells.length) return null;
	return [ ...row.cells ].every((c) => c.tagName === 'TH') ? row : null;
}

function tagDataTables() {
	document.querySelectorAll(foreignTables()).forEach((t) => {
		/* Four header markups, and missing one costs a page: ui.Table emits `.tr.table-titles`,
		 * the apk Software page `.tr.cbi-section-table-titles`, a third-party table may use a real
		 * `<thead>` (luci-mod-dashboard's are `<thead class="thead">` with `nowrap` cells, which
		 * neither card nor compress, so their right-hand columns were clipped on a phone), and
		 * headerRow() covers the fourth.
		 *
		 * `thead`, not `thead tr`: markup built by E() appends the `<th>`s straight to the
		 * `<thead>`, so the parser's implied row never happens.
		 *
		 * Any of the four means a data table; none means a key/value include (System, Memory),
		 * which must never card. */
		const head = t.querySelector('.tr.table-titles, .tr.cbi-section-table-titles, thead') || headerRow(t);
		if (!head) return;
		/* `.table` as well as `.fs-dt`, and only ever added: the theme's table vocabulary is
		 * written against `.table`, so a newly recognised foreign table has to join it. A no-op on
		 * everything LuCI renders. */
		t.classList.add('table', 'fs-dt');
		adoptMarkup(t, head);
		labelCells(t, head);
	});
}

/* …and the rows and cells inside it, or the claim is a trap.
 *
 * `.table` alone gets the frame and the padding; everything that makes the CARD is written one
 * level down (`.table.fs-stacked .tr { display: flex }`, the `.td[data-title]::before` label, the
 * hidden header row), and a bare foreign `<table>` carries none of those names. The fitter would
 * then set `.fs-stacked` and change nothing, while `#view .table.fs-dt.fs-stacked` clips the
 * columns with no scrollbar to reach them.
 *
 * `.tr` / `.td` / `.th` are LuCI's own names for these roles (docs/third-party-apps.md), and the
 * theme is already writing `.table` onto the same element. Additive only and cheap to re-run every
 * pass: these tables are polled, so fresh rows arrive bare.
 *
 * The header also has to be recognisable, or the card shows it as a first row of column names: a
 * `<thead>` becomes `.thead`, a plain first row of `<th>` becomes `.tr.table-titles` — the two
 * names theme/30-tables.css hides when stacked. */
function adoptMarkup(t, head) {
	/* Decided once, at claim time, then read on every pass: asking afresh each pass would answer
	 * "already adopted" the moment we adopted it, and the bare rows a poll brings in would never be
	 * taken. Asking it at all is what keeps the theme's hands off LuCI's own markup — adding
	 * `table-titles` to a `.tr.cbi-section-table-titles` head would rewrite a class LuCI chose. */
	if (t._fsAdopt === undefined) t._fsAdopt = !t.querySelector('.tr, .thead');
	if (!t._fsAdopt) return;
	if (head.tagName === 'THEAD') head.classList.add('thead');
	else head.classList.add('tr', 'table-titles');
	const titleRow = (head.firstElementChild && head.firstElementChild.tagName === 'TR') ? head.firstElementChild : head;
	for (const c of titleRow.children) c.classList.add('th');
	/* `t.rows` covers a real <table> with or without a <tbody> — a table built with createElement
	 * has its <tr> directly under the <table>, where `tbody tr` finds nothing. A `<div class="table">`
	 * has no `.rows` and is LuCI's own markup, which carries the classes. */
	if (!t.rows) return;
	for (const row of t.rows) {
		if (head.contains(row) || row === head) continue;
		row.classList.add('tr');
		for (const cell of row.children) cell.classList.add(cell.tagName === 'TH' ? 'th' : 'td');
	}
}

/* Give every cell the column heading it will show once the table cards. The card layout prints
 * `attr(data-title)` above each value (theme/30-tables.css) and LuCI's own builders fill it in; a
 * foreign table has no reason to, and carding one without captions gives a column of values with
 * nothing saying which is which.
 *
 * The heading is copied from the header cell in the same position, never invented, and never
 * overwrites an existing data-title — the app's own answer knows more than a positional guess.
 * Re-run every pass, because these tables are polled and fresh rows arrive bare; the per-row skip
 * below is what keeps that affordable. */
function labelCells(t, head) {
	const rows = t.querySelectorAll('.tr, tbody tr');
	/* a `<thead>` written as markup nests a real `<tr>` (the parser inserts one even where the
	 * author left it out) while one built by E() holds the `<th>`s directly, so reading
	 * `head.children` blind captions every cell with the header row's entire text */
	const titleRow = (head.firstElementChild && head.firstElementChild.tagName === 'TR') ? head.firstElementChild : head;
	const titles = [ ...titleRow.children ].map((c) => (c.textContent || '').trim());
	if (!titles.some(Boolean)) return;
	for (const row of rows) {
		if (row === head) continue;
		const cells = row.children;
		/* Skip a row that is already captioned, asked of the ROW and of nothing else. A claimed
		 * table is revisited on every mutation pass and everything LuCI renders is captioned by
		 * ui.Table as it builds it, so the common case is answered by one attribute read.
		 *
		 * Per row, because a poll replaces rows one at a time and a table can hold captioned and
		 * bare rows at once. A table-level probe has to guess which row speaks for the rest, and
		 * every choice is wrong for some shape — asking the last row stalls forever on a `<tfoot>`
		 * of totals while fresh rows keep arriving above it.
		 *
		 * Its blind spot: the test reads the FIRST cell, so a cell replaced inside a row whose first
		 * cell survives stays bare. Nothing in the tree reaches it — ui.Table.update() swaps whole
		 * `<tr>`s and hand-rolled equivalents rebuild the row — and testing every cell would cost
		 * the walk this skip exists to avoid on every pass of every polled table.
		 *
		 * A first cell that can never take a caption (spanning, or with empty header text) leaves
		 * its row walked every pass. The walk is idempotent, so that is the safe direction. */
		if (cells.length && cells[0].hasAttribute('data-title')) continue;
		/* Column cursor, not the cell index: a cell spanning N columns occupies N header slots while
		 * advancing the index by one, so keying titles off `i` captions every cell after it with the
		 * heading to its left. The spanning cell itself takes none, having no single heading. (A
		 * rowspan reaching down from an earlier row would shift this too; no LuCI table emits one,
		 * and a wrong caption is worse than none.) */
		let col = 0;
		for (let i = 0; i < cells.length; i++) {
			const span = (cells[i].colSpan > 1) ? cells[i].colSpan : 1;
			if (span === 1 && col < titles.length && titles[col] && !cells[i].hasAttribute('data-title'))
				cells[i].setAttribute('data-title', titles[col]);
			col += span;
		}
	}
}

/* ---- WCAG 1.3.1: a `display` override must not cost a table its own roles ----
 *
 * theme/*.css restyles `display` on `.table`/`.thead`/`.tbody`/`.tfoot`/`.tr`/`.th`/`.td` in over
 * twenty places — `.fs-stacked`, `.fs-rowstack`, the config table's own `@container`, the phone
 * `@media`, the Overview meter row, the software page's carded description column, the 560px
 * key/value card added alongside this file — scattered across selectors this module cannot see the
 * live state of (a media query, a container query, a class some other pass toggled). A `display`
 * other than `table`/`table-row`/`table-cell`/… drops the IMPLICIT `table`/`row`/`cell` role
 * HTML-AAM derives from it: measured on Overview's key/value cards, `display: block`/`grid`/`block`
 * (table/row/cell) at both 1440 and 390px, and on the 390px card stack, `block`/`none`/`block` —
 * neither carries a role, so the column a value belongs to is never announced.
 *
 * Rather than pair each of those twenty-odd rules with a role write timed to its own trigger — a
 * race with every one of them — the role is written UNCONDITIONALLY, matching what a plain
 * `<table>` already carries implicitly. That costs nothing while the table IS a table and survives
 * the moment any of those rules land. tools/table-contract.mjs holds the pairing: a future
 * `display` rule on one of these classes with no role to match is what it is written to catch.
 *
 * The whole chain, every pass — a `role="cell"` with nothing above it saying `row`, or a `row` with
 * nothing above IT saying `table`/`rowgroup`, reads worse than no roles at all. One flat query per
 * class keeps it whole without walking each table by hand: `.tr`/`.th`/`.td` are LuCI's own names,
 * always written together with `.table` (adoptMarkup() above never adds one without the others), so
 * a class query alone reaches the whole subtree. `.thead`/`.tbody`/`.tfoot` are the same for a
 * div-based table; a REAL `<thead>`/`<tbody>`/`<tfoot>` this file never classes (20_lan.js's and
 * 30_wifi.js's `<tfoot>`, theme/30-tables.css:570/634) is reached by tag name instead. */
const TABLE_ROLE_CLASSES = [
	[ '.table', 'table' ],
	[ '.thead', 'rowgroup' ],
	[ '.tbody', 'rowgroup' ],
	[ '.tfoot', 'rowgroup' ],
	[ '.tr', 'row' ],
	[ '.th', 'columnheader' ],
	[ '.td', 'cell' ],
];
const TABLE_ROLE_TAGS = [
	[ 'thead', 'rowgroup' ],
	[ 'tbody', 'rowgroup' ],
	[ 'tfoot', 'rowgroup' ],
];

/* idempotent, the same idiom as menu-footstrap-common.js's fsSyncAttr: a node that already carries
 * the right role is a no-op read, so a poll tick re-rendering the same table on every tick touches
 * no DOM and wakes no attribute observer. Not imported for one line — this file has none of that
 * module's other exports to justify the dependency. */
function setRole(el, role) {
	if (el.getAttribute('role') !== role) el.setAttribute('role', role);
}

/* A hidden row/cell (`.tr.cbi-section-table-descr`, `.td.hide-xs`/`.hide-sm` under `.fs-stacked`/
 * `.fs-drop-xs`) drops out of the accessibility tree on `display: none` alone — the role written
 * here changes nothing about that, since a role is inert on a box the engine never generates. */
function roleTables() {
	TABLE_ROLE_CLASSES.forEach(([ sel, role ]) => {
		document.querySelectorAll(inRoots(sel, liveRoots())).forEach((el) => setRole(el, role));
	});
	TABLE_ROLE_TAGS.forEach(([ sel, role ]) => {
		document.querySelectorAll(inRoots(sel, liveRoots())).forEach((el) => setRole(el, role));
	});
}

/* ---- card-stack a data table that no longer fits ----
 *
 * Measuring, scheduling and the observers are fs-fit.js; this file supplies only the decision.
 * Carding by @container needed three thresholds, two of them carrying their own copy of the card
 * rules, and all three were really asking "does it overflow?" — a fact the browser computes. So it
 * is measured, the card rules live once on `.fs-stacked`, and a third-party table of unknowable
 * width works too.
 *
 * A config table (.cbi-section-table) keeps its @container (960, theme/65-dropdown.css) and must
 * NOT be measured: its rows hold widgets, and a widget bakes in the width of the layout it was laid
 * out in, so un-collapsing it to read it changes what is read — the firewall zone table then
 * reported needing 1747px against a real 1190px and overflowed its section by 557px. */
const stackables = () => inRoots('.table.fs-dt', liveRoots());

/* "Too cramped to be a table any more" — a design judgement, and the only threshold the fit
 * decision takes on trust rather than measuring. A four-column table of short values still fits at
 * 380px of room, technically, as four ribbons of two words each; nothing measures "unreadable",
 * and stock LuCI says 600px of viewport. Do not give the cells a min-width so that "cramped"
 * manufactures an overflow: tried, and it carded the firewall's zone table at 1420px and still
 * overflowed by 39px once carded — a floor big enough to force the overflow is big enough to break
 * the card. */
const CRAMPED = 568;	/* stock LuCI cards its tables at a 600px viewport; below the 767px tier
						 * .fs-content pads var(--fs-space-4) a side, 16px at the default density,
						 * so 600 -> 568 of room. A fixed number and not a re-read of that token on
						 * purpose: the threshold is the DESIGN judgement above, and Compact density
						 * shrinking the gutter to 10px is not a reason to keep a table wider. */

/* ---- the remedy ladder: cheapest first, re-measured at every rung ----
 *
 * theme/30-tables.css gives a data table `overflow-wrap: break-word` for as long as it is a table,
 * so a column's min-content is an honest floor and the overflow the browser reports is honest with
 * it. (Letting any value break anywhere lowers min-content to one character, so a column is starved
 * instead of the table overflowing and `overflows()` goes blind; reconstructing the floor in JS
 * instead is UAX #14 by hand and wrong in both directions — `WPA2-PSK/CCMP` measured 144px against a
 * real 93px, so tables carded that had room.)
 *
 * That leaves one question — does it fit? — and a ladder of answers when it does not, each
 * re-measured:
 *
 *   1. it fits                      -> a table, and nothing was written
 *   2. drop the columns the VIEW marked droppable (`hide-xs`/`hide-sm`) and ask again
 *   3. let the widest breakable column shred, and ask again
 *   4. card it
 *
 * Rungs 2 and 3 need no threshold: the guard is the second measurement. Where one base64 key is the
 * entire problem, breaking that column makes the table fit; where every column is over its share,
 * breaking one changes nothing and the card is right.
 *
 * Rung 2 is upstream's own priority hint, honoured by measurement instead of by viewport: several
 * views mark their least valuable columns `hide-xs` and ui.Table copies the class onto every body
 * cell. */

/* Which cells carry the "may shred" mark, as a column index (-1 = none). Kept on the element so
 * the common case — the same column as last pass — writes nothing. */
function markBreakColumn(t, rows, col) {
	if (t._fsBreakCol === col) return;
	t._fsBreakCol = col;
	for (const row of rows) {
		const cells = row.children;
		for (let i = 0; i < cells.length; i++)
			cells[i].classList.toggle('fs-td-break', i === col);
	}
}

/* Rung 3. The widest column that can be shredded: never the first, which is the row's identity
 * (issue #36 is that column being starved), and never a `nowrap`/`pre` one, where `overflow-wrap`
 * is inert so the mark would buy a layout and no width.
 *
 * With honest floors nothing is starved, so an overflowing table has every column at its own
 * min-content and the widest one holds the longest unbreakable token — one `getComputedStyle` and
 * one rect per column of one row, no text measurement. */
function breakWidestColumn(t) {
	const rows = t.querySelectorAll('.tr:not(.table-titles):not(.cbi-section-table-titles):not(.placeholder)');
	if (!rows.length) return false;
	const cells = rows[0].children;
	let col = -1, widest = 0;
	for (let i = 1; i < cells.length; i++) {
		const ws = getComputedStyle(cells[i]).whiteSpace;
		if (ws === 'nowrap' || ws === 'pre') continue;
		const w = cells[i].getBoundingClientRect().width;
		if (w > widest) { widest = w; col = i; }
	}
	if (col < 0) return false;
	markBreakColumn(t, rows, col);
	if (!fit.overflows(t)) return true;
	markBreakColumn(t, rows, -1);
	return false;
}

/* ---- a table that replaces a table inherits its answer ----
 *
 * The measurement below has to strip a table's marks first (fs-fit rule 1: a stacked table is a
 * pile of flex rows and always "fits"), which lays the page out with a full-width table for the
 * length of the pass — several screens taller than the card stack it is about to be. The poll
 * REPLACES these tables rather than updating them, so every tick hands the fitter a fresh element
 * with no marks and the intermediate happens again: at iPhone width it threw the reader 612px out
 * and back, twice per tick. Compensating for it afterwards was tried four ways and each was wrong
 * somewhere.
 *
 * So the answer is kept on the SLOT instead — the section frame (`slotHome()` says why not the
 * table's own parent), inside which a table is named by its id, or by its position among that
 * frame's tables.
 *
 * The inherited answer is trusted only while the inputs hold: the tier depends on how many columns
 * share the room and how wide the room is, so both are remembered with it. Room is `roomFor()`,
 * which reads the container rather than the table and is unaffected by the marks; the shape is the
 * column count (`shapeOf()` says why rows are not in it).
 *
 * A change in either re-measures, as does a table arriving in an unmeasured slot, as does every
 * full pass — which happens whenever the reader is not scrolling and is what catches a value that
 * grew long enough to change the tier. */
const _slots = new WeakMap();

/* The slot is the frame, not the parent, and the difference is the whole cache: a poll tick hands
 * the container a freshly rendered subtree, so the table's immediate parent is usually new too and
 * every lookup would miss. What survives a tick is the `.cbi-section` frame. */
function slotHome(t) {
	return (t.closest && t.closest('.cbi-section, .cbi-section-node, #view')) || t.parentElement;
}

function slotKey(t, home) {
	if (t.id) return '#' + t.id;
	const kin = home ? Array.from(home.querySelectorAll('.table')) : [];
	const at = kin.indexOf(t);
	return at >= 0 ? 'at' + at : 'lone';
}

/* What can change the answer: how many columns share the room, and how wide the room is — not how
 * many rows there are. A lease list gains and loses a row on almost every tick, so rows in this
 * signature mean the cache never hits and every tick measures from scratch, which is the tall
 * intermediate this exists to avoid.
 *
 * Read from the tree, never from layout: `children.length` is a DOM question and forces nothing. */
function shapeOf(t) {
	const head = t.querySelector('.tr.table-titles, .cbi-section-table-titles') || t.firstElementChild;
	return String(head ? head.children.length : 0);
}

function applyDecision(t, d) {
	/* the mark that lets the table into the layout at all — see theme/30-tables.css */
	t.classList.add('fs-fitted');
	t.classList.toggle('fs-stacked', !!d.stack);
	t.classList.toggle('fs-drop-xs', !!d.drop);
	if (d.breakCol !== undefined && d.breakCol !== -1)
		markBreakColumn(t, t.querySelectorAll('.tr'), d.breakCol);
}

function fitTables() {
	/* mid-scroll, only the tables with no answer yet: one that has an answer needs nothing, one
	 * that does not is held out of the layout by the stylesheet and cannot wait. Neither branch
	 * reads layout while `scrolling()` is true. */
	const sel = fit.scrolling() ? inRoots('.table.fs-dt:not(.fs-fitted)', liveRoots()) : stackables();
	document.querySelectorAll(sel).forEach((t) => {
		/* While the reader scrolls this pass only WRITES: every layout read here forces a
		 * synchronous layout, and a poll tick can land mid-flick, so on a phone with ten tables that
		 * is ten forced layouts in the middle of a flick — the work iOS holds the main thread back
		 * to prevent. */
		const home = slotHome(t);
		const slots = home ? (_slots.get(home) || new Map()) : null;
		const key = slots ? slotKey(t, home) : null;
		const known = slots ? slots.get(key) : null;

		/* The answer still goes on mid-scroll, and it must: letting a freshly polled table wait for
		 * the scrolling to stop makes the reader watch the tables fold into cards under their
		 * thumb, which is the hardest jerk of all. The answer is a write, forces nothing, and keeps
		 * the fresh table the shape of the one it replaced. */
		if (fit.scrolling()) {
			/* the column's width, not the window's: they differ by the sidebar, so an 800px window
			 * whose column is 520px would clear CRAMPED and leave the table unstacked and clipped.
			 * `chrome.contentWidth()` answers from what the last fitter measured, reading no
			 * layout. */
			applyDecision(t, known || { stack: chrome.contentWidth() < CRAMPED, drop: false, breakCol: -1 });
			fit.deferMeasurement();
			return;
		}

		/* SOMEBODY ELSE'S SCROLLER, SOMEBODY ELSE'S DECISION. An app that puts its table in a box of
		 * its own with `overflow-x: auto` has already answered the question this file asks, and
		 * every answer here would overrule it: inside a 598px box a wide table overflows by
		 * definition, so the ladder ends in a card stack however much room the page has.
		 * luci-app-filemanager parks its listing in a `div.resizeable` of exactly that width and
		 * came out as cards on a 1280px screen, with 1224px of column beside it (docs/third-party-
		 * apps.md: what the theme may do to a foreign table). Asked before the slot's answer is
		 * applied, so a table that was carded before this rule existed is un-carded rather than
		 * re-carded. */
		if (fit.inScroller(t)) {
			t.classList.add('fs-fitted');
			t.classList.remove('fs-stacked', 'fs-drop-xs');
			return;
		}

		/* the column count, read from the tree: asking forces no layout */
		const shape = shapeOf(t);

		/* The answer goes on before anything is measured, and that order is the fix: `roomFor()`
		 * forces layout, and a fresh table from a poll tick is unmarked when it lands, so measuring
		 * first lays the page out with a full-width table — the tall intermediate the engine
		 * re-anchors on. With the slot's answer applied first, the only layout this pass forces is
		 * one where the table already wears the answer it had a second ago. */
		if (known) applyDecision(t, known);

		const was = t.classList.contains('fs-stacked');
		/* rounded, because `roomFor()` subtracts parsed padding and answers in fractions, so an
		 * exact compare misses the cache on a width that has not moved */
		const room = Math.round(fit.roomFor(t));
		if (!(room > 0)) {
			/* Detached, hidden, or a closed dialog: keep the previous answer rather than decide
			 * against a width it does not have — but let it into the layout anyway. The stylesheet
			 * keeps an unanswered table out of the flow, and a table whose section is collapsed on
			 * arrival would otherwise stay hidden after the section is opened, since opening one
			 * changes no width this file watches. */
			t.classList.add('fs-fitted');
			return;
		}

		/* On its first pass the table is not measurable, because this file's own gate hides it:
		 * theme/30-tables.css holds a `.fs-dt` out of the layout until something marks it
		 * `.fs-fitted`, so the pass reads `scrollWidth: 0` and 0 overflows nothing. Concluding "it
		 * fits" and caching that leaves the table at its natural width, clipped by
		 * `.fs-main { overflow-x: clip }` with no scrollbar: measured at 768px, 777px of table inside a
		 * 712px column, and a page that renders once and stands still never gets a second pass to
		 * correct it.
		 *
		 * So a zero measurement is not an answer: lift the gate so the next frame can see the
		 * table, ask for that frame, and write nothing to the slot. The schedule is asked for once,
		 * so a table hidden for somebody else's reason cannot turn this into a frame loop. */
		if (t.scrollWidth === 0) {
			if (!t.classList.contains('fs-fitted')) {
				t.classList.add('fs-fitted');
				fit.schedule();
			}
			return;
		}

		/* The slot's answer holds for a table of the same shape in the same room — unless the table
		 * has since outgrown it: a poll tick can put longer values into the same columns, and a
		 * table that fitted a second ago then stands 1000px wide in an 810px column, clipped with
		 * nothing to say so. That question uses the layout this pass already has.
		 *
		 * The other direction cannot be asked that way. `overflows()` is put to a table already
		 * wearing its remedy, and every remedy makes a table fit by construction, so the answer is
		 * always yes and a remedy applied once could never be lifted — one long hostname makes
		 * Associated Stations drop its `hide-xs` columns, and they stay hidden after that station
		 * leaves. An honest measurement needs the marks stripped, which is the visible relayout the
		 * deferral above keeps out of a scroll, so the re-decision is asked for by the CONTENT
		 * instead: a remedied table whose row count has gone DOWN has lost something, and that is
		 * the only way it can stop needing the remedy. Rows are counted from the tree. */
		const rows = t.querySelectorAll('.tr').length;
		const remedied = !!(known && (known.stack || known.drop || known.breakCol !== -1));
		const shrank = remedied && known.rows !== undefined && rows < known.rows;
		if (known && known.room === room && known.shape === shape && !shrank && !fit.overflows(t))
			return;

		/* fs-fit rule 1: a stacked table is a pile of flex rows and always "fits", so reading it as
		 * it stands un-stacks it and the next frame stacks it again. Every mark the ladder can
		 * write comes off here. */
		t.classList.remove('fs-stacked', 'fs-drop-xs');
		if (t._fsBreakCol !== undefined && t._fsBreakCol !== -1)
			markBreakColumn(t, t.querySelectorAll('.tr'), -1);

		/* the one judgement a measurement cannot make */
		let stack = room < CRAMPED;
		if (!stack && fit.overflows(t)) {
			/* rung 2 — the view author already said which columns are expendable */
			if (t.querySelector('.hide-xs, .hide-sm')) t.classList.add('fs-drop-xs');
			/* rung 3 — one column may shred rather than the whole table becoming a stack of cards */
			if (fit.overflows(t) && !breakWidestColumn(t)) stack = true;
		}

		t.classList.add('fs-fitted');
		/* write only on a real change: the poll re-renders these tables on every tick, and toggling
		 * the class each tick invalidates style for every row for nothing */
		if (stack) {
			t.classList.add('fs-stacked');
			/* a card gives every value the whole row, so neither remedy has anything left to do */
			t.classList.remove('fs-drop-xs');
			if (t._fsBreakCol !== undefined && t._fsBreakCol !== -1)
				markBreakColumn(t, t.querySelectorAll('.tr'), -1);
		}
		else if (was) t.classList.remove('fs-stacked');

		if (slots) {
			slots.set(key, {
				stack,
				drop: t.classList.contains('fs-drop-xs'),
				breakCol: (t._fsBreakCol === undefined) ? -1 : t._fsBreakCol,
				room,
				shape,
				/* what the answer was decided over: a drop below this is the one signal that a
				 * remedy may no longer be needed (see the fast path above) */
				rows,
			});
			_slots.set(home, slots);
		}
	});
}

/* ---- and the table that cannot card: it scrolls, and it says so ----
 *
 * A table with no header row has no captions to print, so a card would give a column of values with
 * nothing saying what they are — a log, a statistics matrix, a key/value include. Comparison across
 * rows is that shape's purpose, which is the case WCAG 2.2 names in the exception to SC 1.4.10
 * ("data tables and grids… it is acceptable to provide two-dimensional scrolling for such parts").
 * theme/30-tables.css already scrolls a bare `<table>` of that shape; this reaches the one it
 * cannot name — an app rendering the same thing as `<div class="table">` — by measurement rather
 * than by selector.
 *
 * A scrolling table cannot hold a popup: `overflow-x: auto` computes `overflow-y` to `auto` too
 * (css-overflow-3 §3.1), so it clips everything absolutely positioned inside it, and luci-base's
 * `openDropdown()` sizes an open list against the nearest scroll parent.
 *
 * So the ones that hold CONTROLS stack instead. Their rows are a form, not data, so there is no
 * comparison across rows to preserve; rows and cells become blocks, each control takes the width it
 * was given, and nothing becomes a scroll container. Doing nothing for them is a real defect —
 * Network -> Diagnostics is three controls in one header-less row needing 338px in 320px, and the
 * Ping button was simply unreachable past `.fs-main`'s clip. The shape is not that page's, and the
 * width that matters is the room rather than the viewport, so this measures instead of naming a
 * page. */
const scrollables = () => inRoots('.table:not(.fs-dt):not(.cbi-section-table)', liveRoots());
const HOLDS_CONTROLS = '.cbi-dropdown, .cbi-dynlist, .cbi-tooltip-container, .cbi-progressbar, select, input, textarea, [data-tooltip]';

/* ---- making a scroll box reachable, and handing the markup back as it was found ----
 *
 * Firefox has made scrollers focusable for years and Chrome since 132, but only when they hold no
 * focusable child, and WebKit has not shipped it at all (bug 190870). So say it in the markup: a
 * tab stop (SC 2.1.1) and a name for what receives focus (SC 4.1.2).
 *
 * A role is written only where there is none to lose. `<div class="table">` has no implicit role
 * and takes `group`; a real `<table>` keeps its own, because HTML-AAM maps `<td>` to `cell` and
 * `<th>` to `columnheader`/`rowheader` only while the table's role is `table` (or `grid`/
 * `treegrid`), so `group` would drop every cell to generic and leave a screen reader reading a flat
 * run of text.
 *
 * What is removed is what was written, remembered per element rather than inferred from the value:
 * "is it 0 / is it group" cannot tell whose attribute it is. */
function reach(t) {
	if (!t.hasAttribute('tabindex')) { t.tabIndex = 0; t._fsTab = true; }
	if (!t.hasAttribute('role') && !(t instanceof HTMLTableElement)) {
		t.setAttribute('role', 'group');
		t._fsRole = true;
	}
	if (!t.hasAttribute('aria-label') && !t.hasAttribute('aria-labelledby')) {
		const head = t.closest('.cbi-section, fieldset, #view')?.querySelector('h2, h3, h4, legend');
		t.setAttribute('aria-label', (head && head.textContent.trim()) || _('Table'));
		t._fsNamed = true;
	}
}

function unreach(t) {
	if (t._fsTab) { t.removeAttribute('tabindex'); delete t._fsTab; }
	if (t._fsRole) { t.removeAttribute('role'); delete t._fsRole; }
	if (t._fsNamed) { t.removeAttribute('aria-label'); delete t._fsNamed; }
}

function fitScrollables() {
	/* a layout read here lands mid-flick once per poll tick — see fitTables(). Put off until the
	 * page is still; fs-fit's sampler runs what was deferred once the offset stops changing. */
	if (fit.scrolling()) { fit.deferMeasurement(); return; }
	document.querySelectorAll(scrollables()).forEach((t) => {
		const was = t.classList.contains('fs-xscroll');
		const wasStack = t.classList.contains('fs-rowstack');
		/* rule 1 again: a scrolling box always "fits", its overflow being inside it, and so does a
		 * stacked one, whose rows are blocks */
		t.classList.remove('fs-xscroll', 'fs-rowstack');
		if (!(fit.roomFor(t) > 0)) {
			if (was) t.classList.add('fs-xscroll');
			if (wasStack) t.classList.add('fs-rowstack');
			return;
		}
		const over = fit.overflows(t);
		const controls = over && !!t.querySelector(HOLDS_CONTROLS);
		/* a table of CONTROLS stacks; a table of VALUES scrolls and keeps its shape */
		if (controls) {
			t.classList.add('fs-rowstack');
			if (was) unreach(t);
			return;
		}
		const scroll = over;
		if (scroll === was) { if (was) t.classList.add('fs-xscroll'); return; }
		if (scroll) {
			t.classList.add('fs-xscroll');
			/* a scroll box the keyboard cannot reach is content the keyboard cannot read — see
			 * reach(). `group`, not `region`: a region is a landmark, and a status page with four
			 * scrolling tables would put four of them in the landmark list. */
			reach(t);
		}
		else if (was) unreach(t);
	});
}

/* ---- a pinned actions column is only valid for the layout it was measured in ----
 *
 * luci-base's form.js (stabilizeActionColumnWidth) measures the widest `td.cbi-section-actions > div`
 * and writes it as an inline `width`/`min-width` on the header, footer and every actions cell,
 * caching it in `data-action-col-width`. Its resize handler deletes only the CACHE, never the inline
 * widths, so the fresh measurement reads the width it pinned last time: the pin feeds itself and can
 * only grow.
 *
 * On a stock theme that is invisible, a config table being a table at every width. This theme cards
 * it under `@container fs-content (max-width: 960px)`, where the actions cell is `flex: 1 1 100%`
 * and its buttons spread across the whole card, so a measurement taken there is the CARD's width —
 * carried into table mode, firewall/zones pins 634px and scrolls sideways by 256px, permanently,
 * against 192px on a fresh load at the same width.
 *
 * So drop the pin whenever the layout it was measured in stops being the layout on screen; upstream
 * re-measures from a clean DOM and pins the right number, and if it does not, the natural width is
 * what we wanted.
 *
 * The key is the ROOM, not the mode: the card getting narrower goes stale the same way, and at 768px
 * (no sidebar, 712px column) against 800px (sidebar back, 520px column) the table is carded on both
 * sides, so a mode test sees no change while a 670px cell sits in a 520px column. A mode change
 * cannot happen without a room change, so the room catches both.
 *
 * The room is the parent's content box, which the table's own width does not feed back into, so
 * wiping the pin cannot change the key and set this oscillating. It fires once per change, never per
 * tick. */
function unpinActionColumn() {
	/* a layout read here lands mid-flick once per poll tick — see fitTables() */
	if (fit.scrolling()) { fit.deferMeasurement(); return; }
	for (const t of document.querySelectorAll(inRoots('.table.cbi-section-table', liveRoots()))) {
		if (!t.querySelector('.cbi-section-actions')) continue;
		/* Claim upstream's resize hook, which under SPA navigation is a leak:
		 * stabilizeActionColumnWidth attaches a `resize` listener once per TABLE ELEMENT, guarded by
		 * this expando, and nothing removes it. On a stock theme it dies with the document; here the
		 * document lives for the session, so every visit to a config page leaves another listener
		 * holding another detached table — 1 to 31 listeners over 120 navigations, ~11.8 KB per
		 * navigation that never plateaus.
		 *
		 * Setting the flag first means the listener is never attached, and nothing is lost: the wipe
		 * below re-measures from the room instead of from a window event. The fitter runs
		 * synchronously on the mutation batch that inserts the table (fs-fit rule 2), which is what
		 * makes claiming it in time possible; a table reached late simply keeps upstream's
		 * listener. */
		t.__actionColResizeAttached = true;
		const key = Math.round(fit.roomFor(t));
		if (t._fsActRoom === key) continue;
		const seen = (t._fsActRoom !== undefined);
		t._fsActRoom = key;
		/* the first sighting is not a change: nothing has been pinned in another layout yet */
		if (!seen) continue;
		delete t.dataset.actionColWidth;
		t.querySelectorAll('.cbi-section-actions').forEach((el) => {
			el.style.removeProperty('width');
			el.style.removeProperty('min-width');
		});
	}
}

/* Does this batch contain anything we could care about? Without it every mutation schedules a full
 * scan, and the poll rewrites content on every tick: three document-wide querySelectorAll plus a
 * choicesKey() over every option of every enhanced select, per tick, to discover that nothing
 * changed. */
function relevant(mutations) {
	/* attributeFilter narrows the attribute, not the element: `value`/`disabled` live on inputs and
	 * buttons too, and a poll rewriting an input's value would otherwise wake the whole scan */
	for (const m of mutations) {
		if (m.type === 'attributes' && m.target.tagName === 'SELECT')
			return true;
		/* …and a rebuilt option list: `sel.replaceChildren(new Option(…))` puts <option> elements in
		 * addedNodes, and the shared walk below asks whether an added node is or contains a select,
		 * which an <option> is neither — so the batch is dropped, the widget keeps the old list, and
		 * picking from it writes a value the new list does not contain. CBI dependency handling
		 * rebuilds option lists constantly. */
		if (m.type === 'childList' && m.target.tagName === 'SELECT')
			return true;
	}
	/* `.table`, not `table.table` — the `.table` half of the selector tagDataTables() uses. Additions
	 * only: a select or a table going away costs nothing to notice. */
	return fit.touches(mutations, 'select.cbi-input-select, .table');
}

/* ---- type-ahead: jump to an option by typing its first letters ----
 *
 * A native <select> gives this for free, and it is the only way anyone picks a country out of 248
 * entries. enhance() hides the native select, and ui.Dropdown.handleKeydown does only
 * Esc/Enter/Space/arrows.
 *
 * One document-level listener (a dropdown's <ul> holds focus while open), for every .cbi-dropdown,
 * ours and LuCI's own. Native semantics: only while open; printable keys, no modifiers; the buffer
 * resets after a pause; the same letter repeated cycles; the label matches first and the value
 * second, so "RU" and "Russia" both find it. Space is excluded — ui.Dropdown binds it to "toggle
 * the focused item" and its handler fires first.
 *
 * Only highlights (setFocus, as the arrows do); Enter/Esc stay ui.Dropdown's. */
const TYPEAHEAD_RESET_MS = 1000;
let _taBuf = '', _taTimer = null, _taLast = null;

function typeaheadItems(sb) {
	const ul = sb.querySelector('ul.dropdown') || sb.querySelector('ul');
	if (!ul) return [];
	return [...ul.children].filter((li) =>
		li.tagName === 'LI' &&
		/* the "custom value" row (options.create) is an input, not a choice */
		!li.querySelector('input:not([type="hidden"])') &&
		li.getClientRects().length > 0);
}

function typeaheadLabel(li) {
	return (li.textContent || '').trim().toLowerCase();
}

function wireTypeahead() {
	document.addEventListener('keydown', (ev) => {
		if (ev.ctrlKey || ev.altKey || ev.metaKey) return;
		if (!ev.key || ev.key.length !== 1 || ev.key === ' ') return;
		/* the create-item input is a text field: let the user type into it */
		if (ev.target && ev.target.matches && ev.target.matches('input, textarea')) return;

		const sb = ev.target.closest?.('.cbi-dropdown[open]');
		if (!sb) return;

		const items = typeaheadItems(sb);
		if (!items.length) return;

		/* a new dropdown starts a new search, however fast the user got here */
		if (sb !== _taLast) { _taBuf = ''; _taLast = sb; }

		const ch = ev.key.toLowerCase();
		const repeat = (_taBuf.length === 1 && _taBuf === ch);
		const needle = repeat ? ch : (_taBuf + ch);

		const start = items.findIndex((li) => li.classList.contains('focus'));
		/* on a repeat, look after the current item so the same letter walks forward; otherwise the
		 * search restarts from the top, as a native select does */
		const from = repeat ? start + 1 : 0;

		const matches = (n) => (li) => typeaheadLabel(li).startsWith(n) ||
			String(li.getAttribute('data-value') || '').toLowerCase().startsWith(n);
		const match = matches(needle);

		/* wrap around: the second pass covers what the first skipped */
		let hit = items.slice(from).find(match) ?? items.find(match);
		if (!hit && !repeat) {
			/* the extended buffer matches nothing: treat this keystroke as a fresh search rather
			 * than swallow it, so a mistyped letter is recoverable */
			hit = items.find(matches(ch));
			if (hit) _taBuf = '';
		}
		if (!hit) return;

		_taBuf = repeat ? ch : (_taBuf + ch);
		if (_taTimer) window.clearTimeout(_taTimer);
		_taTimer = window.setTimeout(() => { _taBuf = ''; _taLast = null; }, TYPEAHEAD_RESET_MS);

		/* the widget's own highlighter: adds .focus, scrolls the item into view and focuses it,
		 * so Enter (ui.Dropdown's handler) commits exactly what is highlighted */
		const inst = dom.findClassInstance(sb);
		if (inst && typeof inst.setFocus === 'function')
			inst.setFocus(sb, hit, true);
		else
			hit.focus();

		ev.preventDefault();
		ev.stopPropagation();
	});
}

return baseclass.extend({
	__init__() {
		wireTypeahead();

		const scan = () => {
			document.querySelectorAll('select.cbi-input-select:not([data-fs-select])').forEach(enhance);
			document.querySelectorAll('select.cbi-input-select[data-fs-select="1"]').forEach(resync);
		};
		scan();

		/* Arm the stylesheet's gate from here, because this is the file that clears it: the rule in
		 * theme/30-tables.css holds an unanswered data table out of the layout, and `.fs-fitted` is
		 * written nowhere but in this module. Armed in fs-fit.js, a document that loaded that file
		 * and not this one (the footer requires them separately) hid every table forever. */
		fit.armGate();

		/* A table must be tagged .fs-dt before it can be fitted, and re-tagged whenever the poll
		 * brings a fresh one back, so tagging leads; roleTables() follows it directly so a class
		 * adoptMarkup() just added carries its role in the same pass rather than waiting a tick.
		 *
		 * Six registrations, not one callback: fs-fit catches per registered fitter, and the first
		 * of these walks third-party markup. Bundled, one throw in `tagDataTables()` leaves no table
		 * tagged and — with the gate above raised — a page with no tables on it at all. */
		fit.add(tagDataTables);
		fit.add(roleTables);
		fit.add(fitTables);
		fit.add(fitScrollables);
		fit.add(unpinActionColumn);
		fit.add(resyncValues);

		/* one scan per frame, however many mutations arrive (fit.frame is the shared coalescer) */
		const scanSoon = fit.frame(scan);
		new MutationObserver((mutations) => {
			if (relevant(mutations)) scanSoon();
		}).observe(document.body, {
			childList: true, subtree: true,
			/* `disabled` flips and attribute-driven value writes never mutate childList, so watch
			 * them for resync()/enhance() */
			attributes: true, attributeFilter: [ 'disabled', 'value', 'selected' ]
		});
	}
});
