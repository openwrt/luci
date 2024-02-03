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

		var tunnelsElList = [];
		for (var tunnel of tunnels) {
			var connectionsSection = [];
			if (tunnel.connections.length > 0) {
				var connectionsElList = [];
				for (let connection of tunnel.connections) {
					var dateOpenedAt = new Date(connection.opened_at).toLocaleString();
					connectionsElList.push(
						E('tr', [
							E('td', connection.id),
							E('td', connection.origin_ip),
							E('td', dateOpenedAt),
							E('td', connection.colo_name)
						])
					);
				}

				connectionsSection = [
					E('h5', _('Connections')),
					E('table', {'class': 'table cbi-section-table'}, [
						E('thead', [
							E('tr', {'class': 'tr table-titles'}, [
								E('th', {'class': 'th'}, 'ID'),
								E('th', {'class': 'th'}, _('Origin IP')),
								E('th', {'class': 'th'}, _('Opened At')),
								E('th', {'class': 'th'}, _('Data center')),
							]),
						]),
						E('tbody', connectionsElList)
					])
				];
			} else {
				connectionsSection = [E('em', _('No connections'))];
			}

			var tunnelEl = E('div', [
					E('h4', tunnel.name),
					E('span', 'ID '),
					E('span', tunnel.id),
					E('div', connectionsSection)
				]
			);
			tunnelsElList.push(tunnelEl);
		}
		return E([], [
			E('h2', {'class': 'section-title'}, _('Tunnels')),
			E('div', {'id': 'tunnels'}, tunnelsElList),
		]);
	}
});