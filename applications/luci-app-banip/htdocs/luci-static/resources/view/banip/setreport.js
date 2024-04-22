'use strict';
'require view';
'require fs';
'require ui';

/*
	button handling
*/
function handleAction(report, ev) {
	if (ev === 'search') {
		L.ui.showModal(_('IP Search'), [
			E('p', _('Search the banIP-related Sets for a specific IP.')),
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
					'click': ui.createHandlerFn(this, function (ev) {
						let ip = document.getElementById('search').value.trim().toLowerCase();
						if (ip) {
							document.getElementById('search').value = ip;
							document.getElementById('result').textContent = 'The search is running, please wait...';
							return L.resolveDefault(fs.exec_direct('/etc/init.d/banip', ['search', ip])).then(function (res) {
								let result = document.getElementById('result');
								if (res) {
									result.textContent = res.trim();
								} else {
									result.textContent = _('No Search results!');
								}
								document.getElementById('search').value = '';
							})
						}
						document.getElementById('search').focus();
					})
				}, _('Search'))
			])
		]);
		document.getElementById('search').focus();
	}
	if (ev === 'survey') {
		let content, selectOption;

		if (report[1]) {
			try {
				content = JSON.parse(report[1]);
			} catch (e) {
				content = "";
				ui.addNotification(null, E('p', _('Unable to parse the ruleset file: %s').format(e.message)), 'error');
			}
		} else {
			content = "";
		}
		selectOption = [E('option', { value: '' }, [_('-- Set Selection --')])];
		for (let i = 0; i < Object.keys(content.nftables).length; i++) {
			if (content.nftables[i].set && content.nftables[i].set.name !== undefined && content.nftables[i].set.table !== undefined && content.nftables[i].set.table === 'banIP') {
				selectOption.push(E('option', { 'value': content.nftables[i].set.name }, content.nftables[i].set.name));
			}
		}
		L.ui.showModal(_('Set Survey'), [
			E('p', _('List the elements of a specific banIP-related Set.')),
			E('div', { 'class': 'left', 'style': 'display:flex; flex-direction:column' }, [
				E('label', { 'class': 'cbi-input-select', 'style': 'padding-top:.5em', 'id': 'run' }, [
					E('h5', _('Set')),
					E('select', { 'class': 'cbi-input-select', 'id': 'set' },
						selectOption
					)
				]),
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
					'click': ui.createHandlerFn(this, function (ev) {
						let set = document.getElementById('set').value;
						if (set) {
							document.getElementById('result').textContent = 'The survey is running, please wait...';
							return L.resolveDefault(fs.exec_direct('/etc/init.d/banip', ['survey', set])).then(function (res) {
								let result = document.getElementById('result');
								if (res) {
									result.textContent = res.trim();
								} else {
									result.textContent = _('No Search results!');
								}
								document.getElementById('set').value = '';
							})
						}
						document.getElementById('set').focus();
					})
				}, _('Survey'))
			])
		]);
		document.getElementById('set').focus();
	}
}

return view.extend({
	load: function () {
		return Promise.all([
			L.resolveDefault(fs.exec_direct('/etc/init.d/banip', ['report', 'json']), ''),
			L.resolveDefault(fs.exec_direct('/usr/sbin/nft', ['-tj', 'list', 'ruleset']), '')
		]);
	},

	render: function (report) {
		let content, rowSets, tblSets;

		if (report[0]) {
			try {
				content = JSON.parse(report[0]);
			} catch (e) {
				content = "";
				ui.addNotification(null, E('p', _('Unable to parse the report file: %s').format(e.message)), 'error');
			}
		} else {
			content = "";
		}
		rowSets = [];
		tblSets = E('table', { 'class': 'table', 'id': 'sets' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th' }, _('Set')),
				E('th', { 'class': 'th right', 'style': 'padding-right: 20px' }, _('Elements')),
				E('th', { 'class': 'th' }, _('WAN-Input (packets)')),
				E('th', { 'class': 'th' }, _('WAN-Forward (packets)')),
				E('th', { 'class': 'th' }, _('LAN-Forward (packets)')),
				E('th', { 'class': 'th' }, _('Port/Protocol Limit'))
			])
		]);

		if (content.sets) {
			let cnt1, cnt2, cnt3;
			Object.keys(content.sets).forEach(function (key) {
				cnt1 = content.sets[key].cnt_input ? ': (' + content.sets[key].cnt_input + ')' : '';
				cnt2 = content.sets[key].cnt_forwardwan ? ': (' + content.sets[key].cnt_forwardwan + ')' : '';
				cnt3 = content.sets[key].cnt_forwardlan ? ': (' + content.sets[key].cnt_forwardlan + ')' : '';
				rowSets.push([
					E('em', key),
					E('em', { 'style': 'padding-right: 20px' }, content.sets[key].cnt_elements),
					E('em', content.sets[key].input + cnt1),
					E('em', content.sets[key].wan_forward + cnt2),
					E('em', content.sets[key].lan_forward + cnt3),
					E('em', content.sets[key].port)
				]);
			});
			rowSets.push([
				E('em', { 'style': 'font-weight: bold' }, content.sum_sets),
				E('em', { 'style': 'font-weight: bold; padding-right: 20px' }, content.sum_setelements),
				E('em', { 'style': 'font-weight: bold' }, content.sum_setinput + ' (' + content.sum_cntinput + ')'),
				E('em', { 'style': 'font-weight: bold' }, content.sum_setforwardwan + ' (' + content.sum_cntforwardwan + ')'),
				E('em', { 'style': 'font-weight: bold' }, content.sum_setforwardlan + ' (' + content.sum_cntforwardlan + ')')
			]);
		}
		cbi_update_table(tblSets, rowSets);

		return E('div', { 'class': 'cbi-map', 'id': 'map' }, [
			E('div', { 'class': 'cbi-section' }, [
				E('p', _('This tab shows the last generated Set Report, press the \'Refresh\' button to get a new one.')),
				E('p', '\xa0'),
				E('div', { 'class': 'cbi-value' }, [
					E('div', { 'class': 'cbi-value-title', 'style': 'margin-bottom:-5px;float:left;width:230px;font-weight:bold;' }, _('Timestamp')),
					E('div', { 'class': 'cbi-value-title', 'id': 'start', 'style': 'margin-bottom:-5px;float:left;color:#37c;font-weight:bold;' }, content.timestamp || '-')
				]),
				E('hr'),
				E('div', { 'class': 'cbi-value' }, [
					E('div', { 'class': 'cbi-value-title', 'style': 'margin-top:-5px;float:left;width:230px;font-weight:bold;' }, _('blocked syn-flood packets')),
					E('div', { 'class': 'cbi-value-title', 'id': 'start', 'style': 'margin-top:-5px;float:left;color:#37c;font-weight:bold;' }, content.sum_synflood || '-')
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('div', { 'class': 'cbi-value-title', 'style': 'margin-top:-5px;float:left;width:230px;font-weight:bold;' }, _('blocked udp-flood packets')),
					E('div', { 'class': 'cbi-value-title', 'id': 'start', 'style': 'margin-top:-5px;float:left;color:#37c;font-weight:bold;' }, content.sum_udpflood || '-')
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('div', { 'class': 'cbi-value-title', 'style': 'margin-top:-5px;float:left;width:230px;font-weight:bold;' }, _('blocked icmp-flood packets')),
					E('div', { 'class': 'cbi-value-title', 'id': 'start', 'style': 'margin-top:-5px;float:left;color:#37c;font-weight:bold;' }, content.sum_icmpflood || '-')
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('div', { 'class': 'cbi-value-title', 'style': 'margin-top:-5px;float:left;width:230px;font-weight:bold;' }, _('blocked invalid ct packets')),
					E('div', { 'class': 'cbi-value-title', 'id': 'start', 'style': 'margin-top:-5px;float:left;color:#37c;font-weight:bold;' }, content.sum_ctinvalid || '-')
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('div', { 'class': 'cbi-value-title', 'style': 'margin-top:-5px;float:left;width:230px;font-weight:bold;' }, _('blocked invalid tcp packets')),
					E('div', { 'class': 'cbi-value-title', 'id': 'start', 'style': 'margin-top:-5px;float:left;color:#37c;font-weight:bold;' }, content.sum_tcpinvalid || '-')
				]),
				E('hr'),
				E('div', { 'class': 'cbi-value' }, [
					E('div', { 'class': 'cbi-value-title', 'style': 'margin-top:-5px;float:left;width:230px;font-weight:bold;' }, _('auto-added IPs to allowlist')),
					E('div', { 'class': 'cbi-value-title', 'id': 'start', 'style': 'margin-top:-5px;float:left;color:#37c;font-weight:bold;' }, content.autoadd_allow || '-')
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('div', { 'class': 'cbi-value-title', 'style': 'margin-top:-5px;float:left;width:230px;font-weight:bold;' }, _('auto-added IPs to blocklist')),
					E('div', { 'class': 'cbi-value-title', 'id': 'start', 'style': 'margin-top:-5px;float:left;color:#37c;font-weight:bold;' }, content.autoadd_block || '-')
				]),
				E('div', { 'class': 'right' }, [
					E('button', {
						'class': 'btn cbi-button cbi-button-apply',
						'click': ui.createHandlerFn(this, function () {
							return handleAction(report, 'survey');
						})
					}, [_('Set Survey...')]),
					'\xa0\xa0\xa0',
					E('button', {
						'class': 'btn cbi-button cbi-button-apply',
						'click': ui.createHandlerFn(this, function () {
							return handleAction(report, 'search');
						})
					}, [_('IP Search...')]),
					'\xa0\xa0\xa0',
					E('button', {
						'class': 'btn cbi-button cbi-button-positive',
						'click': ui.createHandlerFn(this, function () {
							location.reload();
						})
					}, [_('Refresh')])
				]),
			])
			,
			E('br'),
			E('div', { 'class': 'cbi-section' }, [
				E('div', { 'class': 'left' }, [
					E('h3', _('Set details')),
					tblSets
				])
			])
		]);
	},
	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
