'use strict';
'require baseclass';
'require ui';
'require dom';
'require fs-fit as fit';
'require fs-chrome as chrome';
'require fs-widgets as widgets';

/* Three jobs; 2, 3 and the value resync register with fs-fit (measuring and scheduling stay there):
 * 1. <select> enhancement: a styled cbi-dropdown beside each plain LuCI <select>, values mirrored
 *    both ways. It keeps its own observer on body (childList and `disabled`) so it also catches
 *    selects added later by client CBI, and schedules the scan through fit.frame.
 * 2. data-table tagging and a11y roles: `.fs-dt`, adopted markup, data-title captions, ARIA roles.
 * 3. table fit decisions: the card/drop/shred ladder, scrollers, the action-column pin.
 * The native <select> must remain frameEl.firstChild, because ui.Select.getValue() returns
 * `this.node.firstChild.value`; the widget goes after it and shares frameEl's lifecycle. */

function readChoices(sel) {
	const choices = {};
	for (const o of sel.options) choices[o.value] = o.textContent;
	return choices;
}

function choicesKey(sel) {
	return Array.from(sel.options, (o) => o.value + '\u0000' + o.textContent).join('\u0001');
}

function teardown(sel) {
	if (sel._fsAbort) sel._fsAbort.abort();
	sel._fsNode?.remove();
	delete sel.dataset.fsSelect;
	sel._fsDd = sel._fsNode = sel._fsKey = sel._fsAbort = null;
	sel.removeAttribute('aria-hidden');
	sel.style.display = '';
}

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

/* A value written through the IDL (`sel.value = x`, what ui.Select.setValue() does on every
 * dependency pass) sets no content attribute and adds no node, so no MutationRecord wakes
 * relevant() and the widget would show the old label while Save reads the new value. So this runs
 * from the fitter once per content mutation batch: the cheap half of resync(), a value compare per
 * enhanced select. */
function resyncValues() {
	for (const sel of document.querySelectorAll('select[data-fs-select]')) {
		const dd = sel._fsDd;
		if (!dd || !sel._fsNode || sel.disabled) continue;
		if (dd.getValue() !== sel.value)
			dd.setValue(sel.value);
	}
}

function enhance(sel) {
	if (sel.dataset.fsSelect || sel.disabled) return;	/* disabled: not marked — it may be enabled later */
	if (sel.multiple || !sel.closest('.cbi-value-field, .cbi-value')) {
		sel.dataset.fsSelect = 'skip';
		return;
	}

	const choices = readChoices(sel);

	let dd;
	try {
		dd = new ui.Dropdown(sel.value, choices, {
			sort: [...new Set(Array.from(sel.options, (o) => o.value))],
			optional: Object.prototype.hasOwnProperty.call(choices, '')
		});
	} catch (e) {
		sel.dataset.fsSelect = 'skip';
		console.error('footstrap: a select could not be enhanced', e);
		return;
	}

	const node = dd.render();
	const ac = new AbortController();
	sel.dataset.fsSelect = '1';
	sel.style.display = 'none';
	const title = sel.closest('.cbi-value')?.querySelector('.cbi-value-title');
	const name = (title && title.textContent.trim()) ||
		(sel.closest('.td')?.getAttribute('data-title') || '').trim();
	if (name)
		node.setAttribute('aria-label', name);
	/* Clicking the field's caption must reach the widget: form.js wires that label to the native
	 * <select>, which is `display: none`. Focus only. */
	if (title)
		title.addEventListener('click', () => node.focus(), { signal: ac.signal });
	sel.setAttribute('aria-hidden', 'true');
	sel._fsDd = dd;
	sel._fsNode = node;
	sel._fsKey = choicesKey(sel);
	sel._fsAbort = ac;

	/* after the select: it must stay frameEl.firstChild for ui.Select to read its value on save */
	sel.after(node);

	/* The dropdown re-dispatches its own bubbling `widget-change` on every pick, open/close and
	 * setValue(), reaching form.js while `sel.value` still holds the old value (fs-appearance's
	 * selectCtl applied 3x per pick). The form is to hear only ui.Select's own `widget-change`, which
	 * the `change` we dispatch on `sel` below produces. */
	node.addEventListener('widget-change', (ev) => ev.stopPropagation(), { signal: ac.signal });

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

	sel.addEventListener('change', () => {
		if (syncing) return;
		if (dd.getValue() !== sel.value)
			dd.setValue(sel.value);
	}, { signal: ac.signal });

	/* A failing validator lands on the hidden <select> (class, data-tooltip, data-tooltip-style), and
	 * ui.js finds a tooltip through the hovered element's ancestors, so a display:none select never
	 * shows it: mirror the two attributes onto the widget. The class is not copied: ui.updateTabs
	 * counts every '.cbi-input-invalid', and a copy counts the field twice. */
	const mirrorError = () => [ 'data-tooltip', 'data-tooltip-style' ]
		.forEach((a) => widgets.syncAttr(node, a, sel.getAttribute(a)));
	mirrorError();
	sel.addEventListener('validation-failure', mirrorError, { signal: ac.signal });
	sel.addEventListener('validation-success', mirrorError, { signal: ac.signal });
}

/* Tag standalone data tables so the stacking rules key off a static `.fs-dt`, not a live
 * `:has(.tr.table-titles)` re-evaluated on every mutation of these polled tables. Not a
 * .cbi-section-table: config forms keep their own layout. Polling swaps rows inside a table we
 * already claimed, so both passes below are additive. */
const ROOTS = [ '#view', '#modal_overlay' ];
const liveRoots = () => (document.body.classList.contains('modal-overlay-active') ? ROOTS : ROOTS.slice(0, 1));
/* every call passes liveRoots(); folded in here rather than threaded as a parameter */
const inRoots = (sel) => liveRoots().map((r) => `${r} ${sel}`).join(', ');

const foreignTables = () => inRoots(':is(.table, table):not(.cbi-section-table)');

/* The fourth header markup, only a foreign table produces: `<table><tr><th>…` with no `<thead>`
 * and none of LuCI's class names. "Every cell in the first row is a `<th>`" is the test. */
function headerRow(t) {
	const row = t.rows && t.rows[0];
	if (!row || !row.cells.length) return null;
	return [ ...row.cells ].every((c) => c.tagName === 'TH') ? row : null;
}

function headOf(t) {
	return t.querySelector('.tr.table-titles, .tr.cbi-section-table-titles, thead') || headerRow(t);
}

const titleRow = (head) =>
	(head.firstElementChild && head.firstElementChild.tagName === 'TR') ? head.firstElementChild : head;

function tagDataTables() {
	document.querySelectorAll(foreignTables()).forEach((t) => {
		const head = headOf(t);
		if (!head) return;
		t.classList.add('table', 'fs-dt');
		adoptMarkup(t, head);
		labelCells(t, head);
	});
}

/* …and the rows and cells inside it, or the claim is a trap: `.table` alone gets the frame, and
 * the card is written one level down (`.table.fs-stacked .tr`, `.td[data-title]::before`). */
function adoptMarkup(t, head) {
	/* decided once at claim time: asked afresh it would answer "already adopted" the moment we
	 * adopted, so polled bare rows would never be taken */
	if (t._fsAdopt === undefined) t._fsAdopt = !t.querySelector('.tr, .thead');
	if (!t._fsAdopt) return;
	if (head.tagName === 'THEAD') head.classList.add('thead');
	else head.classList.add('tr', 'table-titles');
	for (const c of titleRow(head).children) c.classList.add('th');
	if (!t.rows) return;
	for (const row of t.rows) {
		if (head.contains(row)) continue;
		row.classList.add('tr');
		for (const cell of row.children) cell.classList.add(cell.tagName === 'TH' ? 'th' : 'td');
	}
}

/* Give every cell the column heading it will show once the table cards: the card prints
 * `attr(data-title)` above each value (theme/30-tables.css); LuCI's builders fill it and a foreign
 * table does not. */
function labelCells(t, head) {
	const rows = t.querySelectorAll('.tr, tbody tr');
	const titles = [ ...titleRow(head).children ].map((c) => (c.textContent || '').trim());
	if (!titles.some(Boolean)) return;
	for (const row of rows) {
		if (row === head) continue;
		const cells = row.children;
		if (cells.length && cells[0].hasAttribute('data-title')) continue;
		/* column cursor, not the cell index: a cell spanning N columns takes N header slots */
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
 * theme/*.css sets `display` on `.table`/`.thead`/`.tbody`/`.tfoot`/`.tr`/`.th`/`.td` in over
 * twenty places, and any `display` other than table/table-row/table-cell drops the implicit role
 * HTML-AAM derives (measured on Overview's key/value cards at 1440 and 390px). So the role is
 * written unconditionally, the whole chain every pass: a `cell` with no `row` above it reads worse
 * than no roles. */
/* A `display` rule on any of these classes/tags is checked against its role by a regex over these
 * two names: keep both, and each entry a `'.class'` or `'tag'` string literal. */
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

function roleTables() {
	[ ...TABLE_ROLE_CLASSES, ...TABLE_ROLE_TAGS ].forEach(([ sel, role ]) => {
		document.querySelectorAll(inRoots(sel)).forEach((el) => widgets.syncAttr(el, 'role', role));
	});
}

/* ---- card-stack a data table that no longer fits ----
 * Measuring, scheduling and the observers are fs-fit.js; this file supplies the decision. Measured,
 * not @container thresholds: a table of unknowable width works. A config table (.cbi-section-table)
 * keeps its @container (960) and is not measured: a widget bakes in the width of the layout it was
 * laid out in (firewall zone table: 1747px against a real 1190px). */
const stackables = () => inRoots('.table.fs-dt');

/* "Too cramped to be a table any more": a design judgement, the one threshold taken on trust.
 * Stock LuCI cards at a 600px viewport; below 767px .fs-content pads 16px a side, so 568px of
 * room. */
const CRAMPED = 568;

/* ---- the remedy ladder: cheapest first, re-measured at every rung ----
 * theme/30-tables.css gives a data table `overflow-wrap: break-word`, so a column's min-content is
 * an honest floor (`WPA2-PSK/CCMP` measured 144px against a real 93px with `anywhere`). Ladder: 1
 * it fits, write nothing; 2 drop the columns the view marked `hide-xs`/`hide-sm`; 3 shred the
 * widest breakable column; 4 card it. The second measurement is the guard: one base64 key breaking
 * makes the table fit, every column over its share breaking changes nothing. */

function markBreakColumn(t, rows, col) {
	t._fsBreakCol = col;
	for (const row of rows) {
		const cells = row.children;
		for (let i = 0; i < cells.length; i++)
			cells[i].classList.toggle('fs-td-break', i === col);
	}
}

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
 * Measuring strips the table's marks first (fs-fit rule 1), laying the page out with a full-width
 * table. The poll replaces these tables, so each tick repeated that and at iPhone width threw the
 * reader 612px out and back, twice per tick. So the answer is kept on the slot (the section frame)
 * and holds while column count (shapeOf) and room (roomFor) hold. */
const _slots = new WeakMap();

function shapeOf(t) {
	const head = headOf(t);
	return String(head ? titleRow(head).children.length : 0);
}

function applyDecision(t, d) {
	/* the mark that lets the table into the layout at all — see theme/30-tables.css */
	t.classList.add('fs-fitted');
	t.classList.toggle('fs-stacked', !!d.stack);
	t.classList.toggle('fs-drop-xs', !!d.drop);
	if (d.breakCol !== -1) markBreakColumn(t, t.querySelectorAll('.tr'), d.breakCol);
}

/* A first cell with no break opportunity (no space, no hyphen: "/dev/mtdblock6") is marked so a carded half-cell can
 * widen to it: CSS cannot tell a token from a phrase, and `anywhere` cut it mid-word at 94-106px.
 * textContent reads no layout; the class is a function of the text, so a poll's identical copy gets
 * the same answer, and an unchanged mark is not rewritten (no mutation for the observers). */
function markTokenCells(t) {
	t.querySelectorAll('.tr > .td:first-child').forEach((c) => {
		const txt = c.textContent.trim();
		const on = !!txt && !(/[\s\u002d\u00ad\u2010-\u2014]/).test(txt);
		if (c.classList.contains('fs-td-token') !== on) c.classList.toggle('fs-td-token', on);
	});
}

function fitTables() {
	let cw;
	document.querySelectorAll(stackables()).forEach((t) => {
		markTokenCells(t);
		if (fit.scrolling() && t.classList.contains('fs-fitted')) {
			if (t._fsBreakCol >= 0) markBreakColumn(t, t.querySelectorAll('.tr'), t._fsBreakCol);
			return;
		}

		const home = t.closest('.cbi-section, .cbi-section-node, #view, #modal_overlay');
		const slots = _slots.get(home) || new Map();
		const key = t.id ? '#' + t.id : 'at' + Array.from(home.querySelectorAll('.table')).indexOf(t);
		const known = slots.get(key);

		if (fit.scrolling()) {
			if (!known && cw === undefined) cw = chrome.contentWidth();
			applyDecision(t, known || { stack: cw < CRAMPED, drop: false, breakCol: -1 });
			fit.deferMeasurement();
			return;
		}

		if (fit.inScroller(t)) {
			t.classList.add('fs-fitted');
			t.classList.remove('fs-stacked', 'fs-drop-xs');
			return;
		}

		/* the column count, read from the tree: asking forces no layout */
		const shape = shapeOf(t);

		if (known) applyDecision(t, known);

		const room = Math.round(fit.roomFor(t));
		if (!(room > 0)) {
			t.classList.add('fs-fitted');
			return;
		}

		if (t.scrollWidth === 0) {
			if (!t.classList.contains('fs-fitted')) {
				t.classList.add('fs-fitted');
				fit.schedule();
			}
			return;
		}

		/* the slot's answer holds for the same shape in the same room, unless the table outgrew it (a poll
		 * put longer values in: 1000px in an 810px column). A remedied table cannot be asked the other
		 * direction (every remedy fits by construction), so one whose row count went down is re-decided. */
		const rows = t.querySelectorAll('.tr').length;
		const remedied = !!(known && (known.stack || known.drop || known.breakCol !== -1));
		const shrank = remedied && rows < known.rows;
		if (known && known.room === room && known.shape === shape && !shrank && !fit.overflows(t))
			return;

		t.classList.remove('fs-stacked', 'fs-drop-xs');
		if (t._fsBreakCol > -1) markBreakColumn(t, t.querySelectorAll('.tr'), -1);

		/* the one judgement a measurement cannot make */
		let stack = room < CRAMPED;
		if (!stack && fit.overflows(t)) {
			/* rung 2 — the view author already said which columns are expendable */
			if (t.querySelector('.hide-xs, .hide-sm')) t.classList.add('fs-drop-xs');
			if (fit.overflows(t) && !breakWidestColumn(t)) stack = true;
		}

		t.classList.add('fs-fitted');
		if (stack) {
			t.classList.add('fs-stacked');
			/* a card gives every value the whole row, so neither remedy has anything left to do */
			t.classList.remove('fs-drop-xs');
		}

		slots.set(key, {
			stack,
			drop: t.classList.contains('fs-drop-xs'),
			breakCol: (t._fsBreakCol === undefined) ? -1 : t._fsBreakCol,
			room,
			shape,
			rows,
		});
		_slots.set(home, slots);
	});
}

/* ---- and the table that cannot card: it scrolls, and it says so ----
 * A table with no header row has no captions, so a card is unlabelled values; comparison across
 * rows is its purpose (WCAG 2.2 SC 1.4.10 excepts two-dimensional scrolling). But `overflow-x:
 * auto` computes `overflow-y` to `auto` too, clipping every popup inside, so a header-less table
 * that holds controls stacks instead: Network -> Diagnostics needs 338px in 320px. */
const scrollables = () => inRoots('.table:not(.fs-dt):not(.cbi-section-table)');
const HOLDS_CONTROLS = '.cbi-dropdown, .cbi-dynlist, .cbi-tooltip-container, .cbi-progressbar, select, input, textarea, [data-tooltip]';

/* ---- making a scroll box reachable, and handing the markup back as it was found ----
 * Firefox makes scrollers focusable, Chrome since 132 only when they hold no focusable child,
 * WebKit not at all, so the markup says it: a tab stop (SC 2.1.1) and a name (SC 4.1.2). A role is
 * written only where there is none to lose (`<div class="table">` takes `group`; a real `<table>`
 * keeps its own). What is removed is what was written, remembered per element. */
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
	if (fit.scrolling()) { fit.deferMeasurement(); return; }
	document.querySelectorAll(scrollables()).forEach((t) => {
		const was = t.classList.contains('fs-xscroll');
		const wasStack = t.classList.contains('fs-rowstack');
		t.classList.remove('fs-xscroll', 'fs-rowstack');
		if (!(fit.roomFor(t) > 0)) {
			if (was) t.classList.add('fs-xscroll');
			if (wasStack) t.classList.add('fs-rowstack');
			return;
		}
		const over = fit.overflows(t);
		/* a table of controls stacks; a table of values scrolls and keeps its shape */
		if (over && t.querySelector(HOLDS_CONTROLS)) {
			t.classList.add('fs-rowstack');
			if (was) unreach(t);
			return;
		}
		if (over) {
			t.classList.add('fs-xscroll');
			if (!was) reach(t);
		}
		else if (was) unreach(t);
	});
}

/* ---- a pinned actions column is only valid for the layout it was measured in ----
 * luci-base's form.js (stabilizeActionColumnWidth) pins the widest `td.cbi-section-actions > div`
 * as inline width/min-width and its resize handler never drops the pin, so the next measurement can
 * only grow: firewall/zones pins 634px (scrolls 256px sideways) against 192px fresh. Drop the pin
 * when the room changes, not the mode: 768px and 800px are both carded. */
function unpinActionColumn() {
	/* a layout read here lands mid-flick once per poll tick — see fitTables() */
	if (fit.scrolling()) { fit.deferMeasurement(); return; }
	for (const t of document.querySelectorAll(inRoots('.table.cbi-section-table'))) {
		if (!t.querySelector('.cbi-section-actions')) continue;
		/* claim upstream's resize hook: stabilizeActionColumnWidth attaches a `resize` listener once per
		 * table element (this expando) and never removes it, which leaks under SPA navigation (1 to 31
		 * listeners over 120 navigations, ~11.8 KB each). Set first, it is never attached. */
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

function relevant(mutations) {
	for (const m of mutations) if (m.target.tagName === 'SELECT') return true;
	/* Additions only: a select going away costs nothing to notice. */
	return fit.touches(mutations, 'select.cbi-input-select');
}

/* ---- type-ahead: jump to an option by typing its first letters ----
 * A native <select> gives this free (picking a country out of 248 entries); enhance() hides it and
 * ui.Dropdown.handleKeydown does only Esc/Enter/Space/arrows. One document-level listener for every
 * .cbi-dropdown: only while open, printable keys without modifiers, buffer reset after a pause, a
 * repeated letter cycles, label first then value. Only highlights (setFocus); Enter/Esc stay
 * ui.Dropdown's. */
const TYPEAHEAD_RESET_MS = 1000;
let _taBuf = '', _taTimer = null, _taLast = null;

function typeaheadItems(sb) {
	const ul = sb.querySelector('ul.dropdown');
	if (!ul) return [];
	return [...ul.children].filter((li) =>
		li.tagName === 'LI' &&
		!li.querySelector('input:not([type="hidden"]):not([type="checkbox"])') &&
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
		const from = repeat ? start + 1 : 0;

		const matches = (n) => (li) => typeaheadLabel(li).startsWith(n) ||
			String(li.getAttribute('data-value') || '').toLowerCase().startsWith(n);
		const match = matches(needle);

		/* wrap around: the second pass covers what the first skipped */
		let hit = items.slice(from).find(match) ?? items.find(match);
		if (!hit && !repeat) {
			hit = items.find(matches(ch));
			if (hit) _taBuf = '';
		}
		if (!hit) return;

		_taBuf = repeat ? ch : (_taBuf + ch);
		if (_taTimer) window.clearTimeout(_taTimer);
		_taTimer = window.setTimeout(() => { _taBuf = ''; _taLast = null; }, TYPEAHEAD_RESET_MS);

		const inst = dom.findClassInstance(sb);
		if (inst) inst.setFocus(sb, hit, true);

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

		fit.armGate();

		fit.add(tagDataTables);
		fit.add(roleTables);
		fit.add(fitTables);
		fit.add(fitScrollables);
		fit.add(unpinActionColumn);
		fit.add(resyncValues);

		const scanSoon = fit.frame(scan);
		new MutationObserver((mutations) => {
			if (relevant(mutations)) scanSoon();
		}).observe(document.body, {
			childList: true, subtree: true,
			/* a `disabled` flip mutates no childList, so watch it for resync()/enhance() */
			attributes: true, attributeFilter: [ 'disabled' ]
		});
	}
});
