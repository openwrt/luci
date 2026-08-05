'use strict';
'require view';
'require fs';
'require ui';
'require uci';

/* separate flags per notification context */
let listNotMsg = false;
let mapNotMsg = false;

/*
	build a domain lookup link as DOM node

	Domain names originate from captured DNS traffic and are only stripped of
	control characters by the backend, i.e. they may still contain markup
	characters. Table cells are rendered via innerHTML by LuCI, so the link
	has to be assembled as a DOM node to keep the domain properly escaped.
*/
function makeDomainLink(domain) {
	return E('a', {
		'href': 'https://ip-api.com/#' + encodeURIComponent(domain),
		'target': '_blank',
		'rel': 'noreferrer noopener',
		'title': _('Domain Lookup')
	}, [domain]);
}

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
						const domain = document.getElementById('blocklist').value.trim().toLowerCase();
						if (!domain
							|| domain.length > 253
							|| /[^a-z0-9.-]|^-|-$|\.\.|\.$/.test(domain)) {
							ui.addNotification(null, E('p', _('Invalid input, please submit a single valid (sub-)domain.')), 'warning');
							ui.hideModal();
							return;
						}
						L.resolveDefault(fs.read_direct('/etc/adblock/adblock.blocklist'), '')
							.then(function (res) {
								const pattern = new RegExp('^' + domain.replace(/[.]/g, '\\.') + '$', 'm');
								if (res.search(pattern) === -1) {
									const blocklist = res + domain + '\n';
									fs.write('/etc/adblock/adblock.blocklist', blocklist);
									if (!listNotMsg) {
										listNotMsg = true;
										ui.addNotification(null, E('p', _('Blocklist modifications have been saved, reload adblock that changes take effect.')), 'info');
									}
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
						const domain = document.getElementById('allowlist').value.trim().toLowerCase();
						if (!domain
							|| domain.length > 253
							|| /[^a-z0-9.-]|^-|-$|\.\.|\.$/.test(domain)) {
							ui.addNotification(null, E('p', _('Invalid input, please submit a single valid (sub-)domain.')), 'warning');
							ui.hideModal();
							return;
						}
						L.resolveDefault(fs.read_direct('/etc/adblock/adblock.allowlist'), '')
							.then(function (res) {
								const pattern = new RegExp('^' + domain.replace(/[.]/g, '\\.') + '$', 'm');
								if (res.search(pattern) === -1) {
									const allowlist = res + domain + '\n';
									fs.write('/etc/adblock/adblock.allowlist', allowlist);
									if (!listNotMsg) {
										listNotMsg = true;
										ui.addNotification(null, E('p', _('Allowlist modifications have been saved, reload adblock that changes take effect.')), 'info');
									}
								}
								ui.hideModal();
							});
					})
				}, _('Save'))
			])
		]);
		document.getElementById('allowlist').focus();
	}

	if (ev === 'search') {
		ui.showModal(_('Blocklist Search'), [
			E('p', _('Search active blocklists and backups for a specific domain.')),
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
					'click': function () {
						if (window._adbSearchPoller) {
							clearInterval(window._adbSearchPoller);
							window._adbSearchPoller = null;
						}
						ui.hideModal();
					}
				}, _('Cancel')),
				' ',
				E('button', {
					'class': 'btn cbi-button-action',
					'click': ui.createHandlerFn(this, function (ev) {
						const domain = document.getElementById('search').value.trim().toLowerCase().replace(/[^a-z0-9.-]/g, '');
						document.getElementById('run').classList.add("spinning");
						document.getElementById('search').value = domain;
						document.getElementById('result').textContent = _('The search is running, please wait...');

						const modal = ev.target.closest('.modal');
						const buttons = modal ? modal.querySelectorAll('button') : [];
						buttons.forEach(function (btn) { btn.disabled = true; });

						if (window._adbSearchPoller) {
							clearInterval(window._adbSearchPoller);
							window._adbSearchPoller = null;
						}
						L.resolveDefault(fs.write('/var/run/adblock/adblock.search', ''), '').then(function () {
							L.resolveDefault(fs.exec_direct('/etc/init.d/adblock', ['search', domain]), '');
							let attempts = 0;
							window._adbSearchPoller = setInterval(function () {
								attempts++;
								L.resolveDefault(fs.read('/var/run/adblock/adblock.search'), '').then(function (res) {
									if (res && res.trim()) {
										clearInterval(window._adbSearchPoller);
										window._adbSearchPoller = null;
										document.getElementById('result').textContent = res.trim();
										document.getElementById('run').classList.remove("spinning");
										document.getElementById('search').value = '';
										buttons.forEach(function (btn) { btn.disabled = false; });
									} else if (attempts >= 60) {
										clearInterval(window._adbSearchPoller);
										window._adbSearchPoller = null;
										document.getElementById('result').textContent = _('No Search results!');
										document.getElementById('run').classList.remove("spinning");
										buttons.forEach(function (btn) { btn.disabled = false; });
									}
								});
							}, 3000);
						});
						document.getElementById('search').focus();
					})
				}, _('Search'))
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
				E('input', { 'class': 'cbi-input-text', 'spellcheck': 'false', 'id': 'rep_filter' }, []),
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
						document.querySelectorAll('.cbi-page-actions button').forEach(b => b.disabled = true);
						document.querySelectorAll('.modal .right button').forEach(b => b.disabled = true);
						this.blur();
						this.classList.add('spinning');
						const top_count = document.getElementById('top_count').value;
						const res_count = document.getElementById('res_count').value;
						const search = document.getElementById('rep_filter').value.trim().replace(/[^\w.\-:]/g, '') || '+';
						L.resolveDefault(fs.write('/var/run/adblock/adblock.report', ''), '').then(function () {
							L.resolveDefault(fs.exec_direct('/etc/init.d/adblock', ['report', 'gen', top_count, res_count, search]), '');
							let attempts = 0;
							let poller = setInterval(function () {
								L.resolveDefault(fs.read('/var/run/adblock/adblock.report'), '').then(function (res) {
									res = (res || '').trim();
									if (res === '1') {
										clearInterval(poller);
										ui.hideModal();
										location.reload();
									} else if (res === '0') {
										// keep polling
									} else {
										attempts++;
										if (attempts >= 10) {
											clearInterval(poller);
											ui.hideModal();
											document.querySelectorAll('.cbi-page-actions button').forEach(b => b.disabled = false);
											ui.addNotification(null, E('p', _('Failed to generate adblock report!')), 'error');
										}
									}
								});
							}, 3000);
						});
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
						sessionStorage.removeItem('mapData');
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
		let content = [];

		if (dnsreport) {
			try {
				content = JSON.parse(dnsreport[0]);
			} catch (e) {
				content[0] = "";
			}
		} else {
			content[0] = "";
		}

		const total = Number(content[0].total || 0);
		const blocked = Number(content[0].blocked || 0);
		const allowed = Math.max(total - blocked, 0);
		let percent = parseFloat(content[0].percent);
		if (!isFinite(percent)) {
			percent = total > 0 ? (blocked / total) * 100 : 0;
		}

		/*
			scoped theme palette

			Neutral surfaces are derived from translucent grey so they work on top
			of any LuCI theme background. Only the semantic colors are switched per
			color scheme, and both variants are chosen to stay readable either way.
		*/
		const style = E('style', { 'type': 'text/css' }, [
			'#adb-dash {' +
			'--adb-card-bg: rgba(128,128,128,.07);' +
			'--adb-card-border: rgba(128,128,128,.28);' +
			'--adb-track: rgba(128,128,128,.25);' +
			'--adb-muted: GrayText;' +
			'--adb-blocked: #c0392b;' +
			'--adb-allowed: #1f8a5f;' +
			'--adb-neutral: #2f6fb0;' +
			'--adb-warn: #a8760a;' +
			'--adb-blocked-bg: rgba(192,57,43,.14);' +
			'--adb-allowed-bg: rgba(31,138,95,.14);' +
			'--adb-warn-bg: rgba(168,118,10,.16);' +
			'}' +
			'@media (prefers-color-scheme: dark) {' +
			'#adb-dash {' +
			'--adb-blocked: #e8897e;' +
			'--adb-allowed: #63c79b;' +
			'--adb-neutral: #7fb3e8;' +
			'--adb-warn: #d9ab4e;' +
			'}}' +
			'#adb-dash .adb-grid { display: grid; gap: .75em; margin-bottom: 1em; }' +
			'#adb-dash .adb-kpis { grid-template-columns: repeat(auto-fit, minmax(min(9em, 100%), 1fr)); }' +
			'#adb-dash .adb-tops { grid-template-columns: repeat(auto-fit, minmax(min(16em, 100%), 1fr)); }' +
			'#adb-dash .adb-card { background: var(--adb-card-bg); border: 1px solid var(--adb-card-border); border-radius: 8px; padding: .7em .9em; min-width: 0; overflow-wrap: break-word; }' +
			'#adb-dash .adb-label { font-size: .85em; color: var(--adb-muted); }' +
			'#adb-dash .adb-value { font-size: 1.6em; line-height: 1.3; font-variant-numeric: tabular-nums; }' +
			'#adb-dash .adb-head { display: flex; align-items: baseline; justify-content: space-between; gap: .75em; flex-wrap: wrap; margin: 0 0 .5em; }' +
			'#adb-dash .adb-head h3 { margin: 0; }' +
			'#adb-dash .adb-time { font-family: monospace; font-size: .85em; color: var(--adb-muted); }' +
			'#adb-dash .adb-rate { display: flex; align-items: center; gap: .75em; }' +
			'#adb-dash .adb-donut { width: 3.4em; height: 3.4em; flex: 0 0 auto; }' +
			'#adb-dash .adb-arc { transition: stroke-dasharray .6s ease-out; }' +
			'#adb-dash .adb-row { margin-bottom: .55em; }' +
			'#adb-dash .adb-row:last-child { margin-bottom: 0; }' +
			'#adb-dash .adb-row-top { display: flex; justify-content: space-between; gap: .75em; font-size: .9em; margin-bottom: .2em; }' +
			'#adb-dash .adb-row-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }' +
			'#adb-dash .adb-row-cnt { color: var(--adb-muted); font-variant-numeric: tabular-nums; }' +
			'#adb-dash .adb-bar { height: 3px; background: var(--adb-track); border-radius: 2px; }' +
			'#adb-dash .adb-bar > div { height: 3px; border-radius: 2px; }' +
			'#adb-dash .adb-badge { display: inline-block; padding: 0 .5em; border-radius: 4px; font-size: .85em; }' +
			'#adb-dash .adb-nx { background: var(--adb-blocked-bg); color: var(--adb-blocked); }' +
			'#adb-dash .adb-ok { background: var(--adb-allowed-bg); color: var(--adb-allowed); }' +
			'#adb-dash .adb-sf { background: var(--adb-warn-bg); color: var(--adb-warn); }' +
			'@media (prefers-reduced-motion: reduce) { #adb-dash .adb-arc { transition: none; } }'
		]);

		function fmtNum(num) {
			return Number(num || 0).toLocaleString();
		}

		function kpiCard(label, value, color) {
			return E('div', { 'class': 'adb-card' }, [
				E('div', { 'class': 'adb-label' }, [label]),
				E('div', { 'class': 'adb-value', 'style': color ? 'color:var(--adb-' + color + ')' : '' }, [value])
			]);
		}

		/* SVG needs createElementNS, E() cannot be used here */
		function makeDonut(pct) {
			const ns = 'http://www.w3.org/2000/svg';
			function svgNode(tag, attrs) {
				const node = document.createElementNS(ns, tag);
				for (const key in attrs) {
					node.setAttribute(key, attrs[key]);
				}
				return node;
			}
			const svg = svgNode('svg', { 'class': 'adb-donut', 'viewBox': '0 0 42 42', 'role': 'img' });
			const title = document.createElementNS(ns, 'title');
			title.textContent = _('Block Rate') + ': ' + pct.toFixed(2) + '%';
			svg.appendChild(title);
			svg.appendChild(svgNode('circle', {
				'cx': '21', 'cy': '21', 'r': '15.9155', 'fill': 'none',
				'stroke': 'var(--adb-track)', 'stroke-width': '5'
			}));
			const arc = svgNode('circle', {
				'class': 'adb-arc', 'cx': '21', 'cy': '21', 'r': '15.9155', 'fill': 'none',
				'stroke': 'var(--adb-blocked)', 'stroke-width': '5',
				'stroke-dasharray': '0 100', 'stroke-dashoffset': '25'
			});
			svg.appendChild(arc);
			/* run once the node is attached, so the transition applies */
			setTimeout(function () {
				arc.setAttribute('stroke-dasharray', pct.toFixed(2) + ' ' + (100 - pct).toFixed(2));
			}, 50);
			return svg;
		}

		function topCard(title, list, color, linkify) {
			const entries = Array.isArray(list) ? list : [];
			const peak = entries.length ? Number(entries[0].count) || 0 : 0;
			const rows = entries.map(function (entry) {
				const count = Number(entry.count) || 0;
				const width = peak > 0 ? Math.round((count / peak) * 100) : 0;
				return E('div', { 'class': 'adb-row' }, [
					E('div', { 'class': 'adb-row-top' }, [
						E('span', { 'class': 'adb-row-name' }, [
							linkify ? makeDomainLink(entry.address) : entry.address
						]),
						E('span', { 'class': 'adb-row-cnt' }, [fmtNum(count)])
					]),
					E('div', { 'class': 'adb-bar' }, [
						E('div', { 'style': 'width:' + width + '%; background:var(--adb-' + color + ')' })
					])
				]);
			});
			return E('div', { 'class': 'adb-card' }, [
				E('div', { 'class': 'adb-head' }, [E('h3', {}, [title])]),
				rows.length ? E('div', {}, rows) : E('em', { 'class': 'adb-label' }, [_('No data.')])
			]);
		}

		const tbl_requests = E('table', { 'class': 'table', 'id': 'requests' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th' }, _('Date')),
				E('th', { 'class': 'th' }, _('Time')),
				E('th', { 'class': 'th' }, _('Client')),
				E('th', { 'class': 'th' }, _('Interface')),
				E('th', { 'class': 'th' }, _('Type')),
				E('th', { 'class': 'th' }, _('Domain')),
				E('th', { 'class': 'th' }, _('Answer')),
				E('th', { 'class': 'th' }, _('Action'))
			])
		]);

		const requests = Array.isArray(content[0].requests) ? content[0].requests : [];

		function updateRequests(filter) {
			const rows = [];
			for (let i = 0; i < requests.length; i++) {
				const request = requests[i];
				if (filter) {
					const haystack = [request.date, request.time, request.client,
					request.iface, request.type, request.domain, request.rc].join(' ').toLowerCase();
					if (haystack.indexOf(filter) === -1) {
						continue;
					}
				}
				let button, badge;
				if (request.rc === 'NX') {
					badge = E('span', { 'class': 'adb-badge adb-nx' }, [request.rc]);
					button = E('button', {
						'class': 'btn cbi-button cbi-button-positive',
						'style': 'word-break: inherit',
						'name': 'allowlist',
						'title': 'Add to Allowlist',
						'value': request.domain,
						'click': handleAction
					}, [_('Allowlist...')]);
				} else {
					badge = E('span', {
						'class': 'adb-badge ' + (request.rc === 'SF' ? 'adb-sf' : 'adb-ok')
					}, [request.rc]);
					button = E('button', {
						'class': 'btn cbi-button cbi-button-negative',
						'style': 'word-break: inherit',
						'name': 'blocklist',
						'title': 'Add to Blocklist',
						'value': request.domain,
						'click': handleAction
					}, [_('Blocklist...')]);
				}
				rows.push([
					request.date,
					request.time,
					request.client,
					request.iface,
					request.type,
					makeDomainLink(request.domain),
					badge,
					button
				]);
			}
			cbi_update_table(tbl_requests, rows, E('em', {}, [_('No matching DNS requests.')]));
		}
		updateRequests('');

		const timeframe = (content[0].start_date || '-') + ' ' + (content[0].start_time || '-') +
			' \u2192 ' + (content[0].end_date || '-') + ' ' + (content[0].end_time || '-');

		const page = E('div', { 'class': 'cbi-map', 'id': 'adb-dash' }, [
			style,
			E('div', { 'class': 'cbi-section' }, [
				E('p', _('This tab displays the most recently generated DNS report. Use the \'Refresh\' button to update it.')),
				E('div', { 'class': 'adb-head' }, [
					E('h3', {}, [_('Overview')]),
					E('span', { 'class': 'adb-time' }, [timeframe])
				]),
				E('div', { 'class': 'adb-grid adb-kpis' }, [
					kpiCard(_('Total'), fmtNum(total), null),
					kpiCard(_('Blocked'), fmtNum(blocked), 'blocked'),
					kpiCard(_('Allowed'), fmtNum(allowed), 'allowed'),
					E('div', { 'class': 'adb-card adb-rate' }, [
						makeDonut(percent),
						E('div', {}, [
							E('div', { 'class': 'adb-label' }, [_('Block Rate')]),
							E('div', { 'class': 'adb-value' }, [percent.toFixed(2) + '%'])
						])
					])
				]),
				E('div', { 'class': 'adb-grid adb-tops' }, [
					topCard(_('Top Clients'), content[0].top_clients, 'neutral', false),
					topCard(_('Top Domains'), content[0].top_domains, 'allowed', true),
					topCard(_('Top Blocked Domains'), content[0].top_blocked, 'blocked', true)
				]),
				E('div', { 'class': 'adb-head' }, [
					E('h3', {}, [_('Latest DNS Requests')]),
					E('input', {
						'type': 'text',
						'class': 'cbi-input-text',
						'style': 'width:14em',
						'spellcheck': 'false',
						'placeholder': _('Filter'),
						'keyup': function (ev) {
							updateRequests(ev.target.value.trim().toLowerCase());
						}
					})
				]),
				tbl_requests
			]),
			E('div', { 'class': 'cbi-page-actions' }, [
				E('button', {
					'class': 'btn cbi-button cbi-button-apply',
					'style': 'float:none;margin-right:.4em;',
					'id': 'btnTest',
					'title': 'Adblock Test',
					'click': function () {
						window.open('https://adblock.turtlecute.org/', '_blank', 'noopener,noreferrer');
					}
				}, [_('Adblock Test')]),
				E('button', {
					'class': 'btn cbi-button cbi-button-apply',
					'style': 'float:none;margin-right:.4em;',
					'id': 'btnMap',
					'title': 'Map',
					'disabled': 'disabled',
					'click': ui.createHandlerFn(this, function () {
						if (Array.isArray(content[1]) && content[1].length > 1) {
							sessionStorage.setItem('mapData', JSON.stringify(content[1]));
							return handleAction('map');
						} else {
							if (!mapNotMsg) {
								mapNotMsg = true;
								return ui.addNotification(null, E('p', _('No GeoIP Map data!')), 'info');
							}
						}
					})
				}, [_('Map')]),
				E('button', {
					'class': 'btn cbi-button cbi-button-apply',
					'style': 'float:none;margin-right:.4em;',
					'title': 'Blocklist Search',
					'click': ui.createHandlerFn(this, function () {
						return handleAction('search');
					})
				}, [_('Blocklist Search...')]),
				E('button', {
					'class': 'btn cbi-button cbi-button-positive important',
					'style': 'float:none;margin-right:.4em;',
					'title': 'Refresh',
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
