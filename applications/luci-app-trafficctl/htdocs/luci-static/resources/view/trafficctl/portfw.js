// SPDX-License-Identifier: Apache-2.0
'use strict';
'require view';
'require rpc';
'require poll';
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

var callPortfwList = rpc.declare({
	object: 'luci.trafficctl',
	method: 'portfw_list',
	expect: { result: [] }
});

var callPortfwCtl = rpc.declare({
	object: 'luci.trafficctl',
	method: 'portfw_ctl',
	params: ['action', 'scope', 'proto', 'ip', 'port', 'rate_kbit']
});

var LIMIT_PRESETS = [
	{ label: '1M',   kbit: 1000 },
	{ label: '5M',   kbit: 5000 },
	{ label: '10M',  kbit: 10000 },
	{ label: '50M',  kbit: 50000 }
];

function fmtBytes(b) {
	b = b || 0;
	if (b >= 1000000000) return (b / 1000000000).toFixed(b >= 10000000000 ? 0 : 1) + ' GB';
	if (b >= 1000000) return (b / 1000000).toFixed(b >= 10000000 ? 0 : 1) + ' MB';
	if (b >= 1000) return (b / 1000).toFixed(0) + ' KB';
	return b + ' B';
}

function fmtRate(kbit) {
	kbit = kbit || 0;
	if (kbit >= 1000) {
		var m = kbit / 1000;
		return (m === Math.floor(m) ? m : m.toFixed(1)) + ' ' + _('Mbit/s');
	}
	return kbit + ' ' + _('kbit/s');
}

function scopeOf(row) {
	return row.kind === 'open' ? 'input' : 'forward';
}

function protoParam(row) {
	// backend accepts "tcp", "udp" or "tcpudp"
	return row.proto.indexOf('tcp') >= 0 && row.proto.indexOf('udp') >= 0
		? 'tcpudp' : row.proto;
}

return view.extend({
	rows: [],
	tbody: null,
	statusEl: null,

	handleSaveApply: null,
	handleSave: null,
	handleReset: null,

	load: function() {
		return callPortfwList().catch(function() { return []; });
	},

	doCtl: function(action, row, kbit) {
		var self = this;
		self.statusEl.textContent = _('Applying…');
		return callPortfwCtl(action, scopeOf(row), protoParam(row),
			row.kind === 'open' ? '-' : row.ip, String(row.port), kbit || 0)
		.then(function(res) {
			if (res && res.ok) {
				self.statusEl.textContent = '';
				return self.refresh();
			}
			self.statusEl.textContent = '';
			ui.addNotification(null, E('p', (res && res.msg) || _('Operation failed')), 'error');
		}).catch(function(e) {
			self.statusEl.textContent = '';
			ui.addNotification(null, E('p', e.message), 'error');
		});
	},

	renderRow: function(row) {
		var self = this;

		var dest = row.kind === 'open'
			? E('span', { 'class': 'tc-c-muted' }, _('router'))
			: E('span', { 'class': 'tc-mono' }, row.ip + ':' + row.port);

		var state;
		if (!row.enabled) {
			state = E('span', { 'class': 'tc-c-faint' }, _('disabled'));
		} else if (row.paused) {
			state = E('span', { 'class': 'tc-c-warn tc-fw-bold' }, '⏸ ' + _('paused'));
		} else {
			state = E('span', { 'class': 'tc-c-ok' }, '●');
		}

		var pauseBtn = E('button', {
			'class': 'cbi-button ' + (row.paused ? 'cbi-button-apply' : 'cbi-button-remove'),
			'style': 'font-size:11px;padding:1px 8px'
		}, row.paused ? _('Resume') : _('Pause'));
		pauseBtn.addEventListener('click', function() {
			pauseBtn.disabled = true;
			self.doCtl(row.paused ? 'resume' : 'pause', row);
		});

		var limitCell;
		if (row.limit_kbit > 0) {
			var rmBtn = E('button', {
				'class': 'cbi-button cbi-button-remove',
				'style': 'font-size:11px;padding:1px 6px;margin-left:6px',
				'title': _('Remove limit')
			}, _('✕'));
			rmBtn.addEventListener('click', function() {
				rmBtn.disabled = true;
				self.doCtl('limit', row, 0);
			});
			limitCell = E('span', {}, [
				E('span', { 'class': 'tc-c-warn tc-fw-bold' }, '⚡ ' + fmtRate(row.limit_kbit)),
				rmBtn
			]);
		} else {
			var chips = LIMIT_PRESETS.map(function(p) {
				var b = E('button', {
					'class': 'cbi-button',
					'style': 'font-size:10px;padding:0 5px;margin-right:2px',
					'title': _('Limit inbound to %s').format(fmtRate(p.kbit))
				}, p.label);
				b.addEventListener('click', function() {
					b.disabled = true;
					self.doCtl('limit', row, p.kbit);
				});
				return b;
			});
			limitCell = E('span', {}, chips);
		}

		return E('tr', { 'class': 'tr' }, [
			E('td', { 'class': 'td', 'style': row.enabled ? '' : 'opacity:.5' }, [
				E('div', { 'class': 'tc-fw-bold' }, row.name || '*'),
				E('div', { 'class': 'tc-c-faint', 'style': 'font-size:10px' },
					row.kind === 'open' ? _('open port') : _('port forward'))
			]),
			E('td', { 'class': 'td tc-center' }, row.proto),
			E('td', { 'class': 'td tc-center tc-mono' }, String(row.ext_port)),
			E('td', { 'class': 'td' }, dest),
			E('td', { 'class': 'td tc-center' }, state),
			E('td', { 'class': 'td tc-right tc-fw-bold' }, String(row.conns || 0)),
			E('td', { 'class': 'td tc-right' }, String(row.clients || 0)),
			E('td', { 'class': 'td tc-right tc-mono tc-sm' }, fmtBytes(row.bytes_in)),
			E('td', { 'class': 'td tc-right tc-mono tc-sm' }, fmtBytes(row.bytes_out)),
			E('td', { 'class': 'td' }, limitCell),
			E('td', { 'class': 'td tc-center' }, pauseBtn)
		]);
	},

	renderTable: function() {
		var self = this;
		while (this.tbody.firstChild) this.tbody.removeChild(this.tbody.firstChild);
		if (!this.rows.length) {
			this.tbody.appendChild(E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td tc-c-faint', 'colspan': 11 },
					_('No port forwards or WAN-open ports are configured in the firewall.'))
			]));
			return;
		}
		this.rows.forEach(function(r) {
			self.tbody.appendChild(self.renderRow(r));
		});
	},

	refresh: function() {
		var self = this;
		return callPortfwList().then(function(rows) {
			self.rows = rows || [];
			self.renderTable();
		}).catch(function() {});
	},

	render: function(rows) {
		var self = this;
		this.rows = rows || [];
		this.statusEl = E('span', { 'class': 'tc-c-muted', 'style': 'margin-left:10px;font-size:12px' });

		this.tbody = E('tbody', {});
		var table = E('table', { 'class': 'table tc-table' }, [
			E('thead', {}, [
				E('tr', { 'class': 'tr cbi-section-table-titles' }, [
					E('th', { 'class': 'th' }, _('Name')),
					E('th', { 'class': 'th tc-center' }, _('Proto')),
					E('th', { 'class': 'th tc-center', 'title': _('External (WAN) port') }, _('Ext. port')),
					E('th', { 'class': 'th' }, _('Destination')),
					E('th', { 'class': 'th tc-center' }, _('State')),
					E('th', { 'class': 'th tc-right', 'title': _('Active inbound connections') }, _('Conns')),
					E('th', { 'class': 'th tc-right', 'title': _('Distinct remote clients') }, _('Clients')),
					E('th', { 'class': 'th tc-right', 'title': _('Bytes received from remote clients') }, _('In')),
					E('th', { 'class': 'th tc-right', 'title': _('Bytes sent back to remote clients') }, _('Out')),
					E('th', { 'class': 'th', 'title': _('Inbound rate limit (drops packets above the rate)') }, _('Limit')),
					E('th', { 'class': 'th tc-center' }, _('Action'))
				])
			]),
			this.tbody
		]);

		this.renderTable();

		poll.add(function() { return self.refresh(); }, 5);

		return E('div', {}, [
			E('h2', {}, _('Port Forwards & Open Ports')),
			E('div', { 'class': 'cbi-map-descr' }, [
				document.createTextNode(_('Inbound traffic control for DNAT port forwards and router-local open ports configured in the firewall. Pause drops all inbound traffic on the port instantly (without touching the firewall config); Limit polices the inbound rate.')),
				this.statusEl
			]),
			table
		]);
	}
});
