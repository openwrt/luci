'use strict';
'require form';
'require fs';
'require ui';
'require dockerman.common as dm2';

/*
Copyright 2026
Docker manager JS for Luci by Paul Donald <newtwen+github@gmail.com> 
Based on Docker Lua by lisaac <https://github.com/lisaac/luci-app-dockerman>
LICENSE: GPLv2.0
*/


return dm2.dv.extend({
	load() {
		return Promise.all([
			dm2.network_list(),
			dm2.container_list({query: {all: true}}),
		]);
	},

	render([networks, containers]) {
		if (networks?.code !== 200) {
			return E('div', {}, [ networks?.body?.message ]);
		}

		let network_list = this.getNetworksTable(networks.body, containers.body);
		// let container_list = containers.body;
		const view = this; // Capture the view context


		let pollPending = null;
		let netSec = null;

		const refresh = () => {
			if (pollPending) return pollPending;
			pollPending = view.load().then(([networks2, containers2]) => {
				network_list = view.getNetworksTable(networks2.body, containers2.body);
				// container_list = containers2.body;
				m.data = new m.data.constructor({network: network_list, prune: {}});

				if (netSec) {
					netSec.footer = [
						`${_('Total')} ${network_list.length}`,
					];
				}

				return m.render();
			}).catch((err) => { console.warn(err) }).finally(() => { pollPending = null });
			return pollPending;
		};


		let s, o;
		const m = new form.JSONMap({network: network_list, prune: {}},
			_('Docker - Networks'),
			_('This page displays all docker networks that have been created on the connected docker host.'));
		m.submit = false;
		m.reset = false;

		s = m.section(form.TableSection, 'prune', _('Networks overview'), null);
		s.addremove = false;
		s.anonymous = true;

		const prune = s.option(form.Button, '_prune', null);
		prune.inputtitle = `${dm2.ActionTypes['prune'].i18n} ${dm2.ActionTypes['prune'].e}`;
		prune.inputstyle = 'negative';
		prune.onclick = L.bind(function(section_id, ev) {

			return this.super('handleXHRTransfer', [{
				q_params: {  },
				commandCPath: '/networks/prune',
				commandDPath: '/networks/prune',
				commandTitle: dm2.ActionTypes['prune'].i18n,
				onUpdate: (msg) => {
					try {
						if(msg.error)
							ui.addTimeLimitedNotification(dm2.ActionTypes['prune'].i18n, msg.error, 7000, 'error');

						const output = JSON.stringify(msg, null, 2) + '\n';
						view.insertOutput(output);
					} catch {

					}
				},
				noFileUpload: true,
			}]);

			// return view.executeDockerAction(
			// 	dm2.network_prune,
			// 	{ query: { filters: '' } },
			// 	dm2.ActionTypes['prune'].i18n,
			// 	{
			// 		showOutput: true,
			// 		successMessage: _('started/completed'),
			// 		onSuccess: () => {
			// 			setTimeout(() => window.location.href = `${this.dockerman_url}/networks`, 1000);
			// 		}
			// 	}
			// );
		}, this);

		netSec = m.section(form.TableSection, 'network');
		netSec.anonymous = true;
		netSec.nodescriptions = true;
		netSec.addremove = true;
		netSec.sortable = true;
		netSec.filterrow = true;
		netSec.addbtntitle = `${dm2.ActionTypes['create'].i18n} ${dm2.ActionTypes['create'].e}`;
		netSec.footer = [
			`${_('Total')} ${network_list.length}`,
		];

		netSec.handleAdd = function(section_id, ev) {
			window.location.href = `${view.dockerman_url}/network_new`;
		};

		netSec.handleRemove = function(section_id, force, ev) {
			const network = network_list.find(net => net['.name'] === section_id);
			if (!network?.Id) return false;

			return view.executeDockerAction(
				dm2.network_remove,
				{ id: network.Id },
				dm2.ActionTypes['remove'].i18n,
				{
					showOutput: true,
					onSuccess: () => {
						return refresh();
					}
				}
			);
		};

		netSec.handleInspect = function(section_id, ev) {
			const network = network_list.find(net => net['.name'] === section_id);
			if (!network?.Id) return false;

			return view.executeDockerAction(
				dm2.network_inspect,
				{ id: network.Id },
				dm2.ActionTypes['inspect'].i18n,
				{ showOutput: true, showSuccess: false }
			);
		};

		netSec.renderRowActions = function (section_id) {
			const network = network_list.find(net => net['.name'] === section_id);
			const btns = [
				E('button', {
					'class': 'cbi-button view',
					'title': dm2.ActionTypes['inspect'].i18n,
					'click': ui.createHandlerFn(this, this.handleInspect, section_id),
				}, [dm2.ActionTypes['inspect'].e]),

				E('div', {
					'style': 'width: 20px',
					// Some safety margin for mis-clicks
				}, [' ']),

				E('button', {
					'class': 'cbi-button cbi-button-negative remove',
					'title': dm2.ActionTypes['remove'].i18n,
					'click': ui.createHandlerFn(this, this.handleRemove, section_id, false),
					'disabled': network?._disable_delete,
				}, dm2.ActionTypes['remove'].e),
				E('button', {
					'class': 'cbi-button cbi-button-negative important remove',
					'title': dm2.ActionTypes['force_remove'].i18n,
					'click': ui.createHandlerFn(this, this.handleRemove, section_id, true),
					'disabled': network?._disable_delete,
				}, dm2.ActionTypes['force_remove'].e),
			];
			return E('td', { 'class': 'td middle cbi-section-actions' }, E('div', btns));
		};

		o = netSec.option(form.DummyValue, '_shortId', _('ID'));

		o = netSec.option(form.DummyValue, 'Name', _('Name'));

		o = netSec.option(form.DummyValue, 'Labels', _('Labels') + '  🏷️');
		o.cfgvalue = view.objectCfgValueTT;

		o = netSec.option(form.DummyValue, '_container', _('Containers'));

		o = netSec.option(form.DummyValue, 'Driver', _('Driver'));

		o = netSec.option(form.DummyValue, '_interface', _('Parent Interface'));

		o = netSec.option(form.DummyValue, '_subnet', _('Subnet'));

		o = netSec.option(form.DummyValue, '_gateway', _('Gateway'));

		this.insertOutputFrame(s, m);

		return m.render();
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null,

	getNetworksTable(networks, containers) {
		const data = [];

		for (const [ , net] of (networks || []).entries()) {
			const n = net.Name;
			const _shortId = (net.Id || '').substring(0, 12);
			const shortLink = E('a', {
				'href': `${view.dockerman_url}/network/${net.Id}`,
				'style': 'font-family: monospace;',
				'title': _('Click to view this network'),
			}, [_shortId]);

			// Just push plain data objects without UCI metadata
			const configs = Array.isArray(net?.IPAM?.Config) ? net.IPAM.Config : [];
			data.push({
				...net,
				_gateway: configs.map(o => o.Gateway).filter(o => o).join(', ') || '',
				_subnet: configs.map(o => o.Subnet).filter(o => o).join(', ') || '',
				_disable_delete: ( n === 'bridge' || n === 'none' || n === 'host' ) ? true : null,
				_shortId: shortLink,
				_container: this.parseContainerLinksForNetwork(net, containers),
				_interface: (net.Driver === 'bridge')
					? net.Options?.['com.docker.network.bridge.name'] || ''
					: (net.Driver === 'macvlan')
						? net?.Options?.parent
						: '',
			});
		}

		return data;
	},

});
