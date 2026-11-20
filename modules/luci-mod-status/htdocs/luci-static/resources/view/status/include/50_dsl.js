'use strict';
'require baseclass';
'require network';
'require rpc';

var callDSLMetrics = rpc.declare({
	object: 'dsl',
	method: 'metrics',
	expect: { '': {} }
});

function format_values(format, val1, val2) {
	var val1Str = (val1 != null) ? format.format(val1) : '-';
	var val2Str = (val2 != null) ? format.format(val2) : '-';
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
			]),
			L.itemlist(E('span'), [
				_('Data Rate'), format_values('%1000.3mb/s', dsl.downstream.data_rate, dsl.upstream.data_rate),
				_('Noise Margin'), format_values('%.1f dB', dsl.downstream.snr, dsl.upstream.snr),
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
