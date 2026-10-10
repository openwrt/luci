'use strict';
'require view';
'require rpc';
'require ui';
'require librespeed.common as lscommon';

/* The alias comes from the require above; the repo eslint config only
 * knows the stock module names. */
/* global lscommon */

/* The chart wants every point in the range, but the table must not put
 * thousands of rows into the DOM: a 15-minute schedule kept for 30 days is
 * nearly 3000 measurements. Paging keeps the page responsive without a
 * second fetch, since the entries are in memory anyway. */
const pageSize = 50;

const callConfig = rpc.declare({
	object: 'librespeed',
	method: 'config',
	expect: { '': {} }
});

const callHistory = rpc.declare({
	object: 'librespeed',
	method: 'history',
	params: [ 'from', 'to', 'limit' ],
	expect: { '': {} }
});

return view.extend({
	entries: [],
	prevEntries: [],
	resolution: 'raw',
	group: 'speed',
	active: null,
	range: 86400,
	server: '',
	iface: '',
	page: 0,

	/* Which entries come back -- and at which resolution -- is the server's
	 * decision, so every range switch is a fetch rather than a client-side
	 * filter over one download. The previous window of the same length is
	 * fetched alongside, so the summary can say how this period compares. */
	fetch() {
		const now = Math.floor(Date.now() / 1000);
		/* Zero, not undefined: the rpcd argument is typed as an integer and a
		 * null would fail validation rather than mean "everything". */
		const from = this.range ? now - this.range : 0;

		return Promise.all([
			callHistory(from).catch(() => ({})),
			this.range
				? callHistory(now - 2 * this.range, now - this.range).catch(() => ({}))
				: Promise.resolve({})
		]).then(L.bind(function(data) {
			this.entries = Array.isArray(data[0].entries) ? data[0].entries : [];
			this.resolution = data[0].resolution || 'raw';
			this.prevEntries = Array.isArray(data[1].entries) ? data[1].entries : [];
			this.prevResolution = data[1].resolution || 'raw';
		}, this));
	},

	load() {
		/* Both series of a group start visible; the legend narrows it. */
		this.active = {
			speed: lscommon.GROUPS.speed.slice(),
			latency: lscommon.GROUPS.latency.slice()
		};
		/* The config rides along for one purpose: with history keeping off,
		 * the empty state must not send the user to run a test that will
		 * never produce an entry. */
		return Promise.all([
			this.fetch(),
			callConfig().then(c => { this.config = c; }, () => {})
		]);
	},

	/* The server/interface filters narrow the fetched range on the client;
	 * daily aggregates carry neither field, so there the filters offer only
	 * "All" and match everything. */
	applyFilters(entries) {
		return (entries || []).filter(e =>
			(!this.server || (e.server && e.server.name) == this.server) &&
			(!this.iface || e.interface == this.iface));
	},

	visible() {
		return this.applyFilters(this.entries);
	},

	filterSelect(title, values, current, onpick) {
		const sel = E('select', { 'class': 'cbi-input-select' },
			[ E('option', { 'value': '' }, [ _('All') ]) ].concat(
				values.map(v => E('option', { 'value': v }, [ v ]))));

		sel.value = values.indexOf(current) >= 0 ? current : '';
		sel.addEventListener('change', ui.createHandlerFn(this, function() {
			return onpick.call(this, sel.value);
		}));

		return E('label', {}, [
			E('span', { 'class': 'librespeed-muted' }, [ title + ' ' ]), sel ]);
	},

	/* The header above the chart doubles as the legend: per series a checkbox
	 * with its color, its average, and the change against the previous period
	 * -- one place to read the numbers and switch the lines, right where the
	 * eye already is. Below it, one sentence on how the period behaved. */
	renderSummary() {
		const entries = this.visible(),
		      prev = this.applyFilters(this.prevEntries),
		      act = this.active[this.group],
		      states = [];

		this.summaryNode.innerHTML = '';

		const row = E('div', { 'class': 'librespeed-cards' });

		lscommon.GROUPS[this.group].forEach(L.bind(function(k, ki) {
			const m = lscommon.METRICS.find(x => x[0] == k),
			      st = lscommon.seriesStats(entries, k, this.resolution),
			      ps = lscommon.seriesStats(prev, k, this.prevResolution),
			      on = act.indexOf(k) >= 0;

			let diff = ' ';

			/* Only comparable windows get compared: an average of raw samples
			 * against an average of daily aggregates is not the same number,
			 * and the two fetches may straddle the raw/archive boundary. */
			if (on && st && ps && ps.avg > 0 && this.prevResolution == this.resolution) {
				const pct = (st.avg - ps.avg) / ps.avg * 100;
				diff = '%s%d %% %s'.format(pct >= 0 ? '+' : '−',
					Math.abs(Math.round(pct)), _('vs previous period'));
			}

			/* The card is a label around a real checkbox, so it works from the
			 * keyboard exactly like the control it is; the dimming and the
			 * accent stripe say what is drawn. */
			const cb = E('input', { 'type': 'checkbox' });

			cb.checked = on;
			cb.addEventListener('change', L.bind(function() {
				if (cb.checked && act.indexOf(k) < 0)
					act.push(k);
				else if (!cb.checked) {
					if (act.length < 2) {
						cb.checked = true;
						return;
					}
					act.splice(act.indexOf(k), 1);
				}
				this.redraw();
			}, this));

			row.appendChild(E('label', {
				'class': 'librespeed-metric-card librespeed-accent-%d'.format(ki) +
					(on ? ' librespeed-metric-card-on' : ''),
				'title': on ? _('Hide this series') : _('Show this series')
			}, [
				/* Not muted: the card's own off-state opacity already dims
				 * it, and two factors multiply into illegibility. */
				E('div', { 'class': 'librespeed-caps' },
					[ cb, ' ', m[1] ]),
				E('div', { 'class': 'librespeed-card-value' }, [
					st ? '%.1f'.format(st.avg) + ' ' + m[2] : '–',
					E('span', { 'class': 'librespeed-muted', 'style': 'font-size:.6em; font-weight:400' },
						[ ' ' + _('avg') ])
				]),
				E('div', { 'class': 'librespeed-muted', 'style': 'font-size:.85em' }, [ diff ])
			]));

			if (on && st) {
				const varPct = (st.max - st.min) / st.avg * 100,
				      offPct = (st.current - st.avg) / st.avg * 100;
				const bad = (k == 'ping_ms' || k == 'jitter_ms') ? offPct > 15 : offPct < -15;

				states.push([ m[1],
					bad ? _('declining') : (varPct > 30 ? _('highly variable') : _('stable')) ]);
			}
		}, this));

		this.summaryNode.appendChild(row);

		if (states.length) {
			const allStable = states.every(s => s[1] == _('stable'));
			this.summaryNode.appendChild(E('p', { 'class': 'librespeed-muted', 'style': 'margin:0 0 .25em' }, [
				allStable
					? _('Stable over the selected period.')
					: states.map(s => '%s: %s'.format(s[0], s[1])).join(' · ')
			]));
		}
	},

	redraw() {
		const entries = this.visible();

		/* Without data the empty state IS the page: everything that only
		 * makes sense with measurements -- cards, chart, table, export --
		 * stays out of the way entirely, and the one useful action is a
		 * button to go run a test. Filters that merely exclude everything
		 * get their own wording and no button: data exists, go widen them. */
		const noneAtAll = !this.entries.length;

		if (!entries.length) {
			/* Strict, matching test.js: the backend emits a real boolean
			 * (derived from UCI, never its raw '0'/'1'), and an absent or
			 * failed config must read as "history on", not off. */
			const histOff = noneAtAll && this.config &&
				this.config.history && this.config.history.enabled === false;

			/* With history keeping off, a test would never write an entry:
			 * the way out is Settings, not the Start button. */
			this.emptyText.textContent = histOff
				? _('History keeping is switched off, so measurements are not recorded.')
				: (noneAtAll
					? _('Run a speed test to start building your connection history.')
					: _('No measurements match the current filters.'));
			this.emptyStart.style.display = noneAtAll ? '' : 'none';
			this.emptyStart.href = histOff
				? L.url('admin', 'network', 'librespeed', 'settings')
				: L.url('admin', 'network', 'librespeed', 'test');
			this.emptyStart.textContent = histOff ? _('Open settings') : _('Start test');
			this.emptyNode.style.display = '';
			this.dataNode.style.display = 'none';
			return;
		}

		this.emptyNode.style.display = 'none';
		this.dataNode.style.display = '';

		this.renderSummary();

		/* The legend lives in the summary header above; the chart itself has
		 * nothing below it that could be mistaken for table furniture. */
		const drew = lscommon.renderChart(this.chartNode, entries, {
			series: this.active[this.group],
			resolution: this.resolution,
			hover: true
		});

		/* Entries exist -- the empty state above handles the case where they
		 * do not -- so reaching here means this metric has no numbers. */
		if (!drew)
			this.chartNode.appendChild(E('p', { 'class': 'librespeed-muted' },
				[ _('No data for the selected metric.') ]));
		else if (this.resolution == '1d')
			this.chartNode.appendChild(E('p', { 'class': 'librespeed-muted' },
				[ _('Daily minimum, average and maximum.') ]));

		/* The sort key carries the same decimal count as the display half:
		 * ui.Table stringifies the whole cell and compares digit runs one by
		 * one, so ragged fractions would put 94.4 above 94.35. */
		const num = (v, d) => (typeof v == 'number') ? v.toFixed(d) : '';
		const fmtNum = (v, d) => (typeof v == 'number') ? v.toFixed(d) : '–';
		const when = e => lscommon.chartStampFull(e, this.resolution);

		/* One column carries both what the packets were (IPv4/IPv6) and how
		 * they travelled (HTTPS/HTTP); either half may be unknown. */
		const protoCell = e => {
			const fam = e.family == 'ipv6' ? 'IPv6' : (e.family == 'ipv4' ? 'IPv4' : null),
			      pr = e.proto ? e.proto.toUpperCase() : null;
			return [ fam, pr ].filter(x => x).join(' · ') || '–';
		};

		/* Build the cells first, then sort them: the sort key comes out of a
		 * cell, and ui.Table only ever orders the rows it was handed, so
		 * paging first would turn the headers into a per-page sort while the
		 * count below still speaks for every measurement. */
		/* Every display half is a node: ui.Table writes bare strings into
		 * innerHTML, and the server name comes from a downloaded list --
		 * text must stay text. The sort key stays the first element. */
		const cell = t => E('span', {}, [ t ]);
		let rows = entries.slice().reverse().map(e => [
			[ e.epoch ?? 0, cell(when(e)) ],
			cell((e.server && e.server.name) || '–'),
			cell(e.interface || '–'),
			cell(protoCell(e)),
			[ num(e.download_mbps, 2), cell(fmtNum(e.download_mbps, 2)) ],
			[ num(e.upload_mbps, 2), cell(fmtNum(e.upload_mbps, 2)) ],
			[ num(e.ping_ms, 1), cell(fmtNum(e.ping_ms, 1)) ],
			[ num(e.jitter_ms, 1), cell(fmtNum(e.jitter_ms, 1)) ]
		]);

		const sorting = this.table.getActiveSortState();

		if (sorting)
			rows = rows
				.map(L.bind(function(r) {
					return [ this.table.deriveSortKey(r[sorting[0]], sorting[0]), r ];
				}, this))
				.sort((a, b) => sorting[1]
					? -L.naturalCompare(a[0], b[0])
					: L.naturalCompare(a[0], b[0]))
				.map(x => x[1]);

		const pages = Math.max(1, Math.ceil(rows.length / pageSize));

		if (this.page >= pages)
			this.page = pages - 1;

		this.renderPager(rows.length, pages);
		this.table.update(rows.slice(this.page * pageSize, (this.page + 1) * pageSize));
	},

	/* Shown only when there is more than one page; the count is always
	 * worth having, so it stays either way. */
	renderPager(total, pages) {
		const step = L.bind(function(delta) {
			this.page = Math.min(pages - 1, Math.max(0, this.page + delta));
			this.redraw();
		}, this);

		const nav = [ E('span', { 'class': 'librespeed-muted' },
			[ N_(total, '%d measurement', '%d measurements').format(total) ]) ];

		if (pages > 1) {
			nav.push(E('button', {
				'class': 'cbi-button',
				'disabled': this.page > 0 ? null : '',
				'click': ui.createHandlerFn(this, function() { step(-1); })
			}, [ '\u2039 ' + _('Previous') ]));
			nav.push(E('span', { 'class': 'librespeed-muted' },
				[ _('Page %d of %d').format(this.page + 1, pages) ]));
			nav.push(E('button', {
				'class': 'cbi-button',
				'disabled': this.page < pages - 1 ? null : '',
				'click': ui.createHandlerFn(this, function() { step(1); })
			}, [ _('Next') + ' \u203a' ]));
		}

		this.pagerNode.replaceChildren(...nav);
	},

	handleExportCSV() {
		lscommon.exportCSV(this.visible(), this.resolution);
	},

	handleExportJSON() {
		lscommon.exportJSON(this.visible(), this.resolution);
	},

	render() {
		this.summaryNode = E('div', {});
		this.chartNode = E('div', {});
		this.controls = E('div', {});
		this.pagerNode = E('div', { 'class': 'librespeed-toolbar', 'style': 'margin:.5em 0' });

		/* ui.Table gives sortable headers for free -- every cell below is a
		 * [sort key, display] pair, so Time orders by epoch even though it
		 * shows a locale string, and numbers order numerically. The table is
		 * where sorting belongs; the chart above never reorders time. */
		this.table = new ui.Table([
			_('Time'), _('Server'), _('Interface'), _('Protocol'),
			_('Download [Mbps]'), _('Upload [Mbps]'), _('Ping [ms]'), _('Jitter [ms]')
		], { id: 'librespeed-history' });
		this.tableNode = this.table.render();
		/* The table's own handler re-sorts the page it holds; this runs
		 * after it and re-sorts the range, from the first page. */
		this.tableNode.addEventListener('click', L.bind(function(ev) {
			if (ev.target.closest('th[data-sortable-row], .th[data-sortable-row]')) {
				this.page = 0;
				this.redraw();
			}
		}, this));

		const renderControls = L.bind(function() {
			const groups = lscommon.switcher(this,
				[ [ 'speed', _('Speed') ], [ 'latency', _('Latency') ] ], this.group,
				function(v) { this.group = v; renderControls(); this.redraw(); }, _('Series'));
			const ranges = lscommon.switcher(this,
				lscommon.RANGES.map(r => [ String(r[1]), r[0] ]), String(this.range),
				function(v) {
					this.range = +v;
					this.page = 0;
					renderControls();
					return this.fetch().then(L.bind(function() {
						renderControls();
						this.redraw();
					}, this));
				}, _('Range'));

			ranges.classList.add('librespeed-push');

			/* Filter choices are whatever the fetched range actually contains. */
			const servers = [], ifaces = [];

			this.entries.forEach(e => {
				const s = e.server && e.server.name;
				if (s && servers.indexOf(s) < 0)
					servers.push(s);
				if (e.interface && ifaces.indexOf(e.interface) < 0)
					ifaces.push(e.interface);
			});

			/* The freshly fetched window may no longer contain the chosen
			 * server or interface -- daily aggregates carry neither field at
			 * all. The widget would then quietly repaint as "All" while the
			 * model kept filtering everything out, with no control on screen
			 * able to clear it; reconcile the model here, where the choice
			 * lists are built. */
			if (this.server && servers.indexOf(this.server) < 0)
				this.server = '';
			if (this.iface && ifaces.indexOf(this.iface) < 0)
				this.iface = '';

			const filters = E('div', { 'class': 'librespeed-toolbar' }, [
				this.filterSelect(_('Server'), servers.sort(), this.server,
					function(v) { this.server = v; this.page = 0; this.redraw(); }),
				this.filterSelect(_('Interface'), ifaces.sort(), this.iface,
					function(v) { this.iface = v; this.page = 0; this.redraw(); })
			]);

			this.controls.innerHTML = '';
			this.controls.appendChild(E('div', { 'class': 'librespeed-toolbar' },
				[ groups, ranges ]));
			this.controls.appendChild(filters);
		}, this);

		this.emptyText = E('p', { 'class': 'librespeed-muted', 'style': 'margin:.5em 0 1em' });
		this.emptyStart = E('a', {
			'class': 'cbi-button cbi-button-action',
			'href': L.url('admin', 'network', 'librespeed', 'test')
		}, [ _('Start test') ]);
		this.emptyNode = E('div', {
			'class': 'cbi-section librespeed-center',
			'style': 'display:none; margin-top:1em'
		}, [
			E('div', { 'style': 'font-size:1.4em; font-weight:600' },
				[ _('No measurements yet') ]),
			this.emptyText,
			this.emptyStart
		]);

		this.dataNode = E('div', {}, [
			this.chartNode,
			this.summaryNode,
			E('h3', { 'style': 'margin-top:.75em' }, [ _('Measurements') ]),
			this.tableNode,
			this.pagerNode,
			E('div', { 'class': 'cbi-page-actions' }, [
				E('button', { 'class': 'cbi-button', 'click': ui.createHandlerFn(this, 'handleExportCSV') },
					[ _('Export CSV') ]),
				' ',
				E('button', { 'class': 'cbi-button', 'click': ui.createHandlerFn(this, 'handleExportJSON') },
					[ _('Export JSON') ])
			])
		]);

		renderControls();
		this.redraw();

		return E([], [
			lscommon.cssLink(),
			E('h2', [ _('LibreSpeed – History') ]),
			this.controls,
			this.emptyNode,
			this.dataNode
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
