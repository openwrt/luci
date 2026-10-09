'use strict';
'require fs';
'require ui';
'require view';

function copsParse(output) {
	var s = output.replace(/^\+COPS:\s*/i, '');
	var m = s.match(/^\s*(\d+),(\d+),"([^"]*)",(\d+)/);
	if (!m)
		m = s.match(/^\s*(\d+),(\d+),([^,]+),(\d+)/);
	if (!m) return null;
	return {
		mode: parseInt(m[1]),
		format: parseInt(m[2]),
		operator: String(m[3]).replace(/^"+|"+$/g, ''),
		act: parseInt(m[4])
	};
}

var actLabels = {
	 0: 'GSM / GPRS',
	 2: 'UTRAN (3G)',
	 3: 'GSM w/GPRS',
	 4: 'HSDPA (3G)',
	 5: 'HSUPA (3G)',
	 7: 'E-UTRAN (4G LTE)',
	 8: 'HSPA+ (3G)',
	 9: 'E-UTRAN (LTE-A)',
	10: 'NR (5G)'
};

function actLabel(act) {
	return actLabels[act] || _('Unknown') + ' (' + act + ')';
}

function actShort(act) {
	if (act === 2 || act === 4 || act === 5 || act === 6 || act === 8) return '3g';
	if (act === 7 || act === 9 || act === 10) return '4g';
	return 'auto';
}

var atCmd = function(device, cmd) {
	return fs.exec_direct('/usr/share/netmode/at.sh', [device || 'auto', cmd]).then(function(r) {
		return r || '';
	});
};

return view.extend({
	load: function() {
		var self = this;
		self._busy = false;
		self._device = null;
		self._ports = [];
		self._operator = null;
		self._act = null;
		self._error = null;

		return fs.list('/dev').catch(function() {
			return [];
		}).then(function(entries) {
			var ports = [];
			for (var i = 0; i < entries.length; i++)
				if (entries[i].name && entries[i].name.match(/^ttyUSB|^ttyACM/))
					ports.push('/dev/' + entries[i].name);
			ports.sort();
			self._ports = ports;
			self._device = ports.length > 0 ? ports[ports.length - 1] : null;
			if (self._device) return self._reQuery();
		});
	},

	render: function() {
		var self = this;

		return E('div', { 'class': 'cbi-map', 'id': 'netmode-page' }, [
			E('h2', { 'style': 'margin-top:0' }, _('Network Mode')),
			E('p', {}, _('View and switch the modem network access technology.')),
			E('hr'),
			E('h3', {}, _('Current Status')),
			E('div', { 'id': 'netmode-status' }, self._renderStatus()),
			E('h3', {}, _('Change Mode')),
			E('div', { 'id': 'netmode-buttons' }, self._renderButtons()),
			E('div', { 'id': 'netmode-msg', 'style': 'margin-top:12px;min-height:1.5em' }),
			E('details', { 'id': 'netmode-advanced', 'style': 'margin-top:24px' }, [
				E('summary', { 'style': 'cursor:pointer;opacity:0.7' }, _('Advanced Settings')),
				E('div', { 'id': 'netmode-port', 'style': 'margin-top:8px' }, self._renderPortSelect())
			])
		]);
	},

	_renderPortSelect: function() {
		var self = this;
		var options = [];

		if (self._ports.length === 0) {
			options.push(E('option', { 'value': '', 'disabled': 'disabled' }, _('No modem ports found')));
		} else {
			for (var i = 0; i < self._ports.length; i++) {
				var p = self._ports[i];
				options.push(E('option', {
					'value': p,
					'selected': p === self._device ? 'selected' : null
				}, p));
			}
		}

		return E('div', { 'class': 'cbi-value' }, [
			E('label', { 'class': 'cbi-value-title' }, _('AT Port')),
			E('div', { 'class': 'cbi-value-field' }, [
				E('select', {
					'id': 'netmode-port-select',
					'class': 'cbi-input-select',
					'change': function(ev) {
						self._device = ev.target.value;
						self._reQuery();
					}
				}, options)
			])
		]);
	},

	_renderStatus: function() {
		var self = this;

		if (!self._device) {
			return E('div', { 'class': 'cbi-section', 'style': 'padding:12px' }, [
				E('span', { 'class': 'cbi-value-status', 'style': 'color:var(--primary,#666);font-weight:bold' },
					_('No modem device detected.'))
			]);
		}

		if (self._error) {
			return E('div', { 'class': 'cbi-section', 'style': 'padding:12px' }, [
				E('span', { 'style': 'color:var(--error,#c00);font-weight:bold' }, _('Error: ') + self._error)
			]);
		}

		if (self._act == null) {
			return E('div', { 'class': 'cbi-section', 'style': 'padding:12px' }, [
				E('em', {}, _('Querying modem…'))
			]);
		}

		return E('table', { 'class': 'table' }, [
			E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td left', 'width': '30%' }, _('Operator')),
				E('td', { 'class': 'td left', 'id': 'netmode-op' }, self._operator || '—')
			]),
			E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td left' }, _('Network Mode')),
				E('td', { 'class': 'td left', 'id': 'netmode-act' }, [
					E('span', { 'class': 'cbi-value-status', 'style': 'font-weight:bold' }, actLabel(self._act))
				])
			])
		]);
	},

	_renderButtons: function() {
		var self = this;

		return E('div', { 'class': 'cbi-section', 'style': 'display:flex;flex-wrap:wrap;gap:8px' }, [
			self._btnEl('auto', _('Auto Network'), _('Let the modem select the best network automatically')),
			self._btnEl('4g',   _('4G LTE Only'),  _('Force LTE (E-UTRAN) only')),
			self._btnEl('3g',   _('3G Only'),      _('Force 3G (UTRAN) only'))
		]);
	},

	_btnEl: function(mode, label, help) {
		var self = this;
		var active = (actShort(self._act) === mode);
		var disabled = self._busy || self._act == null || !self._device || active;

		return E('button', {
			'class': 'cbi-button cbi-button-' + (active ? 'apply' : 'action'),
			'style': 'flex:1;min-width:160px;padding:10px 12px;text-align:center',
			'disabled': disabled ? 'disabled' : null,
			'click': function(ev) {
				ev.preventDefault();
				self._handleSwitch(mode);
			}
		}, [
			E('div', { 'style': 'font-size:15px;font-weight:bold' }, label),
			E('div', { 'style': 'font-size:11px;opacity:0.75;margin-top:3px' }, help)
		]);
	},

	_handleSwitch: function(mode) {
		var self = this;
		if (self._busy || !self._device) return;
		self._busy = true;

		var cmd = 'AT+COPS=0';
		if (mode === '4g') cmd = 'AT+COPS=0,,,7';
		else if (mode === '3g') cmd = 'AT+COPS=0,,,2';

		self._setMsg(_('Switching network mode…'));
		self._refreshUI();

		atCmd(self._device, cmd).then(function() {
			self._setMsg(_('Waiting for modem to register…'));
			return new Promise(function(resolve) {
				setTimeout(resolve, 2000);
			});
		}).then(function() {
			return atCmd(self._device, 'AT+COPS?');
		}).then(function(out) {
			var cops = copsParse(out);
			if (cops) {
				self._operator = cops.operator;
				self._act = cops.act;
				self._error = null;
				self._setMsg('');
			} else {
				self._setMsg(_('Mode switch sent, but could not read updated status'));
			}
		}).catch(function(err) {
			self._setMsg(_('Operation failed: ') + (err.message || _('unknown error')));
		}).then(function() {
			self._busy = false;
			self._refreshUI();
		});
	},

	_reQuery: function() {
		var self = this;
		if (!self._device) return;

		self._error = null;
		self._act = null;
		self._operator = null;
		self._refreshUI();

		atCmd(self._device, 'AT+COPS?').then(function(out) {
			var cops = copsParse(out);
			if (cops) {
				self._operator = cops.operator;
				self._act = cops.act;
				self._error = null;
			} else {
				self._error = _('Could not parse modem response');
			}
		}).catch(function(err) {
			self._error = err.message || _('AT command failed');
		}).then(function() {
			self._refreshUI();
		});
	},

	_setMsg: function(text) {
		var el = document.getElementById('netmode-msg');
		if (el) el.textContent = text;
	},

	_refreshUI: function() {
		var self = this;
		['netmode-status', 'netmode-buttons', 'netmode-port'].forEach(function(id) {
			var el = document.getElementById(id);
			if (!el) return;
			var fn = (id === 'netmode-status') ? '_renderStatus'
				: (id === 'netmode-buttons') ? '_renderButtons'
				: '_renderPortSelect';
			el.innerHTML = '';
			el.appendChild(self[fn]());
		});
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
