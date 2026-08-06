'use strict';
'require view';
'require fs';
'require ui';
'require uci';

/*
	button handling
*/
function handleAction(report, ev) {
	if (ev === 'search') {
		ui.showModal(_('IP Search'), [
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
				E('h5', _('Result')),
				E('textarea', {
					'id': 'result',
					'style': 'width: 100% !important; margin-top:.5em; padding: 5px; font-family: monospace',
					'readonly': 'readonly',
					'wrap': 'off',
					'rows': 20
				})
			]),
			E('div', { 'class': 'right' }, [
				E('button', {
					'class': 'btn cbi-button',
					'style': 'float:none; margin-right:.4em;',
					'click': ui.hideModal
				}, _('Cancel')),
				' ',
				E('button', {
					'class': 'btn cbi-button-action',
					'click': ui.createHandlerFn(this, function (ev) {
						let ip = document.getElementById('search').value.trim().toLowerCase();

						if (ip) {
							document.getElementById('search').value = ip;
							document.getElementById('result').textContent = _('Search is running, please wait...');
							if (window._banipPoller) {
								clearInterval(window._banipPoller);
								window._banipPoller = null;
							}
							L.resolveDefault(fs.write('/var/run/banIP/banIP.search', ''), '').then(function () {
								L.resolveDefault(fs.exec_direct('/etc/init.d/banip', ['search', ip]), '').then(function () {
									let attempts = 0;
									window._banipPoller = setInterval(function () {
										attempts++;
										L.resolveDefault(fs.read('/var/run/banIP/banIP.search'), '').then(function (res) {
											if (res && res.trim()) {
												clearInterval(window._banipPoller);
												window._banipPoller = null;
												document.getElementById('result').textContent = res.trim();
												document.getElementById('search').value = '';
											} else if (attempts >= 40) {
												clearInterval(window._banipPoller);
												window._banipPoller = null;
												document.getElementById('result').textContent = _('Search timed out.');
											}
										});
									}, 3000);
								});
							});
						}
						document.getElementById('search').focus();
					})
				}, _('Search IP'))
			])
		]);
		document.getElementById('search').focus();
	}
	if (ev === 'content') {
		let content, selectOption;
		let errMsg = false;

		if (report[1]) {
			try {
				content = JSON.parse(report[1]);
			} catch (e) {
				content = "";
				if (!errMsg) {
					errMsg = true;
					return ui.addNotification(null, E('p', _('Unable to parse the ruleset file!')), 'error');
				}
			}
		} else {
			return;
		}
		selectOption = [E('option', { value: '' }, [_('-- Set Selection --')])];
		Object.keys(content.nftables)
			.filter(key => content.nftables[key].set?.name && content.nftables[key].set.table === 'banIP')
			.sort((a, b) => content.nftables[a].set.name.localeCompare(content.nftables[b].set.name))
			.forEach(key => {
				selectOption.push(E('option', { 'value': content.nftables[key].set.name }, content.nftables[key].set.name));
			})
		ui.showModal(_('Set Content'), [
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
				E('label', { 'class': 'cbi-checkbox', 'style': 'padding-top:.5em' }, [
					E('input', {
						'class': 'cbi-checkbox',
						'data-update': 'click change',
						'type': 'checkbox',
						'id': 'chkFilter',
						'disabled': 'disabled',
						'value': 'true'
					}),
					E('span', { 'style': 'margin-left: .5em;' }, _('Show only Set elements with hits'))
				]),
			]),
			E('div', { 'class': 'left', 'style': 'display:flex; flex-direction:column' }, [
				E('h5', _('Result')),
				E('textarea', {
					'id': 'result',
					'style': 'width: 100% !important; margin-top:.5em; padding: 5px; font-family: monospace',
					'readonly': 'readonly',
					'wrap': 'off',
					'rows': 20
				})
			]),
			E('div', { 'class': 'right' }, [
				E('button', {
					'class': 'btn cbi-button',
					'style': 'float:none; margin-right:.4em;',
					'click': ui.hideModal
				}, _('Cancel')),
				' ',
				E('button', {
					'class': 'btn cbi-button-action',
					'click': ui.createHandlerFn(this, function (ev) {
						const checkbox = document.getElementById('chkFilter');
						const isChecked = checkbox.checked ? 'true' : 'false';
						let set = document.getElementById('set').value;
						if (set) {
							document.getElementById('result').textContent = 'Collecting Set content, please wait...';
							return L.resolveDefault(fs.exec_direct('/etc/init.d/banip', ['content', set, isChecked]), '').then(function (res) {
								let result = document.getElementById('result');
								result.textContent = res ? res.trim() : _('Network error');
								document.getElementById('set').value = '';
							})
						}
						document.getElementById('set').focus();
					})
				}, _('Show Content'))
			])
		]);
		if (uci.get('banip', 'global', 'ban_nftcount') === '1') {
			const chk = document.querySelector('#chkFilter');
			if (chk) {
				chk.removeAttribute('disabled');
			}
		}
		document.getElementById('set').focus();
	}
	if (ev === 'map') {
		const modal = ui.showModal(null, [
			E('div', {
				id: 'mapModal',
				style: 'position: relative;'
			}, [
				E('iframe', {
					id: 'mapFrame',
					src: L.resource('view/banip/map.html'),
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
						let iframe = document.getElementById('mapFrame');
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
			L.resolveDefault(fs.exec_direct('/etc/init.d/banip', ['report', 'json']), ''),
			L.resolveDefault(fs.exec_direct('/usr/sbin/nft', ['-tj', 'list', 'sets']), ''),
			uci.load('banip')
		]);
	},

	render: function (report) {
		let content = [], rowSets, tblSets, notMsg;

		if (report) {
			try {
				content = JSON.parse(report[0]);
			} catch (e) {
				content[0] = "";
			}
		} else {
			content[0] = "";
		}
		/*
			derive the hit ratios from the per set nft counters

			All three quotas share one denominator and one time window: the
			counters reset on every reload, and they only exist when the
			'count' option is enabled. An absent counter is an empty string,
			which is what distinguishes "not counted" from "counted zero" -
			without that distinction the quotas would silently report a
			disabled feature as a perfect result.
		*/
		function hitStats(sets) {
			const stats = { 'sets': 0, 'counted': 0, 'total': 0, 'hits': [], 'worst': [] };

			Object.keys(sets || {}).forEach(function (key) {
				const set = sets[key];
				stats.sets++;
				if (`${set.cnt_inbound ?? ''}${set.cnt_outbound ?? ''}` === '') {
					return;
				}
				const count = (parseInt(set.cnt_inbound, 10) || 0) + (parseInt(set.cnt_outbound, 10) || 0);
				const elements = parseInt(String(set.cnt_elements).replace(/\D/g, ''), 10) || 0;
				stats.counted++;
				stats.total += count;
				/* 'value' carries the metric a list ranks and scales its bars by */
				if (count > 0) {
					stats.hits.push({ 'name': key, 'elements': elements, 'hits': count, 'value': count });
				}
				stats.worst.push({ 'name': key, 'elements': elements, 'hits': count, 'value': elements });
			});
			stats.hits.sort(function (a, b) { return b.value - a.value; });
			/*
				worst first: fewest hits, and among those the largest set. Two
				ordinal keys rather than an elements per hit ratio, which would
				need an invented smoothing term to survive a zero denominator.
			*/
			stats.worst.sort(function (a, b) { return (a.hits - b.hits) || (b.value - a.value); });
			return stats;
		}

		/*
			Two colour scales, because the same kind of number answers two
			different questions here.

			The flood and invalid packet counters measure attack traffic, so
			zero is the good case - green, anything above it red.

			The per set counters measure how much a feed actually catches, so
			zero means the set earns nothing - red, while a set that matches is
			working - blue. That matches the Top Sets and Worst Sets lists,
			which rank exactly these numbers.
		*/
		function threatClass(value) {
			return (String(value).trim() === '0') ? 'ban-zero' : 'ban-hit';
		}

		function setClass(value) {
			return (String(value).trim() === '0') ? 'ban-idle' : 'ban-active';
		}

		/* "ON" plus the nft packet counter, only the counter is colour coded */
		function dirNode(direction, count, bold) {
			const attrs = bold ? { 'class': 'ban-nowrap', 'style': 'font-weight: bold' } : { 'class': 'ban-nowrap' };
			if (!count) {
				return E('em', attrs, [direction]);
			}
			return E('em', attrs, [
				direction, bold ? ' (' : ': (',
				E('span', { 'class': setClass(count) }, [fmtCount(count)]),
				')'
			]);
		}

		rowSets = [];
		tblSets = E('table', { 'class': 'table', 'id': 'sets' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th' }, _('Set')),
				E('th', { 'class': 'th right', 'style': 'padding-right: 20px' }, _('Count')),
				E('th', { 'class': 'th' }, _('Inbound&#160;(packets)')),
				E('th', { 'class': 'th' }, _('Outbound&#160;(packets)')),
				E('th', { 'class': 'th' }, _('Port&#160;/&#160;Protocol')),
				E('th', { 'class': 'th' }, _('Elements (max. 50)'))
			])
		]);

		if (content[0].sets) {
			Object.keys(content[0].sets).sort().forEach(function (key) {
				rowSets.push([
					E('em', key),
					E('em', { 'class': 'ban-nowrap', 'style': 'padding-right: 20px' }, fmtCount(content[0].sets[key].cnt_elements)),
					dirNode(content[0].sets[key].inbound, content[0].sets[key].cnt_inbound, false),
					dirNode(content[0].sets[key].outbound, content[0].sets[key].cnt_outbound, false),
					E('em', content[0].sets[key].port),
					E('em', content[0].sets[key].set_elements.join(", "))
				]);
			});
			rowSets.push([
				E('em', { 'style': 'font-weight: bold' }, content[0].sum_sets),
				E('em', { 'class': 'ban-nowrap', 'style': 'font-weight: bold; padding-right: 20px' }, fmtCount(content[0].sum_cntelements)),
				dirNode(content[0].sum_setinbound, content[0].sum_cntinbound, true),
				dirNode(content[0].sum_setoutbound, content[0].sum_cntoutbound, true),
				E('em', { 'style': 'font-weight: bold' }, content[0].sum_setports),
				E('em', { 'style': 'font-weight: bold' }, content[0].sum_setelements)
			]);
		}
		cbi_update_table(tblSets, rowSets);

		/*
			scoped theme palette, kept in sync with the overview page
		*/
		const style = E('style', { 'type': 'text/css' }, [
			'#ban-report {' +
			'--ban-card-bg: rgba(128,128,128,.07);' +
			'--ban-card-border: rgba(128,128,128,.28);' +
			'--ban-muted: GrayText;' +
			'--ban-ok: #1f8a5f;' +
			'--ban-err: #c0392b;' +
			'--ban-info: #2f6fb0;' +
			'--ban-track: rgba(128,128,128,.25);' +
			'}' +
			'@media (prefers-color-scheme: dark) {' +
			'#ban-report {' +
			'--ban-ok: #63c79b;' +
			'--ban-err: #e8897e;' +
			'--ban-info: #7fb3e8;' +
			'}}' +
			'#ban-report .ban-grid { display: grid; gap: .75em; grid-template-columns: repeat(auto-fit, minmax(min(12em, 100%), 1fr)); margin-bottom: .75em; }' +
			'#ban-report .ban-card { background: var(--ban-card-bg); border: 1px solid var(--ban-card-border); border-radius: 8px; padding: .7em .9em; min-width: 0; overflow-wrap: break-word; }' +
			'#ban-report .ban-label { font-size: .85em; color: var(--ban-muted); margin-bottom: .3em; }' +
			'#ban-report .ban-value { font-size: 1.5em; line-height: 1.3; font-variant-numeric: tabular-nums; }' +
			'#ban-report .ban-title { font-weight: bold; margin-bottom: .6em; }' +
			'#ban-report .ban-stack { display: grid; grid-template-columns: minmax(0, 1fr) max-content; gap: .25em .9em; font-size: .9em; }' +
			'#ban-report .ban-key { color: var(--ban-muted); }' +
			'#ban-report .ban-num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }' +
			'#ban-report .ban-zero { color: var(--ban-ok); }' +
			'#ban-report .ban-hit { color: var(--ban-err); }' +
			'#ban-report .ban-idle { color: var(--ban-err); }' +
			'#ban-report .ban-active { color: var(--ban-info); }' +
			'#ban-report .ban-nowrap { white-space: nowrap; }' +
			'#ban-report .ban-hint { font-weight: normal; color: var(--ban-muted); margin-left: .4em; }' +
			'#ban-report .ban-row { margin-bottom: .55em; }' +
			'#ban-report .ban-row:last-child { margin-bottom: 0; }' +
			'#ban-report .ban-row-top { display: flex; justify-content: space-between; gap: .75em; font-size: .9em; margin-bottom: .2em; }' +
			'#ban-report .ban-row-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }' +
			'#ban-report .ban-row-cnt { color: var(--ban-muted); font-variant-numeric: tabular-nums; white-space: nowrap; }' +
			'#ban-report .ban-bar { height: 3px; background: var(--ban-track); border-radius: 2px; }' +
			'#ban-report .ban-bar > div { height: 3px; border-radius: 2px; }'
		]);

		/* group digits with spaces, the same way f_genstatus() formats its counts */
		function fmtCount(value) {
			const text = String(value ?? '').trim();
			if (!/^\d+$/.test(text)) {
				return text || '-';
			}
			return text.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
		}

		/*
			counter rows are colour coded: nothing blocked is the good case,
			anything above zero is worth looking at
		*/
		function statRow(label, value, counter) {
			const text = fmtCount(value);
			let cls = 'ban-num';
			if (counter && /^[\d ]+$/.test(text)) {
				cls += ' ' + threatClass(text.replace(/ /g, ''));
			}
			return [
				E('span', { 'class': 'ban-key' }, [label, ' ']),
				E('span', { 'class': cls }, [text])
			];
		}

		const sum = content?.[0] || {};
		const hits = hitStats(sum.sets);

		/*
			ranked lists with relative bars

			A quota only means something once the counters exist. The report
			carries an empty string rather than a zero while the 'count' option
			is off, which is what separates "not counted" from "counted zero".
		*/
		function topList(title, hint, entries, color, empty) {
			const list = entries.slice(0, 10);
			/* the worst list is not ordered by the bar metric, so take the max */
			const peak = list.reduce(function (max, entry) {
				return entry.value > max ? entry.value : max;
			}, 0);
			let note = empty;

			if (hits.sets === 0) {
				note = '-';
			} else if (hits.counted === 0) {
				note = _('packet counters disabled');
			}
			const rows = list.map(function (entry) {
				const width = peak > 0 ? Math.round(entry.value / peak * 100) : 0;
				return E('div', { 'class': 'ban-row' }, [
					E('div', { 'class': 'ban-row-top' }, [
						E('span', { 'class': 'ban-row-name' }, [entry.name]),
						E('span', { 'class': 'ban-row-cnt' }, [
							`${fmtCount(entry.elements)} / ${fmtCount(entry.hits)}`
						])
					]),
					E('div', { 'class': 'ban-bar' }, [
						E('div', { 'style': `width:${width}%; background:var(--ban-${color})` })
					])
				]);
			});
			return E('div', { 'class': 'ban-card' }, [
				E('div', { 'class': 'ban-title' }, [
					title, E('span', { 'class': 'ban-hint' }, [hint])
				]),
				rows.length ? E('div', {}, rows) : E('em', { 'class': 'ban-label' }, [note])
			]);
		}

		const page = E('div', { 'class': 'cbi-map', 'id': 'ban-report' }, [
			style,
			E('div', { 'class': 'cbi-section' }, [
				E('p', { 'style': 'margin-bottom:1em;' },
					_('This report shows the latest NFT Set statistics, press the \'Refresh\' button to get a new one. \
					You can also display the specific content of Sets, search for suspicious IPs and finally, these IPs can also be displayed on a map.')),
				E('div', { 'class': 'ban-grid' }, [
					E('div', { 'class': 'ban-card' }, [
						E('div', { 'class': 'ban-label' }, [_('Sets')]),
						E('div', { 'class': 'ban-value' }, [fmtCount(sum.sum_sets)])
					]),
					E('div', { 'class': 'ban-card' }, [
						E('div', { 'class': 'ban-label' }, [_('Elements')]),
						E('div', { 'class': 'ban-value' }, [fmtCount(sum.sum_cntelements)])
					]),
					E('div', { 'class': 'ban-card' }, [
						E('div', { 'class': 'ban-label' }, [_('Timestamp')]),
						E('div', { 'class': 'ban-value' }, [sum.timestamp || '-'])
					])
				]),
				E('div', { 'class': 'ban-grid' }, [
					topList(_('Top Sets'), _('elements / packets'), hits.hits, 'info', _('no hits yet')),
					topList(_('Worst Sets'), _('elements / packets'), hits.worst, 'err', '-')
				]),
				E('div', { 'class': 'ban-grid' }, [
					E('div', { 'class': 'ban-card' }, [
						E('div', { 'class': 'ban-title' }, [_('Blocked Packets')]),
						E('div', { 'class': 'ban-stack' }, [].concat(
							statRow(_('syn-flood'), sum.sum_synflood, true),
							statRow(_('udp-flood'), sum.sum_udpflood, true),
							statRow(_('icmp-flood'), sum.sum_icmpflood, true),
							statRow(_('invalid ct'), sum.sum_ctinvalid, true),
							statRow(_('invalid tcp'), sum.sum_tcpinvalid, true),
							statRow(_('bcp38'), sum.sum_bcp38, true)
						))
					]),
					E('div', { 'class': 'ban-card' }, [
						E('div', { 'class': 'ban-title' }, [_('Auto-added IPs')]),
						E('div', { 'class': 'ban-stack' }, [].concat(
							statRow(_('allowlist'), sum.autoadd_allow),
							statRow(_('blocklist'), sum.autoadd_block)
						))
					])
				])
			]),
			E('br'),
			E('div', { 'class': 'cbi-section' }, [
				E('div', { 'class': 'left' }, [
					E('h3', _('Set details')),
					tblSets
				])
			]),
			E('div', { 'class': 'cbi-page-actions' }, [
				E('button', {
					'class': 'btn cbi-button cbi-button-apply',
					'style': 'float:none;margin-right:.4em;',
					'id': 'btnMap',
					'disabled': 'disabled',
					'click': ui.createHandlerFn(this, function () {
						if (Array.isArray(content[1]) && content[1].length > 1) {
							sessionStorage.setItem('mapData', JSON.stringify(content[1]));
							return handleAction(report, 'map');
						} else {
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
						return handleAction(report, 'content');
					})
				}, [_('Set Content...')]),
				E('button', {
					'class': 'btn cbi-button cbi-button-apply',
					'style': 'float:none;margin-right:.4em;',
					'click': ui.createHandlerFn(this, function () {
						return handleAction(report, 'search');
					})
				}, [_('IP Search...')]),
				E('button', {
					'class': 'btn cbi-button cbi-button-positive important',
					'style': 'float:none',
					'click': function () {
						const btn = this;
						document.querySelectorAll('.cbi-page-actions button').forEach(function (b) {
							b.disabled = true;
						});
						btn.blur();
						btn.classList.add('spinning');
						L.resolveDefault(fs.write('/var/run/banIP/banIP.report', ''), '').then(function () {
							L.resolveDefault(fs.exec_direct('/etc/init.d/banip', ['report', 'gen']), '');
							let attempts = 0;
							let poller = setInterval(function () {
								L.resolveDefault(fs.read('/var/run/banIP/banIP.report'), '').then(function (res) {
									res = (res || '').trim();
									if (res === '1') {
										clearInterval(poller);
										location.reload();
									} else if (res === '0') {
										// keep polling, no attempt counter
									} else {
										attempts++;
										if (attempts >= 10) {
											clearInterval(poller);
											btn.classList.remove('spinning');
											document.querySelectorAll('.cbi-page-actions button').forEach(function (b) {
												b.disabled = false;
											});
											ui.addNotification(null, E('p', _('Failed to generate a banIP report!')), 'error');
										}
									}
								});
							}, 3000);
						});
					}
				}, [_('Refresh')])
			])
		]);
		if (uci.get('banip', 'global', 'ban_nftcount') === '1'
			&& uci.get('banip', 'global', 'ban_map') === '1'
			&& (uci.get('banip', 'global', 'ban_allowlistonly') !== '1'
				|| (uci.get('banip', 'global', 'ban_feedin') || "").includes("allowlist")
				|| (uci.get('banip', 'global', 'ban_feedout') || "").includes("allowlist"))) {
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
