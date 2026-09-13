'use strict';
'require view';
'require rpc';
'require poll';

var callList = rpc.declare({
	object: 'luci.sfp-info',
	method: 'list',
	expect: { 'result': [] }
});

function mwToDbm(mw) {
	if (mw == null || mw <= 0)
		return null;

	return 10 * Math.log10(mw);
}

function fmtDate(code) {
	if (!code)
		return '-';

	var m = code.match(/^(\d{2})(\d{2})(\d{2})/);

	if (!m)
		return code;

	return '20' + m[1] + '-' + m[2] + '-' + m[3];
}

function fmtVal(val, unit, dec) {
	if (val == null)
		return '-';

	return val.toFixed(dec || 1) + ' ' + unit;
}

function rangeTip(lo, hi, unit, dec) {
	if (lo == null && hi == null)
		return '';

	dec = dec || 1;
	var l = lo != null ? lo.toFixed(dec) : '?';
	var h = hi != null ? hi.toFixed(dec) : '?';

	return _('Range') + ': ' + l + ' - ' + h + ' ' + unit;
}

return view.extend({
	load: function() {
		return callList();
	},

	render: function(data) {
		var modules = Array.isArray(data) ?
			data :
			((data && data.result) ? data.result : []);

		var tbl = E('table', { 'class': 'table cbi-section-table' }, [
			E('tr', { 'class': 'tr cbi-section-table-titles' }, [
				E('th', { 'class': 'th' }, _('Interface')),
				E('th', { 'class': 'th' }, _('Vendor')),
				E('th', { 'class': 'th' }, _('Type')),
				E('th', { 'class': 'th' }, _('Part Number')),
				E('th', { 'class': 'th' }, _('Date Code')),
				E('th', { 'class': 'th' }, _('Temperature')),
				E('th', { 'class': 'th' }, _('Voltage')),
				E('th', { 'class': 'th' }, _('Bias Current')),
				E('th', { 'class': 'th' }, _('TX Power')),
				E('th', { 'class': 'th' }, _('RX Power')),
				E('th', { 'class': 'th' }, _('Status')),
			])
		]);

		this._populateTable(tbl, modules);

		var view = E('div', {}, [
			E('h2', {}, _('SFP / QSFP Transceiver Information')),
			E('div', { 'class': 'cbi-section' }, [ tbl ])
		]);

		var self = this;
		poll.add(function() {
			return callList().then(function(res) {
				var mods = Array.isArray(res) ?
					res :
					((res && res.result) ? res.result : []);
				self._populateTable(tbl, mods);
			});
		}, 10);

		return view;
	},

	_populateTable: function(tbl, modules) {
		/* remove old data rows, keep header */
		var rows = tbl.querySelectorAll('tr:not(.cbi-section-table-titles)');
		rows.forEach(function(r) {
			r.remove();
		});

		if (!modules.length) {
			tbl.appendChild(E('tr', { 'class': 'tr placeholder' }, [
				E('td', { 'class': 'td', 'colspan': '11' },
					E('em', {},
						_('No SFP/QSFP modules detected.')))
			]));
			return;
		}

		for (var i = 0; i < modules.length; i++) {
			var row = this._renderRow(modules[i]);
			row.classList.add('cbi-rowstyle-' + ((i % 2) ? 2 : 1));
			tbl.appendChild(row);
		}
	},

	_renderRow: function(mod) {
		var d = mod.diagnostics || {};
		var thr = mod.thresholds || {};

		var type = (mod.identifier || '-');
		if (mod.connector)
			type += ' ' + mod.connector;
		if (mod.transceiver_type && mod.transceiver_type.length)
			type += ' \u00b7 ' + mod.transceiver_type.join(', ');

		var statusText = statusLabel(mod.alarms, mod.warnings);

		var tempTitle  = rangeTip(
			thr.temp_low_c, thr.temp_high_c, '\u00b0C');
		var voltTitle  = rangeTip(
			thr.voltage_low_v, thr.voltage_high_v, 'V');
		var biasTitle  = rangeTip(
			thr.tx_bias_low_ma, thr.tx_bias_high_ma, 'mA');
		var txTitle    = rangeTip(
			mwToDbm(thr.tx_power_low_mw),
			mwToDbm(thr.tx_power_high_mw),
			'dBm', 2);
		var rxTitle    = rangeTip(
			mwToDbm(thr.rx_power_low_mw),
			mwToDbm(thr.rx_power_high_mw),
			'dBm', 2);

		return E('tr', { 'class': 'tr' }, [
			E('td', { 'class': 'td' }, mod.iface),
			E('td', { 'class': 'td' }, mod.vendor_name || '-'),
			E('td', { 'class': 'td' }, type),
			E('td', { 'class': 'td' }, mod.vendor_pn || '-'),
			E('td', { 'class': 'td' }, fmtDate(mod.date_code)),
			E('td', { 'class': 'td', 'title': tempTitle },
				fmtVal(d.temperature_c, '\u00b0C', 1)),
			E('td', { 'class': 'td', 'title': voltTitle },
				fmtVal(d.voltage_v, 'V', 3)),
			E('td', { 'class': 'td', 'title': biasTitle },
				fmtVal(d.bias_current_ma, 'mA', 1)),
			E('td', { 'class': 'td', 'title': txTitle },
				fmtVal(d.tx_power_dbm, 'dBm', 2)),
			E('td', { 'class': 'td', 'title': rxTitle },
				fmtVal(d.rx_power_dbm, 'dBm', 2)),
			E('td', { 'class': 'td' }, statusText),
		]);
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});

function statusLabel(alarms, warnings) {
	var items = [];

	var L = {
		'temp_high':     _('Temperature high'),
		'temp_low':      _('Temperature low'),
		'voltage_high':  _('Voltage high'),
		'voltage_low':   _('Voltage low'),
		'tx_bias_high':  _('TX bias high'),
		'tx_bias_low':   _('TX bias low'),
		'tx_power_high': _('TX power high'),
		'tx_power_low':  _('TX power low'),
		'rx_power_high': _('RX power high'),
		'rx_power_low':  _('RX power low')
	};

	if (alarms) {
		for (var k in alarms) {
			if (alarms[k])
				items.push(E('span', { 'class': 'label notice' },
					L[k] || k.replace(/_/g, ' ')));
		}
	}

	if (!items.length && warnings) {
		for (var w in warnings) {
			if (warnings[w])
				items.push(E('span', { 'class': 'label warning' },
					L[w] || w.replace(/_/g, ' ')));
		}
	}

	if (items.length)
		return E('div', {}, items);

	return E('span', { 'class': 'label success' }, _('Normal'));
}
