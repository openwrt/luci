'use strict';
'require view';
'require strongswan-swanctl.ikev1 as ikev1';
'require strongswan-swanctl.service as service';
'require dom';
'require poll';
'require fs';
'require rpc';
'require ui';

const callMapConns = rpc.declare({
	object: 'luci.swanctl',
	method: 'map-conns',
	expect: { }
});

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

function swanctlCommand(parameters) {
	return fs.exec('/usr/sbin/swanctl', parameters)
		.catch(e => ui.addNotification(null, E('p', e.message)));
}

function handleConnectionUp(connectionName, refresh) {
	return swanctlCommand(['--initiate', '--ike', connectionName])
		.then(() => refresh());
}

function handleConnectionDown(connectionName, refresh) {
	return swanctlCommand(['--terminate', '--ike', connectionName])
		.then(() => refresh());
}

// The currently shown details modal, updated on every poll
let openModal = null;

function updateOpenModal(connections) {
	if (!openModal)
		return;

	// ui.hideModal() keeps the content in the DOM, ui.showModal() replaces it
	if (!document.body.classList.contains('modal-overlay-active') || !openModal.node.isConnected) {
		openModal = null;
		return;
	}

	const connection = connections.find(connection => connection.name === openModal.connectionName);
	if (connection)
		openModal.update(connection);
}

function fetchConnection(connectionName) {
	return callMapConns().then(result => {
		if (result.error)
			throw new Error(result.error);
		return (result.data || []).find(connection => connection.name === connectionName);
	});
}

function refreshChildTable(container, connectionName) {
	return fetchConnection(connectionName).then(connection => {
		if (connection)
			dom.content(container, renderChildTable(connection, container));
	}).catch(e => ui.addNotification(null, E('p', e.message)));
}

function handleChildUp(childName, container, connectionName) {
	return swanctlCommand(['--initiate', '--child', childName])
		.then(() => refreshChildTable(container, connectionName));
}

function handleChildDown(childName, container, connectionName) {
	return swanctlCommand(['--terminate', '--child', childName])
		.then(() => refreshChildTable(container, connectionName));
}

function handleChildDetailsDismiss(connection) {
	return fetchConnection(connection.name)
		.catch(e => ui.addNotification(null, E('p', e.message)))
		.then(freshConnection => handleConnectionDetails(freshConnection || connection));
}

function renderDetailsSection(connection) {
	const sa = connection.sa;

	return buildSection(_('Details'), buildKeyValueTable([
		[_('Name'), connection.name],
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

function renderChildDetailsSection(childName, child) {
	const childSa = child.childSa;

	return buildSection(_('Details'), buildKeyValueTable([
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
}

function handleChildDetails(connection, childName, child) {
	const container = E('div', {}, [renderChildDetailsSection(childName, child)]);

	ui.showModal(_('Child Details'), [container, E('div', { 'class': 'right' }, [
		E('button', {
			'class': 'btn cbi-button',
			'click': ui.createHandlerFn(null, handleChildDetailsDismiss, connection)
		}, [_('Dismiss')])
	])], 'cbi-modal');

	openModal = {
		connectionName: connection.name,
		node: container,
		update: freshConnection => {
			const freshChild = freshConnection.children[childName];
			if (freshChild)
				dom.content(container, renderChildDetailsSection(childName, freshChild));
		}
	};
}

function renderChildTable(connection, container) {
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

	Object.entries(connection.children).forEach(([childName, child]) => {
		const childSa = child.childSa;
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
					'click': ui.createHandlerFn(null, handleChildDetails, connection, childName, child)
				}, [_('Details')])
			],
			[
				E('button', {
					'title': _('Start'),
					'class': 'btn cbi-button cbi-button-positive',
					...(isDown ? {} : { 'disabled': 'disabled' }),
					'click': ui.createHandlerFn(null, handleChildUp, childName, container, connection.name)
				}, [_('Start')]),
				E('button', {
					'title': _('Stop'),
					'class': 'btn cbi-button cbi-button-negative',
					...(isDown ? { 'disabled': 'disabled' } : {}),
					'click': ui.createHandlerFn(null, handleChildDown, childName, container, connection.name)
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

function renderConnectionTab(connection) {
	const localAuths = filterConnectionAuths(connection, 'local-');
	const remoteAuths = filterConnectionAuths(connection, 'remote-');

	return [
		renderDetailsSection(connection),
		E('h3', _('Local Auth')),
		renderAuthTable(localAuths),
		E('h3', _('Remote Auth')),
		renderAuthTable(remoteAuths)
	];
}

function handleConnectionDetails(connection) {
	const connectionContainer = E('div', { 'class': 'cbi-section', 'data-tab': 'details', 'data-tab-title': _('Connection') });
	const childContainer = E('div', { 'class': 'cbi-section', 'data-tab': 'children', 'data-tab-title': _('Children') });
	const update = freshConnection => {
		dom.content(connectionContainer, renderConnectionTab(freshConnection));
		dom.content(childContainer, renderChildTable(freshConnection, childContainer));
	};
	update(connection);

	const modal = E([], [E('div', {}, [
		connectionContainer,
		childContainer
	])]);

	ui.tabs.initTabGroup(modal.lastElementChild.childNodes);
	ui.showModal(_('Connection Details'), [modal, E('div', { 'class': 'right' }, [
		E('button', {
			'class': 'btn cbi-button',
			'click': ui.hideModal
		}, [_('Dismiss')])
	])], 'cbi-modal');

	openModal = {
		connectionName: connection.name,
		node: connectionContainer,
		update: update
	};
}

function collectSwanmonErrorMessages(results) {
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
			callMapConns(),
			service.getState()
		]);
	},

	refreshContent(container) {
		return this.load().then(L.bind(function (results) {
			const connectionResult = results[2];

			dom.content(container, this.renderContent(results, container));
			if (!connectionResult.error && connectionResult.data)
				updateOpenModal(connectionResult.data);
		}, this));
	},

	pollData(container) {
		poll.add(L.bind(this.refreshContent, this, container));
	},

	renderContent(results, container) {
		const refresh = () => this.refreshContent(container)
			.catch(e => ui.addNotification(null, E('p', e.message)));
		const [versionResult, statsResult, connectionResult, serviceState] = results;
		const node = E('div', [E('div')]);
		const firstNode = node.firstElementChild;

		const banner = service.banner(serviceState,
			_('Enable the IPsec service to see the IPsec status.'));
		if (banner) {
			firstNode.appendChild(banner);

			return node;
		}

		const errorMessages = collectSwanmonErrorMessages([versionResult, statsResult]);
		if (connectionResult.error)
			errorMessages.push(connectionResult.error);

		if (errorMessages.length > 0) {
			const messageEls = errorMessages.map(function (message) {
				return E('li', message);
			});

			firstNode.appendChild(E('div', { 'class': 'alert-message error' }, [
				E('h4', _('Querying strongSwan failed')),
				E('ul', messageEls)
			]));

			return node;
		}

		const [version, stats, connections] = results.map(function (r) {
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

		const connectionTableRows = [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th' }, _('Name')),
				E('th', { 'class': 'th' }, _('State')),
				E('th', { 'class': 'th' }), /* details button */
				E('th', { 'class': 'th' }) /* up/down button */
			])
		];
		connections.forEach(function (connection) {
			const state = connection.sa ? connection.sa.state : _('Inactive');
			const isDown = !connection.sa;

			connectionTableRows.push(E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td' }, [connection.name]),
				E('td', { 'class': 'td' }, [state]),
				E('td', { 'class': 'td', 'width': '20%' }, [E('button', {
					'title': _('Details'),
					'class': 'btn cbi-button cbi-button-primary',
					'click': ui.createHandlerFn(null, handleConnectionDetails, connection)
				}, [_('Details')])]),
				E('td', { 'class': 'td', 'width': '25%' }, [
					E('button', {
						'title': _('Start'),
						'class': 'btn cbi-button cbi-button-positive',
						...(isDown ? {} : { 'disabled': 'disabled' }),
						'click': ui.createHandlerFn(null, handleConnectionUp, connection.name, refresh)
					}, [_('Start')]),
					E('button', {
						'title': _('Stop'),
						'class': 'btn cbi-button cbi-button-negative',
						...(isDown ? { 'disabled': 'disabled' } : {}),
						'click': ui.createHandlerFn(null, handleConnectionDown, connection.name, refresh)
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

		dom.content(container, this.renderContent(results, container));
		this.pollData(container);

		return ikev1.banner().then(function (banner) {
			if (banner)
				content.insertBefore(banner, container);
			return content;
		});
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
