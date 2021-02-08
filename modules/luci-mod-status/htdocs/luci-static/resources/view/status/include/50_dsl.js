'use strict';
'require baseclass';
'require rpc';

var callDSLMetrics = rpc.declare({
	object: 'dsl',
	method: 'metrics',
	expect: { '': {} }
});

function renderbox(dsl) {
	return E('div', { class: 'ifacebox' }, [
		E('div', { class: 'ifacebox-head center ' + (dsl.up ? 'active' : '') },
			E('strong', _('DSL Status'))),
		E('div', { class: 'ifacebox-body left' }, [
			L.itemlist(E('span'), [
				_('Line State'), dsl.state || '-',
				_('Line Mode'), dsl.mode || '-',
				_('Line Uptime'), '%t'.format(dsl.uptime),
				_('Annex'), dsl.annex || '-',
				_('Data Rate'), '%1000.3mb/s / %1000.3mb/s'.format(dsl.downstream.data_rate, dsl.upstream.data_rate),
				_('Max. Attainable Data Rate (ATTNDR)'), '%1000.3mb/s / %1000.3mb/s'.format(dsl.downstream.attndr, dsl.upstream.attndr),
				_('Latency'), '%.2f ms / %.2f ms'.format(dsl.downstream.interleave_delay / 1000, dsl.upstream.interleave_delay / 1000),
				_('Line Attenuation (LATN)'), '%.1f dB / %.1f dB'.format(dsl.downstream.latn, dsl.upstream.latn),
				_('Signal Attenuation (SATN)'), '%.1f dB / %.1f dB'.format(dsl.downstream.satn, dsl.upstream.satn),
				_('Noise Margin (SNR)'), '%.1f dB / %.1f dB'.format(dsl.downstream.snr, dsl.upstream.snr),
				_('Aggregate Transmit Power (ACTATP)'), '%.1f dB / %.1f dB'.format(dsl.downstream.actatp, dsl.upstream.actatp),
				_('Forward Error Correction Seconds (FECS)'), '%d / %d'.format(dsl.errors.near.fecs, dsl.errors.far.fecs),
				_('Errored seconds (ES)'), '%d / %d'.format(dsl.errors.near.es, dsl.errors.far.es),
				_('Severely Errored Seconds (SES)'), '%d / %d'.format(dsl.errors.near.ses, dsl.errors.far.ses),
				_('Loss of Signal Seconds (LOSS)'), '%d / %d'.format(dsl.errors.near.loss, dsl.errors.far.loss),
				_('Unavailable Seconds (UAS)'), '%d / %d'.format(dsl.errors.near.uas, dsl.errors.far.uas),
				_('Header Error Code Errors (HEC)'), '%d / %d'.format(dsl.errors.near.hec, dsl.errors.far.hec),
				_('Non Pre-emptive CRC errors (CRC_P)'), '%d / %d'.format(dsl.errors.near.crc_p, dsl.errors.far.crc_p),
				_('Pre-emptive CRC errors (CRCP_P)'), '%d / %d'.format(dsl.errors.near.crcp_p, dsl.errors.far.crcp_p),
				_('ATU-C System Vendor ID'), dsl.atu_c.vendor || dsl.atu_c.vendor_id,
				_('Power Management Mode'), dsl.power_state
			])
		])
	]);
}

return baseclass.extend({
	title: _('DSL'),

	load: function() {
		return L.resolveDefault(callDSLMetrics(), {});
	},

	render: function(dsl) {
		if (!dsl.state)
			return null;

		return E('div', { 'id': 'dsl_status_table', 'class': 'network-status-table' }, renderbox(dsl));
	}
});
