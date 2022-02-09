'use strict';
'require view';
'require fs';
'require ui';

/*
	button handling
*/
function handleAction(ev) {
	if (ev.target && ev.target.getAttribute('name') === 'whitelist') {
		L.ui.showModal(_('Whitelist IP/CIDR'), [
			E('p', _('Add this IP/CIDR to your local whitelist.')),
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
						L.resolveDefault(fs.read_direct('/etc/banip/banip.whitelist'), '')
						.then(function(res) {
							var ip = document.getElementById('whitelist').value.trim().toLowerCase();
							if (ip) {
								var whitelist = res + ip + '\n';
								fs.write('/etc/banip/banip.whitelist', whitelist);
								ui.addNotification(null, E('p', _('Whitelist changes have been saved. Refresh your banIP lists that changes take effect.')), 'info');
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
		L.ui.showModal(_('IPSet Query'), [
			E('p', _('Search the active banIP-related IPSets for a specific IP, CIDR or MAC address.')),
			E('div', { 'class': 'left', 'style': 'display:flex; flex-direction:column' }, [
				E('label', { 'style': 'padding-top:.5em', 'id': 'run' }, [
					E('input', { 
						'class': 'cbi-input-text',
						'placeholder': '192.168.0.1',
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
						var ip = document.getElementById('search').value.trim().toLowerCase();
						if (ip) {
							document.getElementById('run').classList.add("spinning");
							document.getElementById('search').value = ip;
							document.getElementById('result').textContent = 'The query is running, please wait...';
							L.resolveDefault(fs.exec_direct('/etc/init.d/banip', ['query', ip])).then(function(res) {
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
}

return view.extend({
	load: function() {
		return L.resolveDefault(fs.exec_direct('/etc/init.d/banip', ['report', 'json']),'');
	},

	render: function(ipsetreport) {
		if (!ipsetreport) {
			ipsetreport = '{}';
		};
		var content;
		content = JSON.parse(ipsetreport);

		var rows_ipsets = [];
		var tbl_ipsets  = E('table', { 'class': 'table', 'id': 'ipsets' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th' }, _('Name')),
				E('th', { 'class': 'th' }, _('Type')),
				E('th', { 'class': 'th' }, _('Count SUM')),
				E('th', { 'class': 'th' }, _('Count IP')),
				E('th', { 'class': 'th' }, _('Count CIDR')),
				E('th', { 'class': 'th' }, _('Count MAC')),
				E('th', { 'class': 'th' }, _('Count ACC')),
				E('th', { 'class': 'th' }, _('Entry Details')),
				E('th', { 'class': 'th' }, '\xa0'),
				E('th', { 'class': 'th' }, _('Action'))
			])
		]);

		if (content.ipsets) {
			var button, member, urlprefix;
			Object.keys(content.ipsets).forEach(function(key) {
				rows_ipsets.push([
					E('em', key),
					E('em', content.ipsets[key].type),
					E('em', content.ipsets[key].count),
					E('em', content.ipsets[key].count_ip),
					E('em', content.ipsets[key].count_cidr),
					E('em', content.ipsets[key].count_mac),
					E('em', content.ipsets[key].count_acc)
				]);
				for (var i = 0; i < content.ipsets[key].member_acc.length; i++) {
					if (key != 'maclist' && key.substr(0,9) != 'whitelist') {
						member = '<a href="https://ipwhois.app/json/' + encodeURIComponent(content.ipsets[key].member_acc[i].member) + '" target="_blank" rel="noreferrer noopener" title="IP/CIDR Lookup" >' + content.ipsets[key].member_acc[i].member + '</a>';
						button = E('button', {
							'class': 'btn cbi-button cbi-button-apply',
							'style': 'word-break: inherit',
							'name': 'whitelist',
							'value': content.ipsets[key].member_acc[i].member,
							'click': handleAction
						}, [ _('Whitelist...')]);
					} else {
						member = content.ipsets[key].member_acc[i].member;
						button = '';
					}
					rows_ipsets.push([
						'',
						'',
						'',
						'',
						'',
						'',
						'',
						member,
						content.ipsets[key].member_acc[i].packets,
						button
					]);
				}
			});
		}
		cbi_update_table(tbl_ipsets, rows_ipsets);

		return E('div', { 'class': 'cbi-map', 'id': 'map' }, [
			E('div', { 'class': 'cbi-section' }, [
				E('p', _('This tab shows the last generated IPSet Report, press the \'Refresh\' button to get a current one.')),
				E('p', '\xa0'),
				E('div', { 'class': 'cbi-value' }, [
					E('div', { 'class': 'cbi-value-title', 'style': 'float:left;width:230px' }, _('Timestamp')),
					E('div', { 'class': 'cbi-value-title', 'id': 'start', 'style': 'float:left;color:#37c' }, content.timestamp || '-')
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('div', { 'class': 'cbi-value-title', 'style': 'float:left;width:230px' }, _('Number of all IPSets')),
					E('div', { 'class': 'cbi-value-title', 'id': 'start', 'style': 'float:left;color:#37c' }, content.cnt_set_sum || '-')
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('div', { 'class': 'cbi-value-title', 'style': 'float:left;width:230px' }, _('Number of all entries')),
					E('div', { 'class': 'cbi-value-title', 'id': 'start', 'style': 'float:left;color:#37c' }, content.cnt_sum || '-')
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('div', { 'class': 'cbi-value-title', 'style': 'float:left;width:230px' }, _('Number of IP entries')),
					E('div', { 'class': 'cbi-value-title', 'id': 'start', 'style': 'float:left;color:#37c' }, content.cnt_ip_sum || '-')
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('div', { 'class': 'cbi-value-title', 'style': 'float:left;width:230px' }, _('Number of CIDR entries')),
					E('div', { 'class': 'cbi-value-title', 'id': 'start', 'style': 'float:left;color:#37c' }, content.cnt_cidr_sum || '-')
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('div', { 'class': 'cbi-value-title', 'style': 'float:left;width:230px' }, _('Number of MAC entries')),
					E('div', { 'class': 'cbi-value-title', 'id': 'start', 'style': 'float:left;color:#37c' }, content.cnt_mac_sum || '-')
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('div', { 'class': 'cbi-value-title', 'style': 'float:left;width:230px' }, _('Number of accessed entries')),
					E('div', { 'class': 'cbi-value-title', 'id': 'start', 'style': 'float:left;color:#37c' }, content.cnt_acc_sum || '-')
				]),
				E('div', { 'class': 'right' }, [
					E('button', {
						'class': 'btn cbi-button cbi-button-apply',
						'click': ui.createHandlerFn(this, function() {
							return handleAction('query');
						})
					}, [ _('IPSet Query...') ]),
					'\xa0\xa0\xa0',
					E('button', {
						'class': 'btn cbi-button cbi-button-positive',
						'click': ui.createHandlerFn(this, async function() {
							L.resolveDefault(fs.exec_direct('/etc/init.d/banip', ['report', 'gen']),'');
							var running = 1;
							while (running === 1) {
								await new Promise(r => setTimeout(r, 1000));
								L.resolveDefault(fs.read_direct('/var/run/banip.pid')).then(function(res) {
									if (!res) {
										running = 0;
									}
								})
							}
							location.reload();
						})
					}, [ _('Refresh') ])
				]),
			]),
			E('br'),
			E('div', { 'class': 'cbi-section' }, [
				E('div', { 'class': 'left' }, [
					E('h3', _('IPSet details')),
					tbl_ipsets
				])
			])
		]);
	},
	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
