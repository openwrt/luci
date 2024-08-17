/* This is free software, licensed under the Apache License, Version 2.0
 *
 * Copyright (C) 2024 Sergey Ponomarev <stokito@gmail.com>
 */

'use strict';
'require view';
'require fs';

function listTunnels() {
	let command = '/usr/bin/cloudflared';
	let commandArgs = ['tunnel', 'list', '-o', 'json'];
	return fs.exec(command, commandArgs).then(function (res) {
		if (res.code === 0) {
			return JSON.parse(res.stdout);
		} else {
			throw new Error(res.stdout + ' ' + res.stderr);
		}
	});
}

return view.extend({
	handleSaveApply: null,
	handleSave: null,
	handleReset: null,

	load: function () {
		return Promise.all([
			listTunnels()
		]);
	},

	render: function (data) {
		var tunnels = data[0];

		var tunnelRows = tunnels.map(function (tunnel, index) {
			var rowClass = index % 2 === 0 ? 'cbi-rowstyle-1' : 'cbi-rowstyle-2';
			var tunneldate = new Date(tunnel.created_at).toLocaleString();
			return E('tr', { 'class': 'tr ' + rowClass }, [
				E('td', {'class': 'td'}, tunnel.name),
				E('td', {'class': 'td'}, tunnel.id),
				E('td', {'class': 'td'}, tunneldate),
				E('td', {'class': 'td'}, tunnel.connections.length)
			]);
		});

		var tunnelTable = [
			E('h3', _('Tunnels Information')),
			E('table', { 'class': 'table cbi-section-table' }, [
				E('tr', { 'class': 'tr table-titles' }, [
					E('th', {'class': 'th'}, _('Name')),
					E('th', {'class': 'th'}, _('ID')),
					E('th', {'class': 'th'}, _('Created At')),
					E('th', {'class': 'th'}, _('Connections'))
				]),
				E(tunnelRows)
			])
		];

		var connectionsTables = tunnels.map(function (tunnel) {
			var connectionsTable;
			if (tunnel.connections.length > 0) {
				var connectionRows = tunnel.connections.map(function (connection, index) {
					var rowClass = index % 2 === 0 ? 'cbi-rowstyle-1' : 'cbi-rowstyle-2';
					var connectiondate = new Date(connection.opened_at).toLocaleString();
					return E('tr', { 'class': 'tr ' + rowClass }, [
						E('td', {'class': 'td'}, connection.id),
						E('td', {'class': 'td'}, connection.origin_ip),
						E('td', {'class': 'td'}, connectiondate),
						E('td', {'class': 'td'}, connection.colo_name)
					]);
				});

				connectionsTable = E('table', { 'class': 'table cbi-section-table' }, [
					E('tr', { 'class': 'tr table-titles' }, [
						E('th', {'class': 'th'}, _('Connection ID')),
						E('th', {'class': 'th'}, _('Origin IP')),
						E('th', {'class': 'th'}, _('Opened At')),
						E('th', {'class': 'th'}, _('Data Center'))
					]),
					E(connectionRows)
				]);
			} else {
				connectionsTable = E('div', {'class':'cbi-value center'}, [
					E('em', _('No connections'))
				]);
			}

			return E('div', {'class': 'cbi-section'}, [
				E('h3', _('Connections') + ' ' + tunnel.name),
				E(connectionsTable)
			]);
		});

		return E([], [
			E('h2', { 'class': 'section-title' }, _('Tunnels')),
			E('div', {'class': 'cbi-section'}, tunnelTable),
			E(connectionsTables)
		]);
	}
});
