'use strict';
// overview.js — sing-box dashboard. Shows running state, active server,
// uptime, TUN state, live traffic and connection count. Buttons: Start,
// Stop, Restart, Apply Config (regenerate + sing-box check + restart).
// Data is fetched on load via status.sh and re-read after each action.

'require ui';
'require view';
'require fs';
'require uci';
'require dom';
'require poll';

function parseJSON(str, fallback) {
	try { return JSON.parse(str); } catch(e) { return fallback; }
}

function formatBytes(bytes) {
	if (!bytes || bytes === 0) return '0 B/s';
	var units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
	var i = Math.floor(Math.log(bytes) / Math.log(1024));
	return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
}

function formatUptime(seconds) {
	if (!seconds || seconds === 0) return '-';
	var days = Math.floor(seconds / 86400);
	var hours = Math.floor((seconds % 86400) / 3600);
	var mins = Math.floor((seconds % 3600) / 60);
	var parts = [];
	if (days > 0) parts.push(days + 'd');
	if (hours > 0) parts.push(hours + 'h');
	parts.push(mins + 'm');
	return parts.join(' ');
}

return view.extend({
	load: function() {
		// Each call is wrapped so a single failure (rpcd ACL glitch, latency
		// probe timeout) doesn't break the whole dashboard.
		function safeExec(path, args) {
			return fs.exec(path, args).then(
				function(r) { return r; },
				function(err) { console.warn('[singbox] fs.exec failed:', path, args, err); return { stdout: '', code: -1 }; }
			);
		}

		return Promise.all([
			safeExec('/usr/share/singbox/status.sh', ['127.0.0.1:9090', 'status']),
			safeExec('/usr/share/singbox/status.sh', ['127.0.0.1:9090', 'servers']),
			safeExec('/usr/share/singbox/status.sh', ['127.0.0.1:9090', 'connections', '25'])
		]).then(function(results) {
			return {
				status: parseJSON(results[0].stdout || results[0].output, {}),
				servers: parseJSON(results[1].stdout || results[1].output, []),
				connections: parseJSON(results[2].stdout || results[2].output, [])
			};
		});
	},

	render: function(data) {
		var status = data.status || {};
		var servers = data.servers || [];
		var connections = data.connections || [];

		var running = status.running;
		var statusColor = running ? '#4caf50' : '#f44336';
		var statusText = running ? _('Running') : _('Stopped');

		var traffic = status.traffic || { up: 0, down: 0 };

		var table = E('div', { class: 'table' }, [
			E('div', { class: 'tr table-titles' }, [
				E('div', { class: 'th', style: 'width:30%;' }, _('Status')),
				E('div', { class: 'td' }, [
					E('span', { style: 'display:inline-block;width:12px;height:12px;border-radius:50%;background:' + statusColor + ';margin-right:8px;' }),
					statusText
				])
			]),
			E('div', { class: 'tr' }, [
				E('div', { class: 'th' }, _('Active Server')),
				E('div', { class: 'td' }, status.active_server || '-')
			]),
			E('div', { class: 'tr' }, [
				E('div', { class: 'th' }, _('Uptime')),
				E('div', { class: 'td' }, formatUptime(status.uptime))
			]),
			E('div', { class: 'tr' }, [
				E('div', { class: 'th' }, _('TUN Interface')),
				E('div', { class: 'td' }, status.tun ? _('Active') : _('Inactive'))
			]),
			E('div', { class: 'tr' }, [
				E('div', { class: 'th' }, _('Traffic')),
				E('div', { class: 'td' }, [
					E('span', { style: 'color:#4caf50;' }, '↓ ' + formatBytes(traffic.down)),
					E('span', {}, ' '),
					E('span', { style: 'color:#2196f3;' }, '↑ ' + formatBytes(traffic.up))
				])
			]),
			E('div', { class: 'tr' }, [
				E('div', { class: 'th' }, _('Connections')),
				E('div', { class: 'td' }, String(status.connections || 0))
			])
		]);

		var btnStart = E('button', {
			class: 'btn cbi-button-positive',
			style: 'margin-right:8px;',
			click: function(ev) {
				ui.addNotification(null, E('p', _('Starting sing-box...')));
				fs.exec('/etc/init.d/sing-box', ['start']).then(function() {
					setTimeout(function() { location.reload(); }, 3000);
				});
			}
		}, _('Start'));

		var btnStop = E('button', {
			class: 'btn cbi-button-negative',
			style: 'margin-right:8px;',
			click: function(ev) {
				fs.exec('/etc/init.d/sing-box', ['stop']).then(function() {
					setTimeout(function() { location.reload(); }, 2000);
				});
			}
		}, _('Stop'));

		var btnRestart = E('button', {
			class: 'btn cbi-button',
			style: 'margin-right:8px;',
			click: function(ev) {
				ui.addNotification(null, E('p', _('Restarting sing-box...')));
				fs.exec('/etc/init.d/sing-box', ['stop']).then(function() {
					return fs.exec('/etc/init.d/sing-box', ['start']);
				}).then(function() {
					setTimeout(function() { location.reload(); }, 3000);
				});
			}
		}, _('Restart'));

		var btnApply = E('button', {
			class: 'btn cbi-button-action',
			click: function(ev) {
				var dlg = ui.showModal(_('Applying Configuration'), [
					E('p', { class: 'spinning' }, _('Generating and validating config...'))
				]);
				fs.exec('/usr/share/singbox/generate-config.sh').then(function(res) {
					if (res.code === 0) {
						return fs.exec('/etc/init.d/sing-box', ['stop']).then(function() {
							return new Promise(function(resolve) {
								setTimeout(function() {
									fs.exec('/etc/init.d/sing-box', ['start']).then(resolve);
								}, 2000);
							});
						}).then(function() {
							ui.hideModal();
							ui.addNotification(null, E('p', _('Configuration applied successfully')));
							setTimeout(function() { location.reload(); }, 2000);
						});
					} else {
						ui.hideModal();
						ui.addNotification(null, [
							E('p', _('Configuration validation failed:')),
							E('pre', { style: 'color:#f44336;' }, res.stdout || res.stderr || 'Unknown error')
						]);
					}
				});
			}
		}, _('Apply Config'));

		var serverRows = servers.map(function(srv) {
			var statusIcon = srv.status === 'online' ? '✅' : '❌';
			var latency = srv.latency > 0 ? srv.latency + ' ms' : '-';
			return E('div', { class: 'tr' }, [
				E('div', { class: 'td' }, srv.name),
				E('div', { class: 'td' }, srv.server + ':' + srv.port),
				E('div', { class: 'td' }, statusIcon + ' ' + srv.status),
				E('div', { class: 'td' }, latency)
			]);
		});

		if (serverRows.length === 0) {
			serverRows = [E('div', { class: 'tr' }, [E('div', { class: 'td', colspan: 4, style: 'text-align:center;' }, _('No servers configured'))])];
		}

		var serverTable = E('div', { class: 'table' }, [
			E('div', { class: 'tr table-titles' }, [
				E('div', { class: 'th' }, _('Name')),
				E('div', { class: 'th' }, _('Address')),
				E('div', { class: 'th' }, _('Status')),
				E('div', { class: 'th' }, _('Latency'))
			]),
			...serverRows
		]);

		// Live connections section. The table itself is rebuilt on demand
		// (load + Refresh button) — NOT in the 3-second poll loop, to keep
		// the router idle when the user is just glancing at the dashboard.
		// Column headers are click-sortable; sort state lives in this closure.
		var connectionsData = [];
		var sortState = { col: 'total', dir: 'desc' };

		// Column metadata: id → {label, sortValue, style}
		var connColumns = [
			{ id: 'host',  label: _('Host'),  flex: 2, sortValue: function(c) { return String(c.host || c.dest || '').toLowerCase(); } },
			{ id: 'net',   label: _('Net'),   flex: 0, sortValue: function(c) { return String(c.network || '').toLowerCase(); } },
			{ id: 'chain', label: _('Chain'), flex: 2, sortValue: function(c) { return (c.chains || []).join(' ').toLowerCase(); } },
			{ id: 'down',  label: _('↓ Down'), flex: 0, sortValue: function(c) { return Number(c.down || 0); } },
			{ id: 'up',    label: _('↑ Up'),   flex: 0, sortValue: function(c) { return Number(c.up || 0); } },
			{ id: 'total', label: _('Total'),  flex: 0, sortValue: function(c) { return Number(c.total || ((c.down || 0) + (c.up || 0))); }, hidden: true }
		];

		function sortConnections() {
			var col = connColumns.find(function(c) { return c.id === sortState.col; }) || connColumns[0];
			var dirMul = sortState.dir === 'asc' ? 1 : -1;
			connectionsData.sort(function(a, b) {
				var va = col.sortValue(a), vb = col.sortValue(b);
				if (va < vb) return -1 * dirMul;
				if (va > vb) return  1 * dirMul;
				return 0;
			});
		}

		var connHost = E('div', { class: 'table' }, [
			E('div', { class: 'tr table-titles' },
				connColumns.filter(function(c) { return !c.hidden; }).map(function(col) {
					var th = E('div', {
						class: 'th',
						style: (col.flex ? 'flex:' + col.flex + ';cursor:pointer;' : 'cursor:pointer;') + ' user-select:none;'
					}, [col.label + ' ']);
					th.addEventListener('click', function() {
						if (sortState.col === col.id) {
							sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
						} else {
							sortState.col = col.id;
							sortState.dir = (col.id === 'host' || col.id === 'net' || col.id === 'chain') ? 'asc' : 'desc';
						}
						sortConnections();
						renderConnections();
						updateSortIndicators();
					});
					th.dataset.colId = col.id;
					return th;
				})
			)
		]);

		function updateSortIndicators() {
			connHost.querySelectorAll('.th[data-col-id]').forEach(function(th) {
				var isActive = th.dataset.colId === sortState.col;
				var arrow = isActive ? (sortState.dir === 'asc' ? ' ↑' : ' ↓') : '';
				var label = connColumns.find(function(c) { return c.id === th.dataset.colId; }).label;
				th.firstChild.nodeValue = label + arrow;
			});
		}

		function renderConnections() {
			// Drop body rows (keep header).
			while (connHost.children.length > 1) {
				connHost.removeChild(connHost.lastChild);
			}
			if (!connectionsData || connectionsData.length === 0) {
				connHost.appendChild(E('div', { class: 'tr' }, [
					E('div', { class: 'td', style: 'text-align:center;opacity:0.6;' }, _('No active connections'))
				]));
				return;
			}
			connectionsData.forEach(function(c) {
				var chain = (c.chains || []).join(' → ') || '-';
				connHost.appendChild(E('div', { class: 'tr' }, [
					E('div', { class: 'td', style: 'flex:2;word-break:break-all;' }, c.host || c.dest || '-'),
					E('div', { class: 'td' }, String(c.network || '-').toUpperCase()),
					E('div', { class: 'td', style: 'flex:2;' }, chain),
					E('div', { class: 'td', style: 'color:#4caf50;' }, formatBytes(c.down)),
					E('div', { class: 'td', style: 'color:#2196f3;' }, formatBytes(c.up))
				]));
			});
		}

		function setConnections(conns) {
			connectionsData = Array.isArray(conns) ? conns : [];
			// Recompute total in case backend didn't (older status.sh build).
			connectionsData.forEach(function(c) {
				if (c.total == null) c.total = (Number(c.down) || 0) + (Number(c.up) || 0);
			});
			sortConnections();
			renderConnections();
			updateSortIndicators();
		}
		setConnections(connections);

		var connRefresh = E('button', {
			class: 'btn',
			style: 'margin-left:8px;',
			click: function(ev) {
				ev.target.disabled = true;
				ev.target.textContent = _('Loading…');
				fs.exec('/usr/share/singbox/status.sh', ['127.0.0.1:9090', 'connections', '25']).then(function(res) {
					var data = parseJSON(res.stdout || res.output || [], []);
					setConnections(data);
				}).catch(function() {}).then(function() {
					ev.target.disabled = false;
					ev.target.textContent = _('Refresh');
				});
			}
		}, _('Refresh'));

		// Smart button state: buttons stay visible but disabled when they'd be no-ops.
		//   Running  → Start disabled, Stop/Restart enabled, Apply enabled
		//   Stopped  → Start enabled,   Stop/Restart disabled, Apply enabled
		btnStart.disabled   = !!running;
		btnStop.disabled    = !running;
		btnRestart.disabled = !running;

		return E('div', { class: 'cbi-map' }, [
			E('h2', { name: 'content' }, _('sing-box VPN')),
			E('div', { class: 'cbi-section' }, [
				E('div', { style: 'margin-bottom:15px;' }, [btnStart, btnStop, btnRestart, btnApply]),
				table
			]),
			E('div', { class: 'cbi-section' }, [
				E('h3', {}, _('Server Status')),
				serverTable
			]),
			E('div', { class: 'cbi-section' }, [
				E('h3', {}, [
					_('Active Connections'),
					E('span', { style: 'font-weight:normal;color:#888;font-size:12px;margin-left:8px;' },
						'(' + connections.length + ')'),
					connRefresh
				]),
				connHost
			])
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
