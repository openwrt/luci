'use strict';
'require baseclass';
'require ui';
'require dom';
'require fs-fit as fit';

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
	if (sel.multiple || !sel.closest('.cbi-value-field, .td.cbi-value-field, .cbi-value')) {
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
	} catch (e) { return; }

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
 * `.table`, not `table.table` — the SAME selector relevant() and STACKABLE use. Stock LuCI
 * happens to emit only real <table>s, but a third-party luci-app-* may emit a <div class="table">
 * (coverage rule, docs/conventions.md), which a tag qualifier would pass over so it could never card. */
function tagDataTables() {
	document.querySelectorAll('#view .table:not(.cbi-section-table):not(.fs-dt)').forEach((t) => {
		/* THREE header markups, and each missing one cost a page. L.ui.Table emits
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
		 * ANY of the three = a data table; NONE = a key/value include (System, Memory), which must
		 * never card. `thead` is the structural form of the same statement the two classes make, so
		 * it belongs in the same list rather than in a rule of its own. */
		const head = t.querySelector('.tr.table-titles, .tr.cbi-section-table-titles, thead');
		if (!head) return;
		t.classList.add('fs-dt');
		labelCells(t, head);
	});
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
 * the app set one, that is the app's answer and it knows more than a positional guess. Cheap enough
 * to re-run on every fit pass (it is skipped entirely once the cells carry the attribute), which
 * matters because these tables are POLLED: the rows are replaced wholesale every few seconds, and
 * the fresh ones arrive without it. */
function labelCells(t, head) {
	const titles = [ ...head.children ].map((c) => (c.textContent || '').trim());
	if (!titles.some(Boolean)) return;
	for (const row of t.querySelectorAll('.tr, tbody tr')) {
		if (row === head) continue;
		const cells = row.children;
		for (let i = 0; i < cells.length; i++) {
			if (i >= titles.length || !titles[i]) continue;
			if (cells[i].hasAttribute('data-title')) continue;
			/* a cell that spans columns has no single heading to take */
			if (cells[i].colSpan > 1) continue;
			cells[i].setAttribute('data-title', titles[i]);
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
const STACKABLE = '#view .table.fs-dt';

/* "Too cramped to be a table any more" — a DESIGN judgement. It has to be one: these tables do
 * NOT overflow when the room runs out (their cells break anywhere), they compress into an
 * unreadable ribbon. Do NOT give the cells a min-width so that "cramped" MANUFACTURES an
 * overflow: tried, and it carded the firewall's zone table at 1420px and still overflowed by
 * 39px once carded — a floor big enough to force the overflow is big enough to break the card. */
const CRAMPED = 568;	/* stock LuCI cards its tables at a 600px viewport; below the 767px
						 * tier .fs-content pads 16px a side, so 600 -> 568 of room */

/* The ribbon has one more shape, and CRAMPED cannot see it: the table has room by the number
 * above and still shreds its FIRST column, because auto table layout hands width out by what
 * each column DEMANDS. The leftmost column is the row's identity and usually the least greedy —
 * a wide neighbour (a hostname plus an IPv6, a modulation string) simply takes the width, and
 * `overflow-wrap: anywhere` (theme/30-tables.css) lets the identity be squeezed with no floor:
 * it breaks mid-word rather than overflow, so there is no overflow for fit.overflows() to read.
 *
 * Measured on the router (Wireless, one station, `Access Point "vaka_devices" (phy6-ap0)`):
 * viewport 900 -> the column is 101px and 5 lines, 850 -> 80px and 7, 800 -> 76px and 8, and at
 * NO width did the table card — a nine-line tower of half-words next to columns with room to
 * spare (issue #7). Below 767 the MAC column drops out (the stock phone contract) and the
 * column springs back to 167px, which is why this only ever bit between roughly 780 and 900.
 *
 * So: past this many lines the identity has stopped being readable and the card view — which
 * gives every field its own labelled row — is simply better. A DESIGN judgement like CRAMPED,
 * and it has to be one: any number of lines is legible in isolation. 5 is what the reporter
 * asked for and what the measurements above bracket. Only the first column, and deliberately:
 * a value column wrapping to a few lines is a value being shown, not a table falling apart. */
const MAX_ID_LINES = 5;

/* Is any row's leftmost cell a tower? Text lines, not height — fs-fit.textLines() explains why.
 * The height gate in front of it is not premature: this runs on every poll tick (once a second,
 * every mutation), and Processes/Connections render hundreds of rows whose first cell is a PID
 * that cannot be a tower — one cheap read each keeps the Range walk for the cells that could. */
function idTower(t) {
	const cells = t.querySelectorAll('.tr > .td:first-child');
	if (!cells.length) return false;
	const cs = getComputedStyle(cells[0]);
	const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2 || 16;
	for (const cell of cells) {
		if (cell.clientHeight < MAX_ID_LINES * lh) continue;
		if (fit.textLines(cell) > MAX_ID_LINES) return true;
	}
	return false;
}

function fitTables() {
	document.querySelectorAll(STACKABLE).forEach((t) => {
		const was = t.classList.contains('fs-stacked');

		/* fs-fit rule 1: a stacked table is a pile of flex rows and always "fits", so reading
		 * it as it stands un-stacks it and the next frame stacks it again — oscillation. */
		t.classList.remove('fs-stacked');
		const room = fit.roomFor(t);
		if (!(room > 0)) { if (was) t.classList.add('fs-stacked'); return; }

		/* idTower last: it is the only one that walks the rows */
		const stack = room < CRAMPED || fit.overflows(t) || idTower(t);
		/* write only on a real change: the poll re-renders these tables once a second, and
		 * toggling the class off and on each tick would invalidate style for every row of
		 * Processes/Leases for nothing */
		if (stack) t.classList.add('fs-stacked');
		else if (was) t.classList.remove('fs-stacked');
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
	for (const t of document.querySelectorAll('#view .table.cbi-section-table')) {
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

		/* A table must be TAGGED .fs-dt before it can be fitted, and re-tagged whenever the poll
		 * brings a fresh one back — so the two travel as one fitter, which fs-fit runs now, on
		 * every content mutation (synchronously, pre-paint) and on every resize of #view. */
		fit.add(() => { tagDataTables(); fitTables(); unpinActionColumn(); resyncValues(); });

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
