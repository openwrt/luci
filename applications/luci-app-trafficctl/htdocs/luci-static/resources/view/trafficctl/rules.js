// SPDX-License-Identifier: Apache-2.0
'use strict';
'require view';
'require rpc';
'require poll';
'require ui';

// "Rules" tab (#128): every block, speed limit, shape and WiFi deny the app
// holds, whether or not the device is online. The Devices tab is built from
// live connections, so a device that went offline took its restrictions out
// of sight with it while they kept applying. The list comes from
// trafficctl-rules.sh, which reads the kernel and the saved state; edits and
// removals go through the same rpcd methods the Devices tab uses.

(function() {
	if (!document.querySelector('link[href*="trafficctl/status.css"]')) {
		var lnk = document.createElement('link');
		lnk.rel = 'stylesheet';
		lnk.type = 'text/css';
		lnk.href = '/luci-static/resources/view/trafficctl/status.css';
		document.head.appendChild(lnk);
	}
})();

var callRulesList = rpc.declare({
	object: 'luci.trafficctl',
	method: 'rules_list',
	expect: { result: {} }
});

var callBlock = rpc.declare({
	object: 'luci.trafficctl',
	method: 'block',
	params: ['ip', 'label']
});

var callUnblock = rpc.declare({
	object: 'luci.trafficctl',
	method: 'unblock',
	params: ['ip', 'label']
});

var callMacfilterRemove = rpc.declare({
	object: 'luci.trafficctl',
	method: 'macfilter_remove',
	params: ['ip', 'mac']
});

var callRatelimit = rpc.declare({
	object: 'luci.trafficctl',
	method: 'ratelimit',
	params: ['ip', 'rate_kbit', 'label', 'mode', 'rate_kbit_up']
});

var callShapeAdd = rpc.declare({
	object: 'luci.trafficctl',
	method: 'shape_add',
	params: ['ip', 'rate_kbit', 'label', 'rate_kbit_up']
});

var callShapeRemove = rpc.declare({
	object: 'luci.trafficctl',
	method: 'shape_remove',
	params: ['ip', 'label']
});

var TYPE_ORDER = { block: 0, wifi: 1, ratelimit: 2, shape: 3 };

function fmtRate(kbit) {
	if (!kbit || kbit <= 0) return '—';
	var mbit = kbit / 1000;
	if (mbit >= 1) return (mbit % 1 === 0 ? mbit.toFixed(0) : mbit.toFixed(1)) + ' ' + _('Mbit/s');
	return kbit + ' ' + _('kbit/s');
}

function fmtCeiling(kbit, kbitUp) {
	if (!kbitUp || kbitUp <= 0 || kbitUp === kbit) return fmtRate(kbit);
	return '↓ ' + fmtRate(kbit) + ' / ↑ ' + fmtRate(kbitUp);
}

function isSubnet(target) {
	return target.indexOf('/') >= 0 && !/\/32$/.test(target);
}

// Sort key: addresses numerically, so a device's rules sit together and
// 192.168.1.9 comes before 192.168.1.10; MACs without an address go last.
function addrKey(r) {
	var a = (r.ip || r.target || '').split('/')[0].split('.');
	if (a.length !== 4) return 'z' + (r.target || '');
	return a.map(function(o) { return ('00' + o).slice(-3); }).join('.');
}

function typeLabel(r) {
	switch (r.type) {
	case 'block': return E('span', { 'class': 'tc-badge tc-badge--blocked' }, '⛔ ' + _('Internet blocked'));
	case 'wifi': return E('span', { 'class': 'tc-badge tc-badge--wifi' }, '📶 ' + _('WiFi blocked'));
	case 'ratelimit': return E('span', { 'class': 'tc-badge tc-badge--limited' }, '⚡ ' + _('Speed limit'));
	case 'shape': return E('span', { 'class': 'tc-badge tc-badge--shaped' }, '≋ ' + _('Shaped'));
	}
	return E('span', {}, r.type);
}

function detail(r) {
	if (r.type === 'ratelimit') {
		var s = fmtCeiling(r.rate_kbit, r.rate_kbit_up);
		if (isSubnet(r.target)) {
			s += ' · ' + (r.mode === 'shared' ? _('shared between them') : _('each'));
		}
		return s;
	}
	if (r.type === 'shape') return fmtCeiling(r.rate_kbit, r.rate_kbit_up);
	return '';
}

// What the operator needs to know about where the rule actually is. The two
// mismatches are the reason this column exists: "saved but not in effect"
// and "in effect but lost on reboot" both used to read as plain "active".
function stateCell(r, persist) {
	if (r.type === 'wifi') {
		switch (r.enforcement) {
		case 'acl': return E('span', { 'class': 'tc-c-ok' }, '● ' + _('Active'));
		case 'ban': return E('span', { 'class': 'tc-c-warn', 'title': _('hostapd-utils is missing, so hostapd only banned the device for a while. The deny list entry applies when WiFi restarts.') }, '◐ ' + _('Temporary ban only'));
		case 'no-radio': return E('span', { 'class': 'tc-c-muted' }, '○ ' + _('Saved, applies when WiFi starts'));
		case 'none': return E('span', { 'class': 'tc-c-err tc-fw-bold', 'title': _('The deny list names this device but the running radio does not. Install hostapd-utils, or restart WiFi (disconnects every client).') }, '✗ ' + _('Saved, not in effect'));
		}
		return E('span', { 'class': 'tc-c-muted' }, '? ' + _('Saved, radio state unknown'));
	}
	if (r.applied && r.persisted) return E('span', { 'class': 'tc-c-ok' }, '● ' + _('Active'));
	if (r.applied) {
		return E('span', {
			'class': 'tc-c-warn',
			'title': persist ? _('In effect now but not saved, so a reboot drops it.')
				: _('Blocks and speed limits are not saved while "Keep rules after reboot" is off (Settings).')
		}, '◐ ' + _('Active, lost on reboot'));
	}
	return E('span', {
		'class': 'tc-c-err tc-fw-bold',
		'title': _('Saved, but not in the firewall or traffic shaper right now. It is restored when the LAN interface next comes up; Apply puts it back now.')
	}, '✗ ' + _('Saved, not in effect'));
}

function mbitInput(kbit) {
	return E('input', {
		'type': 'number', 'min': '0.064', 'step': '0.1', 'class': 'cbi-input-text',
		'style': 'width:6em',
		'value': kbit > 0 ? String(kbit / 1000) : ''
	});
}

function toKbit(v) {
	var n = parseFloat(v);
	if (!isFinite(n) || n <= 0) return 0;
	return Math.round(n * 1000);
}

return view.extend({
	data: null,
	editing: null,
	filter: 'all',
	query: '',

	handleSaveApply: null,
	handleSave: null,
	handleReset: null,

	load: function() {
		return callRulesList().catch(function() { return {}; });
	},

	refresh: function() {
		var self = this;
		if (self.editing) return Promise.resolve();
		return callRulesList().then(function(d) {
			self.data = d || {};
			self.renderAll();
		}).catch(function() {});
	},

	// One result handler for every action: show the backend's own message,
	// which says things like "IPv4 only" or "NOT PERSISTENT" that a generic
	// "done" would hide, then re-read the list.
	act: function(promise, btn) {
		var self = this;
		if (btn) btn.disabled = true;
		self.statusEl.textContent = _('Applying…');
		return promise.then(function(res) {
			self.statusEl.textContent = '';
			if (res && res.ok === false) {
				ui.addNotification(null, E('p', res.msg || _('Operation failed')), 'error');
			} else if (res && res.msg) {
				ui.addNotification(null, E('p', res.msg), 'info');
			}
			self.editing = null;
			return self.refresh();
		}).catch(function(e) {
			self.statusEl.textContent = '';
			if (btn) btn.disabled = false;
			ui.addNotification(null, E('p', e.message), 'error');
		});
	},

	remove: function(r, btn) {
		var who = r.name ? r.name + ' (' + r.target + ')' : r.target;
		if (!window.confirm(_('Remove this restriction from %s?').format(who))) return;
		switch (r.type) {
		case 'block': return this.act(callUnblock(r.target, ''), btn);
		case 'wifi': return this.act(callMacfilterRemove(r.ip || '', r.mac || r.target), btn);
		case 'ratelimit': return this.act(callRatelimit(r.target, 0, '', r.mode), btn);
		case 'shape': return this.act(callShapeRemove(r.target, ''), btn);
		}
	},

	// Put a saved rule back into the kernel now, with the values it was saved
	// with, through the same call that created it.
	reapply: function(r, btn) {
		var up = (r.rate_kbit_up && r.rate_kbit_up !== r.rate_kbit) ? r.rate_kbit_up : null;
		switch (r.type) {
		case 'block': return this.act(callBlock(r.target, ''), btn);
		case 'ratelimit': return this.act(callRatelimit(r.target, r.rate_kbit, '', r.mode, up), btn);
		case 'shape': return this.act(callShapeAdd(r.target, r.rate_kbit, '', up), btn);
		}
	},

	save: function(r, dn, up, mode, btn) {
		var kd = toKbit(dn), ku = toKbit(up);
		if (!kd) {
			ui.addNotification(null, E('p', _('Enter a download rate above zero.')), 'error');
			return;
		}
		var sendUp = (ku && ku !== kd) ? ku : null;
		if (r.type === 'ratelimit') {
			return this.act(callRatelimit(r.target, kd, '', mode || r.mode, sendUp), btn);
		}
		return this.act(callShapeAdd(r.target, kd, '', sendUp), btn);
	},

	ruleKey: function(r) { return r.type + '|' + r.target; },

	renderActions: function(r) {
		var self = this;
		var btns = [];
		var small = 'font-size:11px;padding:1px 8px;margin:1px 2px';

		if (r.type !== 'wifi' && !r.applied) {
			var applyBtn = E('button', {
				'class': 'cbi-button cbi-button-apply', 'style': small,
				'title': _('Put this saved rule back into effect now')
			}, _('Apply'));
			applyBtn.addEventListener('click', function() { self.reapply(r, applyBtn); });
			btns.push(applyBtn);
		}
		if (r.type === 'ratelimit' || r.type === 'shape') {
			var editBtn = E('button', { 'class': 'cbi-button cbi-button-edit', 'style': small }, _('Edit'));
			editBtn.addEventListener('click', function() {
				self.editing = self.ruleKey(r);
				self.renderAll();
			});
			btns.push(editBtn);
		}
		var rmBtn = E('button', { 'class': 'cbi-button cbi-button-remove', 'style': small }, _('Remove'));
		rmBtn.addEventListener('click', function() { self.remove(r, rmBtn); });
		btns.push(rmBtn);
		return btns;
	},

	renderEditor: function(r) {
		var self = this;
		var dn = mbitInput(r.rate_kbit);
		var up = mbitInput(r.rate_kbit_up);
		var mode = r.mode;
		var parts = [
			E('label', { 'class': 'tc-sm', 'style': 'margin-right:4px' }, '↓'), dn,
			E('label', { 'class': 'tc-sm', 'style': 'margin:0 4px 0 8px' }, '↑'), up,
			E('span', { 'class': 'tc-sm tc-c-muted', 'style': 'margin-left:4px' }, _('Mbit/s'))
		];
		if (r.type === 'ratelimit' && isSubnet(r.target)) {
			var chips = E('span', { 'style': 'margin-left:8px' });
			['each', 'shared'].forEach(function(m) {
				var c = E('span', {
					'class': 'tc-chip' + (m === mode ? ' tc-chip--active' : ''),
					'title': m === 'shared' ? _('One bucket for the whole subnet') : _('One bucket per device inside the subnet')
				}, m === 'shared' ? _('shared between them') : _('each'));
				c.addEventListener('click', function() {
					mode = m;
					Array.prototype.forEach.call(chips.children, function(x) { x.classList.remove('tc-chip--active'); });
					c.classList.add('tc-chip--active');
				});
				chips.appendChild(c);
			});
			parts.push(chips);
		}
		var saveBtn = E('button', { 'class': 'cbi-button cbi-button-positive', 'style': 'font-size:11px;padding:1px 8px;margin-left:8px' }, _('Save'));
		saveBtn.addEventListener('click', function() { self.save(r, dn.value, up.value, mode, saveBtn); });
		var cancelBtn = E('button', { 'class': 'cbi-button', 'style': 'font-size:11px;padding:1px 8px;margin-left:2px' }, _('Cancel'));
		cancelBtn.addEventListener('click', function() { self.editing = null; self.renderAll(); });
		parts.push(saveBtn, cancelBtn);
		return E('div', { 'style': 'display:flex;flex-wrap:wrap;align-items:center' }, parts);
	},

	renderRow: function(r, persist) {
		var target = r.target === '0.0.0.0/0' ? _('Whole network') : r.target;
		var title = r.name || (isSubnet(r.target) ? _('Subnet') : (r.type === 'wifi' && !r.ip ? _('Unknown device') : '*'));
		var sub = [];
		if (r.type === 'wifi') {
			if (r.ip) sub.push(r.ip);
		} else {
			sub.push(target);
			if (r.mac) sub.push(r.mac);
		}
		if (r.type === 'wifi') sub.push(r.mac || r.target);

		var presence;
		if (r.online === true) {
			presence = E('span', { 'class': 'tc-c-ok', 'title': _('Has active connections or answers on the LAN') }, '● ' + _('online'));
		} else if (r.online === false) {
			presence = E('span', { 'class': 'tc-c-faint' }, '○ ' + _('offline'));
		} else {
			presence = E('span', { 'class': 'tc-c-faint' }, '—');
		}

		var editing = this.editing === this.ruleKey(r);
		return E('tr', { 'class': 'tr' }, [
			E('td', { 'class': 'td' }, [
				E('div', { 'class': 'tc-fw-bold' }, title),
				E('div', { 'class': 'tc-mono tc-c-faint tc-sm' }, sub.join(' · '))
			]),
			E('td', { 'class': 'td tc-center tc-sm' }, presence),
			E('td', { 'class': 'td' }, [
				typeLabel(r),
				E('div', { 'class': 'tc-mono tc-sm', 'style': 'margin-top:2px' }, detail(r))
			]),
			E('td', { 'class': 'td tc-sm' }, stateCell(r, persist)),
			E('td', { 'class': 'td' }, editing ? this.renderEditor(r) : this.renderActions(r))
		]);
	},

	matches: function(r) {
		if (this.filter === 'offline' && r.online !== false) return false;
		if (this.filter !== 'all' && this.filter !== 'offline' && r.type !== this.filter) return false;
		if (!this.query) return true;
		var hay = [r.name, r.target, r.ip, r.mac].join(' ').toLowerCase();
		return hay.indexOf(this.query) >= 0;
	},

	renderAll: function() {
		var self = this;
		var d = self.data || {};
		var rules = (d.rules || []).slice();
		rules.sort(function(a, b) {
			var ka = addrKey(a), kb = addrKey(b);
			if (ka !== kb) return ka < kb ? -1 : 1;
			return (TYPE_ORDER[a.type] || 0) - (TYPE_ORDER[b.type] || 0);
		});

		while (self.notes.firstChild) self.notes.removeChild(self.notes.firstChild);
		if (d.persist_rules === false) {
			self.notes.appendChild(E('div', { 'class': 'alert-message warning' },
				_('"Keep rules after reboot" is off: blocks and speed limits listed here are lost on reboot. Shapes are always kept.')));
		}
		if (d.wifi_allow_ifaces > 0) {
			self.notes.appendChild(E('div', { 'class': 'alert-message notice' },
				_('%d WiFi network(s) use an allow-list. A device blocked there is one missing from that list, so it cannot be shown here; manage it in Network → Wireless.').format(d.wifi_allow_ifaces)));
		}

		while (self.tbody.firstChild) self.tbody.removeChild(self.tbody.firstChild);
		var shown = rules.filter(function(r) { return self.matches(r); });
		if (!shown.length) {
			self.tbody.appendChild(E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td tc-c-faint', 'colspan': 5 },
					rules.length ? _('No restriction matches the filter.')
						: _('No device is blocked, limited or shaped.'))
			]));
		}
		shown.forEach(function(r) { self.tbody.appendChild(self.renderRow(r, d.persist_rules)); });

		var off = rules.filter(function(r) { return r.online === false; }).length;
		var bad = rules.filter(function(r) { return r.applied === false; }).length;
		var parts = [_('%d restrictions').format(rules.length)];
		if (off) parts.push(_('%d on offline devices').format(off));
		if (bad) parts.push(_('%d not in effect').format(bad));
		self.countEl.textContent = parts.join(' · ');
	},

	renderFilters: function() {
		var self = this;
		var row = E('div', { 'class': 'tc-chips-row', 'style': 'margin:8px 0' });
		var opts = [
			['all', _('All')],
			['offline', _('Offline devices')],
			['block', _('Internet blocked')],
			['wifi', _('WiFi blocked')],
			['ratelimit', _('Speed limit')],
			['shape', _('Shaped')]
		];
		opts.forEach(function(o) {
			var c = E('span', { 'class': 'tc-chip' + (o[0] === self.filter ? ' tc-chip--active' : '') }, o[1]);
			c.addEventListener('click', function() {
				self.filter = o[0];
				Array.prototype.forEach.call(row.querySelectorAll('.tc-chip'), function(x) { x.classList.remove('tc-chip--active'); });
				c.classList.add('tc-chip--active');
				self.renderAll();
			});
			row.appendChild(c);
		});
		var search = E('input', {
			'type': 'search', 'class': 'cbi-input-text', 'style': 'margin-left:8px;width:14em',
			'placeholder': _('Filter by name, IP or MAC')
		});
		search.addEventListener('input', function() {
			self.query = search.value.trim().toLowerCase();
			self.renderAll();
		});
		row.appendChild(search);
		return row;
	},

	render: function(d) {
		var self = this;
		self.data = d || {};
		self.statusEl = E('span', { 'class': 'tc-c-muted', 'style': 'margin-left:10px;font-size:12px' });
		self.countEl = E('span', { 'class': 'tc-c-muted tc-sm', 'style': 'margin-left:8px' });
		self.notes = E('div', {});
		self.tbody = E('tbody', {});

		var table = E('table', { 'class': 'table tc-table' }, [
			E('thead', {}, [
				E('tr', { 'class': 'tr cbi-section-table-titles' }, [
					E('th', { 'class': 'th' }, _('Device')),
					E('th', { 'class': 'th tc-center' }, _('Presence')),
					E('th', { 'class': 'th' }, _('Restriction')),
					E('th', { 'class': 'th', 'title': _('Whether the rule is in the firewall or shaper now, and whether it survives a reboot') }, _('State')),
					E('th', { 'class': 'th' }, _('Action'))
				])
			]),
			self.tbody
		]);

		self.renderAll();
		poll.add(function() { return self.refresh(); }, 10);

		return E('div', {}, [
			E('h2', {}, _('Active restrictions')),
			E('div', { 'class': 'cbi-map-descr' }, [
				document.createTextNode(_('Every block, speed limit, shape and WiFi block the router holds, including those on devices that are offline. Each rule keeps applying while its device is away, so this is the place to find and lift it.')),
				self.countEl,
				self.statusEl
			]),
			self.notes,
			self.renderFilters(),
			table
		]);
	}
});
