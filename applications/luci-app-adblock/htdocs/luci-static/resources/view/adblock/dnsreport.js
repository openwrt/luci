'use strict';
'require view';
'require fs';
'require ui';

/*
	button handling
*/
function handleAction(ev) {
	if (ev.target && ev.target.getAttribute('name') === 'blacklist') {
		L.ui.showModal(_('Add Blacklist Domain'), [
			E('p', _('Add this (sub-)domain to your local blacklist.')),
			E('div', { 'class': 'left', 'style': 'display:flex; flex-direction:column' }, [
				E('label', { 'class': 'cbi-input-text', 'style': 'padding-top:.5em' }, [
					E('input', { 'class': 'cbi-input-text', 'style': 'width:300px', 'spellcheck': 'false', 'id': 'blacklist', 'value': ev.target.getAttribute('value') }, [])
				])
			]),
			E('div', { 'class': 'right' }, [
				E('button', {
					'class': 'btn cbi-button',
					'click': L.hideModal
				}, _('Cancel')),
				' ',
				E('button', {
					'class': 'btn cbi-button-action',
					'click': ui.createHandlerFn(this, function(ev) {
						L.resolveDefault(fs.read_direct('/etc/adblock/adblock.blacklist'), '')
						.then(function(res) {
							var domain = document.getElementById('blacklist').value.trim().toLowerCase().replace(/[^a-z0-9\.\-]/g,'');
							var pattern = new RegExp('^' + domain.replace(/[\.]/g,'\\.') + '$', 'm');
							if (res.search(pattern) === -1) {
								var blacklist = res + domain + '\n';
								fs.write('/etc/adblock/adblock.blacklist', blacklist);
								ui.addNotification(null, E('p', _('Blacklist changes have been saved. Refresh your adblock lists that changes take effect.')), 'info');
							}
							L.hideModal();
						});
					})
				}, _('Save'))
			])
		]);
		document.getElementById('blacklist').focus();
	}

	if (ev.target && ev.target.getAttribute('name') === 'whitelist') {
		L.ui.showModal(_('Add Whitelist Domain'), [
			E('p', _('Add this (sub-)domain to your local whitelist.')),
			E('div', { 'class': 'left', 'style': 'display:flex; flex-direction:column' }, [
				E('label', { 'class': 'cbi-input-text', 'style': 'padding-top:.5em' }, [
					E('input', { 'class': 'cbi-input-text', 'style': 'width:300px', 'spellcheck': 'false', 'id': 'whitelist', 'value': ev.target.getAttribute('value') }, [])
				])
			]),
			E('div', { 'class': 'right' }, [
				E('button', {
					'class': 'btn cbi-button',
					'click': L.hideModal
				}, _('Cancel')),
				' ',
				E('button', {
					'class': 'btn cbi-button-action',
					'click': ui.createHandlerFn(this, function(ev) {
						L.resolveDefault(fs.read_direct('/etc/adblock/adblock.whitelist'), '')
						.then(function(res) {
							var domain = document.getElementById('whitelist').value.trim().toLowerCase().replace(/[^a-z0-9\.\-]/g,'');
							var pattern = new RegExp('^' + domain.replace(/[\.]/g,'\\.') + '$', 'm');
							if (res.search(pattern) === -1) {
								var whitelist = res + domain + '\n';
								fs.write('/etc/adblock/adblock.whitelist', whitelist);
								ui.addNotification(null, E('p', _('Whitelist changes have been saved. Refresh your adblock lists that changes take effect.')), 'info');
							}
							L.hideModal();
						});
					})
				}, _('Save'))
			])
		]);
		document.getElementById('whitelist').focus();
	}

	if (ev === 'query') {
		L.ui.showModal(_('Blocklist Query'), [
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
					'click': L.hideModal
				}, _('Cancel')),
				' ',
				E('button', {
					'class': 'btn cbi-button-action',
					'click': ui.createHandlerFn(this, function(ev) {
						var domain = document.getElementById('search').value.trim().toLowerCase().replace(/[^a-z0-9\.\-]/g,'');
						if (domain) {
							document.getElementById('run').classList.add("spinning");
							document.getElementById('search').value = domain;
							document.getElementById('result').textContent = 'The query is running, please wait...';
							L.resolveDefault(fs.exec_direct('/etc/init.d/adblock', ['query', domain])).then(function(res) {
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
		L.ui.showModal(_('Refresh DNS Report'), [
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
					'click': L.hideModal
				}, _('Cancel')),
				' ',
				E('button', {
					'class': 'btn cbi-button-action',
					'id': 'refresh',
					'click': ui.createHandlerFn(this, async function(ev) {
						var top_count = document.getElementById('top_count').value;
						var res_count = document.getElementById('res_count').value;
						var search = document.getElementById('search').value.trim().replace(/[^\w\.\-\:]/g,'') || '+';
						L.resolveDefault(fs.exec_direct('/etc/init.d/adblock', ['report', 'gen', top_count, res_count, search]),'');
						var running = 1;
						while (running === 1) {
							await new Promise(r => setTimeout(r, 1000));
							L.resolveDefault(fs.read_direct('/var/run/adblock.pid')).then(function(res) {
								if (!res) {
									running = 0;
								}
							})
						}
						L.hideModal();
						location.reload();
					})
				}, _('Refresh'))
			])
		]);
		document.getElementById('refresh').focus();
	}
}

return view.extend({
	load: function() {
		return L.resolveDefault(fs.exec_direct('/etc/init.d/adblock', ['report', 'json', '10', '50', '+']),'');
	},

	render: function(dnsreport) {
		if (!dnsreport) {
			dnsreport = '{}';
		};
		var content;
		content = JSON.parse(dnsreport);

		var rows_top = [];
		var tbl_top  = E('table', { 'class': 'table', 'id': 'top_10' }, [
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
		if (content.top_clients && content.top_domains && content.top_blocked) {
			max = Math.max(content.top_clients.length, content.top_domains.length, content.top_blocked.length);
		}
		for (var i = 0; i < max; i++) {
			var a_cnt = '\xa0', a_addr = '\xa0', b_cnt = '\xa0', b_addr = '\xa0', c_cnt = '\xa0', c_addr = '\xa0';
			if (content.top_clients[i]) {
				a_cnt = content.top_clients[i].count;
			}
			if (content.top_clients[i]) {
				a_addr = content.top_clients[i].address;
			}
			if (content.top_domains[i]) {
				b_cnt = content.top_domains[i].count;
			}
			if (content.top_domains[i]) {
				b_addr = '<a href="https://duckduckgo.com/?q=' + encodeURIComponent(content.top_domains[i].address) + '&amp;k1=-1&amp;km=l&amp;kh=1" target="_blank" rel="noreferrer noopener" title="Domain Lookup">' + content.top_domains[i].address + '</a>';
			}
			if (content.top_blocked[i]) {
				c_cnt = content.top_blocked[i].count;
			}
			if (content.top_blocked[i]) {
				c_addr = '<a href="https://duckduckgo.com/?q=' + encodeURIComponent(content.top_blocked[i].address) + '&amp;k1=-1&amp;km=l&amp;kh=1" target="_blank" rel="noreferrer noopener" title="Domain Lookup">' + content.top_blocked[i].address + '</a>';
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
		var tbl_requests  = E('table', { 'class': 'table', 'id': 'requests' }, [
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
		if (content.requests) {
			var button;
			max = content.requests.length;
			for (var i = 0; i < max; i++) {
				if (content.requests[i].rc === 'NX') {
					button = E('button', {
						'class': 'btn cbi-button cbi-button-positive',
						'style': 'word-break: inherit',
						'name': 'whitelist',
						'value': content.requests[i].domain,
						'click': handleAction
					}, [ _('Whitelist...') ]);
				} else {
					button = E('button', {
						'class': 'btn cbi-button cbi-button-negative',
						'style': 'word-break: inherit',
						'name': 'blacklist',
						'value': content.requests[i].domain,
						'click': handleAction
					}, [ _('Blacklist...') ]);
				}
				rows_requests.push([
					content.requests[i].date,
					content.requests[i].time,
					content.requests[i].client,
					'<a href="https://duckduckgo.com/?q=' + encodeURIComponent(content.requests[i].domain) + '&amp;k1=-1&amp;km=l&amp;kh=1" target="_blank" rel="noreferrer noopener" title="Domain Lookup">' + content.requests[i].domain + '</a>',
					content.requests[i].rc,
					button
				]);
			}
		}
		cbi_update_table(tbl_requests, rows_requests);

		return E('div', { 'class': 'cbi-map', 'id': 'map' }, [
			E('div', { 'class': 'cbi-section' }, [
				E('p', _('This tab shows the last generated DNS Report, press the \'Refresh\' button to get a current one.')),
				E('p', '\xa0'),
				E('div', { 'class': 'cbi-value' }, [
					E('div', { 'class': 'cbi-value-title', 'style': 'float:left;width:230px' }, _('Start Timestamp')),
					E('div', { 'class': 'cbi-value-title', 'id': 'start', 'style': 'float:left;color:#37c' }, (content.start_date || '-') + ', ' + (content.start_time || '-'))
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('div', { 'class': 'cbi-value-title', 'style': 'float:left;width:230px' }, _('End Timestamp')),
					E('div', { 'class': 'cbi-value-title', 'id': 'end', 'style': 'float:left;color:#37c' }, (content.end_date || '-') + ', ' + (content.end_time || '-'))
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('div', { 'class': 'cbi-value-title', 'style': 'float:left;width:230px' }, _('Total DNS Requests')),
					E('div', { 'class': 'cbi-value-title', 'id': 'total', 'style': 'float:left;color:#37c' }, content.total || '-')
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('div', { 'class': 'cbi-value-title', 'style': 'float:left;width:230px' }, _('Blocked DNS Requests')),
					E('div', { 'class': 'cbi-value-title', 'id': 'blocked', 'style': 'float:left;color:#37c' }, (content.blocked || '-') + ' (' + (content.percent || '-') + ')')
				]),
				E('div', { 'class': 'right' }, [
					E('button', {
						'class': 'btn cbi-button cbi-button-apply',
						'click': ui.createHandlerFn(this, function() {
							return handleAction('query');
						})
					}, [ _('Blocklist Query...') ]),
					'\xa0\xa0\xa0',
					E('button', {
						'class': 'btn cbi-button cbi-button-positive',
						'click': ui.createHandlerFn(this, function() {
							return handleAction('refresh');
						})
					}, [ _('Refresh...') ])
				]),
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
			])
		]);
	},
	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
