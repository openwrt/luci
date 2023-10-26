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
			dawn.callDawnGetNetwork(),
			dawn.callHostHints()
		]);
	},

	render: function(data) {

		const dawnNetworkData = data[0];
		const hostHintsData = data[1];

		const body = E([
			E('h2', _('Network Overview'))
		]);

		let client_table = {};

		for (let network in dawnNetworkData) {
			
			body.appendChild(
				E('h3', 'SSID: ' + network)
			);

			let ap_table = E('table', { 'class': 'table cbi-section-table' }, [
				E('tr', { 'class': 'tr table-titles' }, [
					E('th', { 'class': 'th left cbi-section-actions' }, _('Access Point')),
					E('th', { 'class': 'th left cbi-section-actions' }, _('Interface')),
					E('th', { 'class': 'th left cbi-section-actions' }, _('MAC')),
					E('th', { 'class': 'th left cbi-section-actions' }, _('Utilization')),
					E('th', { 'class': 'th left cbi-section-actions' }, _('Frequency')),
					E('th', { 'class': 'th left cbi-section-actions' }, _('Stations Connected')),
					E('th', { 'class': 'th left cbi-section-actions' }, E('span', { 'data-tooltip': _('High Throughput') }, [ _('HT') ])),
					E('th', { 'class': 'th left cbi-section-actions' }, E('span', { 'data-tooltip': _('Very High Throughput') }, [ _('VHT') ])),
					E('th', { 'class': 'th center cbi-section-actions' }, _('Clients')),
				])
			]);

			let aps = Object.entries(dawnNetworkData[network]).map(function(ap) {
				client_table[ap[0]] = E('table', { 'class': 'table cbi-section-table', 'style': 'display: table' }, [
					E('tr', { 'class': 'tr table-titles' }, [
						E('th', { 'class': 'th' }, _('Client')),
						E('th', { 'class': 'th' }, E('span', { 'data-tooltip': _('High Throughput') }, [ _('HT') ])),
						E('th', { 'class': 'th' }, E('span', { 'data-tooltip': _('Very High Throughput') }, [ _('VHT') ])),
						E('th', { 'class': 'th' }, _('Signal'))
					])
				]);

				let clients = [];
				let clientData = Object.entries(ap[1]);
				for (let i = 0; i < clientData.length; i++) {
					if (typeof clientData[i][1] === 'object') {
						clients.push([
							dawn.getHostnameFromMAC(hostHintsData ,clientData[i][0]),
							dawn.getAvailableText(clientData[i][1].ht),
							dawn.getAvailableText(clientData[i][1].vht),
							clientData[i][1].signal
						]);
					}
				}

				cbi_update_table(client_table[ap[0]], clients, E('em', _('No clients connected.')));
			
				return [
					ap[1].hostname,
					ap[1].iface,
					ap[0],
					dawn.getFormattedNumber(ap[1].channel_utilization, 2, 2.55) + '%',
					dawn.getFormattedNumber(ap[1].freq, 3, 1000) + ' GHz (' + _('Channel') + ': ' + dawn.getChannelFromFrequency(ap[1].freq) + ')',
					ap[1].num_sta,
					dawn.getAvailableText(ap[1].ht_support),
					dawn.getAvailableText(ap[1].vht_support),
					ap[1].num_sta > 0 ? client_table[ap[0]] : E('em', { 'style': 'display: inline' }, _('No clients connected.'))
				]
			});

			cbi_update_table(ap_table, aps, E('em', _('No access points available.')));
			
			body.appendChild(ap_table);
		}
		return body;
	}
});
