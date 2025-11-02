'use strict';
'require view';
'require fs';
'require ui';
'require uci';

/*
	button handling
*/
function handleAction(ev) {
	if (ev.target && ev.target.getAttribute('name') === 'blocklist') {
		ui.showModal(_('Add Blocklist Domain'), [
			E('p', _('Add this (sub-)domain to your local blocklist.')),
			E('div', { 'class': 'left', 'style': 'display:flex; flex-direction:column' }, [
				E('label', { 'class': 'cbi-input-text', 'style': 'padding-top:.5em' }, [
					E('input', { 'class': 'cbi-input-text', 'style': 'width:300px', 'spellcheck': 'false', 'id': 'blocklist', 'value': ev.target.getAttribute('value') }, [])
				])
			]),
			E('div', { 'class': 'right' }, [
				E('button', {
					'class': 'btn cbi-button',
					'click': ui.hideModal
				}, _('Cancel')),
				' ',
				E('button', {
					'class': 'btn cbi-button-action',
					'click': ui.createHandlerFn(this, function (ev) {
						L.resolveDefault(fs.read_direct('/etc/adblock/adblock.blocklist'), '')
							.then(function (res) {
								var domain = document.getElementById('blocklist').value.trim().toLowerCase().replace(/[^a-z0-9\.\-]/g, '');
								var pattern = new RegExp('^' + domain.replace(/[\.]/g, '\\.') + '$', 'm');
								if (res.search(pattern) === -1) {
									var blocklist = res + domain + '\n';
									fs.write('/etc/adblock/adblock.blocklist', blocklist);
									ui.addNotification(null, E('p', _('Blocklist modifications have been saved, reload adblock that changes take effect.')), 'info');
								}
								ui.hideModal();
							});
					})
				}, _('Save'))
			])
		]);
		document.getElementById('blocklist').focus();
	}

	if (ev.target && ev.target.getAttribute('name') === 'allowlist') {
		ui.showModal(_('Add Allowlist Domain'), [
			E('p', _('Add this (sub-)domain to your local allowlist.')),
			E('div', { 'class': 'left', 'style': 'display:flex; flex-direction:column' }, [
				E('label', { 'class': 'cbi-input-text', 'style': 'padding-top:.5em' }, [
					E('input', { 'class': 'cbi-input-text', 'style': 'width:300px', 'spellcheck': 'false', 'id': 'allowlist', 'value': ev.target.getAttribute('value') }, [])
				])
			]),
			E('div', { 'class': 'right' }, [
				E('button', {
					'class': 'btn cbi-button',
					'click': ui.hideModal
				}, _('Cancel')),
				' ',
				E('button', {
					'class': 'btn cbi-button-action',
					'click': ui.createHandlerFn(this, function (ev) {
						L.resolveDefault(fs.read_direct('/etc/adblock/adblock.allowlist'), '')
							.then(function (res) {
								var domain = document.getElementById('allowlist').value.trim().toLowerCase().replace(/[^a-z0-9\.\-]/g, '');
								var pattern = new RegExp('^' + domain.replace(/[\.]/g, '\\.') + '$', 'm');
								if (res.search(pattern) === -1) {
									var allowlist = res + domain + '\n';
									fs.write('/etc/adblock/adblock.allowlist', allowlist);
									ui.addNotification(null, E('p', _('Allowlist modifications have been saved, reload adblock that changes take effect.')), 'info');
								}
								ui.hideModal();
							});
					})
				}, _('Save'))
			])
		]);
		document.getElementById('allowlist').focus();
	}

	if (ev === 'query') {
		ui.showModal(_('Blocklist Query'), [
			E('p', _('Query active blocklists and backups for a specific domain.')),
			E('div', { 'class': 'left', 'style': 'display:flex; flex-direction:column' }, [
				E('label', { 'style': 'padding-top:.5em', 'id': 'run' }, [
					E('input', {
						'class': 'cbi-input-text',
						'placeholder': 'google.com',
						'style': 'width:300px',
						'spellcheck': 'false',
						'id': 'search'
					})
				])
			]),
			E('div', { 'class': 'left', 'style': 'display:flex; flex-direction:column' }, [
				'\xa0',
				E('h5', _('Result')),
				E('textarea', {
					'id': 'result',
					'style': 'width: 100% !important; padding: 5px; font-family: monospace',
					'readonly': 'readonly',
					'wrap': 'off',
					'rows': 20
				})
			]),
			E('div', { 'class': 'right' }, [
				E('button', {
					'class': 'btn cbi-button',
					'click': ui.hideModal
				}, _('Cancel')),
				' ',
				E('button', {
					'class': 'btn cbi-button-action',
					'click': ui.createHandlerFn(this, function (ev) {
						var domain = document.getElementById('search').value.trim().toLowerCase().replace(/[^a-z0-9\.\-]/g, '');
						if (domain) {
							document.getElementById('run').classList.add("spinning");
							document.getElementById('search').value = domain;
							document.getElementById('result').textContent = 'The query is running, please wait...';
							L.resolveDefault(fs.exec_direct('/etc/init.d/adblock', ['query', domain])).then(function (res) {
								var result = document.getElementById('result');
								if (res) {
									result.textContent = res.trim();
								} else {
									result.textContent = _('No Query results!');
								}
								document.getElementById('run').classList.remove("spinning");
								document.getElementById('search').value = '';
							})
						}
						document.getElementById('search').focus();
					})
				}, _('Query'))
			])
		]);
		document.getElementById('search').focus();
	}

	if (ev === 'refresh') {
		ui.showModal(_('Refresh DNS Report'), [
			E('div', { 'class': 'left', 'style': 'display:flex; flex-direction:column' }, [
				E('label', { 'class': 'cbi-input-select', 'style': 'padding-top:.5em' }, [
					E('select', { 'class': 'cbi-input-select', 'id': 'top_count' }, [
						E('option', { 'value': '10' }, '10'),
						E('option', { 'value': '20' }, '20'),
						E('option', { 'value': '30' }, '30'),
						E('option', { 'value': '40' }, '40'),
						E('option', { 'value': '50' }, '50')
					]),
					'\xa0\xa0\xa0',
					_('max. top statistics')
				])
			]),
			E('div', { 'class': 'left', 'style': 'display:flex; flex-direction:column' }, [
				E('label', { 'class': 'cbi-input-select', 'style': 'padding-top:.5em' }, [
					E('select', { 'class': 'cbi-input-select', 'id': 'res_count' }, [
						E('option', { 'value': '50' }, '50'),
						E('option', { 'value': '100' }, '100'),
						E('option', { 'value': '150' }, '150'),
						E('option', { 'value': '250' }, '250'),
						E('option', { 'value': '500' }, '500')
					]),
					'\xa0\xa0\xa0',
					_('max. result set size')
				])
			]),
			E('label', { 'class': 'cbi-input-text', 'style': 'padding-top:.5em' }, [
				E('input', { 'class': 'cbi-input-text', 'spellcheck': 'false', 'id': 'search' }, [
				]),
				'\xa0\xa0\xa0',
				_('Filter criteria like date, domain or client (optional)')
			]),
			E('div', { 'class': 'right' }, [
				E('button', {
					'class': 'btn cbi-button',
					'click': ui.hideModal
				}, _('Cancel')),
				' ',
				E('button', {
					'id': 'refresh',
					'class': 'btn cbi-button-action',
					'click': function () {
						document.querySelectorAll('.cbi-page-actions button').forEach(function (btn) {
							btn.disabled = true;
						})
						this.blur();
						this.classList.add('spinning');
						const top_count = document.getElementById('top_count').value;
						const res_count = document.getElementById('res_count').value;
						const search = document.getElementById('search').value.trim().replace(/[^\w\.\-\:]/g, '') || '+';
						L.resolveDefault(fs.exec_direct('/etc/init.d/adblock', ['report', 'gen', top_count, res_count, search]), '')
							.then(function () {
								location.reload();
							})
					}
				}, _('Refresh'))
			])
		]);
		document.getElementById('refresh').focus();
	}

	if (ev === 'map') {
		const modal = ui.showModal(null, [
			E('div', {
				id: 'mapModal',
				style: 'position: relative;'
			}, [
				E('iframe', {
					id: 'mapFrame',
					src: L.resource('view/adblock/map.html'),
					style: 'width: 100%; height: 80vh; border: none;'
				}),
			]),
			E('div', { 'class': 'right' }, [
				E('button', {
					'class': 'btn cbi-button',
					'click': ui.createHandlerFn(this, function (ev) {
						ui.hideModal();
						sessionStorage.clear();
						location.reload();
					})
				}, _('Cancel')),
				' ',
				E('button', {
					'class': 'btn cbi-button-action',
					'click': ui.createHandlerFn(this, function (ev) {
						const iframe = document.getElementById('mapFrame');
						iframe.contentWindow.location.reload();
					})
				}, _('Map Reset'))
			])
		]);
		modal.style.maxWidth = '90%';
		document.getElementById('mapModal').focus();
	}
}

return view.extend({
	load: function () {
		return Promise.all([
			L.resolveDefault(fs.exec_direct('/etc/init.d/adblock', ['report', 'json', '10', '50', '+']), ''),
			uci.load('adblock')
		]);
	},

	render: function (dnsreport) {
		let content = [], notMsg, errMsg;

		if (dnsreport) {
			try {
				content = JSON.parse(dnsreport[0]);
			} catch (e) {
				content[0] = "";
			}
		} else {
			content[0] = "";
		}

		var rows_top = [];
		var tbl_top = E('table', { 'class': 'table', 'id': 'top_10' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th right' }, _('Count')),
				E('th', { 'class': 'th' }, _('Clients')),
				E('th', { 'class': 'th right' }, _('Count')),
				E('th', { 'class': 'th' }, _('Domains')),
				E('th', { 'class': 'th right' }, _('Count')),
				E('th', { 'class': 'th' }, _('Blocked Domains'))
			])
		]);

		var max = 0;
		if (content[0].top_clients && content[0].top_domains && content[0].top_blocked) {
			max = Math.max(content[0].top_clients.length, content[0].top_domains.length, content[0].top_blocked.length);
		}
		for (var i = 0; i < max; i++) {
			var a_cnt = '\xa0', a_addr = '\xa0', b_cnt = '\xa0', b_addr = '\xa0', c_cnt = '\xa0', c_addr = '\xa0';
			if (content[0].top_clients[i]) {
				a_cnt = content[0].top_clients[i].count;
			}
			if (content[0].top_clients[i]) {
				a_addr = content[0].top_clients[i].address;
			}
			if (content[0].top_domains[i]) {
				b_cnt = content[0].top_domains[i].count;
			}
			if (content[0].top_domains[i]) {
				b_addr = '<a href="https://ip-api.com/#' + encodeURIComponent(content[0].top_domains[i].address) + '" target="_blank" rel="noreferrer noopener" title="Domain Lookup">' + content[0].top_domains[i].address + '</a>';
			}
			if (content[0].top_blocked[i]) {
				c_cnt = content[0].top_blocked[i].count;
			}
			if (content[0].top_blocked[i]) {
				c_addr = '<a href="https://ip-api.com/#' + encodeURIComponent(content[0].top_blocked[i].address) + '" target="_blank" rel="noreferrer noopener" title="Domain Lookup">' + content[0].top_blocked[i].address + '</a>';
			}
			rows_top.push([
				a_cnt,
				a_addr,
				b_cnt,
				b_addr,
				c_cnt,
				c_addr
			]);
		}
		cbi_update_table(tbl_top, rows_top);

		var rows_requests = [];
		var tbl_requests = E('table', { 'class': 'table', 'id': 'requests' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th' }, _('Date')),
				E('th', { 'class': 'th' }, _('Time')),
				E('th', { 'class': 'th' }, _('Client')),
				E('th', { 'class': 'th' }, _('Domain')),
				E('th', { 'class': 'th' }, _('Answer')),
				E('th', { 'class': 'th' }, _('Action'))
			])
		]);

		max = 0;
		if (content[0].requests) {
			var button;
			max = content[0].requests.length;
			for (var i = 0; i < max; i++) {
				if (content[0].requests[i].rc === 'NX') {
					button = E('button', {
						'class': 'btn cbi-button cbi-button-positive',
						'style': 'word-break: inherit',
						'name': 'allowlist',
						'value': content[0].requests[i].domain,
						'click': handleAction
					}, [_('Allowlist...')]);
				} else {
					button = E('button', {
						'class': 'btn cbi-button cbi-button-negative',
						'style': 'word-break: inherit',
						'name': 'blocklist',
						'value': content[0].requests[i].domain,
						'click': handleAction
					}, [_('Blocklist...')]);
				}
				rows_requests.push([
					content[0].requests[i].date,
					content[0].requests[i].time,
					content[0].requests[i].client,
					'<a href="https://ip-api.com/#' + encodeURIComponent(content[0].requests[i].domain) + '" target="_blank" rel="noreferrer noopener" title="Domain Lookup">' + content[0].requests[i].domain + '</a>',
					content[0].requests[i].rc,
					button
				]);
			}
		}
		cbi_update_table(tbl_requests, rows_requests);

		const page = E('div', { 'class': 'cbi-map', 'id': 'map' }, [
			E('div', { 'class': 'cbi-section' }, [
				E('p', _('This tab shows the last generated DNS Report, press the \'Refresh\' button to get a current one.')),
				E('p', '\xa0'),
				E('div', { 'class': 'cbi-value' }, [
					E('div', { 'class': 'cbi-value-title', 'style': 'float:left;width:230px' }, _('Start Timestamp')),
					E('div', { 'class': 'cbi-value-title', 'id': 'start', 'style': 'float:left;color:#37c' }, (content[0].start_date || '-') + ', ' + (content[0].start_time || '-'))
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('div', { 'class': 'cbi-value-title', 'style': 'float:left;width:230px' }, _('End Timestamp')),
					E('div', { 'class': 'cbi-value-title', 'id': 'end', 'style': 'float:left;color:#37c' }, (content[0].end_date || '-') + ', ' + (content[0].end_time || '-'))
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('div', { 'class': 'cbi-value-title', 'style': 'float:left;width:230px' }, _('Total DNS Requests')),
					E('div', { 'class': 'cbi-value-title', 'id': 'total', 'style': 'float:left;color:#37c' }, content[0].total || '-')
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('div', { 'class': 'cbi-value-title', 'style': 'float:left;width:230px' }, _('Blocked DNS Requests')),
					E('div', { 'class': 'cbi-value-title', 'id': 'blocked', 'style': 'float:left;color:#37c' }, (content[0].blocked || '-') + ' (' + (content[0].percent || '-') + ')')
				])
			]),
			E('div', { 'class': 'cbi-section' }, [
				E('div', { 'class': 'left' }, [
					E('h3', _('Top Statistics')),
					tbl_top
				])
			]),
			E('br'),
			E('div', { 'class': 'cbi-section' }, [
				E('div', { 'class': 'left' }, [
					E('h3', _('Latest DNS Requests')),
					tbl_requests
				])
			]),
			E('div', { 'class': 'cbi-page-actions' }, [
				E('button', {
					'class': 'btn cbi-button cbi-button-apply',
					'style': 'float:none;margin-right:.4em;',
					'id': 'btnMap',
					'disabled': 'disabled',
					'click': ui.createHandlerFn(this, function () {
						if (content[1] && content[1].length > 1) {
							sessionStorage.setItem('mapData', JSON.stringify(content[1]));
							return handleAction('map');
						}
						else {
							if (!notMsg) {
								notMsg = true;
								return ui.addNotification(null, E('p', _('No GeoIP Map data!')), 'info');
							}
						}
					})
				}, [_('Map...')]),
				E('button', {
					'class': 'btn cbi-button cbi-button-apply',
					'style': 'float:none;margin-right:.4em;',
					'click': ui.createHandlerFn(this, function () {
						return handleAction('query');
					})
				}, [_('Blocklist Query...')]),
				E('button', {
					'class': 'btn cbi-button cbi-button-positive important',
					'style': 'float:none;margin-right:.4em;',
					'click': ui.createHandlerFn(this, function () {
						return handleAction('refresh');
					})
				}, [_('Refresh...')])
			])
		]);
		if (uci.get('adblock', 'global', 'adb_map') === '1') {
			const btn = page.querySelector('#btnMap');
			if (btn) {
				btn.removeAttribute('disabled');
			}
		}
		return page;
	},
	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
