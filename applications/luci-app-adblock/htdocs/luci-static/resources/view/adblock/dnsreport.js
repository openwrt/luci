'use strict';
'require view';
'require fs';
'require ui';
'require uci';

var notMsg = false, errMsg = false;

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
									if (!notMsg) {
										notMsg = true;
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
						L.resolveDefault(fs.read_direct('/etc/adblock/adblock.allowlist'), '')
							.then(function (res) {
								var domain = document.getElementById('allowlist').value.trim().toLowerCase().replace(/[^a-z0-9\.\-]/g, '');
								var pattern = new RegExp('^' + domain.replace(/[\.]/g, '\\.') + '$', 'm');
								if (res.search(pattern) === -1) {
									var allowlist = res + domain + '\n';
									fs.write('/etc/adblock/adblock.allowlist', allowlist);
									if (!notMsg) {
										notMsg = true;
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
						const domain = document.getElementById('search').value.trim().toLowerCase().replace(/[^a-z0-9\.\-]/g, '');
						if (domain) {
							document.getElementById('run').classList.add("spinning");
							document.getElementById('search').value = domain;
							document.getElementById('result').textContent = 'The query is running, please wait...';
							L.resolveDefault(fs.exec_direct('/etc/init.d/adblock', ['query', domain])).then(function (res) {
								const result = document.getElementById('result');
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

		let rows_top = [];
		const tbl_top = E('table', { 'class': 'table', 'id': 'top_10' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th right' }, _('Count')),
				E('th', { 'class': 'th' }, _('Clients')),
				E('th', { 'class': 'th right' }, _('Count')),
				E('th', { 'class': 'th' }, _('Domains')),
				E('th', { 'class': 'th right' }, _('Count')),
				E('th', { 'class': 'th' }, _('Blocked Domains'))
			])
		]);

		let max = 0;
		if (content[0].top_clients && content[0].top_domains && content[0].top_blocked) {
			max = Math.max(content[0].top_clients.length, content[0].top_domains.length, content[0].top_blocked.length);
		}
		for (let i = 0; i < max; i++) {
			let a_cnt = '\xa0', a_addr = '\xa0', b_cnt = '\xa0', b_addr = '\xa0', c_cnt = '\xa0', c_addr = '\xa0';
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

		let rows_requests = [];
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

		max = 0;
		if (content[0].requests) {
			let button;
			max = content[0].requests.length;
			for (let i = 0; i < max; i++) {
				if (content[0].requests[i].rc === 'NX') {
					button = E('button', {
						'class': 'btn cbi-button cbi-button-positive',
						'style': 'word-break: inherit',
						'name': 'allowlist',
						'title': 'Add to Allowlist',
						'value': content[0].requests[i].domain,
						'click': handleAction
					}, [_('Allowlist...')]);
				} else {
					button = E('button', {
						'class': 'btn cbi-button cbi-button-negative',
						'style': 'word-break: inherit',
						'name': 'blocklist',
						'title': 'Add to Blocklist',
						'value': content[0].requests[i].domain,
						'click': handleAction
					}, [_('Blocklist...')]);
				}
				rows_requests.push([
					content[0].requests[i].date,
					content[0].requests[i].time,
					content[0].requests[i].client,
					content[0].requests[i].iface,
					content[0].requests[i].type,
					'<a href="https://ip-api.com/#' + encodeURIComponent(content[0].requests[i].domain) + '" target="_blank" rel="noreferrer noopener" title="Domain Lookup">' + content[0].requests[i].domain + '</a>',
					content[0].requests[i].rc,
					button
				]);
			}
		}
		cbi_update_table(tbl_requests, rows_requests);

		const page = E('div', { 'class': 'cbi-map', 'id': 'map' }, [
			E('div', { 'class': 'cbi-section' }, [
				E('p', _('This tab displays the most recently generated DNS report. Use the \‘Refresh\’ button to update it.')),
				E('div', { 'class': 'cbi-value', 'style': 'position:relative;min-height:220px' }, [
					E('div', {
						'style': 'position:absolute; top:0; right:0; text-align:center'
					}, [
						E('div', { 'style': 'font-size:12px; color:#37c; margin-bottom:8px; font-family:monospace; line-height:1.3; text-align:right' }, [
							E('div', { 'style': 'font-size:12px; color:#37c; margin-bottom:8px' }, [
								E('div', {}, 'Start: ' + (content[0].start_date || '-') + ' ' + (content[0].start_time || '-')),
								E('div', {}, 'End: ' + (content[0].end_date || '-') + ' ' + (content[0].end_time || '-'))
							])
						]),
						E('canvas', {
							'id': 'dnsPie',
							'width': 160,
							'height': 160,
							'style': 'max-width:160px; width:28vw; height:auto; cursor:pointer;'
						}),
						E('div', { 'style': 'margin-top:5px; font-size:12px' }, [
							E('span', { 'style': 'color:#b04a4a' }, '■ Blocked'),
							E('span', { 'style': 'margin-left:10px;color:#6a8f6a' }, '■ Allowed')
						])
					])
				])
			]),
			E('div', { 'class': 'cbi-section' }, [
				E('div', { 'class': 'left' }, [
					E('h3', { 'style': 'white-space:nowrap' }, _('Top Statistics')),
					tbl_top
				])
			]),
			E('br'),
			E('div', { 'class': 'cbi-section' }, [
				E('div', { 'class': 'left' }, [
					E('h3', { 'style': 'white-space:nowrap' }, _('Latest DNS Requests')),
					tbl_requests
				])
			]),
			E('div', { 'class': 'cbi-page-actions' }, [
				E('button', {
					'class': 'btn cbi-button cbi-button-apply',
					'style': 'float:none;margin-right:.4em;',
					'id': 'btnTest',
					'title': 'Adblock Test',
					'click': function() {
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
				}, [_('Map')]),
				E('button', {
					'class': 'btn cbi-button cbi-button-apply',
					'style': 'float:none;margin-right:.4em;',
					'title': 'Blocklist Query',
					'click': ui.createHandlerFn(this, function () {
						return handleAction('query');
					})
				}, [_('Blocklist Query...')]),
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
		/* Draw Pie Chart with Tooltip */
		const tooltip = E('div', {
			id: 'dnsPieTooltip',
			style: 'position:absolute; padding:6px 10px; background:#333; color:#fff; border-radius:4px; font-size:12px; pointer-events:none; opacity:0; transition:opacity .15s; z-index:9999'
		});
		document.body.appendChild(tooltip);
		setTimeout(function() {
			const total = Number(content[0].total || 0);
			const blocked = Number(content[0].blocked || 0);
			const allowed = Math.max(total - blocked, 0);

			const canvas = document.getElementById('dnsPie');
			if (!canvas || total <= 0)
				return;

			const ctx = canvas.getContext('2d');
			const colors = {
				blocked: '#b04a4a',
				allowed: '#6a8f6a'
			};

			function drawPie(rotation = 0) {
				const w = canvas.clientWidth;
				canvas.width = w;
				canvas.height = w;
				const cx = w / 2;
				const cy = w / 2;
				const r  = (w / 2) - 4;
				const blockedAngle = (blocked / total) * 2 * Math.PI;
				const allowedAngle = (allowed / total) * 2 * Math.PI;

				ctx.clearRect(0, 0, w, w);
				ctx.beginPath();
				ctx.moveTo(cx, cy);
				ctx.fillStyle = colors.blocked;
				ctx.arc(cx, cy, r, rotation, rotation + blockedAngle);
				ctx.fill();

				ctx.beginPath();
				ctx.moveTo(cx, cy);
				ctx.fillStyle = colors.allowed;
				ctx.arc(cx, cy, r, rotation + blockedAngle, rotation + blockedAngle + allowedAngle);
				ctx.fill();

				ctx.beginPath();
				ctx.arc(cx, cy, r, 0, 2 * Math.PI);
				ctx.strokeStyle = '#fff';
				ctx.lineWidth = 2;
				ctx.stroke();
			}
			let rot = 0;
			function animate() {
				rot += 0.10;
				drawPie(rot);
				if (rot < Math.PI * 2)
					requestAnimationFrame(animate);
			}
			animate();
			window.addEventListener('resize', function() {
				drawPie(rot);
			});
			const tooltip = document.getElementById('dnsPieTooltip');
			canvas.addEventListener('mousemove', function(ev) {
				const rect = canvas.getBoundingClientRect();
				const x = ev.clientX - rect.left;
				const y = ev.clientY - rect.top;
				const cx = canvas.width / 2;
				const cy = canvas.height / 2;
				const dx = x - cx;
				const dy = y - cy;
				const dist = Math.sqrt(dx*dx + dy*dy);
				if (dist > canvas.width/2 - 4) {
					tooltip.style.opacity = 0;
					return;
				}
				let angle = Math.atan2(dy, dx);
				if (angle < 0) angle += 2 * Math.PI;

				const blockedAngle = (blocked / total) * 2 * Math.PI;
				let label, abs, pct;
				if (angle < blockedAngle) {
					label = 'Blocked';
					abs = blocked;
					pct = ((blocked / total) * 100).toFixed(1) + '%';
				} else {
					label = 'Allowed';
					abs = allowed;
					pct = ((allowed / total) * 100).toFixed(1) + '%';
				}
				tooltip.textContent = `${label}: ${abs} (${pct})`;
				tooltip.style.left = ev.pageX + 12 + 'px';
				tooltip.style.top = ev.pageY + 12 + 'px';
				tooltip.style.opacity = 1;
			});
			canvas.addEventListener('mouseleave', function() {
				tooltip.style.opacity = 0;
			});
		}, 0);
		return page;
	},
	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
