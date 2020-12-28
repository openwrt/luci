'use strict';
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
					'class': 'btn',
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
					'class': 'btn',
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
					'class': 'btn',
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
					E('select', { 'class': 'cbi-input-select', 'id': 'count' }, [
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
					'class': 'btn',
					'click': L.hideModal
				}, _('Cancel')),
				' ',
				E('button', {
					'class': 'btn cbi-button-action',
					'id': 'refresh',
					'click': ui.createHandlerFn(this, async function(ev) {
						var count = document.getElementById('count').value;
						var search = document.getElementById('search').value.trim().replace(/[^\w\.\-\:]/g,'') || '+';
						L.resolveDefault(fs.exec_direct('/etc/init.d/adblock', ['report', search, count, 'true', 'json']),'');
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

return L.view.extend({
	load: function() {
		return L.resolveDefault(fs.exec_direct('/etc/init.d/adblock', ['report', '+', '50', 'false', 'json']),'');
	},

	render: function(dnsreport) {
		if (!dnsreport) {
			dnsreport = '{ "data": "" }';
		};
		var content;
		content = JSON.parse(dnsreport);

		var rows_top = [];
		var tbl_top  = E('div', { 'class': 'table', 'id': 'top_10' }, [
			E('div', { 'class': 'tr table-titles' }, [
				E('div', { 'class': 'th right' }, _('Count')),
				E('div', { 'class': 'th' }, _('Name / IP Address')),
				E('div', { 'class': 'th right' }, _('Count')),
				E('div', { 'class': 'th' }, _('Domain')),
				E('div', { 'class': 'th right' }, _('Count')),
				E('div', { 'class': 'th' }, _('Blocked Domain'))
			])
		]);

		var max = 0;
		if (content.data.top_clients && content.data.top_domains && content.data.top_blocked) {
			max = Math.max(content.data.top_clients.length, content.data.top_domains.length, content.data.top_blocked.length);
		}
		for (var i = 0; i < max; i++) {
			var a_cnt = '\xa0', a_addr = '\xa0', b_cnt = '\xa0', b_addr = '\xa0', c_cnt = '\xa0', c_addr = '\xa0';
			if (content.data.top_clients[i]) {
				a_cnt = content.data.top_clients[i].count;
			}
			if (content.data.top_clients[i]) {
				a_addr = content.data.top_clients[i].address;
			}
			if (content.data.top_domains[i]) {
				b_cnt = content.data.top_domains[i].count;
			}
			if (content.data.top_domains[i]) {
				//[!CDATA[
					b_addr = '<a href="https://duckduckgo.com/?q=' + encodeURIComponent(content.data.top_domains[i].address) + '&amp;k1=-1&amp;km=l&amp;kh=1" target="_blank" title="Search this domain">' + content.data.top_domains[i].address + '</a>';
				//]]>
			}
			if (content.data.top_blocked[i]) {
				c_cnt = content.data.top_blocked[i].count;
			}
			if (content.data.top_blocked[i]) {
				//[!CDATA[
					c_addr = '<a href="https://duckduckgo.com/?q=' + encodeURIComponent(content.data.top_blocked[i].address) + '&amp;k1=-1&amp;km=l&amp;kh=1" target="_blank" title="Search this domain">' + content.data.top_blocked[i].address + '</a>';
				//]]>
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
		var tbl_requests  = E('div', { 'class': 'table', 'id': 'requests' }, [
			E('div', { 'class': 'tr table-titles' }, [
				E('div', { 'class': 'th' }, _('Date')),
				E('div', { 'class': 'th' }, _('Time')),
				E('div', { 'class': 'th' }, _('Client')),
				E('div', { 'class': 'th' }, _('Domain')),
				E('div', { 'class': 'th' }, _('Answer')),
				E('div', { 'class': 'th' }, _('Action'))
			])
		]);

		max = 0;
		if (content.data.requests) {
			var button;
			max = content.data.requests.length;
			for (var i = 0; i < max; i++) {
				if (content.data.requests[i].rc === 'NX') {
					button = E('button', {
						'class': 'cbi-button cbi-button-apply',
						'style': 'word-break: inherit',
						'name': 'whitelist',
						'value': content.data.requests[i].domain,
						'click': handleAction
					}, [ _('Whitelist...') ]);
				} else {
					button = E('button', {
						'class': 'cbi-button cbi-button-apply',
						'style': 'word-break: inherit',
						'name': 'blacklist',
						'value': content.data.requests[i].domain,
						'click': handleAction
					}, [ _('Blacklist...') ]);
				}
				rows_requests.push([
					content.data.requests[i].date,
					content.data.requests[i].time,
					content.data.requests[i].client,
					//[!CDATA[
						'<a href="https://duckduckgo.com/?q=' + encodeURIComponent(content.data.requests[i].domain) + '&amp;k1=-1&amp;km=l&amp;kh=1" target="_blank" title="Search this domain">' + content.data.requests[i].domain + '</a>',
					//]]>
					content.data.requests[i].rc,
					button
				]);
			}
		}
		cbi_update_table(tbl_requests, rows_requests);

		return E('div', { 'class': 'cbi-map', 'id': 'map' }, [
			E('div', { 'class': 'cbi-section' }, [
				E('p', _('This shows the last generated DNS Report, press the refresh button to get a current one.')),
				E('p', '\xa0'),
				E('div', { 'class': 'cbi-value', 'style': 'margin-bottom:5px' }, [
				E('label', { 'class': 'cbi-value-title', 'style': 'padding-top:0rem' }, _('Start Timestamp')),
				E('div', { 'class': 'cbi-value-field', 'id': 'start', 'style': 'margin-bottom:5px;margin-left:200px;color:#37c' }, (content.data.start_date || '-') + ', ' + (content.data.start_time || '-'))]),
				E('div', { 'class': 'cbi-value', 'style': 'margin-bottom:5px' }, [
				E('label', { 'class': 'cbi-value-title', 'style': 'padding-top:0rem' }, _('End Timestamp')),
				E('div', { 'class': 'cbi-value-field', 'id': 'end', 'style': 'margin-bottom:5px;margin-left:200px;color:#37c' }, (content.data.end_date || '-') + ', ' + (content.data.end_time || '-'))]),
				E('div', { 'class': 'cbi-value', 'style': 'margin-bottom:5px' }, [
				E('label', { 'class': 'cbi-value-title', 'style': 'padding-top:0rem' }, _('Total DNS Requests')),
				E('div', { 'class': 'cbi-value-field', 'id': 'total', 'style': 'margin-bottom:5px;margin-left:200px;color:#37c' }, content.data.total || '-')]),
				E('div', { 'class': 'cbi-value', 'style': 'margin-bottom:5px' }, [
				E('label', { 'class': 'cbi-value-title', 'style': 'padding-top:0rem' }, _('Blocked DNS Requests')),
				E('div', { 'class': 'cbi-value-field', 'id': 'blocked', 'style': 'margin-bottom:5px;margin-left:200px;color:#37c' }, (content.data.blocked || '-') + ' (' + (content.data.percent || '-') + ')')]),
				E('div', { 'class': 'right' }, [
					E('button', {
						'class': 'cbi-button cbi-button-apply',
						'click': ui.createHandlerFn(this, function() {
							return handleAction('query');
						})
					}, [ _('Blocklist Query...') ]),
					'\xa0\xa0\xa0',
					E('button', {
						'class': 'cbi-button cbi-button-apply',
						'click': ui.createHandlerFn(this, function() {
							return handleAction('refresh');
						})
					}, [ _('Refresh...') ])
				]),
			]),
			E('div', { 'class': 'cbi-section' }, [
				E('div', { 'class': 'left' }, [
					E('h3', _('Top 10 Statistics')),
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
