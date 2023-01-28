'use strict';
'require baseclass';
'require network';
'require rpc';

var callDSLMetrics = rpc.declare({
	object: 'dsl',
	method: 'metrics',
	expect: { '': {} }
});

function format_latency(val) {
	return '%.2f ms'.format(val / 1000);
}

function format_values(format, val1, val2) {
	var val1Str = (val1 != null) ? format.format(val1) : '-';
	var val2Str = (val2 != null) ? format.format(val2) : '-';
	return val1Str + ' / ' + val2Str;
}
function format_values_func(func, val1, val2) {
	var val1Str = (val1 != null) ? func(val1) : '-';
	var val2Str = (val2 != null) ? func(val2) : '-';
	return val1Str + ' / ' + val2Str;
}

function renderbox(dsl) {
	return E('div', { class: 'ifacebox' }, [
		E('div', { class: 'ifacebox-head center ' + (dsl.up ? 'active' : '') },
			E('strong', _('DSL Status'))),
		E('div', { class: 'ifacebox-body left' }, [
			L.itemlist(E('span'), [
				_('Line State'), dsl.state || '-',
				_('Line Mode'), dsl.mode || '-',
				_('Line Uptime'), '%t'.format(dsl.uptime),
				_('Annex'), dsl.annex || '-'
			]),
			L.itemlist(E('span'), [
				_('Data Rate'), format_values('%1000.3mb/s', dsl.downstream.data_rate, dsl.upstream.data_rate),
				_('Max. Attainable Data Rate (ATTNDR)'), format_values('%1000.3mb/s', dsl.downstream.attndr, dsl.upstream.attndr),
				_('Latency'), format_values_func(format_latency, dsl.downstream.interleave_delay, dsl.upstream.interleave_delay)
			]),
			L.itemlist(E('span'), [
				_('Line Attenuation (LATN)'), format_values('%.1f dB', dsl.downstream.latn, dsl.upstream.latn),
				_('Signal Attenuation (SATN)'), format_values('%.1f dB', dsl.downstream.satn, dsl.upstream.satn),
				_('Noise Margin (SNR)'), format_values('%.1f dB', dsl.downstream.snr, dsl.upstream.snr),
				_('Aggregate Transmit Power (ACTATP)'), format_values('%.1f dB', dsl.downstream.actatp, dsl.upstream.actatp)
			]),
			L.itemlist(E('span'), [
				_('Forward Error Correction Seconds (FECS)'), format_values('%d', dsl.errors.near.fecs, dsl.errors.far.fecs),
				_('Errored seconds (ES)'), format_values('%d', dsl.errors.near.es, dsl.errors.far.es),
				_('Severely Errored Seconds (SES)'), format_values('%d', dsl.errors.near.ses, dsl.errors.far.ses),
				_('Loss of Signal Seconds (LOSS)'), format_values('%d', dsl.errors.near.loss, dsl.errors.far.loss),
				_('Unavailable Seconds (UAS)'), format_values('%d', dsl.errors.near.uas, dsl.errors.far.uas)
			]),
			L.itemlist(E('span'), [
				_('Header Error Code Errors (HEC)'), format_values('%d', dsl.errors.near.hec, dsl.errors.far.hec),
				_('Non Pre-emptive CRC errors (CRC_P)'), format_values('%d', dsl.errors.near.crc_p, dsl.errors.far.crc_p),
				_('Pre-emptive CRC errors (CRCP_P)'), format_values('%d', dsl.errors.near.crcp_p, dsl.errors.far.crcp_p)
			]),
			L.itemlist(E('span'), [
				_('ATU-C System Vendor ID'), dsl.atu_c.vendor || dsl.atu_c.vendor_id
			]),
			L.itemlist(E('span'), [
				_('Power Management Mode'), dsl.power_state
			])
		])
	]);
}

return baseclass.extend({
	title: _('DSL'),

	load: function() {
		return network.getDSLModemType().then(function(type) {
			if (!type)
				return Promise.reject();

			return L.resolveDefault(callDSLMetrics(), {});
		});
	},

	render: function(dsl) {
		if (!dsl.state)
			return null;

		return E('div', { 'id': 'dsl_status_table', 'class': 'network-status-table' }, renderbox(dsl));
	}
});
