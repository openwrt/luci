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

/* undo enhance(): drop the widget, unhide the select, and — critically — cut every listener
 * enhance() installed. The `change` listener used to survive teardown, and resync() calls
 * teardown()+enhance() every time a script rebuilds the option list (CBI dependencies do this
 * constantly on the firewall/network forms) — so the select accumulated one live listener per
 * rebuild, each closing over a dead ui.Dropdown and its detached subtree: a leak that grew with
 * every interaction. AbortController is the only way to drop an anonymous listener. */
function teardown(sel) {
	if (sel._fsAbort) sel._fsAbort.abort();
	if (sel._fsNode && sel._fsNode.parentNode)
		sel._fsNode.parentNode.removeChild(sel._fsNode);
	delete sel.dataset.fsSelect;
	sel._fsDd = sel._fsNode = sel._fsKey = sel._fsAbort = null;
	sel.removeAttribute('aria-hidden');
	sel.style.display = '';
}

/* keep an enhanced select and its widget in step when a script drives the native element
 * directly: ui.Select.setValue() rewrites value/options WITHOUT dispatching `change`, so
 * enhance()'s mirror never fires and the widget went stale — showed the old value while Save
 * read the new one. */
function resync(sel) {
	const dd = sel._fsDd;
	if (!dd || !sel._fsNode) return;
	if (sel.disabled) { teardown(sel); return; }	/* disabled later: back to native */
	const key = choicesKey(sel);
	if (key !== sel._fsKey) {
		/* option list rebuilt — recreate the widget from the fresh options */
		teardown(sel);
		enhance(sel);
		return;
	}
	if (dd.getValue() !== sel.value)
		dd.setValue(sel.value);
}

/* A VALUE written through the IDL is invisible to every observer there is.
 *
 * `sel.value = x` and `options[i].selected = true` — which is exactly what `ui.Select.setValue()`
 * does, and `form.js`'s `updateDefaultValue()` calls it on every dependency pass — set no content
 * attribute and add no node, so no MutationRecord is produced at all. relevant() therefore could
 * never wake, resync() never ran, and the widget showed the old label while `getValue()` (and Save)
 * read the new one. Reproduced on the router: `s.value = 'DROP'` left the widget unchanged.
 *
 * So this runs from the fitter, i.e. once per content mutation batch — the same cadence the tables
 * already use — and it is deliberately the CHEAP half of resync(): a value compare per enhanced
 * select, no choicesKey() over every option. Re-keying the widget stays behind relevant(), which now
 * sees an option-list rebuild. */
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
		/* Marked, not merely returned from: without the mark the same select is re-selected by
		 * scan()'s :not([data-fs-select]) on every mutation frame and throws again, forever and
		 * silently. One loud failure, then left as the stock <select> it already is. */
		sel.dataset.fsSelect = 'skip';
		console.error('footstrap: a select could not be enhanced', e);
		return;
	}

	const node = dd.render();
	const ac = new AbortController();
	sel.dataset.fsSelect = '1';
	sel.style.display = 'none';
	/* The hidden <select> leaves the CBI <label for=…> pointing at something no screen reader
	 * announces, and the visible widget nameless. Move the name over, drop the select from the
	 * a11y tree. */
	const title = sel.closest('.cbi-value')?.querySelector('.cbi-value-title');
	/* In a TABLE section there is no .cbi-value and no .cbi-value-title at all — form.js builds
	 * `E('td', {class: 'td cbi-value-field'})` there — so on firewall zones, port forwards and
	 * static leases the widget was left with no accessible name while the native select it replaces
	 * is aria-hidden. The cell's `data-title` IS the column heading (LuCI fills it for the card
	 * stack), which is the same string the header cell shows. */
	const name = (title && title.textContent.trim()) ||
		(sel.closest('.td')?.getAttribute('data-title') || '').trim();
	if (name)
		node.setAttribute('aria-label', name);
	/* Clicking the field's caption must reach the widget. form.js wires that label to
	 * `#widget.cbid…`.click()/focus() — which is the native <select> we just set `display: none` on,
	 * so on this theme the click did nothing at all (measured: focus stayed on <body>, no list
	 * opened), while stock bootstrap focuses the select. The <label for=…> is equally dead for the
	 * same reason. Re-point the gesture at the visible control — focus only, which is the parity
	 * stock gets: its `elem.click()` on a `<select>` opens no list either, so the gesture has always
	 * meant "put me on this control". */
	if (title)
		title.addEventListener('click', () => node.focus(), { signal: ac.signal });
	sel.setAttribute('aria-hidden', 'true');
	sel._fsDd = dd;
	sel._fsNode = node;
	sel._fsKey = choicesKey(sel);
	sel._fsAbort = ac;

	/* AFTER the select: it must stay frameEl.firstChild for ui.Select to read its value on save */
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
 * `:has(.tr.table-titles)` the style engine re-evaluated on every mutation of these polled tables
 * (Processes/routes/leases). Not a .cbi-section-table — config forms keep their own layout.
 *
 * `.table`, not `table.table` — the SAME selector relevant() and stackables() use. Stock LuCI
 * happens to emit only real <table>s, but a third-party luci-app-* may emit a <div class="table">
 * (coverage rule, docs/conventions.md), which a tag qualifier would pass over so it could never card.
 *
 * `.table` is LuCI's own class, and everything the theme knows how to do with a table hangs off it.
 * A third-party app that emits a BARE `<table>` — no LuCI classes at all — therefore matched none of
 * this: nothing tagged it, nothing measured it, nothing carded it, and the only thing that reached it
 * was a phone-tier scrollbar (theme/90-responsive.css). Reported from a phone against a wifi-clients
 * dashboard whose last column was simply cut off.
 *
 * So the second half of this selector claims those too. It is deliberately UNMEASURABLE on the dev
 * stand — a census of `#view table:not(.table):not(.cbi-section-table)` over all 196 menu pages,
 * openclash / justclash / ssclash / dashboard / statistics included, found ZERO. That is the point:
 * every table anyone here emits already carries the class, so this changes nothing that can be
 * measured and covers the one shape that cannot be (docs/conventions.md: coverage is a contract). */
/* NO `:not(.fs-dt)`, and that is the difference between claiming a table once and KEEPING it. These
 * tables are polled: L.ui.Table.update() and every hand-rolled equivalent replace the rows inside
 * the element they already have. Excluding what we tagged meant the claim ran exactly once per
 * element — the rows present at that moment were adopted and captioned, and every batch after it
 * kept neither `.tr`/`.td` nor `data-title`, on a table that by then may carry `.fs-stacked`, where
 * `#view .table.fs-dt.fs-stacked { overflow: hidden }` clips the lot with no scrollbar. That is the
 * exact failure adoptMarkup() was written to prevent, arriving one poll later. LuCI's own tables
 * were never exposed to it (ui.Table writes those class names and the caption itself), so this is
 * third-party-only — which is the zone this whole selector exists for.
 *
 * Re-running is what the two functions below are already written for: both are additive, both skip
 * what is already done, and neither re-decides anything (adoptMarkup() settles the "is this ours to
 * rewrite?" question once, at claim time, and remembers the answer on the element). */
/* ---- AND `#view` IS NOT THE ONLY PLACE A TABLE LANDS ----
 *
 * `ui.showModal` (luci-base ui.js) parks its dialog on `#modal_overlay`, which ui's own `__init__`
 * appends to `<body>` — a SIBLING of #view, not a descendant. Every selector in this file said
 * `#view`, so a table in a dialog was reached by none of it: never tagged `.fs-dt`, never
 * captioned, never measured, never carded. The dialog that shows it is the wireless scan
 * ("Join Network: Wireless Scan", luci-mod-network/wireless.js — a seven-column table built with
 * `E('table', {class: 'table'})` and fed to `cbi_update_table`).
 *
 * Measured on the stand with that exact markup, at a 390px viewport: in #view the table cards
 * (`.fs-stacked`, 358px wide, every value on its own labelled line); in the dialog it stayed a
 * table 373px wide inside 317px of room — 56px past the dialog's edge, with the Encryption column
 * given 10px and `mixed WPA/WPA2 PSK (CCMP…)` spelled one character per line. Reported from a
 * phone, and the screenshot is exactly that tower.
 *
 * So the roots are listed once, here, and every table query in this file is built from them. The
 * overlay is a scroll container (base/60-modal.css) and theme/70-modal.css already spends a block
 * on keeping a wide child from scrolling the dialog off the screen — a table is the widest child
 * there is, and it belongs to the same rule.
 *
 * ---- AND A CLOSED DIALOG IS NOT A CONTENT ROOT, THOUGH IT IS STILL IN THE DOM ----
 *
 * `hideModal()` only drops a class off `<body>`; the dialog KEEPS the last markup it was given until
 * the next `showModal()` overwrites it, and `visibility: hidden` leaves a box behind. Measured after
 * closing a dialog: the overlay shrink-fits to 270px (its `inset-inline: 0` comes with the open
 * class), so the table inside reports 236px of room and stacks — a decision taken about a width the
 * dialog will never have, on rows nobody can see, re-taken on every pass a polled page makes. So the
 * dialog counts as a root only while it is open, which is the same fact `body.modal-overlay-active`
 * already carries for the CSS.
 *
 * The flag flips AFTER the content is written (`showModal` appends, then adds the class), so a
 * mutation-driven pass would run one moment too early and never look again — which is why
 * `fs-fit.js` also watches that class, and why this is a question asked per PASS rather than a
 * selector fixed at load. */
const ROOTS = [ '#view', '#modal_overlay' ];
const inRoots = (sel, roots) => roots.map((r) => `${r} ${sel}`).join(', ');
const liveRoots = () => (document.body.classList.contains('modal-overlay-active') ? ROOTS : ROOTS.slice(0, 1));

const foreignTables = () => inRoots('.table:not(.cbi-section-table)', liveRoots()) + ', ' +
	inRoots('table:not(.table):not(.cbi-section-table)', liveRoots());

/* The FOURTH header markup, and the one only a foreign table produces: `<table><tr><th>…`, with no
 * `<thead>` for the parser to imply and none of LuCI's class names. It is the exact shape the phone
 * tier's scroll fallback was written against, so it has to be recognisable here or that table can
 * still only ever scroll.
 *
 * "Every cell in the first row is a `<th>`" is the whole test, and it has to be EVERY: a data row
 * whose first cell is a row header (`<th scope=row>`) would otherwise be read as the header row and
 * every value below it captioned with a value. A table with no `<th>` at all — a layout table, a
 * matrix — returns null and keeps today's behaviour, which is what the scroll fallback is for. */
function headerRow(t) {
	const row = t.rows && t.rows[0];
	if (!row || !row.cells.length) return null;
	return [ ...row.cells ].every((c) => c.tagName === 'TH') ? row : null;
}

function tagDataTables() {
	document.querySelectorAll(foreignTables()).forEach((t) => {
		/* FOUR header markups, and each missing one cost a page. L.ui.Table emits
		 * `.tr.table-titles`; the apk Software page emits `.tr.cbi-section-table-titles` (missing
		 * it is why the package list once needed a stacking block of its own); and a third-party
		 * table may simply use a real `<thead>` — luci-mod-dashboard's device lists are
		 * `<thead class="thead dashboard-bg"><th class="th nowrap">`, matching neither name. They
		 * therefore never carded, and because those `th`s are `nowrap` they could not compress
		 * either: on a phone the right-hand columns were cut off by .fs-main's overflow clip.
		 * Reported from a router with wifi clients.
		 *
		 * `thead`, not `thead tr`: that markup is built by E(), which appends the `<th>`s straight
		 * to the `<thead>` — the parser's implied row never happens, so a `tr` in the selector finds
		 * nothing. Read as "the header ROW-ISH element", which is what its children are cells of.
		 *
		 * ANY of the four = a data table; NONE = a key/value include (System, Memory), which must
		 * never card. `thead` is the structural form of the same statement the two classes make, so
		 * it belongs in the same list rather than in a rule of its own; headerRow() is the fourth and
		 * cannot be, because "the first row is all `<th>`" is not a selector. */
		const head = t.querySelector('.tr.table-titles, .tr.cbi-section-table-titles, thead') || headerRow(t);
		if (!head) return;
		/* `.table` as well as `.fs-dt`, and only ever ADDED: the theme's whole table vocabulary —
		 * the frame, the cell padding, the card stack — is written against `.table`, so a foreign
		 * table that has just been recognised as a data table has to join it or the tag buys nothing.
		 * A no-op on everything LuCI renders, which carries the class already. */
		t.classList.add('table', 'fs-dt');
		adoptMarkup(t, head);
		labelCells(t, head);
	});
}

/* ...AND THE ROWS AND CELLS INSIDE IT, or the claim is a trap.
 *
 * `.table` alone gets the frame and the padding, because those rules end at the table. Everything
 * that makes the CARD is written one level down — `.table.fs-stacked .tr { display: flex }`, the
 * `.td[data-title]::before` label, the hidden header row — and a bare foreign `<table>` carries none
 * of those class names. So the fitter would measure it, decide it no longer fits, set `.fs-stacked`
 * and change NOTHING: measured at 390px on a bare four-column table, the rows stayed `table-row`,
 * the cells `table-cell` at 80px each, no label was generated — and `#view .table.fs-dt.fs-stacked`
 * sets `overflow: hidden`, so the columns were CLIPPED with no scrollbar to reach them. That is
 * worse than the phone-tier scroll it replaced, which is the whole reason this exists.
 *
 * `.tr` / `.td` / `.th` are LuCI's own names for these roles (docs/third-party-apps.md: the shared
 * zone), and the theme is already writing `.table` onto the same element — this is that one act
 * carried down to the rows, not a new liberty. Additive only, and cheap enough to re-run every fit
 * pass: `classList.add` on an element that already has the class is the same `contains` check we
 * would write to skip it, and these tables are POLLED, so fresh rows arrive bare.
 *
 * The HEADER also has to be recognisable as one, or the card shows it as a first row of column
 * names: a `<thead>` becomes `.thead` and a plain first row of `<th>` becomes `.tr.table-titles` —
 * the two names theme/30-tables.css hides when stacked. */
function adoptMarkup(t, head) {
	/* DECIDED ONCE, AT CLAIM TIME, and only for a table that speaks none of this vocabulary — then
	 * READ on every pass, because the caller now revisits a table it has already claimed (see
	 * foreignTables()). Asking the question afresh each pass instead would answer "already adopted"
	 * the moment we adopted it, and the fresh rows a poll brings in bare would never be taken.
	 * Asking it at all is what keeps the theme's hands off LuCI's own markup: the apk Software list
	 * heads its table with `.tr.cbi-section-table-titles`, and blindly adding `table-titles` to that
	 * would be the theme rewriting a class LuCI chose. */
	if (t._fsAdopt === undefined) t._fsAdopt = !t.querySelector('.tr, .thead');
	if (!t._fsAdopt) return;
	if (head.tagName === 'THEAD') head.classList.add('thead');
	else head.classList.add('tr', 'table-titles');
	const titleRow = (head.firstElementChild && head.firstElementChild.tagName === 'TR') ? head.firstElementChild : head;
	for (const c of titleRow.children) c.classList.add('th');
	/* `t.rows` covers a real <table> whether or not it has a <tbody> — a table built with
	 * createElement has its <tr> directly under the <table> and `tbody tr` finds nothing. A
	 * `<div class="table">` has no `.rows` and is LuCI's own markup, which carries the classes. */
	if (!t.rows) return;
	for (const row of t.rows) {
		if (head.contains(row) || row === head) continue;
		row.classList.add('tr');
		for (const cell of row.children) cell.classList.add(cell.tagName === 'TH' ? 'th' : 'td');
	}
}

/* Give every cell the column heading it will show once the table cards.
 *
 * The card layout prints `attr(data-title)` above each value (theme/30-tables.css), and LuCI's own
 * table builders fill that attribute in. A foreign table has no reason to: luci-mod-dashboard emits
 * bare `<td class="td">`, so carding it would have produced a column of values with nothing saying
 * which was the hostname and which the signal — worse than the clipped table it replaced.
 *
 * The heading is COPIED, not invented: it is the text of the header cell in the same position, so
 * the card says exactly what the column header says. Never overwrites an existing data-title — if
 * the app set one, that is the app's answer and it knows more than a positional guess. Re-run on
 * every fit pass, because these tables are POLLED: the rows are replaced wholesale every few
 * seconds and the fresh ones arrive without the attribute. What keeps that affordable is the
 * PER-ROW skip below: a captioned row is recognised from one cell instead of all of them, so a
 * table LuCI captioned itself costs one attribute test per row and nothing else. */
function labelCells(t, head) {
	const rows = t.querySelectorAll('.tr, tbody tr');
	/* A `<thead>` that was WRITTEN as markup nests a real `<tr>` — the parser inserts one even where
	 * the author left it out — while one built by E() holds the `<th>`s directly (see above). Reading
	 * `head.children` blind therefore captioned every cell of a parsed table with the header row's
	 * ENTIRE text: "HostAddressSignal" over the hostname, over the address and over the signal.
	 * Measured against a bare `<table><thead><tr><th>` on the stand, which is the shape a
	 * server-rendered or innerHTML-built foreign table has. */
	const titleRow = (head.firstElementChild && head.firstElementChild.tagName === 'TR') ? head.firstElementChild : head;
	const titles = [ ...titleRow.children ].map((c) => (c.textContent || '').trim());
	if (!titles.some(Boolean)) return;
	for (const row of rows) {
		if (row === head) continue;
		const cells = row.children;
		/* ---- SKIP A ROW THAT IS ALREADY CAPTIONED, ASKED OF THE ROW AND OF NOTHING ELSE ----
		 *
		 * A claimed table is revisited on every fit pass — a MUTATION pass, not a once-a-second one —
		 * so the common case has to be answered cheaply: everything LuCI renders is captioned by
		 * `ui.Table` as it builds it, and the walk could never find work there. Testing the row's FIRST
		 * cell answers that in one attribute read instead of one per cell.
		 *
		 * The row, rather than the table, is what carries the answer, and that is the whole point: a
		 * poll appends or replaces rows one at a time, and a table can hold captioned and bare rows at
		 * once. A table-level probe has to guess WHICH row speaks for the rest, and every choice is
		 * wrong for some shape — asking the last row stalls forever on a `<tfoot>` of per-column
		 * totals, which is captioned once and then never bare again while fresh rows keep arriving in
		 * the `<tbody>` above it (`t.rows` spans thead, tbody and tfoot, and the query above is in
		 * document order). Asked per row, there is nothing to guess: a fresh row has no caption and is
		 * walked, a captioned one is skipped.
		 *
		 * ITS OWN BLIND SPOT, stated because the reader has no other way to learn its shape: the test
		 * reads the FIRST cell, so a cell replaced inside a row whose first cell survives is skipped
		 * with the row and stays bare. It is narrower than the table-level probe's — that one stalled
		 * a whole table forever, this one misses cells 2..n of one row, and only while that row's first
		 * cell keeps its caption — and nothing in the tree reaches it: `ui.Table.update()` swaps whole
		 * `<tr>`s, and every hand-rolled equivalent rebuilds the row. Testing every cell instead would
		 * cost the walk this skip exists to avoid, on every pass of every polled table, to cover a
		 * shape no emitter produces.
		 *
		 * A first cell that can never take a caption — one that spans columns, or whose header text is
		 * empty — leaves its row walked on every pass. That is the safe direction and it is bounded by
		 * the row, not the table: the walk is idempotent and writes nothing it has not been asked to. */
		if (cells.length && cells[0].hasAttribute('data-title')) continue;
		/* COLUMN cursor, not the cell index: a cell that spans N columns occupies N of the header's
		 * slots while advancing the cell index by one, so keying titles off `i` captioned every cell
		 * AFTER a spanning one with the heading of the column to its left — "Hostname" over an IP
		 * address, and nothing to say the mapping was guessed. Only the spanning cell itself is left
		 * uncaptioned, because it has no single heading to take. (A rowspan reaching down from an
		 * earlier row would shift this too; no LuCI table emits one, and a wrong caption is worse
		 * than none, so that shape stays unhandled rather than approximated.) */
		let col = 0;
		for (let i = 0; i < cells.length; i++) {
			const span = (cells[i].colSpan > 1) ? cells[i].colSpan : 1;
			if (span === 1 && col < titles.length && titles[col] && !cells[i].hasAttribute('data-title'))
				cells[i].setAttribute('data-title', titles[col]);
			col += span;
		}
	}
}

/* ---- CARD-STACK A DATA TABLE THAT NO LONGER FITS --------------------------------
 *
 * Measuring, scheduling and the observers are fs-fit.js; this file supplies only the DECISION.
 * A data table used to card by @container at THREE thresholds (568 plain, 780 leases, 800 apk
 * package list), the last two each carrying their own COPY of the card rules — CSS cannot share
 * a block across two thresholds. All were really asking "does it OVERFLOW?", a fact the browser
 * computes, so it is measured instead: the card rules live once in theme/30-tables.css on
 * .fs-stacked, and a third-party table of unknowable width works too.
 *
 * A CONFIG table (.cbi-section-table) keeps its @container (960, theme/65-dropdown.css) and must
 * NOT be measured: its rows hold widgets (enhance() above turns every <select> into a
 * ui.Dropdown) and a widget bakes in the width of the layout it was laid out in, so
 * un-collapsing it to read it CHANGES what is read. Measured on the router: the firewall zone
 * table then reported needing 1747px where it really needs 1190px and overflowed its section by
 * 557px — an overflow the CSS-only version never had. A data table has no widgets, which is why
 * it is the one that gets measured. */
const stackables = () => inRoots('.table.fs-dt', liveRoots());

/* "Too cramped to be a table any more" — a DESIGN judgement, and the only number in this file.
 *
 * It survives the honest floor below rather than being replaced by it: a four-column table of short
 * values (Startup, Connections) still FITS at 380px of room, technically, as four ribbons of two
 * words each. Nothing measures "unreadable", so somebody has to say it, and stock LuCI says 600px of
 * viewport. Do NOT give the cells a min-width so that "cramped" MANUFACTURES an overflow: tried, and
 * it carded the firewall's zone table at 1420px and still overflowed by 39px once carded — a floor
 * big enough to force the overflow is big enough to break the card. */
const CRAMPED = 568;	/* stock LuCI cards its tables at a 600px viewport; below the 767px tier
						 * .fs-content pads var(--fs-space-4) a side, 16px at the default density,
						 * so 600 -> 568 of room. A fixed number and not a re-read of that token on
						 * purpose: the threshold is the DESIGN judgement above, and Compact density
						 * shrinking the gutter to 10px is not a reason to keep a table wider. */

/* ---- THE REMEDY LADDER: cheapest first, re-measured at every rung ----
 *
 * There used to be four terms in one `||`: `room < CRAMPED`, `overflows()`, `idTower()` (is the first
 * column a tower of half-words?) and `wordFloor() > room` (does the table need more width than its
 * own content can be squeezed into?). Three of the four existed because the CSS had told the engine
 * that any value may break anywhere, which lowers a column's min-content to ONE CHARACTER: with no
 * floor, a column could be starved instead of the table overflowing, and `overflows()` — the one
 * question the browser answers exactly — went blind. `wordFloor()` reconstructed the floor with a
 * canvas and a whitespace split, which is UAX #14 done by hand and wrong in both directions
 * (`WPA2-PSK/CCMP` measured 144px against a real 93px, so tables carded that had room).
 *
 * theme/30-tables.css now gives a data table `overflow-wrap: break-word` for as long as it is a
 * table, so the floor is real again and the overflow is honest. That leaves ONE question — does it
 * fit? — and a ladder of answers when it does not, each one re-measured:
 *
 *   1. it fits                      -> a table, and nothing was written
 *   2. drop the columns the VIEW marked droppable (`hide-xs`/`hide-sm`) and ask again
 *   3. let the widest breakable column shred, and ask again
 *   4. card it
 *
 * Rungs 2 and 3 need no threshold, and that is the point: the guard is the second measurement. On a
 * wide desktop where one base64 key or one process command line is the entire problem, breaking that
 * column makes the table fit and it stays a table; where every column is over its share, breaking one
 * changes nothing and the card is right. Nobody picks a fraction.
 *
 * Rung 2 is upstream's own priority hint, honoured by measurement instead of by viewport: wireless.js,
 * connections.js and channel_analysis.js mark their least valuable columns `hide-xs`, `ui.Table`
 * copies the class from the header cell onto every body cell (ui.js), and until now the theme only
 * obeyed it below 767px or in a card. */

/* Which cells of a table carry the "may shred" mark, as a column index (-1 = none). Kept on the
 * element so the common case — the same column as last pass — writes nothing at all. */
function markBreakColumn(t, rows, col) {
	if (t._fsBreakCol === col) return;
	t._fsBreakCol = col;
	for (const row of rows) {
		const cells = row.children;
		for (let i = 0; i < cells.length; i++)
			cells[i].classList.toggle('fs-td-break', i === col);
	}
}

/* Rung 3. The widest column that CAN be shredded, which is never the first (it is the row's
 * identity — issue #36 is precisely that column being starved) and never a `nowrap`/`pre` one
 * (`overflow-wrap` is inert there, so marking it would buy a layout and no width).
 *
 * With honest floors nothing is starved, so when the table overflows every column sits at its own
 * min-content and the widest one IS the column holding the longest unbreakable token. No canvas, no
 * text measurement — one `getComputedStyle` and one rect per column of one row. */
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

/* ---- A TABLE THAT REPLACES A TABLE INHERITS ITS ANSWER ----
 *
 * The measurement below has to strip a table's marks first (fs-fit rule 1: a stacked table is a pile
 * of flex rows and always "fits"), and that lays the page out with a full-width table for the length
 * of the pass — at 390px, several screens taller than the card stack it is about to be. Standing
 * still nobody sees it. The poll REPLACES these tables rather than updating them, so every tick used
 * to hand the fitter a fresh element with no marks and that intermediate happened again; on a remote
 * router at iPhone width it threw the reader 612px out and back, twice per tick.
 *
 * Compensating for it was tried four ways and each was wrong somewhere; the changelog entry for this
 * release records all four, because each looked right. This attacks the cause instead: the
 * intermediate exists only because the answer was thrown away with the element, so the answer is
 * kept on the SLOT. The slot is the section frame — `slotHome()` below says why it cannot be the
 * table's own parent — and inside it a table is named by its id, or by its position among the
 * tables of that frame when it has none.
 *
 * WHEN THE INHERITED ANSWER IS TRUSTED, and it is not "always". The tier depends on how many columns
 * share the room and on how wide the room is, so both are remembered with it. Room is `roomFor()`,
 * which reads the container rather than the table, so it is unaffected by the marks. The shape is
 * the column count, read from the DOM — `shapeOf()` says why rows are deliberately not in it.
 *
 * A change in either one re-measures. So does the arrival of a table in a slot nobody has measured
 * yet, and so does every full pass, which happens whenever the reader is not scrolling — that last
 * one is what catches the case a column count cannot see, a value that grew long enough to change
 * the tier, within a second of it happening and never during a scroll.
 *
 * WHAT IT COSTS. A tick on a table whose columns and room did not change writes its class names and
 * reads one width, against stripping every mark, forcing a layout, reading `scrollWidth` and
 * possibly walking the columns. Mid-scroll it does not even read the width: only tables with no
 * answer at all are visited, and each is given one without measuring anything. */
const _slots = new WeakMap();

/* THE SLOT IS THE FRAME, NOT THE PARENT, and the difference is the whole cache. A poll tick hands
 * the container a freshly rendered subtree, so the table's immediate parent is usually new as well —
 * keyed on that, every lookup missed and every tick measured from scratch, which is exactly the
 * behaviour this was written to end (measured: the ±612px kept coming). What survives a tick is the
 * frame the theme and luci-mod-status build once, `.cbi-section`; inside it a table is named by its
 * id where it has one, and by its position among the tables of that frame where it does not. */
function slotHome(t) {
	return (t.closest && t.closest('.cbi-section, .cbi-section-node, #view')) || t.parentElement;
}

function slotKey(t, home) {
	if (t.id) return '#' + t.id;
	const kin = home ? Array.from(home.querySelectorAll('.table')) : [];
	const at = kin.indexOf(t);
	return at >= 0 ? 'at' + at : 'lone';
}

/* WHAT CAN CHANGE THE ANSWER, AND WHAT CANNOT. The tier depends on how many columns have to share
 * the room and on how wide the room is — not on how many rows there are. Rows were in this
 * signature first and that was the bug behind a whole afternoon: a lease list gains and loses a row
 * on almost every poll tick, so the signature changed every tick, the cache never hit, and every
 * tick measured from scratch — which is the tall intermediate this exists to avoid.
 *
 * Read from the tree, never from layout: `children.length` is a DOM question, so asking it cannot
 * force the layout the whole design is arranging not to force. */
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
	/* MID-SCROLL, ONLY THE TABLES THAT HAVE NO ANSWER YET. A table that already carries its answer
	 * needs nothing; one that does not is being held out of the layout by the stylesheet and cannot
	 * wait. Neither branch of this function reads layout while `scrolling()` is true. */
	const sel = fit.scrolling() ? inRoots('.table.fs-dt:not(.fs-fitted)', liveRoots()) : stackables();
	document.querySelectorAll(sel).forEach((t) => {
		/* ---- WHILE THE READER SCROLLS, THIS PASS READS NOTHING ----
		 *
		 * Every layout read here — `roomFor()` is one per table — forces the engine to lay the page
		 * out synchronously, and a poll tick lands once a second, so on a phone that is ten forced
		 * layouts in the middle of a flick. iOS runs the main thread sparingly during momentum
		 * scrolling exactly to keep the frame rate; work like this is what it is protecting against,
		 * and the reporter's word for the result was "shakes". A stock theme has no JS in this path
		 * at all, which is why the same page under luci-theme-bootstrap scrolls smoothly.
		 *
		 * So a pass that happens mid-scroll only WRITES: the answer this slot already has goes on the
		 * fresh table, and nothing is measured until the scrolling stops. A slot nobody has measured
		 * yet is judged from the window width instead of the container's — the one number available
		 * without touching layout, and at phone width it gives the same answer. */
		const home = slotHome(t);
		const slots = home ? (_slots.get(home) || new Map()) : null;
		const key = slots ? slotKey(t, home) : null;
		const known = slots ? slots.get(key) : null;

		/* the answer without a measurement: the slot's, or — for a slot nobody has measured yet —
		 * the window's width, which is the one number available without touching layout. At the
		 * width where this matters the cheap judgement and the measured one agree. */
		/* MID-SCROLL THE ANSWER STILL GOES ON, and it must. Letting a freshly polled table wait for
		 * the scrolling to stop was tried on the device that has the fault: the reader then WATCHES
		 * the tables fold into cards under their thumb, and that fold is the hardest jerk of all. The
		 * answer is a write, it forces nothing, and it keeps the fresh table the same shape as the one
		 * it replaced. */
		if (fit.scrolling()) {
			/* the column's width, not the window's: in the sidebar layout they differ by the sidebar,
			 * and an 800px window whose column is 520px used to clear CRAMPED and leave the table
			 * unstacked at full width, clipped by `.fs-main { overflow-x: clip }` until the reader
			 * held still. `chrome.contentWidth()` answers from what the last fitter measured plus the
			 * layout attributes — no layout is read here either. */
			applyDecision(t, known || { stack: chrome.contentWidth() < CRAMPED, drop: false, breakCol: -1 });
			fit.deferMeasurement();
			return;
		}

		/* the column count, read from the tree: no layout is forced by asking */
		const shape = shapeOf(t);

		/* ---- THE ANSWER GOES ON BEFORE ANYTHING IS MEASURED, AND THAT ORDER IS THE FIX ----
		 *
		 * `roomFor()` reads a clientWidth, which forces layout — and a fresh table from a poll tick
		 * is UNMARKED when it lands, so a pass that measured first laid the page out with a
		 * full-width table before it had said a word. That is the tall intermediate the engine
		 * re-anchors on: measured on a remote router at iPhone width, ±612px twice per tick, and it
		 * survived every attempt to compensate for it because the compensation ran after the layout
		 * that caused it.
		 *
		 * With the slot's answer applied first, the only layout this pass forces is one where the
		 * table already wears the answer it had a second ago. */
		if (known) applyDecision(t, known);

		const was = t.classList.contains('fs-stacked');
		/* rounded, because `roomFor()` subtracts parsed padding and answers in fractions: comparing
		 * those exactly made the cache miss on a width that had not moved at all */
		const room = Math.round(fit.roomFor(t));
		if (!(room > 0)) {
			/* Detached, hidden, or a dialog that is closed: keep what it had rather than decide
			 * against a width it does not have — but LET IT INTO THE LAYOUT anyway. The stylesheet
			 * keeps an unanswered table out of the flow (theme/30-tables.css), and a table whose
			 * section is collapsed when it arrives would otherwise stay hidden after the section is
			 * opened: nothing measures it again, because opening a section changes no width this
			 * file watches. A table with no room cannot move anything either way, so admitting it
			 * costs nothing and the next pass with room decides properly. */
			t.classList.add('fs-fitted');
			return;
		}

		/* AND THE TABLE ITSELF HAS TO BE MEASURABLE, WHICH ON ITS FIRST PASS IT IS NOT — because
		 * THIS FILE'S OWN GATE is what hides it. `theme/30-tables.css` holds a `.fs-dt` out of the
		 * layout until something marks it `.fs-fitted`, so the very first pass over a fresh table
		 * reads `scrollWidth: 0` — a `display: none` box has no content width — and 0 overflows
		 * nothing. The pass therefore concluded "it fits", wrote `.fs-fitted`, and CACHED that
		 * answer against the slot; the table then appeared at its natural width, 777px inside a
		 * 712px column, columns cut off by `.fs-main { overflow-x: clip }` with no scrollbar and
		 * nothing to say so.
		 *
		 * It usually corrected itself, which is what made it a report rather than a gate failure: a
		 * second pass ~60 ms later measured the now-visible table and broke its widest column. But
		 * that pass only exists if something mutates `#view` again, and Status → Processes renders
		 * once and then stands still. Measured on the stand at 768px, entering the page directly:
		 * 2 of 8 arrivals on 0.13.1 and 3 of 8 here left the table past the column, and one
		 * mutation of any kind fixed it instantly.
		 *
		 * So a zero measurement is not an answer to anything: lift the gate so the next frame can
		 * see the table, ask for that frame, and write NOTHING to the slot. The schedule is asked
		 * for once — on the pass that lifts the gate — so a table hidden for somebody else's reason
		 * (a closed section, a tab pane) cannot turn this into a frame loop. */
		if (t.scrollWidth === 0) {
			if (!t.classList.contains('fs-fitted')) {
				t.classList.add('fs-fitted');
				fit.schedule();
			}
			return;
		}

		/* the answer this slot already has, for a table of the same shape in the same room — UNLESS the
		 * table has since outgrown it. Room and column count are not the whole input: a poll tick can
		 * put longer values into the same columns, and then a table that fitted a second ago does not.
		 * Measured on a live router at 900px, where the cache held: status_leases6 stood 1000px wide in
		 * an 810px column and wifi_assoclist_table 896px, neither carded, both quietly clipped by
		 * `.fs-main { overflow-x: clip }` — columns cut off with nothing to say so. The extra question
		 * is one the pass already has the layout for. */
		/* AND THE OTHER DIRECTION, WHICH THAT QUESTION CANNOT ASK. `overflows()` is put to a table
		 * that is already wearing its remedy, and every remedy makes a table fit by construction: a
		 * card is a pile of flex rows, `.fs-drop-xs` has hidden the expendable columns, a broken
		 * column shreds. So the answer is always "it fits", and a remedy applied once could never be
		 * lifted while the room and the column count held still — a one-way ratchet. The case is
		 * real: one station with a long hostname makes Associated Stations drop its `hide-xs`
		 * columns, and those columns stayed hidden after that station left, on a screen with room to
		 * spare and nothing to say a column existed.
		 *
		 * The only honest measurement is of a table with no remedy on it, and taking that on every
		 * tick would mean stripping the marks on every tick — the strip-measure-restore that lands as
		 * a visible relayout, which is what the deferral above exists to keep out of a scroll. So the
		 * re-decision is asked for by the CONTENT instead: a remedied table whose row count has gone
		 * DOWN has lost something, and losing something is the only way it can stop needing the
		 * remedy. Rows are counted from the tree, not the layout. A table that keeps its rows keeps
		 * its answer, which is what makes the poll cheap. */
		const rows = t.querySelectorAll('.tr').length;
		const remedied = !!(known && (known.stack || known.drop || known.breakCol !== -1));
		const shrank = remedied && known.rows !== undefined && rows < known.rows;
		if (known && known.room === room && known.shape === shape && !shrank && !fit.overflows(t))
			return;

		/* fs-fit rule 1: a stacked table is a pile of flex rows and always "fits", so reading
		 * it as it stands un-stacks it and the next frame stacks it again — oscillation. Every
		 * mark the ladder can write comes off here, for the same reason. */
		t.classList.remove('fs-stacked', 'fs-drop-xs');
		if (t._fsBreakCol !== undefined && t._fsBreakCol !== -1)
			markBreakColumn(t, t.querySelectorAll('.tr'), -1);

		/* the one judgement a measurement cannot make, and the only number in this file */
		let stack = room < CRAMPED;
		if (!stack && fit.overflows(t)) {
			/* rung 2 — the view author already said which columns are expendable */
			if (t.querySelector('.hide-xs, .hide-sm')) t.classList.add('fs-drop-xs');
			/* rung 3 — one column may shred rather than the whole table becoming a stack of cards */
			if (fit.overflows(t) && !breakWidestColumn(t)) stack = true;
		}

		t.classList.add('fs-fitted');
		/* write only on a real change: the poll re-renders these tables once a second, and
		 * toggling the class off and on each tick would invalidate style for every row of
		 * Processes/Leases for nothing */
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
				/* what the answer was decided over — a drop below this is the one signal that a
				 * remedy may no longer be needed (see the fast path above) */
				rows,
			});
			_slots.set(home, slots);
		}
	});
}

/* ---- AND THE TABLE THAT CANNOT CARD: it scrolls, and it says so ----
 *
 * A table with no header row has no captions to print, so a card would give a column of values with
 * nothing saying what they are — a log, a statistics matrix, a key/value include. Comparison across
 * rows IS that shape's purpose, which is the one case WCAG 2.2 names in the exception to SC 1.4.10
 * ("data tables and grids… it is acceptable to provide two-dimensional scrolling for such parts").
 * theme/30-tables.css already scrolls a BARE `<table>` of that shape; this reaches the one it cannot
 * name — an app that renders the same thing as `<div class="table">` — and it reaches it by
 * measurement rather than by selector, which is what makes the widget refusal below possible.
 *
 * A SCROLLING TABLE CANNOT HOLD A POPUP. `overflow-x: auto` computes `overflow-y` to `auto` too
 * (css-overflow-3 §3.1: there is no `auto`/`visible` pair), so it CLIPS every absolutely positioned
 * thing inside it, and luci-base's `openDropdown()` additionally sizes an open list against the
 * nearest scroll parent — which would now be the table.
 *
 * SO THE ONES THAT HOLD CONTROLS STACK INSTEAD, and refusing to do anything for them was a real
 * defect rather than caution: Network → Diagnostics is three controls in one header-less row, and at
 * 320px of room it needs 338 — measured, the row simply ran past `.fs-main`'s clip and the Ping
 * button was unreachable. Nothing about that shape wants scrolling either: its rows are a FORM, not
 * data, so there is no comparison across rows to preserve. Rows and cells become blocks, each
 * control takes the width it was given, the table cannot overflow anything, and no popup is clipped
 * because nothing became a scroll container.
 *
 * That is also what `theme/90-responsive.css` had been doing for this one page since the phone
 * sweep, keyed by `body[data-page="admin-network-diagnostics"]` and only below 767px. The shape is
 * not that page's — any app can put a select and a button in a `<div class="table">` — and the width
 * that matters is the room, not the viewport, so the page rule is gone and the measurement covers
 * every one of them. */
const scrollables = () => inRoots('.table:not(.fs-dt):not(.cbi-section-table)', liveRoots());
const HOLDS_CONTROLS = '.cbi-dropdown, .cbi-dynlist, .cbi-tooltip-container, .cbi-progressbar, select, input, textarea, [data-tooltip]';

/* ---- MAKING A SCROLL BOX REACHABLE, AND HANDING THE MARKUP BACK EXACTLY AS IT WAS FOUND ----
 *
 * Firefox has made scrollers focusable for years and Chrome since 132, but only when they hold no
 * focusable child — a table row full of buttons disqualifies itself — and WebKit has not shipped it
 * at all (bug 190870, open since 2018). So say it in the markup: a tab stop (SC 2.1.1), and a name so
 * what receives focus can be announced (SC 4.1.2).
 *
 * A ROLE IS WRITTEN ONLY WHERE THERE IS NONE TO LOSE. `<div class="table">` has no implicit role and
 * takes `group`. A real `<table>` must keep the role it already has: HTML-AAM maps `<td>` to `cell`
 * and `<th>` to `columnheader`/`rowheader` ONLY while the table element's role is `table` (or
 * `grid`/`treegrid`), so overwriting it with `group` drops every cell to generic — a screen reader
 * would then read a flat run of text with no rows and no columns, which is the very structure the
 * SC 1.4.10 exception exists to preserve. `aria-label` works on either, so the name and the tab stop
 * are unaffected.
 *
 * WHAT IS REMOVED IS WHAT WAS WRITTEN, remembered per element rather than inferred from the value:
 * an app that had its own `tabindex="0"` or `role="group"` on that table got them taken away when the
 * table later fitted, because "is it 0 / is it group" cannot tell whose it is. */
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
	/* A layout read here lands in the middle of a flick once per poll tick, and that is the work iOS
	 * holds the main thread back to prevent — the same argument fitTables() makes above, and the
	 * reason the theme shook on a phone while a stock one did not. Put off until the page is still;
	 * fs-fit's sampler runs what was deferred the moment the scroll offset stops changing. */
	if (fit.scrolling()) { fit.deferMeasurement(); return; }
	document.querySelectorAll(scrollables()).forEach((t) => {
		const was = t.classList.contains('fs-xscroll');
		const wasStack = t.classList.contains('fs-rowstack');
		/* rule 1 again: a scrolling box always "fits" — its overflow is inside it — and so does a
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
			/* A SCROLL BOX THE KEYBOARD CANNOT REACH IS CONTENT THE KEYBOARD CANNOT READ, and the
			 * tab stop, the name and the conditional role that say so are all reach()'s business —
			 * its header above carries the reasoning.
			 *
			 * `group`, not `region`: a region is a landmark, and a status page with four scrolling
			 * tables would put four of them in the landmark list. */
			reach(t);
		}
		else if (was) unreach(t);
	});
}

/* ---- A PINNED ACTIONS COLUMN IS ONLY VALID FOR THE LAYOUT MODE IT WAS MEASURED IN ----
 *
 * luci-base's `form.js` (stabilizeActionColumnWidth) measures the widest
 * `td.cbi-section-actions > div` and writes that number as an INLINE `width` and `min-width` onto the
 * header cell, the footer cell and every actions cell, caching it in `data-action-col-width`. It does
 * re-run on window resize — but it only deletes the CACHE, never the inline widths, so the fresh
 * measurement reads the width it pinned last time. The pin feeds itself and can only ever grow.
 *
 * On a stock theme that is invisible: a config table is a table at every width, so every measurement
 * is taken in the same layout. This theme cards it under `@container fs-content (max-width: 960px)`
 * (theme/65-dropdown.css), where the actions cell is `flex: 1 1 100%` and its buttons deliberately
 * spread across the whole card — so a measurement taken there is the CARD's width, and carrying it
 * into table mode makes the column absurd.
 *
 * Measured on the router, Network -> Firewall -> Zones: loaded at 1000px (carded) and grown to
 * 1280px, the actions column pins 634px, the table renders 1267px inside a 1056px content column and
 * the column scrolls sideways by 256px — permanently, because upstream's own re-measure reads the
 * pin. A FRESH load at 1280px renders the same table at 966px with a 192px actions column. Shrinking,
 * and growing within table mode, were always fine; it is the card -> table crossing that breaks.
 *
 * So drop the pin whenever the layout it was measured in stops being the layout on screen. Upstream
 * re-measures from a clean DOM on its own resize listener and pins the right number; if it does not,
 * the natural width is what we wanted anyway.
 *
 * THE KEY IS THE ROOM, NOT THE MODE, and starting from the mode alone missed half of it: the card ->
 * table crossing is one way a pin goes stale, and the card simply getting NARROWER is the other. At
 * 768px this theme has no sidebar (data-narrow) and the column is 712px; at 800px the sidebar returns
 * and the column is 520px — the viewport grew, the room shrank, and the table was carded on both
 * sides, so a mode test sees no change at all. Measured: firewall/zones and wireless both kept a
 * `min-width: 670px` cell in a 520px column, 154px of scroll. Keying on the room catches both, since
 * a mode change cannot happen without one.
 *
 * The room is the parent's content box (fit.roomFor), which the table's own width does not feed back
 * into — so wiping the pin cannot change the key and set this oscillating. It fires once per CHANGE,
 * never per tick, so it does not fight upstream for the pin on a polled page. */
function unpinActionColumn() {
	/* A layout read here lands in the middle of a flick once per poll tick, and that is the work iOS
	 * holds the main thread back to prevent — the same argument fitTables() makes above, and the
	 * reason the theme shook on a phone while a stock one did not. Put off until the page is still;
	 * fs-fit's sampler runs what was deferred the moment the scroll offset stops changing. */
	if (fit.scrolling()) { fit.deferMeasurement(); return; }
	for (const t of document.querySelectorAll(inRoots('.table.cbi-section-table', liveRoots()))) {
		if (!t.querySelector('.cbi-section-actions')) continue;
		/* ---- and CLAIM upstream's resize hook, because under SPA navigation it is a leak ----
		 *
		 * stabilizeActionColumnWidth ends by attaching `window.addEventListener('resize', …)` once per
		 * TABLE ELEMENT, guarded by this expando, and the callback closes over that element. Nothing
		 * ever removes it. On a stock theme the next page is a full load and the listener dies with the
		 * document; here the document lives for the whole session, so every visit to a config page
		 * leaves another listener holding another detached table.
		 *
		 * Measured on the router over 120 navigations: window went from 1 resize listener to 31, and a
		 * heap snapshot 280 navigations wide grew by 26 880 UniqueElementData, 23 600 Text nodes,
		 * 18 520 EventListener and 1 160 <form> — a straight 11.8 KB per navigation that never
		 * plateaus once the module cache is full.
		 *
		 * Setting the flag before upstream reaches it means the listener is never attached, and nothing
		 * is lost: what it existed to do — re-measure the column when the width changes — is what the
		 * wipe below now does, from the room rather than from a window event. The fitter runs
		 * SYNCHRONOUSLY on the mutation batch that inserts the table (fs-fit rule 2), which is what
		 * makes claiming it in time possible at all; a table we somehow reach late simply keeps
		 * upstream's listener, i.e. today's behaviour. */
		t.__actionColResizeAttached = true;
		const key = Math.round(fit.roomFor(t));
		if (t._fsActRoom === key) continue;
		const seen = (t._fsActRoom !== undefined);
		t._fsActRoom = key;
		/* the first sighting is not a CHANGE: nothing has been pinned in another layout yet */
		if (!seen) continue;
		delete t.dataset.actionColWidth;
		t.querySelectorAll('.cbi-section-actions').forEach((el) => {
			el.style.removeProperty('width');
			el.style.removeProperty('min-width');
		});
	}
}

/* Does this batch contain anything we could care about? Without it EVERY mutation scheduled a
 * full scan — and the poll rewrites content once a second, so on Overview/Processes/Leases we
 * ran three document-wide querySelectorAll plus a choicesKey() over every option of every
 * enhanced select (thousands of characters on the firewall page) every second, forever, to
 * discover that nothing had changed. */
function relevant(mutations) {
	/* attributeFilter narrows the ATTRIBUTE, not the element: `value`/`disabled` live on inputs
	 * and buttons too, and a poll rewriting an input's value would otherwise wake the whole
	 * scan. This half is ours alone; the added-node walk below is fs-fit's shared one. */
	for (const m of mutations) {
		if (m.type === 'attributes' && m.target.tagName === 'SELECT')
			return true;
		/* …and a REBUILT OPTION LIST. `sel.replaceChildren(new Option(…))` puts <option> elements in
		 * addedNodes, and the shared walk below asks whether an added node IS or CONTAINS a select —
		 * an <option> is neither, so the batch was dropped and resync() never re-keyed the widget.
		 * Measured on the firewall page: after replaceChildren the native select listed AAA/BBB
		 * while the widget still offered reject/drop/accept, and picking from the stale list wrote a
		 * value the new list does not contain, i.e. `''`. CBI dependency handling rebuilds option
		 * lists constantly, which is the case resync() was written for. */
		if (m.type === 'childList' && m.target.tagName === 'SELECT')
			return true;
	}
	/* `.table`, not `table.table` — the same selector tagDataTables() and STACKABLE use.
	 * Additions only: a select or a table going away costs us nothing to notice. */
	return fit.touches(mutations, 'select.cbi-input-select, .table');
}

/* ---- TYPE-AHEAD: jump to an option by typing its first letters ---------------------
 *
 * A native <select> gives this for free, and it is the only way anyone picks a country out of
 * 248 entries. enhance() hides the native select, and ui.Dropdown.handleKeydown (luci-base) does
 * only Esc/Enter/Space/arrows — no letter search — so Wireless -> Country Code became 248 items
 * you could only scroll. (Stock LuCI never had it either; bootstrap only appears to, because it
 * leaves that field a real <select>.)
 *
 * One document-level listener (a dropdown's <ul> holds focus while open), for EVERY
 * .cbi-dropdown — ours and LuCI's own. Native semantics: only while OPEN; printable keys, no
 * modifiers; buffer resets after a pause; the SAME letter repeated cycles (how you reach the
 * second "Germany"); matches the LABEL first, then the value, so "RU" and "Russia" both find it.
 * SPACE is deliberately excluded: ui.Dropdown binds it to "toggle the focused item" and its
 * handler fires first, so treating it as a character would select something.
 *
 * Only HIGHLIGHTS (setFocus, as the arrows do); Enter/Esc stay ui.Dropdown's. */
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
		/* the create-item input is a text field — let the user type into it */
		if (ev.target && ev.target.matches && ev.target.matches('input, textarea')) return;

		const sb = ev.target.closest?.('.cbi-dropdown[open]');
		if (!sb) return;

		const items = typeaheadItems(sb);
		if (!items.length) return;

		/* a new dropdown starts a new search, however fast the user got here */
		if (sb !== _taLast) { _taBuf = ''; _taLast = sb; }

		const ch = ev.key.toLowerCase();
		/* repeating one letter cycles; anything else extends the search */
		const repeat = (_taBuf.length === 1 && _taBuf === ch);
		const needle = repeat ? ch : (_taBuf + ch);

		const start = items.findIndex((li) => li.classList.contains('focus'));
		/* on a repeat, look AFTER the current item so the same letter walks forward; otherwise
		 * the search restarts from the top, as a native select does */
		const from = repeat ? start + 1 : 0;

		/* matches the LABEL first, then the value, so "RU" and "Russia" both find it */
		const matches = (n) => (li) => typeaheadLabel(li).startsWith(n) ||
			String(li.getAttribute('data-value') || '').toLowerCase().startsWith(n);
		const match = matches(needle);

		/* wrap around: the second pass covers what the first skipped */
		let hit = items.slice(from).find(match) ?? items.find(match);
		if (!hit && !repeat) {
			/* the extended buffer matches nothing — treat this keystroke as a fresh search
			 * instead of swallowing it, so a mistyped letter is recoverable */
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

		/* ARM THE STYLESHEET'S GATE FROM HERE, because this is the file that clears it. The rule in
		 * theme/30-tables.css holds an unanswered data table out of the layout, and `.fs-fitted` —
		 * the answer — is written nowhere but in this module. Arming it in fs-fit.js meant a document
		 * that loaded fs-fit and not this file (the footer requires them separately) hid every table
		 * forever. Raised here, one line before the pass that clears it is registered. */
		fit.armGate();

		/* A table must be TAGGED .fs-dt before it can be fitted, and re-tagged whenever the poll
		 * brings a fresh one back — so tagging leads, and the passes that depend on it follow.
		 *
		 * FIVE REGISTRATIONS, NOT ONE CALLBACK. fs-fit catches per registered fitter, so a throw in
		 * one of these used to take the other four with it — and the first of them walks third-party
		 * markup, which is the shape most likely to surprise it. Bundled, a single throw in
		 * `tagDataTables()` left no table tagged, no table answered, and — with the gate above raised
		 * — a page with no tables on it at all. Registered separately, each pass fails alone. */
		fit.add(tagDataTables);
		fit.add(fitTables);
		fit.add(fitScrollables);
		fit.add(unpinActionColumn);
		fit.add(resyncValues);

		/* one scan per frame, however many mutations arrive (fit.frame — the theme's shared
		 * coalescer) */
		const scanSoon = fit.frame(scan);
		new MutationObserver((mutations) => {
			if (relevant(mutations)) scanSoon();
		}).observe(document.body, {
			childList: true, subtree: true,
			/* `disabled` flips and attr-driven value writes never mutate childList;
			 * watch them so resync()/enhance() notice (filtered — cheap) */
			attributes: true, attributeFilter: [ 'disabled', 'value', 'selected' ]
		});
	}
});
