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
		const requestPath = L.env.requestpath;
		const netId = requestPath[requestPath.length-1] || '';
		this.networkId = netId;

		return Promise.all([
			dm2.network_inspect({ id: netId }),
			dm2.container_list({query: {all: true}}),
		]);
	},

	render([network, containers]) {
		if (network?.code !== 200) {
			window.location.href = `${this.dockerman_url}/networks`;
			return;
		}

		const view = this;
		const this_network = network.body || {};
		const container_list = Array.isArray(containers.body) ? containers.body : [];

		const m = new form.JSONMap({
				network: this_network,
				Driver: this_network?.IPAM?.Driver,
				Config: this_network?.IPAM?.Config,
				Containers: Object.entries(this_network?.Containers || {}).map(([id, info]) => ({ id, ...info })),
				_inspect: {},
			},
			_('Docker - Networks'),
			_('This page displays all docker networks that have been created on the connected docker host.'));
		m.submit = false;
		m.reset = false;

		let s = m.section(form.NamedSection, 'network', _('Networks overview'));
		s.anonymous = true;
		s.addremove = false;
		s.nodescriptions = true;

		let o, t, ss;

		// INFO TAB
		t = s.tab('info', _('Info'));

		o = s.taboption('info', form.DummyValue, 'Name', _('Network Name'));
		o = s.taboption('info', form.DummyValue, 'Id', _('ID'));
		o = s.taboption('info', form.DummyValue, 'Created', _('Created'));
		o = s.taboption('info', form.DummyValue, 'Scope', _('Scope'));
		o = s.taboption('info', form.DummyValue, 'Driver', _('Driver'));
		o = s.taboption('info', form.Flag, 'EnableIPv6', _('IPv6'));
		o.readonly = true;

		o = s.taboption('info', form.Flag, 'Internal', _('Internal'));
		o.readonly = true;

		o = s.taboption('info', form.Flag, 'Attachable', _('Attachable'));
		o.readonly = true;

		o = s.taboption('info', form.Flag, 'Ingress', _('Ingress'));
		o.readonly = true;

		o = s.taboption('info', form.DummyValue, 'ConfigFrom', _('ConfigFrom'));
		o.cfgvalue = view.objectCfgValueTT;


		o = s.taboption('info', form.Flag, 'ConfigOnly', _('Config Only'));
		o.readonly = true;
		o.cfgvalue = view.objectCfgValueTT;

		o = s.taboption('info', form.DummyValue, 'Containers', _('Containers'));
		o.load = function(sid) {
			return view.parseContainerLinksForNetwork(this_network, container_list);
		};

		o = s.taboption('info', form.DummyValue, 'Options', _('Options'));
		o.cfgvalue = view.objectCfgValueTT;

		o = s.taboption('info', form.DummyValue, 'Labels', _('Labels'));
		o.cfgvalue = view.objectCfgValueTT;

		// CONFIGS TAB
		t = s.tab('detail', _('Detail'));

		o = s.taboption('detail', form.DummyValue, 'Driver', _('IPAM Driver'));

		o = s.taboption('detail', form.SectionValue, '_conf_', form.TableSection, 'Config', _('Network Configurations'));
		ss = o.subsection;
		ss.anonymous = true;

		ss.option(form.DummyValue, 'Subnet', _('Subnet'));
		ss.option(form.DummyValue, 'Gateway', _('Gateway'));

		o = s.taboption('detail', form.SectionValue, '_cont_', form.TableSection, 'Containers', _('Containers'));
		ss = o.subsection;
		ss.anonymous = true;

		o = ss.option(form.DummyValue, 'Name', _('Name'));
		o.cfgvalue = function(sid) {
			const val = this.data?.[sid] ?? this.map.data.get(this.map.config, sid, this.option);
			const containerId = container_list.find(c => c.Names.find(e => e.substring(1) === val)).Id;
			return E('a', {
				href: `${view.dockerman_url}/container/${containerId}`,
				title: containerId,
				style: 'white-space: nowrap;'
			}, [val]);
		};

		ss.option(form.DummyValue, 'MacAddress', _('Mac Address'));
		ss.option(form.DummyValue, 'IPv4Address', _('IPv4 Address'));

		// Show IPv6 column when at least one entry contains a non-empty IPv6Address
		const _networkContainers = Object.values(this_network?.Containers || {});
		const _hasIPv6 = _networkContainers.some(c => c?.IPv6Address && String(c.IPv6Address).trim() !== '');
		if (_hasIPv6) {
			ss.option(form.DummyValue, 'IPv6Address', _('IPv6 Address'));
		}

		// INSPECT TAB

		t = s.tab('inspect', _('Inspect'));

		o = s.taboption('inspect', form.SectionValue, '__ins__', form.NamedSection, '_inspect', null);
		ss = o.subsection;
		ss.anonymous = true;
		ss.nodescriptions = true;

		o = ss.option(form.Button, '_inspect_button', null);
		o.inputtitle = `${dm2.ActionTypes['inspect'].i18n} ${dm2.ActionTypes['inspect'].e}`;
		o.inputstyle = 'neutral';
		o.onclick = L.bind(function(section_id, ev) {
			return dm2.network_inspect({ id: this_network.Id }).then((response) => {
				const inspectField = document.getElementById('inspect-output-text');
				if (inspectField && response?.body) {
					inspectField.textContent = JSON.stringify(response.body, null, 2);
				}
			});
		}, this);

		o = s.taboption('inspect', form.SectionValue, '__insoutput__', form.NamedSection, null, null);
		o.render = L.bind(() => {
			return this.insertOutputFrame(null, null);
		}, this);

		return m.render();
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null,

});
