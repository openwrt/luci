'use strict';
'require view';
'require dom';
'require poll';
'require fs';
'require ui';

function formatTime(seconds, selectCount) {
	var days = Math.floor(seconds / (60 * 60 * 24));
	var hours = Math.floor(seconds / (60 * 60)) % 24;
	var minutes = Math.floor(seconds / 60) % 60;
	var seconds = Math.floor(seconds % 60);

	var times = [
		[days, _('Day'), _('Days')],
		[hours, _('Hour'), _('Hours')],
		[minutes, _('Minute'), _('Minutes')],
		[seconds, _('Second'), _('Seconds')]
	].filter(function ([time, singular, plural]) {
		return time > 0;
	});

	var selectedTimes = times.slice(0, selectCount);
	return selectedTimes.map(function ([time, singular, plural]) {
		var unit = time > 1 ? plural : singular;
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
	var rows = kvPairs.map(function (row) {
		return E('tr', { 'class': 'tr' }, [
			E('td', { 'class': 'td', 'width': '33%' }, E('strong', [row[0]])),
			E('td', { 'class': 'td' }, [row[1]])
		]);
	});
	return buildTable(rows);
}

function collectErrorMessages(results) {
	var errorMessages = results.reduce(function (messages, result) {
		return messages.concat(result.errors.map(function (error) {
			return error.message;
		}));
	}, []);
	var uniqueErrorMessages = new Set(errorMessages);

	return [...uniqueErrorMessages];
}

return view.extend({
	load: function () {
		return Promise.all([
			fs.exec_direct('/usr/sbin/swanmon', ['version'], 'json'),
			fs.exec_direct('/usr/sbin/swanmon', ['stats'], 'json'),
			fs.exec_direct('/usr/sbin/swanmon', ['list-sas'], 'json')
		]);
	},

	pollData: function (container) {
		poll.add(L.bind(function () {
			return this.load().then(L.bind(function (results) {
				dom.content(container, this.renderContent(results));
			}, this));
		}, this));
	},

	renderContent: function (results) {
		var node = E('div', [E('div')]);
		var firstNode = node.firstElementChild;

		var errorMessages = collectErrorMessages(results);
		if (errorMessages.length > 0) {
			var messageEls = errorMessages.map(function (message) {
				return E('li', message);
			});

			firstNode.appendChild(E('h4', _('Querying strongSwan failed')));
			firstNode.appendChild(E('ul', messageEls));

			return node;
		}

		var [version, stats, sas] = results.map(function (r) {
			return r.data;
		});

		var uptimeSeconds = (new Date() - new Date(stats.uptime.since)) / 1000;
		var statsSection = buildSection(_('Stats'), buildKeyValueTable([
			[_('Version'), version.version],
			[_('Uptime'), formatTime(uptimeSeconds, 2)],
			[_('Daemon'), version.daemon],
			[_('Active IKE_SAs'), stats.ikesas.total],
			[_('Half-Open IKE_SAs'), stats.ikesas['half-open']]
		]));
		firstNode.appendChild(statsSection);

		var tableRows = sas.map(function (conn) {
			var name = Object.keys(conn)[0];
			var data = conn[name];
			var childSas = [];

			Object.entries(data['child-sas']).forEach(function ([name, data]) {
				var table = buildKeyValueTable([
					[_('State'), data.state],
					[_('Mode'), data.mode],
					[_('Protocol'), data.protocol],
					[_('Local Traffic Selectors'), data['local-ts'].join(', ')],
					[_('Remote Traffic Selectors'), data['remote-ts'].join(', ')],
					[_('Encryption Algorithm'), data['encr-alg']],
					[_('Encryption Keysize'), data['encr-keysize']],
					[_('Bytes in'), data['bytes-in']],
					[_('Bytes out'), data['bytes-out']],
					[_('Life Time'), formatTime(data['life-time'], 2)],
					[_('Install Time'), formatTime(data['install-time'], 2)],
					[_('Rekey in'), formatTime(data['rekey-time'], 2)],
					[_('SPI in'), data['spi-in']],
					[_('SPI out'), data['spi-out']]
				]);
				childSas.push(E('div', { 'class': 'cbi-section' }, [
					E('h4', { 'style': 'margin-top: 0; padding-top: 0;' }, [name]),
					table
				]));
			});
			childSas.push(E('button', {
				'class': 'btn cbi-button cbi-button-apply',
				'click': ui.hideModal
			}, _('Close')));

			return E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td' }, [name]),
				E('td', { 'class': 'td' }, [data.state]),
				E('td', { 'class': 'td' }, [data['remote-host']]),
				E('td', { 'class': 'td' }, [data.version]),
				E('td', { 'class': 'td' }, [formatTime(data.established, 2)]),
				E('td', { 'class': 'td' }, [formatTime(data['reauth-time'], 2)]),
				E('td', { 'class': 'td' }, [E('button', {
					'class': 'btn cbi-button cbi-button-apply',
					'click': function (ev) {
						ui.showModal(_('CHILD_SAs'), childSas)
					}
				}, _('Show Details'))])
			]);
		});
		var connSection = buildSection(_('Security Associations (SAs)'), buildTable([
			E('tr', { 'class': 'tr' }, [
				E('th', { 'class': 'th' }, [_('Name')]),
				E('th', { 'class': 'th' }, [_('State')]),
				E('th', { 'class': 'th' }, [_('Remote')]),
				E('th', { 'class': 'th' }, [_('IKE Version')]),
				E('th', { 'class': 'th' }, [_('Established for')]),
				E('th', { 'class': 'th' }, [_('Reauthentication in')]),
				E('th', { 'class': 'th' }, [_('Details')])
			]),
			...tableRows
		]));
		firstNode.appendChild(connSection);

		return node;
	},

	render: function (results) {
		var content = E([], [
			E('h2', [_('strongSwan Status')]),
			E('div')
		]);
		var container = content.lastElementChild;

		dom.content(container, this.renderContent(results));
		this.pollData(container);

		return content;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
