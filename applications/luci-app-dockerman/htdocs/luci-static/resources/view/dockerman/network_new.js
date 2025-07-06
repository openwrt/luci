'use strict';
'require form';
'require fs';
'require ui';
'require tools.widgets as widgets';
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

		]);
	},

	render([]) {

		// stuff JSONMap with {network: {}} to prime it with a new empty entry
		const m = new form.JSONMap({network: {}}, _('Docker - New Network'));
		m.submit = true;
		m.reset = true;

		let s = m.section(form.NamedSection, 'network', _('Create new docker network'));
		s.anonymous = true;
		s.nodescriptions = true;
		s.addremove = false;

		let o;

		o = s.option(form.Value, 'name', _('Network Name'),
			_('Name of the network that can be selected during container creation'));
		o.rmempty = true;

		o = s.option(form.ListValue, 'driver', _('Driver'));
		o.rmempty = true;
		o.value('bridge', _('Bridge device'));
		o.value('macvlan', _('MAC VLAN'));
		o.value('ipvlan',  _('IP VLAN'));
		o.value('overlay', _('Overlay network'));

		o = s.option(widgets.DeviceSelect, 'parent', _('Base device'));
		o.rmempty = true;
		o.create = false
		o.noaliases = true;
		o.nocreate = true;
		o.depends('driver', 'macvlan');

		o = s.option(form.ListValue, 'macvlan_mode', _('Mode'));
		o.rmempty = true;
		o.depends('driver', 'macvlan');
		o.default = 'bridge';
		o.value('bridge', _('Bridge (Support direct communication between MAC VLANs)'));
		o.value('private', _('Private (Prevent communication between MAC VLANs)'));
		o.value('vepa', _('VEPA (Virtual Ethernet Port Aggregator)'));
		o.value('passthru', _('Pass-through (Mirror physical device to single MAC VLAN)'));

		o = s.option(form.ListValue, 'ipvlan_mode', _('Ipvlan Mode'));
		o.rmempty = true;
		o.depends('driver', 'ipvlan');
		o.default='l3';
		o.value('l2', _('L2 bridge'));
		o.value('l3', _('L3 bridge'));

		o = s.option(form.Flag, 'ingress',
			_('Ingress'),
			_('Ingress network is the network which provides the routing-mesh in swarm mode'));
		o.rmempty = true;
		o.disabled = 0;
		o.enabled = 1;
		o.default = 0;
		o.depends('driver', 'overlay');

		o = s.option(form.DynamicList, 'options', _('Options'));
		o.rmempty = true;
		o.placeholder='com.docker.network.driver.mtu=1500';

		o = s.option(form.DynamicList, 'labels', _('Labels'));
		o.rmempty = true;
		o.placeholder='foo=bar';

		o = s.option(form.Flag, 'internal', _('Internal'), _('Restrict external access to the network'));
		o.rmempty = true;
		o.depends('driver', 'overlay');
		o.disabled = 0;
		o.enabled = 1;
		o.default = o.disabled;

		// if nixio.fs.access('/etc/config/network') and nixio.fs.access('/etc/config/firewall')then
		// 	o = s.option(form.Flag, 'op_macvlan', _('Create macvlan interface'), _('Auto create macvlan interface in Openwrt'))
		// 	o.depends('driver', 'macvlan')
		// 	o.disabled = 0
		// 	o.enabled = 1
		// 	o.default = 1
		// end

		o = s.option(form.Value, 'subnet', _('Subnet'));
		o.rmempty = true;
		o.placeholder = '10.1.0.0/16';
		o.datatype = 'ip4addr';

		o = s.option(form.Value, 'gateway', _('Gateway'));
		o.rmempty = true;
		o.placeholder = '10.1.1.1';
		o.datatype = 'ip4addr';

		o = s.option(form.Value, 'ip_range', _('IP range'));
		o.rmempty = true;
		o.placeholder='10.1.1.0/24';
		o.datatype = 'ip4addr';

		o = s.option(form.DynamicList, 'aux_address', _('Exclude IPs'));
		o.rmempty = true;
		o.placeholder = 'my-route=10.1.1.1';

		o = s.option(form.Flag, 'ipv6', _('Enable IPv6'));
		o.rmempty = true;
		o.disabled = 0;
		o.enabled = 1;
		o.default = o.disabled;

		o = s.option(form.Value, 'subnet6', _('IPv6 Subnet'));
		o.rmempty = true;
		o.placeholder='fe80::/10'
		o.datatype = 'ip6addr';
		o.depends('ipv6', 1);

		o = s.option(form.Value, 'gateway6', _('IPv6 Gateway'));
		o.rmempty = true;
		o.placeholder='fe80::1';
		o.datatype = 'ip6addr';
		o.depends('ipv6', 1);

		this.map = m;

		return m.render();

	},

	handleSave(ev) {
		ev?.preventDefault();

		const view = this;

		const map = this.map;
		if (!map)
			return Promise.reject(new Error(_('Form is not ready yet.')));

		const listToKv = view.listToKv;

		const toBool = (val) => (val === 1 || val === '1' || val === true);

		return map.parse()
			.then(() => {
				const get = (opt) => map.data.get('json', 'network', opt);
				const name = get('name');
				const driver = get('driver');
				const internal = toBool(get('internal'));
				const ingress = toBool(get('ingress'));
				const ipv6 = toBool(get('ipv6'));
				const subnet = get('subnet');
				const gateway = get('gateway');
				const ipRange = get('ip_range');
				const auxAddress = listToKv(get('aux_address'));
				const optionsList = listToKv(get('options'));
				const labelsList = listToKv(get('labels'));
				const subnet6 = get('subnet6');
				const gateway6 = get('gateway6');

				const createBody = {
					Name: name,
					Driver: driver,
					EnableIPv6: ipv6,
					IPAM: {
						Driver: 'default'
					},
					Internal: internal,
					Labels: labelsList,
				};

				if (subnet || gateway || ipRange
					|| (auxAddress && typeof auxAddress === 'object' && Object.keys(auxAddress).length)) {
					createBody.IPAM.Config = [{
						Subnet: subnet,
						Gateway: gateway,
						IPRange: ipRange,
						AuxAddress: auxAddress,
						AuxiliaryAddresses: auxAddress,
					}];
				}

				if (driver === 'macvlan') {
					createBody.Options = {
						macvlan_mode: get('macvlan_mode'),
						parent: get('parent'),
					};
				}
				else if (driver === 'ipvlan') {
					createBody.Options = {
						ipvlan_mode: get('ipvlan_mode'),
					};
				}
				else if (driver === 'overlay') {
					createBody.Ingress = ingress;
				}

				if (ipv6 && (subnet6 || gateway6)) {
					createBody.IPAM.Config = createBody.IPAM.Config || [];
					createBody.IPAM.Config.push({
						Subnet: subnet6,
						Gateway: gateway6,
					});
				}

				if (optionsList && typeof optionsList === 'object' && Object.keys(optionsList).length) {
					createBody.Options = Object.assign(createBody.Options || {}, optionsList);
				}

				if (labelsList && typeof labelsList === 'object' && Object.keys(labelsList).length) {
					createBody.Labels = Object.assign(createBody.Labels || {}, labelsList);
				}

				return createBody;
			})
			.then((createBody) => view.executeDockerAction(
				dm2.network_create,
				{ body: createBody },
				_('Create network'),
				{
					showOutput: false,
					showSuccess: false,
					onSuccess: (response) => {
						if (response?.body?.Warning) {
							view.showNotification(_('Network created with warning'), response.body.Warning, 5000, 'warning');
						} else {
							view.showNotification(_('Network created'), _('OK'), 4000, 'success');
						}
						window.location.href = `${this.dockerman_url}/networks`;
					}
				}
			))
			.catch((err) => {
				view.showNotification(_('Create network failed'), err?.message || String(err), 7000, 'error');
				return false;
			});
	},

	handleSaveApply: null,
	handleReset: null,

});
