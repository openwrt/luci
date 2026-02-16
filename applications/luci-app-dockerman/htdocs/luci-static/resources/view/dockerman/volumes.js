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
			dm2.volume_list(),
			dm2.container_list({query: {all: true}}),
		]);
	},

	render([volumes, containers]) {
		if (volumes?.code !== 200) {
			return E('div', {}, [ volumes.body.message ]);
		}

		// this.volumes = volumes || {};
		let container_list = containers.body || [];
		let volume_list = this.getVolumesTable(volumes.body);
		const view = this; // Capture the view context

		let pollPending = null;
		let volSec = null;

		const refresh = () => {
			if (pollPending) return pollPending;
			pollPending = view.load().then(([volumes2, containers2]) => {
				volume_list = view.getVolumesTable(volumes2.body);
				container_list = containers2.body;
				m.data = new m.data.constructor({volume: volume_list, prune: {}});

				if (volSec) {
					volSec.footer = [
						`${_('Total')} ${volume_list.length}`,
					];
				}

				return m.render();
			}).catch((err) => { console.warn(err) }).finally(() => { pollPending = null });
			return pollPending;
		};

		let s, o;
		const m = new form.JSONMap({volume: volume_list, prune: {}},
			_('Docker - Volumes'),
			_('This page displays all docker volumes that have been created on the connected docker host.'));
		m.submit = false;
		m.reset = false;

		s = m.section(form.TableSection, 'prune', null, _('Volumes overview'));
		s.addremove = false;
		s.anonymous = true;
		const prune = s.option(form.Button, '_prune', null);
		prune.inputtitle = `${dm2.ActionTypes['prune'].i18n} ${dm2.ActionTypes['prune'].e}`;
		prune.inputstyle = 'negative';
		prune.onclick = L.bind(function(sid, ev) {

			return this.super('handleXHRTransfer', [{
				q_params: {  },
				commandCPath: '/volumes/prune',
				commandDPath: '/volumes/prune',
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
			// 	dm2.volume_prune,
			// 	{ query: { filters: '' } },
			// 	dm2.ActionTypes['prune'].i18n,
			// 	{
			// 		showOutput: true,
			// 		successMessage: _('started/completed'),
			// 		onSuccess: () => {
			// 			setTimeout(() => window.location.href = `${this.dockerman_url}/volumes`, 1000);
			// 		}
			// 	}
			// );
		}, this);


		volSec = m.section(form.TableSection, 'volume');
		volSec.anonymous = true;
		volSec.nodescriptions = true;
		volSec.addremove = true;
		volSec.sortable = true;
		volSec.filterrow = true;
		volSec.addbtntitle = `${dm2.ActionTypes['create'].i18n} ${dm2.ActionTypes['create'].e}`;
		volSec.footer = [
			`${_('Total')} ${volume_list.length}`,
		];

		volSec.handleAdd = function(ev) {

			ev.preventDefault();
			let nameInput, labelsInput;
			return ui.showModal(_('New volume'), [
				E('p', {}, _('Enter an optional name and labels for the new volume')),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title' }, _('Name')),
					E('div', { 'class': 'cbi-value-field' }, [
						nameInput = E('input', {
							'type': 'text',
							'class': 'cbi-input-text',
							'placeholder': _('volume name'),
						})
					])
				]),

				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title' }, _('Labels')),
					E('div', { 'class': 'cbi-value-field' }, [
						labelsInput = E('input', {
							'type': 'text',
							'class': 'cbi-input-text',
							'placeholder': 'key=value, key2=value2, ...',
						})
						// labelsInput = new ui.DynamicList([], [], {}).render(),
					])
				]),


				E('div', { 'class': 'right' }, [
					E('button', {
						'class': 'cbi-button',
						'click': ui.hideModal
					}, ['↩']),
					' ',
					E('button', {
						'class': 'cbi-button cbi-button-positive',
						'click': ui.createHandlerFn(view, () => {
							const name = nameInput.value.trim();
							const labels = Object.fromEntries(
								(labelsInput.value.trim()?.split(',') || [])
									.map(e => e.trim())
									.filter(Boolean)
									.map(e => e.split('='))
									.filter(pair => pair.length === 2)
							);

							ui.hideModal();

							return view.executeDockerAction(
								dm2.volume_create,
								{ opts: { Name: name, Labels: labels } },
								dm2.Types['volume'].sub['create'].i18n,
								{
									showOutput: true,
									onSuccess: () => {
										return refresh();
									}
								}
							);
						})
					}, [dm2.Types['volume'].sub['create'].e])
				])
			]);
		};

		volSec.handleRemove = function(sid, force, ev) {
			const volume = volume_list.find(net => net['.name'] === sid);

			if (!volume?.Name) return false;

			return view.executeDockerAction(
				dm2.volume_remove,
				{ id: volume.Name, query: { force: force } },
				dm2.ActionTypes['remove'].i18n,
				{
					showOutput: true,
					onSuccess: () => {
						return refresh();
					}
				}
			);
		};

		volSec.handleInspect = function(sid, ev) {
			const volume = volume_list.find(net => net['.name'] === sid);

			if (!volume?.Name) return false;

			return view.executeDockerAction(
				dm2.volume_inspect,
				{ id: volume.Name },
				dm2.ActionTypes['inspect'].i18n,
				{ showOutput: true, showSuccess: false }
			);
		};

		volSec.renderRowActions = function (sid) {
			const volume = volume_list.find(net => net['.name'] === sid);
			const btns = [
				E('button', {
					'class': 'cbi-button view',
					'title': dm2.ActionTypes['inspect'].i18n,
					'click': ui.createHandlerFn(this, this.handleInspect, sid),
				}, [dm2.ActionTypes['inspect'].e]),

				E('div', {
					'style': 'width: 20px',
					// Some safety margin for mis-clicks
				}, [' ']),

				E('button', {
					'class': 'cbi-button cbi-button-negative remove',
					'title': dm2.ActionTypes['remove'].i18n,
					'click': ui.createHandlerFn(this, this.handleRemove, sid, false),
					'disabled': volume?._disable_delete,
				}, [dm2.ActionTypes['remove'].e]),
				E('button', {
					'class': 'cbi-button cbi-button-negative important remove',
					'title': dm2.ActionTypes['force_remove'].i18n,
					'click': ui.createHandlerFn(this, this.handleRemove, sid, true),
				}, [dm2.ActionTypes['force_remove'].e]),
			];
			return E('td', { 'class': 'td middle cbi-section-actions' }, E('div', btns));
		};

		volSec.option(form.DummyValue, '_name', _('Name'));

		o = volSec.option(form.DummyValue, 'Labels', _('Labels') + '  🏷️');
		o.cfgvalue = view.objectCfgValueTT;

		volSec.option(form.DummyValue, 'Driver', _('Driver'));

		o = volSec.option(form.DummyValue, 'Containers', _('Containers'));
		o.cfgvalue = function(sid) {
			const vol = this.map.data.data[sid] || {};
			return view.parseContainerLinksForVolume(vol, container_list);
		};

		o = volSec.option(form.DummyValue, 'Mountpoint', _('Mount Point'));
		o.cfgvalue = function(sid) {
			const mp = this.map.data.get(this.map.config, sid, this.option);
			if (!mp) return;
			// Try to match Docker volume mountpoint pattern: /var/lib/docker/volumes/<id>/_data
			const match = mp.match(/^(.*\/volumes\/)([^/]+)(\/.*)?$/);
			if (match && match[2].length > 36) {
				// Show the first 12 characters of the ID portion
				return match[1] + match[2].substring(0, 12) + '...' + (match[3] || '');
			}
			return mp;
		};

		o = volSec.option(form.DummyValue, 'CreatedAt', _('Created'));

		this.insertOutputFrame(s, m);

		return m.render();
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null,

	getVolumesTable(volumes) {
		const data = [];

		for (const [ , vol] of (volumes?.Volumes || []).entries()) {
			const labels = vol?.Labels || {};

			// Just push plain data objects without UCI metadata
			data.push({
				...vol,
				Labels: labels,
				_name: (vol.Name || '').substring(0, 12),
				Containers: vol.Containers || '',
			});
		}

		return data;
	},

	parseContainerLinksForVolume(volume, containers) {
		const links = [];
		for (const cont of containers || []) {
			const mounts = cont?.Mounts || [];
			const usesVolume = mounts.some(m => {
				if (m?.Type !== 'volume' && m?.Type !== 'bind') return false;
				const byName = !!volume?.Name && m?.Name === volume.Name;
				const bySource = !!volume?.Mountpoint && (m?.Source === volume.Mountpoint || (m?.Source || '').startsWith(volume.Mountpoint));
				return byName || bySource;
			});

			if (usesVolume) {
				const containerName = cont?.Names?.[0]?.replace(/^\//, '') || (cont?.Id || '').substring(0, 12);
				const containerId = cont?.Id;
				links.push(E('a', {
					href: `${this.dockerman_url}/container/${containerId}`,
					title: containerId,
					style: 'white-space: nowrap;'
				}, [containerName]));
			}
		}

		if (!links.length)
			return '-';

		const out = [];
		for (let i = 0; i < links.length; i++) {
			out.push(links[i]);
			if (i < links.length - 1)
				out.push(' | ');
		}

		return E('div', {}, out);
	},

});
