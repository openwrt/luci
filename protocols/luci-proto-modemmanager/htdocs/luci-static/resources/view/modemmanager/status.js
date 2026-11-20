'use strict';
'require ui';
'require view';
'require poll';
'require dom';
'require modemmanager_helper as helper';

return view.extend({
	load: function() {
		return helper.getModems().then(function (modems) {
			return Promise.all(modems.filter(function (modem){
				return modem != null;
			}).map(function (modem) {
				return helper.getModemSims(modem.modem).then(function (sims) {
					modem.sims = sims.filter(function (sim) {
						return sim != null;
					});

					return helper.getModemLocation(modem.modem).then(function (location) {
						modem.location = location;
						return modem;
					});
				});
			}));
		});
	},

	pollData: function (container) {
		poll.add(L.bind(function () {
			return this.load().then(L.bind(function (modems) {
				dom.content(container, this.renderContent(modems));
			}, this));
		}, this));
	},

	renderSections: function (name, sections) {
		if (sections.length == 0) {
			sections.push(E('div', { 'class': 'cbi-section' }, [
				E('span', {}, _('Section %s is empty.').format(name))
			]));
		}

		return E('div', { 'class': 'cbi-section' }, [
			E('h1', {}, name),
			...sections
		]);
	},

	renderSection: function (name, table) {
		var rowNodes = table.filter(function (row) {
			return row[1] != null;
		}).map(function (row) {
			return E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td', 'width': '33%' }, E('strong', {}, [row[0]])),
				E('td', { 'class': 'td' }, [row[1]])
			]);
		});

		var tableNode;
		if (rowNodes.length == 0) {
			tableNode = E('div', { 'class': 'cbi-section' }, [
				E('span', {}, _('Section %s is empty.').format(name))
			])
		} else {
			tableNode = E('table', { 'class': 'table', }, rowNodes);
		}

		return E('div', { 'class': 'cbi-section' }, [
			E('h2', {}, [name]),
			tableNode
		]);
	},

	renderContent: function (modems) {
		var node = E('div', {}, E('div'));

		modems.forEach(L.bind(function (modem) {
			var generic = modem.modem.generic;
			var modem3gpp = modem.modem['3gpp'];

			var modemSection = this.renderSection(_('Modem Info'), [
				[_('Manufacturer'), generic.manufacturer],
				[_('Model'), generic.model],
				[_('Revision'), generic.revision],
				[E('abbr', { 'title': _('International Mobile Station Equipment Identity') }, [
					_('IMEI')
				]), modem3gpp.imei],
				[_('Device Identifier'), generic['device-identifier']],
				[_('Power State'), generic['power-state']],
				[_('State'), generic.state],
				[_('Failed Reason'), generic['state-failed-reason']]
			]);

			var ownNumbersStr = generic['own-numbers'].join(', ');
			var accessTechnologiesStr = generic['access-technologies'].join(', ');
			var signalQualityValue = parseInt(generic['signal-quality'].value);
			var networkSection = this.renderSection(_('Network Registration'), [
				[_('Mobile Number'), ownNumbersStr],
				[_('Access Technologies'), accessTechnologiesStr],
				[_('Operator') , modem3gpp['operator-name']],
				[_('Operator Code'), modem3gpp['operator-code']],
				[_('Registration State'), modem3gpp['registration-state']],
				[_('Packet Service State'), modem3gpp['packet-service-state']],
				[_('Signal Quality'), E('div', { 'class': 'cbi-progressbar', 'title': '%d %'.format(signalQualityValue) }, [
					E('div', { 'style': 'width: %d%%'.format(signalQualityValue) })
				])]
			]);

			var location3gpp = {};
			if (modem.location != null) {
				location3gpp = modem.location.modem.location['3gpp'];
			}
			var locationSection = this.renderSection(_('Cell Location'), [
				[E('abbr', { 'title': _('Cell ID') }, [
					'CID'
				]), location3gpp.cid],
				[E('abbr', { 'title': _('Location Area Code') }, [
					'LAC'
				]), location3gpp.lac],
				[E('abbr', { 'title': _('Mobile Country Code') }, [
					'MCC'
				]), location3gpp.mcc],
				[E('abbr', { 'title': _('Mobile Network Code') }, [
					'MNC'
				]), location3gpp.mnc],
				[E('abbr', { 'title': _('Tracking Area Code') }, [
					'TAC'
				]), location3gpp.tac]
			]);

			var simTables = modem.sims.map(function (sim) {
				var properties = sim.sim.properties;
				return [
					[_('Active'), properties.active],
					[_('Operator Name'), properties['operator-name']],
					[E('abbr', { 'title': _('Integrated Circuit Card Identifier') }, [
						'ICCID'
					]), properties.iccid],
					[E('abbr', { 'title': _('International Mobile Subscriber Identity') }, [
							'IMSI'
					]), properties.imsi]
				];
			});
			var simSubSections = simTables.map(L.bind(function (table, index) {
				return this.renderSection(_('SIM %d').format(index + 1), table)
			}, this));
			var simSection = this.renderSections(_('SIMs'), simSubSections);

			var sections = [
				E('div', { 'class': 'cbi-map-descr'}, []),
				modemSection,
				networkSection,
				locationSection,
				simSection
			].filter(function (section) {
				return section != null;
			});
			node.firstElementChild.appendChild(E('div', { 'data-tab': generic.device, 'data-tab-title': generic.device }, sections));
		}, this));
		ui.tabs.initTabGroup(node.firstElementChild.childNodes);

		return node;
	},

	render: function (modems) {
		var content = E([], [
			E('h2', {}, [_('Cellular Network')]),
			E('div')
		]);
		var container = content.lastElementChild;

		dom.content(container, this.renderContent(modems));
		this.pollData(container);

		return content;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
