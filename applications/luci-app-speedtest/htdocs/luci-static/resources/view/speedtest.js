/* This is free software, licensed under the Apache License, Version 2.0
 *
 * Copyright (C) 2024 Hilman Maulana <hilman0.0maulana@gmail.com>
 */

'use strict';
'require view';
'require fs';

return view.extend({
	handleSaveApply: null,
	handleSave: null,
	handleReset: null,
	render: function() {
		var header = [
			E('h2', {'class': 'section-title'}, _('Speedtest')),
			E('div', {'class': 'cbi-map-descr'}, _('Here you can perform a speed test to measure the basic aspects of your network connection.'))
		];
		var select = [
			E('label', { 'class': 'cbi-input-label', 'for': 'speedtest-type', 'style': 'margin-right: 8px;'}, _('Test')),
			E('select', { 'id': 'speedtest-type', 'style': 'width:80%;'}, [
				E('option', { 'value': 'all', 'selected': 'selected'}, _('All')),
				E('option', { 'value': 'latency' }, _('Latency')),
				E('option', { 'value': 'download' }, _('Download')),
				E('option', { 'value': 'upload' }, _('Upload'))
			])
		];
		var status = [
			E('label', { 'class': 'cbi-input-label', 'style': 'margin-right: 8px;'}, _('Status')),
			E('em', { 'id': 'speedtest-status'}, _('Available'))
		];
		var table = [
			E('h3', {'class': 'section-title'}, _('Results')),
			E('table', {'class': 'table cbi-section-table'}, [
				E('tr', {'class': 'tr table-title'}, [
					E('th', {'class': 'th ', 'style': 'display: none;'})
				]),
				E('tr', {'class': 'tr cbi-rowstyle-1'},[
					E('td', {'class': 'td left', 'width': '50%'}, _('IP Address')),
					E('td', {'class': 'td', 'id': 'client-ip'}, '-')
				]),
				E('tr', {'class': 'tr cbi-rowstyle-2'},[
					E('td', {'class': 'td left', 'width': '50%'}, _('Provider')),
					E('td', {'class': 'td', 'id': 'client-isp'}, '-')
				]),
				E('tr', {'class': 'tr cbi-rowstyle-1'},[
					E('td', {'class': 'td left', 'width': '50%'}, _('Server')),
					E('td', {'class': 'td', 'id': 'server-name'}, '-')
				]),
				E('tr', {'class': 'tr cbi-rowstyle-2'},[
					E('td', {'class': 'td left', 'width': '50%'}, _('ID')),
					E('td', {'class': 'td', 'id': 'server-id'}, '-')
				]),
				E('tr', {'class': 'tr cbi-rowstyle-1'},[
					E('td', {'class': 'td left', 'width': '50%'}, _('Location')),
					E('td', {'class': 'td', 'id': 'server-location'}, '-')
				]),
				E('tr', {'class': 'tr cbi-rowstyle-2'},[
					E('td', {'class': 'td left', 'width': '50%'}, _('Server Host')),
					E('td', {'class': 'td', 'id': 'server-host'}, '-')
				]),
				E('tr', {'class': 'tr cbi-rowstyle-1'},[
					E('td', {'class': 'td left', 'width': '50%'}, _('Ping')),
					E('td', {'class': 'td', 'id': 'ping'}, '-')
				]),
				E('tr', {'class': 'tr cbi-rowstyle-2'},[
					E('td', {'class': 'td left', 'width': '50%'}, _('Jitter')),
					E('td', {'class': 'td', 'id': 'jitter'}, '-')
				]),
				E('tr', {'class': 'tr cbi-rowstyle-1'},[
					E('td', {'class': 'td left', 'width': '50%'}, _('Download Speed')),
					E('td', {'class': 'td', 'id': 'download'}, '-')
				]),
				E('tr', {'class': 'tr cbi-rowstyle-2'},[
					E('td', {'class': 'td left', 'width': '50%'}, _('Upload Speed')),
					E('td', {'class': 'td', 'id': 'upload'}, '-')
				])
			])
		];
		var running = false;
		var button = [
			E('button', {
				'class': 'btn cbi-button cbi-button-action',
				'click': function() {
					if (!running) {
						running = true;
						var dropdown = document.getElementById('speedtest-type');
						var value = dropdown.options[dropdown.selectedIndex].value;
						var command = ['--output', 'json'];
						if (value !== 'all') {
							command.push('--' + value);
						}

						var status = document.getElementById('speedtest-status');
						status.textContent = _('Running');

						fs.exec_direct('speedtest', command)
						.then(function(response) {
							var result = JSON.parse(response);
							document.getElementById('client-ip').textContent = result.client.ip;
							document.getElementById('client-isp').textContent = result.client.isp + ' [' + result.client.lat + ', ' + result.client.lon + ']';
							document.getElementById('server-name').textContent = result.server.sponsor;
							document.getElementById('server-id').textContent = result.server.id;
							document.getElementById('server-location').textContent = result.server.name + ' (' + result.server.distance + ' km)';
							document.getElementById('server-host').textContent = result.server.host;
							document.getElementById('ping').textContent = result.ping + ' ms';
							document.getElementById('jitter').textContent = result.jitter + ' ms';
							document.getElementById('download').textContent = result.download_mbit ? result.download_mbit + ' Mbit/s' : '-';
							document.getElementById('upload').textContent = result.upload_mbit ? result.upload_mbit + ' Mbit/s' : '-';
							status.textContent = _('Finished');
							running = false;
						})
						.catch(function(err) {
							if (!err.response) {
								status.textContent = _('No response received, please check your internet connection or try again later.');
							} else if (err.response.data && err.response.data.error === 'unable to retrieve your ip info') {
								status.textContent = _('Unable to retrieve IP information, please check your internet connection.');
							} else {
								status.textContent = err;
							}
							running = false;
						});
					}
				}
			}, _('Start'))
		];
		return E('div', {'class': 'cbi-map'}, [
			E(header),
			E('table', {'class': 'table'}, [
				E('tr', {'class': 'tr'}, [
					E('td', {'class': 'td', 'style': 'overflow:initial;'}, select),
					E('td', {'class': 'td', 'style': 'overflow:initial;'}, button),
					E('td', {'class': 'td'}, status)
				])
			]),
			E('div', {'class': 'cbi-section'}, [
				E('div', {'class': 'speedtest-info'}, table)
			])
		])
	}
})
