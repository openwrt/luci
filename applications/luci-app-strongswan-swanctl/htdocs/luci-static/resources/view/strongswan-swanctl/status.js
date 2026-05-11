'use strict';
'require view';
'require dom';
'require poll';
'require fs';
'require ui';

function formatTime(seconds, selectCount) {
	const days = Math.floor(seconds / (60 * 60 * 24));
	const hours = Math.floor(seconds / (60 * 60)) % 24;
	const minutes = Math.floor(seconds / 60) % 60;
	seconds = Math.floor(seconds % 60);

	const times = [
		[days, _('Day'), _('Days')],
		[hours, _('Hour'), _('Hours')],
		[minutes, _('Minute'), _('Minutes')],
		[seconds, _('Second'), _('Seconds')]
	].filter(function ([time, singular, plural]) {
		return time > 0;
	});

	const selectedTimes = times.slice(0, selectCount);
	return selectedTimes.map(function ([time, singular, plural]) {
		const unit = time > 1 ? plural : singular;
		return '%d %s'.format(time, unit);
	}).join(', ');
}

function buildSection(name, table) {
	return E('div', { 'class': 'cbi-section' }, [
		E('h2', [name]),
		table
	]);
}

function buildTable(rows) {
	return E('table', { 'class': 'table', }, rows);
}

function buildKeyValueTable(kvPairs) {
	const rows = kvPairs.map(function (row) {
		return E('tr', { 'class': 'tr' }, [
			E('td', { 'class': 'td', 'width': '33%' }, E('strong', [row[0]])),
			E('td', { 'class': 'td' }, [row[1]])
		]);
	});
	return buildTable(rows);
}

function mapConnectionSas(conns, sas) {
	/* map connections to SAs and connection children to SA children */
	const connMap = new Map();
	const childConnMap = new Map();
	conns.forEach(function (connObject) {
		const [connName, conn] = Object.entries(connObject)[0];
		connMap.set(connName, conn);
		Object.entries(conn.children).forEach(function ([childName, child]) {
			childConnMap.set(childName, child);
		});
	});

	sas.forEach(function (saObject) {
		const [saName, sa] = Object.entries(saObject)[0];
		const connection = connMap.get(saName);
		if (connection) {
			connection.childSa = sa;
		}

		Object.entries(sa['child-sas']).forEach(function ([childSaName, childSa]) {
			const childConnection = childConnMap.get(childSaName);
			if (childConnection) {
				childConnection.childSa = childSa;
			}
		});
	});

	return conns;
}

function swanctlCommand(parameters) {
	return fs.exec('/usr/sbin/swanctl', parameters)
		.catch(e => ui.addNotification(null, E('p', e.message)));
}

function handleConnectionUp(connectionName) {
	return swanctlCommand(['--initiate', '--ike', connectionName]);
}

function handleConnectionDown(connectionName) {
	return swanctlCommand(['--terminate', '--ike', connectionName]);
}

function handleChildUp(childName) {
	return swanctlCommand(['--initiate', '--child', childName]);
}

function handleChildDown(childName) {
	return swanctlCommand(['--terminate', '--child', childName]);
}

function renderDetailsSection(connection, connectionName) {
	const sa = connection.sa;

	return buildSection(_('Details'), buildKeyValueTable([
		[_('Name'), connectionName],
		[_('Unique ID'), sa ? sa.uniqueid : ''],
		[_('Local Addresses'), connection.local_addrs.join(', ')],
		[_('Remote Addresses'), connection.remote_addrs.join(', ')],
		[_('Local Port'), connection.local_port],
		[_('Remote Port'), connection.remote_port],
		[_('Version'), connection.version],
		[_('Reauthentication Interval'), _('%d seconds').format(connection.reauth_time)],
		[_('Rekeying Interval'), _('%d seconds').format(connection.rekey_time)],
		[_('Established'), sa ? formatTime(parseInt(sa.established), 3) : '']
	]));
}

function handleChildDetails(childName, child, childSa) {
	const modal = buildSection(_('Details'), buildKeyValueTable([
		[_('Name'), childName],
		[_('Mode'), child.mode],
		[_('Protocol'), childSa ? childSa.protocol : ''],
		[_('Local Traffic Selectors'), child['local-ts'].join(', ')],
		[_('Remote Traffic Selectors'), child['remote-ts'].join(', ')],
		[_('Rekey in'), childSa ? _('%d seconds').format(childSa['rekey-time']) : ''],
		[_('Encryption Algorithm'), childSa ? childSa['encr-alg'] : ''],
		[_('Encryption Keysize'), childSa ? childSa['encr-keysize'] : ''],
		[_('Bytes in'), childSa ? childSa['bytes-in'] : ''],
		[_('Bytes out'), childSa ? childSa['bytes-out'] : ''],
		[_('Life Time'), childSa ? formatTime(parseInt(childSa['life-time']), 2) : ''],
		[_('Install Time'), childSa ? formatTime(parseInt(childSa['install-time']), 2) : ''],
		[_('SPI in'), childSa ? childSa['spi-in'] : ''],
		[_('SPI out'), childSa ? childSa['spi-out'] : '']
	]));

	ui.showModal(_('Child Details'), [modal, E('div', { 'class': 'right' }, [
		E('button', {
			'class': 'btn cbi-button',
			'click': ui.hideModal
		}, [_('Dismiss')])
	])], 'cbi-modal');
}

function renderChildTable(children) {
	const tableHeaders = [
		[_('Name')],
		[_('State')],
		[_('Mode')],
		[_('Protocol')],
		[_('Local Traffic Selectors')],
		[_('Remote Traffic Selectors')],
		[_('Rekey in')],
		[/* details button */],
		[/* up/down button */]
	]
	const childTableRows = [
		E('tr', { 'class': 'tr table-titles' }, tableHeaders.map(
			header => E('th', { 'class': 'th' }, header)
		))
	];

	Object.entries(children).forEach(([childName, child]) => {
		const childSa = child.ChildSa;
		const state = childSa ? childSa.state : _('Inactive');
		const isDown = !childSa;

		const tableValues = [
			[childName],
			[state],
			[child.mode],
			[childSa ? childSa.protocol : ''],
			[child['local-ts'].join(', ')],
			[child['remote-ts'].join(', ')],
			[childSa ? _('%d seconds').format(childSa['rekey-time']) : ''],
			[
				E('button', {
					'title': _('Details'),
					'class': 'btn cbi-button cbi-button-primary',
					'click': ui.createHandlerFn(null, handleChildDetails, childName, child, childSa)
				}, [_('Details')])
			],
			[
				E('button', {
					'title': _('Start'),
					'class': 'btn cbi-button cbi-button-positive',
					...(isDown ? {} : { 'disabled': 'disabled' }),
					'click': ui.createHandlerFn(null, handleChildUp, childName)
				}, [_('Start')]),
				E('button', {
					'title': _('Stop'),
					'class': 'btn cbi-button cbi-button-negative',
					...(isDown ? { 'disabled': 'disabled' } : {}),
					'click': ui.createHandlerFn(null, handleChildDown, childName)
				}, [_('Stop')])
			]
		];

		childTableRows.push(E('tr', { 'class': 'tr' }, tableValues.map(
			value => E('td', { 'class': 'td' }, value)
		)));
	});

	return E('table', { 'class': 'table' }, childTableRows);
}

function renderAuthTable(auths) {
	const authTableRows = [
		E('tr', { 'class': 'tr table-titles' }, [
			E('th', { 'class': 'th' }, [_('Class')]),
			E('th', { 'class': 'th' }, [_('ID')])
		])
	];

	auths.forEach(auth => {
		authTableRows.push(E('tr', { 'class': 'tr' }, [
			E('td', { 'class': 'td' }, [auth.class]),
			E('td', { 'class': 'td' }, [auth.id || ''])
		]));
	});

	return E('table', { 'class': 'table' }, authTableRows);
}

function filterConnectionAuths(connection, prefix) {
	const auths = Object.entries(connection).filter(([key, value]) => key.startsWith(prefix));
	return auths.map(([key, value]) => value);
}

function handleConnectionDetails(connection, connectionName) {
	const detailSection = renderDetailsSection(connection, connectionName);
	const childTable = renderChildTable(connection.children);
	const localAuths = filterConnectionAuths(connection, 'local-');
	const remoteAuths = filterConnectionAuths(connection, 'remote-');
	const localAuthTable = renderAuthTable(localAuths);
	const remoteAuthTable = renderAuthTable(remoteAuths);

	const modal = E([], [E('div', {}, [
		E('div', { 'class': 'cbi-section', 'data-tab': 'details', 'data-tab-title': _('Connection') }, [
			detailSection,
			E('h3', _('Local Auth')),
			localAuthTable,
			E('h3', _('Remote Auth')),
			remoteAuthTable
		]),
		E('div', { 'class': 'cbi-section', 'data-tab': 'children', 'data-tab-title': _('Children') }, [childTable])
	])]);

	ui.tabs.initTabGroup(modal.lastElementChild.childNodes);
	ui.showModal(_('Connection Details'), [modal, E('div', { 'class': 'right' }, [
		E('button', {
			'class': 'btn cbi-button',
			'click': ui.hideModal
		}, [_('Dismiss')])
	])], 'cbi-modal');
}

function collectErrorMessages(results) {
	const errorMessages = results.reduce(function (messages, result) {
		return messages.concat(result.errors.map(function (error) {
			return error.message;
		}));
	}, []);
	const uniqueErrorMessages = new Set(errorMessages);

	return [...uniqueErrorMessages];
}

return view.extend({
	load() {
		return Promise.all([
			fs.exec_direct('/usr/sbin/swanmon', ['version'], 'json'),
			fs.exec_direct('/usr/sbin/swanmon', ['stats'], 'json'),
			fs.exec_direct('/usr/sbin/swanmon', ['list-conns'], 'json'),
			fs.exec_direct('/usr/sbin/swanmon', ['list-sas'], 'json')
		]);
	},

	pollData(container) {
		poll.add(L.bind(function () {
			return this.load().then(L.bind(function (results) {
				dom.content(container, this.renderContent(results));
			}, this));
		}, this));
	},

	renderContent(results) {
		const node = E('div', [E('div')]);
		const firstNode = node.firstElementChild;

		const errorMessages = collectErrorMessages(results);
		if (errorMessages.length > 0) {
			const messageEls = errorMessages.map(function (message) {
				return E('li', message);
			});

			firstNode.appendChild(E('h4', _('Querying strongSwan failed')));
			firstNode.appendChild(E('ul', messageEls));

			return node;
		}

		const [version, stats, conns, sas] = results.map(function (r) {
			return r.data;
		});

		const uptimeSeconds = (new Date() - new Date(stats.uptime.since)) / 1000;
		const overviewSection = buildSection(_('Overview'), buildKeyValueTable([
			[_('Version'), version.version],
			[_('Uptime'), formatTime(uptimeSeconds, 2)],
			[_('Daemon'), version.daemon],
			[_('Active IKE_SAs'), stats.ikesas.total],
			[_('Half-Open IKE_SAs'), stats.ikesas['half-open']]
		]));
		firstNode.appendChild(overviewSection);

		const connections = mapConnectionSas(conns, sas);
		const connectionTableRows = [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th' }, _('Name')),
				E('th', { 'class': 'th' }, _('State')),
				E('th', { 'class': 'th' }), /* details button */
				E('th', { 'class': 'th' }) /* up/down button */
			])
		];
		connections.forEach(function (connectionObject) {
			const [connectionName, connection] = Object.entries(connectionObject)[0];
			const state = connection.sa ? connection.sa.state : _('Inactive');
			const isDown = !connection.sa;

			connectionTableRows.push(E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td' }, [connectionName]),
				E('td', { 'class': 'td' }, [state]),
				E('td', { 'class': 'td', 'width': '20%' }, [E('button', {
					'title': _('Details'),
					'class': 'btn cbi-button cbi-button-primary',
					'click': ui.createHandlerFn(null, handleConnectionDetails, connection, connectionName)
				}, [_('Details')])]),
				E('td', { 'class': 'td', 'width': '25%' }, [
					E('button', {
						'title': _('Start'),
						'class': 'btn cbi-button cbi-button-positive',
						...(isDown ? {} : { 'disabled': 'disabled' }),
						'click': ui.createHandlerFn(null, handleConnectionUp, connectionName)
					}, [_('Start')]),
					E('button', {
						'title': _('Stop'),
						'class': 'btn cbi-button cbi-button-negative',
						...(isDown ? { 'disabled': 'disabled' } : {}),
						'click': ui.createHandlerFn(null, handleConnectionDown, connectionName)
					}, [_('Stop')])
				])
			]));
		});

		firstNode.appendChild(E([
			E('h2', _('Connections')),
			E('table', { 'class': 'table' }, connectionTableRows)
		]));

		return node;
	},

	render(results) {
		const content = E([], [
			E('h2', [_('strongSwan Status')]),
			E('div')
		]);
		const container = content.lastElementChild;

		dom.content(container, this.renderContent(results));
		this.pollData(container);

		return content;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
