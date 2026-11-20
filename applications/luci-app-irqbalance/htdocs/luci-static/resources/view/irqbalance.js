'use strict';
'require view';
'require fs';
'require form';
'require poll';
'require rpc';
'require ui';

const callServiceList = rpc.declare({
	object: 'service',
	method: 'list',
	params: [ 'name' ],
	expect: { '': {} },
});

function getServiceStatus() {
	return L.resolveDefault(callServiceList('irqbalance'), {}).then(function (res) {
		try { return res['irqbalance']['instances']['irqbalance']['running']; }
		catch (e) { return false; }
	});
}

/* Parse /proc/interrupts into rows.
 *
 * Each line is a label, one counter per CPU, then a free-form tail naming the controller, the
 * hardware line and the device. Numbered labels are hardware IRQs; IPI*, Err and ERR are per-CPU
 * software counters and are kept in a second list, so "CPU stop interrupts" does not sit between
 * two NICs. Err carries a single counter rather than one per CPU, so short rows are padded and the
 * missing cells stay empty instead of shifting the row under the wrong heading. */
function parseInterrupts(data) {
	const lines = String(data || '').split('\n').filter(l => l.trim() !== '');
	if (!lines.length) return { cpus: [], hw: [], other: [] };

	const cpus = lines[0].match(/CPU\d+/g) || [];
	const hw = [], other = [];

	for (let i = 1; i < lines.length; i++) {
		const m = lines[i].match(/^\s*([^:]+):\s*(.*)$/);
		if (!m) continue;

		const label = m[1].trim();
		const rest = m[2].trim().split(/\s+/);
		const counts = rest.slice(0, cpus.length).map(n => parseInt(n, 10)).filter(n => !isNaN(n));
		const tail = rest.slice(counts.length).join(' ');
		while (counts.length < cpus.length) counts.push(null);

		const row = { label, counts, tail, total: counts.reduce((a, b) => a + b, 0) };
		if (/^\d+$/.test(label)) hw.push(row); else other.push(row);
	}

	return { cpus, hw, other };
}

/* Render one row of the interrupts table.
 *
 * Plain LuCI table markup: `.tr` of `.td`, every cell carrying `data-title` so a theme can turn the
 * row into a card on a narrow screen. `data-irq` keys the row for the poll, `data-idle` marks a row
 * whose counters are all zero. */
function renderRow(cpus, row, index, headings) {
	const cells = [ E('div', { 'class': 'td', 'data-title': headings.first }, E('strong', {}, row.label)) ];

	row.counts.forEach(function (n, i) {
		cells.push(E('div', { 'class': 'td right', 'data-title': cpus[i] || '' },
			n === null ? '' : '%d'.format(n)));
	});

	cells.push(E('div', { 'class': 'td right', 'data-title': _('Total') },
		row.total ? '%d'.format(row.total) : '-'));
	cells.push(E('div', { 'class': 'td', 'data-title': headings.last }, row.tail || '-'));

	const tr = E('div', {
		'class': 'tr cbi-rowstyle-%d'.format(index % 2 ? 2 : 1),
		'data-irq': row.label,
	}, cells);
	if (!row.total) tr.setAttribute('data-idle', '1');

	return tr;
}

function renderTable(cpus, rows, headings, id) {
	const head = [ E('div', { 'class': 'th' }, headings.first) ]
		.concat(cpus.map(c => E('div', { 'class': 'th right' }, c)))
		.concat([
			E('div', { 'class': 'th right' }, _('Total')),
			E('div', { 'class': 'th' }, headings.last),
		]);

	const body = rows.length
		? rows.map((row, i) => renderRow(cpus, row, i, headings))
		: [ E('div', { 'class': 'tr placeholder' }, E('div', { 'class': 'td' }, E('em', {}, _('No data')))) ];

	return E('div', { 'class': 'table', 'id': id }, [ E('div', { 'class': 'tr table-titles' }, head) ].concat(body));
}

/* Update the counters a row already shows.
 *
 * Rows are rewritten in place rather than rebuilt: replacing them would move the page under the
 * reader on every tick. `rows` may hold rows that are currently filtered out of the table, which is
 * why the caller passes the full set rather than reading the document. */
function updateRows(cpus, data, rows) {
	const byLabel = {};
	for (const tr of rows) byLabel[tr.getAttribute('data-irq')] = tr;

	for (const row of data) {
		const tr = byLabel[row.label];
		if (!tr) continue;

		const cells = tr.querySelectorAll('.td');
		row.counts.forEach(function (n, i) {
			if (cells[i + 1]) cells[i + 1].textContent = (n === null ? '' : '%d'.format(n));
		});
		if (cells[cpus.length + 1])
			cells[cpus.length + 1].textContent = row.total ? '%d'.format(row.total) : '-';

		if (row.total) tr.removeAttribute('data-idle'); else tr.setAttribute('data-idle', '1');
	}
}

/* Show or hide the interrupts that have never fired.
 *
 * Idle rows are taken out of the table rather than marked `hidden`: a theme lays `.tr` out with a
 * `display` of its own, and a class beats the `hidden` attribute's UA rule, so a hidden row would
 * still paint. Removing them also keeps the zebra striping counting only the rows on screen. The
 * table is rewritten only when the visible set actually changes, so a poll tick that changes
 * nothing does not touch the DOM. */
function applyFilter(table, rows, show) {
	const visible = rows.filter(tr => show || !tr.hasAttribute('data-idle'));
	const current = Array.from(table.querySelectorAll('.tr[data-irq]'));

	if (current.length === visible.length && current.every((tr, i) => tr === visible[i])) return;

	visible.forEach((tr, i) => tr.className = 'tr cbi-rowstyle-%d'.format(i % 2 ? 2 : 1));
	table.replaceChildren(table.firstElementChild, ...visible);
}

function busiest(rows) {
	const top = rows.slice().sort((a, b) => b.total - a.total)[0];
	return (top && top.total) ? '%s - %s (%d)'.format(top.label, top.tail || _('unknown'), top.total) : '-';
}

return view.extend({
	load() {
		return Promise.all([
			L.resolveDefault(fs.read_direct('/proc/interrupts'), ''),
			getServiceStatus(),
		]);
	},

	render(data) {
		const irqs = parseInterrupts(data[0]);
		const running = data[1];
		const hwHeadings = { first: _('IRQ'), last: _('Device') };
		const swHeadings = { first: _('Counter'), last: _('Description') };
		let hwRows = [], hwTable = null, idleBox = null;
		let m, s, o;

		m = new form.Map('irqbalance', _('irqbalance'),
			_('The purpose of irqbalance is to distribute hardware interrupts across processors/cores on a multiprocessor/multicore system in order to increase performance.'));

		/* Status, as form rows rather than a bare paragraph: the page then folds on a narrow screen
		 * the way every other service page does. */
		s = m.section(form.NamedSection, 'irqbalance', 'irqbalance', _('Status'));
		s.anonymous = true;

		o = s.option(form.DummyValue, '_status', _('Service'));
		o.cfgvalue = function () {
			return E('span', { 'id': 'irqbalance-status' },
				E('strong', { 'style': running ? 'color:var(--success-color-high,#3a3)' : 'color:var(--error-color-high,#c33)' },
					running ? _('Running') : _('Not running')));
		};

		o = s.option(form.DummyValue, '_cpus', _('CPUs'));
		o.cfgvalue = () => '%d'.format(irqs.cpus.length);

		o = s.option(form.DummyValue, '_irqs', _('Hardware interrupts'));
		o.cfgvalue = () => '%d'.format(irqs.hw.length);

		o = s.option(form.DummyValue, '_busiest', _('Busiest interrupt'));
		o.cfgvalue = function () {
			return E('span', { 'id': 'irqbalance-busiest' }, busiest(irqs.hw));
		};

		/* The snapshot, as a table instead of a textarea: the same numbers in the columns they were
		 * already in, and a row a theme can card on a phone. */
		s = m.section(form.NamedSection, 'irqbalance', 'irqbalance');
		s.anonymous = true;
		s.render = function () {
			hwTable = renderTable(irqs.cpus, irqs.hw, hwHeadings, 'irqbalance-hw');
			hwRows = Array.from(hwTable.querySelectorAll('.tr[data-irq]'));
			idleBox = new ui.Checkbox(false, { id: 'irqbalance-idle' });

			const box = idleBox.render();
			box.addEventListener('change', () => applyFilter(hwTable, hwRows, idleBox.isChecked()));
			applyFilter(hwTable, hwRows, false);

			/* ui.Checkbox mints the input id at render time, so the label can only be pointed at it
			 * afterwards; without this the label is not a click target. */
			const inputId = box.querySelector('input').id;

			return E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, _('Hardware interrupts')),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title', 'for': inputId }, _('Show idle interrupts')),
					E('div', { 'class': 'cbi-value-field' }, [
						box,
						E('div', { 'class': 'cbi-value-description' },
							_('%d of %d interrupts have fired since boot.')
								.format(irqs.hw.filter(r => r.total).length, irqs.hw.length)),
					]),
				]),
				hwTable,
			]);
		};

		s = m.section(form.NamedSection, 'irqbalance', 'irqbalance');
		s.anonymous = true;
		s.render = function () {
			return E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, _('Software and inter-processor interrupts')),
				renderTable(irqs.cpus, irqs.other, swHeadings, 'irqbalance-sw'),
			]);
		};

		poll.add(function () {
			return Promise.all([
				getServiceStatus(),
				L.resolveDefault(fs.read_direct('/proc/interrupts'), ''),
			]).then(function (res) {
				const status = document.getElementById('irqbalance-status');
				if (status) {
					const strong = status.firstElementChild;
					strong.textContent = res[0] ? _('Running') : _('Not running');
					strong.style.color = res[0] ? 'var(--success-color-high,#3a3)' : 'var(--error-color-high,#c33)';
				}

				const now = parseInterrupts(res[1]);
				if (!now.cpus.length) return;

				if (hwTable) {
					updateRows(now.cpus, now.hw, hwRows);
					applyFilter(hwTable, hwRows, idleBox ? idleBox.isChecked() : false);
				}

				const sw = document.getElementById('irqbalance-sw');
				if (sw) updateRows(now.cpus, now.other, Array.from(sw.querySelectorAll('.tr[data-irq]')));

				const top = document.getElementById('irqbalance-busiest');
				if (top) top.textContent = busiest(now.hw);
			});
		});

		s = m.section(form.TypedSection, 'irqbalance', _('General settings'));
		s.anonymous = true;

		o = s.option(form.Flag, 'enabled', _('Enable'));
		o.default = '0';
		o.rmempty = false;

		o = s.option(form.Value, 'deepestcache', _('Deepest cache'),
			_('Cache level at which irqbalance partitions cache domains.'));
		o.placeholder = '2';
		o.datatype = 'uinteger';
		o.optional = true;

		o = s.option(form.Value, 'interval', _('Interval'), _('Value in seconds.'));
		o.placeholder = '10';
		o.datatype = 'uinteger';
		o.optional = true;

		/* Both exclusion lists keep the validation they had. What changes is the offer: the valid
		 * values used to be a comma-run in the description, which the reader had to match by hand
		 * against /proc/interrupts. Each IRQ is now a choice that names its own device. */
		const cpuIds = irqs.cpus.map(c => c.slice(3));

		o = s.option(form.Value, 'banned_cpulist', _('Exclude CPUs'),
			_('List of CPUs to ignore, can be an integer or integers separated by commas.'));
		o.placeholder = '0';
		o.optional = true;
		o.validate = function (section_id, value) {
			for (const cpu of String(value).split(','))
				if (cpu !== '' && !cpuIds.includes(cpu)) return _('Invalid');
			return true;
		};

		o = s.option(form.DynamicList, 'banirq', _('Exclude IRQs'), _('List of IRQs to ignore.'));
		o.placeholder = '36';
		o.datatype = 'uinteger';
		o.optional = true;
		irqs.hw.forEach(row => o.value(row.label, '%s - %s'.format(row.label, row.tail || _('unknown'))));
		o.validate = function (section_id, value) {
			const known = irqs.hw.map(row => row.label);
			return (value !== '' && !known.includes(String(value))) ? _('Invalid') : true;
		};

		o = s.option(form.Flag, 'debug', _('Show debug output'), _('Show debug output in system log.'));

		return m.render();
	},
});
