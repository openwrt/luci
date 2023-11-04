'use strict';
'require uci';
'require view';
'require dawn.dawn-common as dawn';

return view.extend({
	handleSaveApply: null,
	handleSave: null,
	handleReset: null,

	load: function() {
		return Promise.all([
			dawn.callDawnGetHearingMap(),
			dawn.callHostHints()
		]);
	},

	render: function(data) {

		const dawnHearingMapData = data[0];
		const hostHintsData = data[1];

		const body = E([
			E('h2', _('Hearing Map'))
		]);

		for (let network in dawnHearingMapData) {
			
			body.appendChild(
				E('h3', 'SSID: ' + network)
			);

			let hearing_map_table = E('table', { 'class': 'table cbi-section-table' }, [
				E('tr', { 'class': 'tr table-titles' }, [
					E('th', { 'class': 'th' }, _('Client')),
					E('th', { 'class': 'th' }, _('Access Point')),
					E('th', { 'class': 'th' }, _('Frequency')),
					E('th', { 'class': 'th' }, E('span', { 'data-tooltip': _('High Throughput') }, [ _('HT') ])),
					E('th', { 'class': 'th' }, E('span', { 'data-tooltip': _('Very High Throughput') }, [ _('VHT') ])),
					E('th', { 'class': 'th' }, _('Signal')),
					E('th', { 'class': 'th' }, E('span', { 'data-tooltip': _('Received Channel Power Indication') }, [ _('RCPI') ])),
					E('th', { 'class': 'th' }, E('span', { 'data-tooltip': _('Received Signal to Noise Indicator') }, [ _('RSNI') ])),
					E('th', { 'class': 'th' }, _('Channel Utilization')),
					E('th', { 'class': 'th' }, _('Stations Connected')),
					E('th', { 'class': 'th' }, _('Score'))
				])
			]);

			let clients = Object.entries(dawnHearingMapData[network]).map(function(client) {
				
				return Object.entries(client[1]).map(function(ap) {

					if (ap[1].freq != 0) {
						return [
							dawn.getHostnameFromMAC(hostHintsData, client[0]),
							dawn.getHostnameFromMAC(hostHintsData, ap[0]),
							dawn.getFormattedNumber(ap[1].freq, 3, 1000) + ' GHz (' + _('Channel') + ': ' + dawn.getChannelFromFrequency(ap[1].freq) + ')',
							dawn.getAvailableText(ap[1].ht_capabilities && ap[1].ht_support),
							dawn.getAvailableText(ap[1].vht_capabilities && ap[1].vht_support),
							ap[1].signal,
							ap[1].rcpi,
							ap[1].rsni,
							dawn.getFormattedNumber(ap[1].channel_utilization, 2, 2.55) + '%',
							ap[1].num_sta,
							ap[1].score
						]
					}
				}).flat()
				
			});

			cbi_update_table(hearing_map_table, clients, E('em', _('No clients connected.')));

			body.appendChild(hearing_map_table);
		}
		return body;
	}
});
