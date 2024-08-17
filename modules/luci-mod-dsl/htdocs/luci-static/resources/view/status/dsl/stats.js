'use strict';
'require view';
'require dom';
'require poll';
'require rpc';

var callDSLMetrics = rpc.declare({
	object: 'dsl',
	method: 'metrics',
	expect: { '': {} }
});

function format_on_off(val) {
	return val ? _('on') : _('off');
}

function format_latency(val) {
	return '%.2f ms'.format(val / 1000);
}

return view.extend({
	load: function() {
		return L.resolveDefault(callDSLMetrics(), {});
	},

	pollData: function(container) {
		poll.add(L.bind(function() {
			return L.resolveDefault(callDSLMetrics(), {}).then(L.bind(function(data) {
				dom.content(container, this.renderContent(data));
			}, this));
		}, this));
	},

	formatHelper: function(format, val) {
		if (val != null) {
			if (format instanceof Function) {
				return format(val);
			} else if (typeof format === 'string') {
				return format.format(val);
			} else {
				return val;
			}
		}
		return '-';
	},

	renderSimpleTable: function(data) {
		var table = E('table', { 'class': 'table' });

		for (var [i, item] of data.entries()) {
			var label = item[0];
			var val = item[1];

			var rowstyle = (i % 2 == 0) ? 'cbi-rowstyle-1' : 'cbi-rowstyle-2';

			table.appendChild(E('tr', { 'class': 'tr ' + rowstyle }, [
				E('td', { 'class': 'td left', 'width': '33%' }, [ label ]),
				E('td', { 'class': 'td left' }, [ this.formatHelper(null, val) ])
			]));
		}

		return E('div', { 'class': 'cbi-section' }, table);
	},

	renderTable: function(data) {
		var table = E('table', { 'class': 'table' });

		for (var [i, item] of data.entries()) {
			var label = item[0];
			var format = item[1];
			var val1 = item[2];
			var val2 = item[3];

			var rowstyle = (i % 2 == 0) ? 'cbi-rowstyle-1' : 'cbi-rowstyle-2';

			table.appendChild(E('tr', { 'class': 'tr ' + rowstyle }, [
				E('td', { 'class': 'td left', 'width': '33%' }, [ label ]),
				E('td', { 'class': 'td right', 'width': '33%' }, [ this.formatHelper(format, val1) ]),
				E('td', { 'class': 'td right', 'width': '33%' }, [ this.formatHelper(format, val2) ])
			]));
		}

		return E('div', { 'class': 'cbi-section' }, table);
	},

	renderContent: function(data) {
		return E([], [

			E('h3', {}, [ _('Connection State') ]),

			this.renderSimpleTable([
				[ _('Line State'), data.state ],
				[ _('Line Mode'), data.mode ],
				[ _('Line Uptime'), '%t'.format(data.uptime) ],
				[ _('Annex'), data.annex ],
				[ _('Power Management Mode'), data.power_state ]
			]),

			E('h3', {}, [ _('Inventory') ]),

			this.renderSimpleTable([
				[ _('Modem Chipset'), data.chipset ],
				[ _('Modem Firmware'), data.firmware_version ],
				[ _('xTU-C Vendor ID'), data.atu_c.vendor || data.atu_c.vendor_id ]
			]),

			E('h3', {}, [ _('Line Details') ]),

			E('h4', {}, [ _('Data Rates') ]),
			this.renderTable([
				[ _('Actual Data Rate'), '%1000.3mb/s', data.downstream.data_rate, data.upstream.data_rate ],
				[ _('Attainable Data Rate (ATTNDR)'), '%1000.3mb/s', data.downstream.attndr, data.upstream.attndr ],
				[ _('Minimum Error-Free Throughput (MINEFTR)'), '%1000.3mb/s', data.downstream.mineftr, data.upstream.mineftr ]
			]),

			E('h4', {}, [ _('On-line Reconfiguration') ]),
			this.renderTable([
				[ _('Bitswap'), format_on_off, data.downstream.bitswap, data.upstream.bitswap ],
				[ _('Rate Adaptation Mode'), '%s', data.downstream.ra_mode, data.upstream.ra_mode ]
			]),

			E('h4', {}, [ _('Noise Protection') ]),
			this.renderTable([
				[ _('Latency'), format_latency, data.downstream.interleave_delay, data.upstream.interleave_delay ],
				[ _('Impulse Noise Protection (INP)'), '%.1f symbols', data.downstream.inp, data.upstream.inp ],
				[ _('Retransmission (G.INP)'), format_on_off, data.downstream.retx, data.upstream.retx ]
			]),

			E('h4', {}, [ _('Line Parameters') ]),
			this.renderTable([
				[ _('Line Attenuation (LATN)'), '%.1f dB', data.downstream.latn, data.upstream.latn ],
				[ _('Signal Attenuation (SATN)'), '%.1f dB', data.downstream.satn, data.upstream.satn ],
				[ _('Noise Margin (SNRM)'), '%.1f dB', data.downstream.snr, data.upstream.snr ],
				[ _('Aggregate Transmit Power (ACTATP)'), '%.1f dB', data.downstream.actatp, data.upstream.actatp ]
			]),

			E('h3', {}, [ _('Error Counters') ]),

			E('h4', {}, [ _('Error Seconds') ]),
			this.renderTable([
				[ _('Forward Error Correction Seconds (FECS)'), '%d', data.errors.near.fecs, data.errors.far.fecs ],
				[ _('Errored Seconds (ES)'), '%d', data.errors.near.es, data.errors.far.es ],
				[ _('Severely Errored Seconds (SES)'), '%d', data.errors.near.ses, data.errors.far.ses ],
				[ _('Loss of Signal Seconds (LOSS)'), '%d', data.errors.near.loss, data.errors.far.loss ],
				[ _('Unavailable Seconds (UAS)'), '%d', data.errors.near.uas, data.errors.far.uas ],
				[ _('Seconds with Low Error-Free Throughput (LEFTRS)'), '%d', data.errors.near.leftrs, data.errors.far.leftrs ]
			]),

			E('h4', {}, [ _('Channel Counters') ]),
			this.renderTable([
				[ _('CRC Errors (CV-C)'), '%d', data.errors.near.cv_c, data.errors.far.cv_c ],
				[ _('Corrected by FEC (FEC-C)'), '%d', data.errors.near.fec_c, data.errors.far.fec_c ]
			]),

			E('h4', {}, [ _('Data Path Counters') ]),
			this.renderTable([
				[ _('ATM Header Error Control Errors (HEC-P)'), '%d', data.errors.near.hec, data.errors.far.hec ],
				[ _('PTM Non Pre-emptive CRC Errors (CRC-P)'), '%d', data.errors.near.crc_p, data.errors.far.crc_p ],
				[ _('PTM Pre-emptive CRC Errors (CRCP-P)'), '%d', data.errors.near.crcp_p, data.errors.far.crcp_p ]
			]),

			E('h4', {}, [ _('Retransmission Counters') ]),
			this.renderTable([
				[ _('Retransmitted DTUs (rtx-tx)'), '%d', data.errors.far.tx_retransmitted, data.errors.near.tx_retransmitted ],
				[ _('Corrected DTUs (rtx-c)'), '%d', data.errors.near.rx_corrected, data.errors.far.rx_corrected ],
				[ _('Uncorrected DTUs (rtx-uc)'), '%d', data.errors.near.rx_uncorrected_protected, data.errors.far.rx_uncorrected_protected ]
			])

		]);
	},

	render: function(data) {
		var v = E([], [
			E('h2', {}, [ _('DSL stats') ]),
			E('div')
		]);

		var container = v.lastElementChild;
		dom.content(container, this.renderContent(data));
		this.pollData(container);

		return v;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
