// SPDX-License-Identifier: Apache-2.0
'use strict';
'require view';
'require rpc';
'require ui';

(function() {
	if (!document.querySelector('link[href*="trafficctl/status.css"]')) {
		var lnk = document.createElement('link');
		lnk.rel = 'stylesheet';
		lnk.type = 'text/css';
		lnk.href = '/luci-static/resources/view/trafficctl/status.css';
		document.head.appendChild(lnk);
	}
})();

var callHistoryStatus = rpc.declare({
	object: 'luci.trafficctl',
	method: 'history_status',
	expect: { result: {} }
});

var callHistoryPeriods = rpc.declare({
	object: 'luci.trafficctl',
	method: 'history_periods',
	expect: { result: [] }
});

var callHistoryRead = rpc.declare({
	object: 'luci.trafficctl',
	method: 'history_read',
	params: ['period', 'to'],
	expect: { result: [] }
});

var callHistoryReadIfaces = rpc.declare({
	object: 'luci.trafficctl',
	method: 'history_read_ifaces',
	params: ['period', 'to'],
	expect: { result: [] }
});

var callHistoryFlush = rpc.declare({
	object: 'luci.trafficctl',
	method: 'history_flush',
	expect: { result: {} }
});

var callHistoryConfigSet = rpc.declare({
	object: 'luci.trafficctl',
	method: 'history_config_set',
	params: ['enabled', 'dir', 'period', 'interval', 'sample_interval', 'keep']
});

function fmtBytes(b) {
	b = b || 0;
	if (b >= 1000000000000) return (b / 1000000000000).toFixed(2) + ' TB';
	if (b >= 1000000000) return (b / 1000000000).toFixed(b >= 10000000000 ? 1 : 2) + ' GB';
	if (b >= 1000000) return (b / 1000000).toFixed(b >= 10000000 ? 0 : 1) + ' MB';
	if (b >= 1000) return (b / 1000).toFixed(0) + ' KB';
	return b + ' B';
}

function fmtAgo(ts) {
	if (!ts) return '—';
	var d = Math.floor(Date.now() / 1000) - ts;
	if (d < 0) d = 0;
	if (d < 90) return _('just now');
	if (d < 5400) return Math.round(d / 60) + ' ' + _('min ago');
	if (d < 172800) return Math.round(d / 3600) + ' ' + _('h ago');
	return Math.round(d / 86400) + ' ' + _('days ago');
}

// The three verdicts trafficctl-history.sh can report, and what each one means
// for a number on this page. Keyed on exactly the strings hist_accuracy emits;
// an unknown value must fall through to a warning rather than to silence,
// because the dangerous direction is presenting an unverified number as a
// measurement.
var ACCURACY = {
	'counter': {
		cls: 'tc-c-ok',
		icon: '●',
		text: _('Exact. Byte counts come from cumulative nftables counters, so they do not depend on how often the sampler runs. The TCP/UDP split is unavailable from this source.')
	},
	'sampled': {
		cls: 'tc-c-muted',
		icon: '○',
		text: _('Sampled. Byte counts come from conntrack, which only reports flows that are alive when it is read — a connection that both starts and finishes between two samples is not counted. Shorten the sampling interval to narrow that gap.')
	},
	'degraded': {
		cls: 'tc-c-warn',
		icon: '⚠',
		text: _('Lower bound, not a measurement. Flow offloading is active without counter support, so the kernel counters this history is built from stop moving while traffic keeps flowing. The real figures are higher by an unknown amount — use these only as a floor.')
	}
};

// Deliberately separate from ACCURACY. The interface series is not a view of
// the device series and its accuracy does not follow it: these bytes come from
// the kernel's own interface counters via /proc/net/dev, so flow offloading
// does not hide them. Under offload this table is the MORE trustworthy of the
// two, which is the inverse of the device table's verdict — inheriting it
// would be wrong in the direction that matters.
var IF_ACCURACY = {
	'exact': {
		cls: 'tc-c-ok',
		icon: '●',
		text: _('Exact. These are the router\'s own interface counters, so flow offloading does not undercount them — with offloading on, this table is more trustworthy than the device table above. A link that goes down restarts its counter: the traffic it carried between the last sample and the restart is lost.')
	}
};

function ifAccuracyOf(verdict) {
	return IF_ACCURACY[verdict] || {
		cls: 'tc-c-warn',
		icon: '⚠',
		text: _('The accuracy of these interface figures could not be determined.')
	};
}

// '-' and '?' are the store's placeholders for an absent label and an unknown
// role (the file is tab-separated, so an empty field could not be empty).
function ifText(v) {
	if (!v || v === '-' || v === '?') return '';
	return v;
}

function accuracyOf(verdict) {
	return ACCURACY[verdict] || {
		cls: 'tc-c-warn',
		icon: '⚠',
		text: _('The accuracy of these figures could not be determined.')
	};
}

return view.extend({
	st: {},
	periods: [],
	rows: [],
	sel: '',
	selTo: '',
	sortKey: 'total',
	tbody: null,
	ifRows: [],
	ifBody: null,
	ifNoteEl: null,
	ifWrapEl: null,
	statusEl: null,
	bannerEl: null,

	handleSaveApply: null,
	handleSave: null,
	handleReset: null,

	load: function() {
		return Promise.all([
			callHistoryStatus().catch(function() { return {}; }),
			callHistoryPeriods().catch(function() { return []; })
		]);
	},

	totalOf: function(r) {
		return (r.bytes_in || 0) + (r.bytes_out || 0);
	},

	sorted: function() {
		var self = this;
		var rows = this.rows.slice();
		rows.sort(function(a, b) {
			if (self.sortKey === 'name') {
				var an = (a.name || a.ip || '').toLowerCase();
				var bn = (b.name || b.ip || '').toLowerCase();
				return an < bn ? -1 : (an > bn ? 1 : 0);
			}
			if (self.sortKey === 'last') return (b.last_seen || 0) - (a.last_seen || 0);
			if (self.sortKey === 'down') return (b.bytes_in || 0) - (a.bytes_in || 0);
			if (self.sortKey === 'up') return (b.bytes_out || 0) - (a.bytes_out || 0);
			return self.totalOf(b) - self.totalOf(a);
		});
		return rows;
	},

	renderRow: function(r) {
		var label = r.name || r.ip || r.key;

		// An ip: key means no MAC could be established for this device — a
		// client behind a downstream router, or one in extra_subnets. Its
		// history is only as stable as its address, and saying so is the
		// point: the alternative was guessing, which merges devices.
		var ident = [];
		if (r.key_kind === 'mac' && r.mac && r.mac !== '-') {
			ident.push(E('span', { 'class': 'tc-mono' }, r.mac));
		} else {
			ident.push(E('span', {
				'class': 'tc-c-warn',
				'title': _('No MAC address is known for this device, so its history is keyed on its IP address. If that address is reassigned, earlier traffic recorded here may belong to a different device.')
			}, _('IP-keyed')));
		}
		if (r.ip) {
			ident.push(document.createTextNode(' '));
			ident.push(E('span', { 'class': 'tc-c-faint tc-mono' }, r.ip));
		}

		var nameCell = [
			E('div', { 'class': 'tc-fw-bold' }, label),
			E('div', { 'class': 'tc-c-faint', 'style': 'font-size:10px' }, ident)
		];
		if (r.degraded) {
			nameCell.push(E('div', {
				'class': 'tc-c-warn',
				'style': 'font-size:10px',
				'title': _('While this total was being accumulated, flow offloading froze the counters it is built from. The figure is a floor, not a measurement.')
			}, '⚠ ' + _('undercounted')));
		}

		return E('tr', { 'class': 'tr' }, [
			E('td', { 'class': 'td' }, nameCell),
			E('td', { 'class': 'td tc-right tc-mono tc-sm' }, fmtBytes(r.bytes_in)),
			E('td', { 'class': 'td tc-right tc-mono tc-sm' }, fmtBytes(r.bytes_out)),
			E('td', { 'class': 'td tc-right tc-mono tc-fw-bold' }, fmtBytes(this.totalOf(r))),
			E('td', { 'class': 'td tc-center tc-sm tc-c-muted' }, fmtAgo(r.last_seen)),
			E('td', { 'class': 'td tc-center tc-sm tc-c-faint' },
				(r.periods || []).join(', '))
		]);
	},

	renderTable: function() {
		var self = this;
		while (this.tbody.firstChild) this.tbody.removeChild(this.tbody.firstChild);

		if (!this.st.enabled) {
			this.tbody.appendChild(E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td tc-c-faint', 'colspan': 6 },
					_('Traffic history is switched off. Nothing is being recorded.'))
			]));
			return;
		}
		if (!this.rows.length) {
			this.tbody.appendChild(E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td tc-c-faint', 'colspan': 6 },
					_('No traffic has been recorded for this period yet. The first figures appear after the next flush.'))
			]));
			return;
		}

		var rows = this.sorted();
		var tin = 0, tout = 0;
		rows.forEach(function(r) {
			tin += (r.bytes_in || 0);
			tout += (r.bytes_out || 0);
			self.tbody.appendChild(self.renderRow(r));
		});

		// A total over rows that include a degraded one is itself a floor, so
		// it has to carry the same caveat rather than look authoritative.
		var anyDegraded = rows.some(function(r) { return !!r.degraded; });
		this.tbody.appendChild(E('tr', { 'class': 'tr', 'style': 'border-top:2px solid var(--border-color-medium,#ccc)' }, [
			E('td', { 'class': 'td tc-fw-bold' }, [
				document.createTextNode(_('Total') + ' (' + rows.length + ' ' + _('devices') + ')'),
				anyDegraded ? E('span', {
					'class': 'tc-c-warn',
					'style': 'margin-left:6px;font-size:10px'
				}, '⚠ ' + _('at least')) : ''
			]),
			E('td', { 'class': 'td tc-right tc-mono tc-sm tc-fw-bold' }, fmtBytes(tin)),
			E('td', { 'class': 'td tc-right tc-mono tc-sm tc-fw-bold' }, fmtBytes(tout)),
			E('td', { 'class': 'td tc-right tc-mono tc-fw-bold' }, fmtBytes(tin + tout)),
			E('td', { 'class': 'td' }, ''),
			E('td', { 'class': 'td' }, '')
		]));
	},

	// Fixed order rather than a sortable header: there are a handful of rows
	// and the useful reading is "which WAN carried what", so WAN first.
	ifSorted: function() {
		var rank = { wan: 0, vpn: 1, lan: 2, other: 3 };
		return this.ifRows.slice().sort(function(a, b) {
			var ra = rank[a.role], rb = rank[b.role];
			if (ra === undefined) ra = 4;
			if (rb === undefined) rb = 4;
			if (ra !== rb) return ra - rb;
			return ((b.bytes_in || 0) + (b.bytes_out || 0)) -
			       ((a.bytes_in || 0) + (a.bytes_out || 0));
		});
	},

	renderIfRow: function(r) {
		var label = ifText(r.label) || r.dev;
		var role = ifText(r.role);
		var name = [E('span', { 'class': 'tc-fw-bold' }, label)];
		// The device name is what appears in logs and in `ip link`, so it is
		// worth showing even when a friendlier label exists.
		if (label !== r.dev) {
			name.push(E('span', { 'class': 'tc-mono tc-sm tc-c-faint',
				'style': 'margin-left:6px' }, r.dev));
		}
		if (role) {
			name.push(E('span', { 'class': 'tc-c-muted tc-sm',
				'style': 'margin-left:6px' }, role));
		}
		var tot = (r.bytes_in || 0) + (r.bytes_out || 0);
		return E('tr', { 'class': 'tr' }, [
			E('td', { 'class': 'td' }, name),
			E('td', { 'class': 'td tc-right tc-mono tc-sm' }, fmtBytes(r.bytes_in || 0)),
			E('td', { 'class': 'td tc-right tc-mono tc-sm' }, fmtBytes(r.bytes_out || 0)),
			E('td', { 'class': 'td tc-right tc-mono tc-fw-bold' }, fmtBytes(tot)),
			E('td', { 'class': 'td tc-center tc-sm tc-c-muted' }, fmtAgo(r.last_seen))
		]);
	},

	// No total row, unlike the device table. These rows overlap by design: a
	// VPN tunnel's bytes also travelled over its WAN, and the LAN bridge sees
	// the same traffic from the other side. A sum would be a number with no
	// meaning, presented as if it were the period's total.
	renderIfTable: function() {
		var self = this;
		while (this.ifBody.firstChild) this.ifBody.removeChild(this.ifBody.firstChild);
		if (!this.ifRows.length) {
			this.ifBody.appendChild(E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td tc-c-faint', 'colspan': 5 },
					_('No interface traffic recorded for this period yet.'))
			]));
			return;
		}
		this.ifSorted().forEach(function(r) {
			self.ifBody.appendChild(self.renderIfRow(r));
		});
	},

	// Hidden entirely when the series is off or history is: an empty table
	// with a note about accuracy would be worse than no table.
	renderIfSection: function() {
		if (!this.ifWrapEl) return;
		var on = !!this.st.enabled && this.st.interfaces !== false;
		this.ifWrapEl.classList.toggle('tc-hidden', !on);
		if (!on) return;
		var a = ifAccuracyOf(this.st.iface_accuracy);
		while (this.ifNoteEl.firstChild) this.ifNoteEl.removeChild(this.ifNoteEl.firstChild);
		this.ifNoteEl.appendChild(E('div', { 'class': a.cls }, [
			E('span', { 'class': 'tc-fw-bold' }, a.icon + ' '),
			document.createTextNode(a.text)
		]));
	},

	loadPeriod: function() {
		var self = this;
		self.statusEl.textContent = _('Loading…');
		// Each series catches its own failure: one of them being unreadable
		// must not blank the other, since they come from different files.
		var wantIf = self.st.interfaces !== false;
		return Promise.all([
			callHistoryRead(self.sel || '', self.selTo || '')
				.then(function(rows) { self.rows = rows || []; })
				.catch(function(e) {
					self.rows = [];
					ui.addNotification(null, E('p', e.message), 'error');
				}),
			wantIf ? callHistoryReadIfaces(self.sel || '', self.selTo || '')
				.then(function(rows) { self.ifRows = rows || []; })
				.catch(function() { self.ifRows = []; })
				: Promise.resolve()
		]).then(function() {
			self.statusEl.textContent = '';
			self.renderTable();
			self.renderIfTable();
			self.renderIfSection();
		});
	},

	refreshStatus: function() {
		var self = this;
		return Promise.all([callHistoryStatus(), callHistoryPeriods()])
		.then(function(res) {
			self.st = res[0] || {};
			self.periods = res[1] || [];
			self.renderBanner();
			self.renderIfSection();
		}).catch(function() {});
	},

	renderBanner: function() {
		var a = accuracyOf(this.st.accuracy);
		while (this.bannerEl.firstChild) this.bannerEl.removeChild(this.bannerEl.firstChild);

		if (!this.st.enabled) {
			this.bannerEl.appendChild(E('div', { 'class': 'tc-c-muted' }, [
				E('span', { 'class': 'tc-fw-bold' }, _('Off.') + ' '),
				document.createTextNode(_('History is not recorded by default: it writes to the router\'s flash on a schedule, and every other persistent store in this app was deliberately kept off that path. Enable it below.'))
			]));
			return;
		}

		var notes = [
			E('div', { 'class': a.cls }, [
				E('span', { 'class': 'tc-fw-bold' }, a.icon + ' '),
				document.createTextNode(a.text)
			])
		];

		if (this.st.error) {
			notes.push(E('div', { 'class': 'tc-c-warn tc-fw-bold', 'style': 'margin-top:4px' },
				'⚠ ' + _('Recording is paused: the last write failed.') + ' ' + this.st.error));
		} else if (!this.st.writable) {
			notes.push(E('div', { 'class': 'tc-c-warn', 'style': 'margin-top:4px' },
				'⚠ ' + _('The store directory is not writable yet.') + ' ' + (this.st.dir || '')));
		}

		notes.push(E('div', { 'class': 'tc-c-faint', 'style': 'margin-top:4px;font-size:11px' },
			_('Store') + ': ' + (this.st.dir || '—') +
			' · ' + _('period') + ': ' + (this.st.period_kind || '—') +
			' · ' + _('flush every') + ' ' + (this.st.interval || 0) + ' s' +
			' · ' + _('sampled every') + ' ' + (this.st.sample_interval || 0) + ' s' +
			' · ' + _('keeping') + ' ' + (this.st.keep || 0) + ' ' + _('periods') +
			' · ' + _('last flush') + ': ' + fmtAgo(this.st.last_flush)));

		notes.forEach(function(n) { this.bannerEl.appendChild(n); }, this);
	},

	exportCsv: function() {
		var self = this;
		var head = ['key', 'key_kind', 'mac', 'ip', 'name', 'bytes_in', 'bytes_out',
			'bytes_total', 'first_seen', 'last_seen', 'degraded', 'periods'];
		var lines = [head.join(',')];
		this.sorted().forEach(function(r) {
			// Quote and escape every field: a device name comes from a DHCP
			// lease or a PTR record and can contain a comma or a quote.
			var vals = [r.key, r.key_kind, r.mac, r.ip, r.name || '',
				r.bytes_in, r.bytes_out, self.totalOf(r),
				r.first_seen, r.last_seen, r.degraded ? 'true' : 'false',
				(r.periods || []).join(' ')];
			lines.push(vals.map(function(v) {
				return '"' + String(v === undefined || v === null ? '' : v).replace(/"/g, '""') + '"';
			}).join(','));
		});
		var blob = new Blob([lines.join('\n') + '\n'], { type: 'text/csv' });
		var url = URL.createObjectURL(blob);
		var a = E('a', {
			'href': url,
			'download': 'trafficctl-history-' + (this.sel || this.st.period || 'current') + '.csv'
		});
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	},

	render: function(data) {
		var self = this;
		this.st = data[0] || {};
		this.periods = data[1] || [];
		this.sel = this.st.period || '';
		this.selTo = '';

		this.statusEl = E('span', { 'class': 'tc-c-muted', 'style': 'margin-left:10px;font-size:12px' });
		this.bannerEl = E('div', { 'style': 'margin:6px 0 10px 0;font-size:12px' });

		// ── period picker ───────────────────────────────────────────────────
		var picker = E('div', { 'style': 'margin-bottom:8px' });
		var known = this.periods.map(function(p) { return p.period; });
		if (this.st.period && known.indexOf(this.st.period) < 0) known.unshift(this.st.period);
		known.sort().reverse();

		function periodButton(label, from, to, title) {
			var active = (self.sel === from && self.selTo === to);
			var b = E('button', {
				'class': 'cbi-button ' + (active ? 'cbi-button-apply' : ''),
				'style': 'font-size:11px;padding:1px 8px;margin-right:4px',
				'title': title || ''
			}, label);
			b.addEventListener('click', function() {
				self.sel = from;
				self.selTo = to;
				self.loadPeriod();
				// Re-render the picker so the active state follows the click.
				var fresh = buildPicker();
				picker.parentNode.replaceChild(fresh, picker);
				picker = fresh;
			});
			return b;
		}

		function buildPicker() {
			var p = E('div', { 'style': 'margin-bottom:8px' });
			p.appendChild(E('span', { 'class': 'tc-c-faint', 'style': 'margin-right:6px;font-size:11px' },
				_('Period') + ':'));
			known.forEach(function(name) {
				p.appendChild(periodButton(name, name, '', _('Show only this period')));
			});
			if (known.length > 1) {
				p.appendChild(periodButton(_('All'), known[known.length - 1], known[0],
					_('Aggregate every stored period')));
			}
			picker = p;
			return p;
		}
		picker = buildPicker();

		// ── table ───────────────────────────────────────────────────────────
		this.tbody = E('tbody', {});

		function sortHeader(label, key, cls, title) {
			var th = E('th', {
				'class': 'th ' + (cls || ''),
				'style': 'cursor:pointer',
				'title': title || _('Sort by this column')
			}, label + (self.sortKey === key ? ' ▾' : ''));
			th.addEventListener('click', function() {
				self.sortKey = key;
				self.renderTable();
				var fresh = buildHead();
				thead.parentNode.replaceChild(fresh, thead);
				thead = fresh;
			});
			return th;
		}

		var thead;
		function buildHead() {
			thead = E('thead', {}, [
				E('tr', { 'class': 'tr cbi-section-table-titles' }, [
					sortHeader(_('Device'), 'name'),
					sortHeader(_('Download'), 'down', 'tc-right'),
					sortHeader(_('Upload'), 'up', 'tc-right'),
					sortHeader(_('Total'), 'total', 'tc-right'),
					sortHeader(_('Last seen'), 'last', 'tc-center',
						_('When this device last moved any traffic, not when it was last connected')),
					E('th', { 'class': 'th tc-center' }, _('Periods'))
				])
			]);
			return thead;
		}
		buildHead();

		var table = E('table', { 'class': 'table tc-table' }, [thead, this.tbody]);

		// ── interfaces: a second series, below the first ────────────────────
		this.ifBody = E('tbody', {});
		this.ifNoteEl = E('div', { 'style': 'margin-bottom:6px' });
		this.ifWrapEl = E('div', { 'class': 'tc-hidden', 'style': 'margin-top:18px' }, [
			E('h3', {}, _('Per-interface totals')),
			E('div', { 'class': 'cbi-map-descr' },
				_('Which link carried the traffic — the question the device table cannot answer. This is a separate series, not a breakdown of it: the rows include the router\'s own traffic and broadcast, and they overlap each other (a VPN tunnel\'s bytes also travelled over its WAN), so the two tables are not meant to add up. Received and Sent are relative to the interface, so on the LAN bridge Received is what your devices sent.')),
			this.ifNoteEl,
			E('table', { 'class': 'table tc-table' }, [
				E('thead', {}, [
					E('tr', { 'class': 'tr cbi-section-table-titles' }, [
						E('th', { 'class': 'th' }, _('Interface')),
						E('th', { 'class': 'th tc-right',
							'title': _('Bytes the interface received. On a WAN that is download; on the LAN bridge it is what your devices uploaded.') },
							_('Received')),
						E('th', { 'class': 'th tc-right',
							'title': _('Bytes the interface sent. On a WAN that is upload; on the LAN bridge it is what your devices downloaded.') },
							_('Sent')),
						E('th', { 'class': 'th tc-right' }, _('Total')),
						E('th', { 'class': 'th tc-center' }, _('Last active'))
					])
				]),
				this.ifBody
			])
		]);

		this.renderBanner();
		this.renderTable();
		this.renderIfTable();
		this.renderIfSection();
		if (this.st.enabled) this.loadPeriod();

		// ── controls ────────────────────────────────────────────────────────
		var enableBtn = E('button', { 'class': 'cbi-button cbi-button-apply' },
			this.st.enabled ? _('Switch off') : _('Switch on'));
		enableBtn.addEventListener('click', function() {
			enableBtn.disabled = true;
			var want = !self.st.enabled;
			callHistoryConfigSet(want, null, null, null, null, null).then(function(res) {
				enableBtn.disabled = false;
				if (res && res.ok === false) {
					ui.addNotification(null, E('p', res.msg || _('Operation failed')), 'error');
					return;
				}
				return self.refreshStatus().then(function() {
					enableBtn.textContent = self.st.enabled ? _('Switch off') : _('Switch on');
					if (self.st.enabled) return self.loadPeriod();
					self.rows = [];
					self.ifRows = [];
					self.renderTable();
					self.renderIfTable();
					self.renderIfSection();
				});
			}).catch(function(e) {
				enableBtn.disabled = false;
				ui.addNotification(null, E('p', e.message), 'error');
			});
		});

		var flushBtn = E('button', {
			'class': 'cbi-button',
			'style': 'margin-left:6px',
			'title': _('Write the figures accumulated so far to the store now, without waiting for the next scheduled flush')
		}, _('Flush now'));
		flushBtn.addEventListener('click', function() {
			flushBtn.disabled = true;
			self.statusEl.textContent = _('Flushing…');
			callHistoryFlush().then(function(res) {
				flushBtn.disabled = false;
				self.statusEl.textContent = '';
				if (res && res.ok === false) {
					ui.addNotification(null, E('p', res.reason || _('Flush failed')), 'error');
				}
				return self.refreshStatus().then(function() { return self.loadPeriod(); });
			}).catch(function(e) {
				flushBtn.disabled = false;
				self.statusEl.textContent = '';
				ui.addNotification(null, E('p', e.message), 'error');
			});
		});

		var csvBtn = E('button', { 'class': 'cbi-button', 'style': 'margin-left:6px' },
			_('Export CSV'));
		csvBtn.addEventListener('click', function() { self.exportCsv(); });

		return E('div', {}, [
			E('h2', {}, _('Traffic History')),
			E('div', { 'class': 'cbi-map-descr' }, [
				document.createTextNode(_('Per-device totals accumulated per accounting period, including devices that are not connected now. Figures survive reboots; the live view on the Devices tab does not.')),
				this.statusEl
			]),
			this.bannerEl,
			E('div', { 'style': 'margin-bottom:8px' }, [enableBtn, flushBtn, csvBtn]),
			picker,
			table,
			this.ifWrapEl
		]);
	}
});
