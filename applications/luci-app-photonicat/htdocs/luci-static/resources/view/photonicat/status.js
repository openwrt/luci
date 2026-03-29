'use strict';
'require view';
'require rpc';
'require poll';
'require dom';

const callGetStatus = rpc.declare({
	object: 'luci.photonicat',
	method: 'get_status'
});

const callSetFanMode = rpc.declare({
	object: 'luci.photonicat',
	method: 'set_fan_mode',
	params: ['mode']
});

const callSetFanLevel = rpc.declare({
	object: 'luci.photonicat',
	method: 'set_fan_level',
	params: ['level']
});

const callSetFanCurve = rpc.declare({
	object: 'luci.photonicat',
	method: 'set_fan_curve',
	params: ['min_temp', 'max_temp', 'hysteresis']
});

const callSetCPUGovernor = rpc.declare({
	object: 'luci.photonicat',
	method: 'set_cpu_governor',
	params: ['governor']
});

const callGetDisplayConfig = rpc.declare({
	object: 'luci.photonicat',
	method: 'get_display_config'
});

const callSetDisplayConfig = rpc.declare({
	object: 'luci.photonicat',
	method: 'set_display_config',
	params: ['backlight', 'refresh', 'theme', 'font_scale', 'pages']
});

/* ── helpers ─────────────────────────────────────────────── */

function tempColor(temp) {
	if (temp < 40) return '#4CAF50';
	if (temp < 55) return '#8BC34A';
	if (temp < 65) return '#FFC107';
	if (temp < 75) return '#FF9800';
	if (temp < 85) return '#FF5722';
	return '#F44336';
}

function bar(pct, color) {
	return E('div', {
		'style': 'background:#e0e0e0; border-radius:4px; overflow:hidden; height:18px;'
	}, [
		E('div', {
			'style': 'background:' + color + '; width:' + Math.max(0, Math.min(100, pct)) +
				'%; height:100%; border-radius:4px; transition:width 0.6s ease;'
		})
	]);
}

function tempBar(temp) {
	return bar(Math.min(100, temp), tempColor(temp));
}

function row(label, value) {
	return E('div', { 'class': 'tr' }, [
		E('div', { 'class': 'td', 'style': 'width:160px; font-weight:bold; padding:6px 8px;' }, label),
		E('div', { 'class': 'td', 'style': 'padding:6px 8px;' }, value)
	]);
}

function section(title, content) {
	return E('div', { 'class': 'cbi-section' }, [
		E('h3', {}, title),
		E('div', { 'class': 'cbi-section-node' }, [
			E('div', { 'class': 'table' }, content)
		])
	]);
}

/* ── view ────────────────────────────────────────────────── */

return view.extend({
	_status: {},
	_displayConfig: {},
	_fanModeButtons: {},
	_fanLevelSlider: null,
	_fanLevelLabel: null,
	_govSelect: null,

	load: function() {
		return Promise.all([callGetStatus(), callGetDisplayConfig()]);
	},

	render: function(data) {
		this._status = data[0] || {};
		this._displayConfig = data[1] || {};

		let statusDiv = E('div', { 'id': 'pcat-status' });
		let controlsDiv = E('div', { 'id': 'pcat-controls' });

		this.updateStatus(statusDiv);
		this.renderControls(controlsDiv);

		poll.add(L.bind(function() {
			return callGetStatus().then(L.bind(function(s) {
				this._status = s;
				let el = document.getElementById('pcat-status');
				if (el) this.updateStatus(el);
				this.syncControlState();
			}, this));
		}, this), 5);

		return E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, _('Photonicat 2')),
			E('div', { 'class': 'cbi-map-descr' },
				_('System dashboard and hardware control for the Photonicat 2 SBC.')),
			statusDiv,
			controlsDiv
		]);
	},

	/* ── status display (rebuilt every poll) ──────────────── */

	updateStatus: function(container) {
		if (!container) return;
		let s = this._status;
		dom.content(container, [
			this.renderPower(s),
			this.renderTemps(s),
			this.renderFanStatus(s),
			this.renderCPUStatus(s)
		]);
	},

	renderPower: function(s) {
		let bat = s.battery || {};
		let chg = s.charger || {};

		let pct = (bat.capacity != null) ? bat.capacity : null;
		let batStatus = bat.status || 'Unknown';
		let volts = (bat.voltage != null) ? bat.voltage.toFixed(2) + ' V' : '--';
		let amps  = (bat.current != null) ? Math.abs(bat.current).toFixed(2) + ' A' : '--';
		let batColor = (pct > 50) ? '#4CAF50' : (pct > 20) ? '#FFC107' : '#F44336';
		let chgText = chg.online ? _('Connected') : _('Disconnected');

		let rows = [];

		if (pct != null) {
			rows.push(row(_('Battery'), [
				E('span', { 'style': 'font-size:1.2em; font-weight:bold;' }, pct + '%'),
				E('span', { 'style': 'margin-left:12px; color:#666;' }, batStatus)
			]));
			rows.push(E('div', { 'class': 'tr' }, [
				E('div', { 'class': 'td' }, ''),
				E('div', { 'class': 'td', 'style': 'padding:2px 8px 6px;' }, [bar(pct, batColor)])
			]));
			rows.push(row('', [
				E('span', {}, volts),
				E('span', { 'style': 'margin-left:20px;' }, amps)
			]));
		}

		rows.push(row(_('Charger'), chgText));

		return section(_('Power'), rows);
	},

	renderTemps: function(s) {
		let zones = s.thermal_zones || [];
		let board = s.board_temp;
		let rows = [];

		if (board != null) {
			rows.push(E('div', { 'class': 'tr' }, [
				E('div', { 'class': 'td', 'style': 'width:160px; padding:6px 8px;' }, _('Board (MCU)')),
				E('div', { 'class': 'td', 'style': 'width:70px; text-align:right; font-weight:bold; color:' +
					tempColor(board) + '; padding:6px 4px;' }, board.toFixed(0) + '\u00b0C'),
				E('div', { 'class': 'td', 'style': 'padding:6px 8px;' }, [tempBar(board)])
			]));
		}

		for (let i = 0; i < zones.length; i++) {
			let z = zones[i];
			rows.push(E('div', { 'class': 'tr' }, [
				E('div', { 'class': 'td', 'style': 'width:160px; padding:6px 8px;' }, z.type || ('Zone ' + i)),
				E('div', { 'class': 'td', 'style': 'width:70px; text-align:right; font-weight:bold; color:' +
					tempColor(z.temp) + '; padding:6px 4px;' }, z.temp.toFixed(0) + '\u00b0C'),
				E('div', { 'class': 'td', 'style': 'padding:6px 8px;' }, [tempBar(z.temp)])
			]));
		}

		return section(_('Temperatures'), rows);
	},

	renderFanStatus: function(s) {
		let rpm   = (s.fan_rpm != null) ? s.fan_rpm + ' RPM' : '--';
		let level = (s.fan_level != null) ? s.fan_level : '--';
		let max   = s.fan_max_level || 9;
		let cfg   = s.fan_config || {};

		return section(_('Fan'), [
			row(_('Speed'), rpm),
			row(_('Level'), level + ' / ' + max +
				'  (' + (cfg.mode || 'auto') + ' mode)')
		]);
	},

	renderCPUStatus: function(s) {
		let cpu = s.cpu || {};
		let labels = { 'policy0': 'Cortex-A55 (Little)', 'policy4': 'Cortex-A76 (Big)' };
		let rows = [];

		for (let policy in cpu) {
			let p = cpu[policy];
			rows.push(row(labels[policy] || policy, [
				E('span', { 'style': 'font-weight:bold;' },
					(p.cur_freq || '--') + ' MHz'),
				E('span', { 'style': 'margin-left:12px; color:#666;' },
					p.governor || '--')
			]));
		}

		return section(_('CPU'), rows);
	},

	/* ── controls (built once, kept persistent) ──────────── */

	renderControls: function(container) {
		let s = this._status;
		let cfg = s.fan_config || {};
		let cpu = s.cpu || {};

		/* Fan mode buttons */
		let modes = ['auto', 'manual', 'off'];
		let modeButtons = [];
		for (let i = 0; i < modes.length; i++) {
			let m = modes[i];
			let btn = E('button', {
				'class': 'cbi-button' + (cfg.mode === m ? ' cbi-button-positive' : ''),
				'data-mode': m,
				'click': L.bind(this.handleFanMode, this, m),
				'style': 'margin-right:6px;'
			}, m.charAt(0).toUpperCase() + m.slice(1));
			this._fanModeButtons[m] = btn;
			modeButtons.push(btn);
		}

		/* Fan level slider (manual mode) */
		this._fanLevelLabel = E('span', { 'style': 'font-weight:bold; min-width:2em; display:inline-block;' },
			String(cfg.manual_level || 3));

		this._fanLevelSlider = E('input', {
			'type': 'range', 'min': '0', 'max': '9',
			'value': String(cfg.manual_level || 3),
			'style': 'width:200px; vertical-align:middle;',
			'input': L.bind(function(ev) {
				this._fanLevelLabel.textContent = ev.target.value;
			}, this),
			'change': L.bind(this.handleFanLevel, this)
		});

		let levelRow = E('div', {
			'class': 'cbi-value',
			'id': 'fan-level-row',
			'style': cfg.mode === 'manual' ? '' : 'display:none;'
		}, [
			E('label', { 'class': 'cbi-value-title' }, _('Fan Level')),
			E('div', { 'class': 'cbi-value-field' }, [
				this._fanLevelSlider,
				E('span', { 'style': 'margin-left:10px;' }, [
					this._fanLevelLabel, E('span', {}, ' / 9')
				])
			])
		]);

		/* Fan curve inputs (auto mode) */
		let minInput  = E('input', { 'type': 'number', 'class': 'cbi-input-text',
			'id': 'fc-min', 'value': String(cfg.min_temp || 45),
			'style': 'width:60px;', 'min': '20', 'max': '80' });
		let maxInput  = E('input', { 'type': 'number', 'class': 'cbi-input-text',
			'id': 'fc-max', 'value': String(cfg.max_temp || 85),
			'style': 'width:60px;', 'min': '50', 'max': '110' });
		let hystInput = E('input', { 'type': 'number', 'class': 'cbi-input-text',
			'id': 'fc-hyst', 'value': String(cfg.hysteresis || 3),
			'style': 'width:60px;', 'min': '1', 'max': '15' });

		let curveRow = E('div', {
			'class': 'cbi-value',
			'id': 'fan-curve-row',
			'style': cfg.mode === 'auto' ? '' : 'display:none;'
		}, [
			E('label', { 'class': 'cbi-value-title' }, _('Fan Curve')),
			E('div', { 'class': 'cbi-value-field', 'style': 'display:flex; align-items:center; flex-wrap:wrap; gap:6px;' }, [
				E('span', {}, _('Start')), minInput, E('span', {}, '\u00b0C'),
				E('span', { 'style': 'margin-left:8px;' }, _('Max')), maxInput, E('span', {}, '\u00b0C'),
				E('span', { 'style': 'margin-left:8px;' }, _('Hyst')), hystInput, E('span', {}, '\u00b0C'),
				E('button', {
					'class': 'cbi-button cbi-button-apply',
					'style': 'margin-left:12px;',
					'click': L.bind(this.handleFanCurve, this)
				}, _('Apply'))
			])
		]);

		/* CPU governor selector */
		let govs = [];
		let currentGov = '';
		for (let p in cpu) {
			if (cpu[p].governors && cpu[p].governors.length)
				govs = cpu[p].governors;
			if (cpu[p].governor)
				currentGov = cpu[p].governor;
		}

		this._govSelect = E('select', {
			'class': 'cbi-input-select',
			'change': L.bind(this.handleGovernor, this)
		});
		for (let j = 0; j < govs.length; j++) {
			let opt = E('option', { 'value': govs[j] }, govs[j]);
			if (govs[j] === currentGov) opt.selected = true;
			this._govSelect.appendChild(opt);
		}

		dom.content(container, [
			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, _('Fan Control')),
				E('div', { 'class': 'cbi-section-node' }, [
					E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title' }, _('Mode')),
						E('div', { 'class': 'cbi-value-field' }, modeButtons)
					]),
					levelRow,
					curveRow
				])
			]),
			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, _('CPU Governor')),
				E('div', { 'class': 'cbi-section-node' }, [
					E('div', { 'class': 'cbi-value' }, [
						E('label', { 'class': 'cbi-value-title' }, _('Governor')),
						E('div', { 'class': 'cbi-value-field' }, [
							this._govSelect,
							E('span', { 'style': 'margin-left:12px; color:#666;' },
								_('Applies to all CPU clusters'))
						])
					])
				])
			]),
			this.renderDisplayControls()
		]);
	},

	/* ── sync control visual state after poll ────────────── */

	syncControlState: function() {
		let mode = (this._status.fan_config || {}).mode || 'auto';

		for (let m in this._fanModeButtons) {
			this._fanModeButtons[m].className =
				'cbi-button' + (m === mode ? ' cbi-button-positive' : '');
		}

		let lr = document.getElementById('fan-level-row');
		if (lr) lr.style.display = (mode === 'manual') ? '' : 'none';

		let cr = document.getElementById('fan-curve-row');
		if (cr) cr.style.display = (mode === 'auto') ? '' : 'none';
	},

	/* ── event handlers ──────────────────────────────────── */

	handleFanMode: function(mode) {
		callSetFanMode(mode).then(L.bind(function() {
			this._status.fan_config = this._status.fan_config || {};
			this._status.fan_config.mode = mode;
			this.syncControlState();
		}, this));
	},

	handleFanLevel: function(ev) {
		let level = parseInt(ev.target.value);
		callSetFanLevel(level);
	},

	handleFanCurve: function() {
		let min  = parseInt(document.getElementById('fc-min').value)  || 45;
		let max  = parseInt(document.getElementById('fc-max').value)  || 85;
		let hyst = parseInt(document.getElementById('fc-hyst').value) || 3;
		callSetFanCurve(min, max, hyst);
	},

	handleGovernor: function(ev) {
		callSetCPUGovernor(ev.target.value);
	},

	/* ── Display controls ────────────────────────────────── */

	renderDisplayControls: function() {
		let dc = this._displayConfig;
		let allPages = ['dashboard', 'clock', 'battery', 'network', 'wifi', 'thermal', 'system', 'custom'];
		let activePages = dc.pages || ['dashboard'];
		let themes = ['dark', 'light', 'green', 'cyan', 'amber'];

		/* Backlight toggle */
		let blOn  = E('button', {
			'class': 'cbi-button' + (dc.backlight ? ' cbi-button-positive' : ''),
			'click': L.bind(this.handleDisplayApply, this, { backlight: 1 }),
			'style': 'margin-right:6px;'
		}, _('On'));
		let blOff = E('button', {
			'class': 'cbi-button' + (!dc.backlight ? ' cbi-button-positive' : ''),
			'click': L.bind(this.handleDisplayApply, this, { backlight: 0 }),
			'style': 'margin-right:6px;'
		}, _('Off'));

		/* Theme selector */
		let themeSelect = E('select', {
			'class': 'cbi-input-select',
			'id': 'disp-theme',
			'change': L.bind(function(ev) {
				this.handleDisplayApply({ theme: ev.target.value });
			}, this)
		});
		for (let i = 0; i < themes.length; i++) {
			let opt = E('option', { 'value': themes[i] }, themes[i].charAt(0).toUpperCase() + themes[i].slice(1));
			if (themes[i] === (dc.theme || 'dark')) opt.selected = true;
			themeSelect.appendChild(opt);
		}

		/* Refresh rate */
		let refreshLabel = E('span', { 'style': 'font-weight:bold; min-width:2em; display:inline-block;' },
			String(dc.refresh || 5));
		let refreshSlider = E('input', {
			'type': 'range', 'min': '1', 'max': '30',
			'value': String(dc.refresh || 5),
			'style': 'width:200px; vertical-align:middle;',
			'id': 'disp-refresh',
			'input': L.bind(function(ev) {
				refreshLabel.textContent = ev.target.value;
			}, this),
			'change': L.bind(function(ev) {
				this.handleDisplayApply({ refresh: parseInt(ev.target.value) });
			}, this)
		});

		/* Font scale */
		let scaleSelect = E('select', {
			'class': 'cbi-input-select',
			'id': 'disp-scale',
			'change': L.bind(function(ev) {
				this.handleDisplayApply({ font_scale: parseFloat(ev.target.value) });
			}, this)
		});
		let scaleValues = [1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0];
		for (let si = 0; si < scaleValues.length; si++) {
			let sv = scaleValues[si];
			let sopt = E('option', { 'value': String(sv) }, sv.toFixed(1) + 'x');
			if (Math.abs(sv - (dc.font_scale || 1.0)) < 0.05) sopt.selected = true;
			scaleSelect.appendChild(sopt);
		}

		/* Pages checkboxes */
		/* note: when using the external display the power button cycles through
		   pages in the order listed here (short press advances, hold ≥3s to power
		   off) */
		let pageLabels = {
			dashboard: 'Dashboard', clock: 'Clock', battery: 'Battery', network: 'Network',
			wifi: 'WiFi', thermal: 'Thermal', system: 'System', custom: 'Custom'
		};
		let pageChecks = [];
		for (let p = 0; p < allPages.length; p++) {
			let pg = allPages[p];
			let checked = false;
			for (let k = 0; k < activePages.length; k++) {
				if (activePages[k] === pg) { checked = true; break; }
			}
			let cb = E('label', { 'style': 'margin-right:14px; white-space:nowrap;' }, [
				E('input', {
					'type': 'checkbox',
					'data-page': pg,
					'checked': checked ? '' : null,
					'change': L.bind(this.handlePagesChange, this),
					'style': 'margin-right:4px;'
				}),
				pageLabels[pg] || pg
			]);
			pageChecks.push(cb);
		}

		return E('div', { 'class': 'cbi-section' }, [
			E('h3', {}, _('Display')),
			E('div', { 'class': 'cbi-section-node' }, [
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title' }, _('Backlight')),
					E('div', { 'class': 'cbi-value-field' }, [blOn, blOff])
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title' }, _('Theme')),
					E('div', { 'class': 'cbi-value-field' }, [themeSelect])
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title' }, _('Refresh')),
					E('div', { 'class': 'cbi-value-field' }, [
						refreshSlider,
						E('span', { 'style': 'margin-left:10px;' }, [refreshLabel, E('span', {}, 's')])
					])
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title' }, _('Font Scale')),
					E('div', { 'class': 'cbi-value-field' }, [scaleSelect])
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title' }, _('Pages')),
					E('div', { 'class': 'cbi-value-field', 'style': 'display:flex; flex-wrap:wrap;' }, pageChecks)
				])
			])
		]);
	},

	handleDisplayApply: function(overrides) {
		let dc = this._displayConfig;
		let opts = {
			backlight:  (overrides.backlight != null) ? overrides.backlight : dc.backlight,
			refresh:    overrides.refresh || dc.refresh || 5,
			theme:      overrides.theme || dc.theme || 'dark',
			font_scale: (overrides.font_scale != null) ? overrides.font_scale : (dc.font_scale || 1.0),
			pages:      overrides.pages || dc.pages || ['dashboard'],
		};

		/* Update local cache */
		for (let k in overrides)
			dc[k] = overrides[k];

		callSetDisplayConfig(opts.backlight, opts.refresh, opts.theme, opts.font_scale, opts.pages);
	},

	handlePagesChange: function() {
		let allPages = ['dashboard', 'clock', 'battery', 'network', 'wifi', 'thermal', 'system', 'custom'];
		let selected = [];
		for (let i = 0; i < allPages.length; i++) {
			let cb = document.querySelector('input[data-page="' + allPages[i] + '"]');
			if (cb && cb.checked)
				selected.push(allPages[i]);
		}
		if (selected.length > 0)
			this.handleDisplayApply({ pages: selected });
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
