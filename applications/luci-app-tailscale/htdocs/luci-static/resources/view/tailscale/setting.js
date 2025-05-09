/* SPDX-License-Identifier: GPL-3.0-only
 *
 * Copyright (C) 2024 asvow
 */

'use strict';
'require form';
'require fs';
'require network';
'require poll';
'require rpc';
'require uci';
'require view';

const callServiceList = rpc.declare({
	object: 'service',
	method: 'list',
	params: ['name'],
	expect: { '': {} }
});

async function getInterfaceSubnets(interfaces = ['lan', 'wan']) {
	const networks = await network.getNetworks();
	return [...new Set(
		networks
			.filter(ifc => interfaces.includes(ifc.getName()))
			.flatMap(ifc => ifc.getIPAddrs())
			.filter(addr => addr.includes('/'))
			.map(addr => {
				const [ip, cidr] = addr.split('/');
				const ipParts = ip.split('.').map(Number);
				const mask = ~((1 << (32 - parseInt(cidr))) - 1);
				const subnetParts = ipParts.map((part, i) => (part & (mask >> (24 - i * 8))) & 255);
				return `${subnetParts.join('.')}/${cidr}`;
			})
	)];
}

async function getStatus() {
	const status = {
		isRunning: false,
		backendState: undefined,
		authURL: undefined,
		displayName: undefined,
		onlineExitNodes: [],
		subnetRoutes: []
	};
	const res = await callServiceList('tailscale');
	try {
		status.isRunning = res['tailscale']['instances']['instance1']['running'];
	} catch (e) {
		return status;
	}
	const tailscaleRes = await fs.exec("/usr/sbin/tailscale", ["status", "--json"]);
	const tailscaleStatus = JSON.parse(tailscaleRes.stdout.replace(/("\w+"):\s*(\d+)/g, '$1:"$2"'));
	if (!tailscaleStatus.AuthURL && tailscaleStatus.BackendState === "NeedsLogin") {
		fs.exec("/usr/sbin/tailscale", ["login"]);
	}
	status.backendState = tailscaleStatus.BackendState;
	status.authURL = tailscaleStatus.AuthURL;
	status.displayName = (status.backendState === "Running") ? tailscaleStatus.User[tailscaleStatus.Self.UserID].DisplayName : undefined;
	if (tailscaleStatus.Peer) {
		status.onlineExitNodes = Object.values(tailscaleStatus.Peer)
			.flatMap(peer => (peer.ExitNodeOption && peer.Online) ? [peer.HostName] : []);
		status.subnetRoutes = Object.values(tailscaleStatus.Peer)
			.flatMap(peer => peer.PrimaryRoutes || []);
	}
	return status;
}

function renderStatus(isRunning) {
	const spanTemp = '<em><span style="color:%s"><strong>%s %s</strong></span></em>';
	let renderHTML;
	if (isRunning) {
		renderHTML = String.format(spanTemp, 'green', _('Tailscale'), _('RUNNING'));
	} else {
		renderHTML = String.format(spanTemp, 'red', _('Tailscale'), _('NOT RUNNING'));
	}

	return renderHTML;
}

function renderLogin(loginStatus, authURL, displayName) {
	const spanTemp = '<span style="color:%s">%s</span>';
	let renderHTML;
	if (loginStatus === "NeedsLogin") {
		renderHTML = String.format('<a href="%s" target="_blank">%s</a>', authURL, _('Need to log in'));
	} else if (loginStatus === "Running") {
		renderHTML = String.format('<a href="%s" target="_blank">%s</a>', 'https://login.tailscale.com/admin/machines', displayName);
		renderHTML += String.format('<br><a style="color:green" id="logout_button">%s</a>', _('Log out and Unbind'));
	} else {
		renderHTML = String.format(spanTemp, 'orange', _('NOT RUNNING'));
	}

	return renderHTML;
}

return view.extend({
	load() {
		return Promise.all([
			uci.load('tailscale'),
			getStatus(),
			getInterfaceSubnets()
		]);
	},

	render(data) {
		let m, s, o;
		const statusData = data[1];
		const interfaceSubnets = data[2];
		const onlineExitNodes = statusData.onlineExitNodes;
		const subnetRoutes = statusData.subnetRoutes;

		m = new form.Map('tailscale', _('Tailscale'), _('Tailscale is a cross-platform and easy to use virtual LAN.'));

		s = m.section(form.TypedSection);
		s.anonymous = true;
		s.render = function () {
			poll.add(async function() {
				const res = await getStatus();
				const service_view = document.getElementById("service_status");
				const login_view = document.getElementById("login_status_div");
				service_view.innerHTML = renderStatus(res.isRunning);
				login_view.innerHTML = renderLogin(res.backendState, res.authURL, res.displayName);
				const logoutButton = document.getElementById('logout_button');
				if (logoutButton) {
					logoutButton.onclick = function() {
						if (confirm(_('Are you sure you want to log out and unbind the current device?'))) {
							fs.exec("/usr/sbin/tailscale", ["logout"]);
						}
					}
				}
			});

			return E('div', { class: 'cbi-section', id: 'status_bar' }, [
				E('p', { id: 'service_status' }, _('Collecting data ...'))
			]);
		}

		s = m.section(form.NamedSection, 'settings', 'config');
		s.tab('basic', _('Basic Settings'));

		o = s.taboption('basic', form.Flag, 'enabled', _('Enable'));
		o.default = o.disabled;
		o.rmempty = false;

		o = s.taboption('basic', form.DummyValue, 'login_status', _('Login Status'));
		o.depends('enabled', '1');
		o.renderWidget = function(section_id, option_id) {
			return E('div', { 'id': 'login_status_div' }, _('Collecting data ...'));
		};

		o = s.taboption('basic', form.Value, 'port', _('Port'), _('Set the Tailscale port number.'));
		o.datatype = 'port';
		o.default = '41641';
		o.rmempty = false;

		o = s.taboption('basic', form.Value, 'config_path', _('Workdir'), _('The working directory contains config files, audit logs, and runtime info.'));
		o.default = '/etc/tailscale';
		o.rmempty = false;

		o = s.taboption('basic', form.ListValue, 'fw_mode', _('Firewall Mode'));
		o.value('nftables', 'nftables');
		o.value('iptables', 'iptables');
		o.default = 'nftables';
		o.rmempty = false;

		o = s.taboption('basic', form.Flag, 'log_stdout', _('StdOut Log'), _('Logging program activities.'));
		o.default = o.enabled;
		o.rmempty = false;

		o = s.taboption('basic', form.Flag, 'log_stderr', _('StdErr Log'), _('Logging program errors and exceptions.'));
		o.default = o.enabled;
		o.rmempty = false;

		s.tab('advance', _('Advanced Settings'));

		o = s.taboption('advance', form.Flag, 'accept_routes', _('Accept Routes'), _('Accept subnet routes that other nodes advertise.'));
		o.default = o.disabled;
		o.rmempty = false;

		o = s.taboption('advance', form.Value, 'hostname', _('Device Name'), _("Leave blank to use the device's hostname."));
		o.default = '';
		o.rmempty = true;

		o = s.taboption('advance', form.Flag, 'accept_dns', _('Accept DNS'), _('Accept DNS configuration from the Tailscale admin console.'));
		o.default = o.enabled;
		o.rmempty = false;

		o = s.taboption('advance', form.Flag, 'advertise_exit_node', _('Exit Node'), _('Offer to be an exit node for outbound internet traffic from the Tailscale network.'));
		o.default = o.disabled;
		o.rmempty = false;

		o = s.taboption('advance', form.ListValue, 'exit_node', _('Online Exit Nodes'), _('Select an online machine name to use as an exit node.'));
		if (onlineExitNodes.length > 0) {
			o.optional = true;
			onlineExitNodes.forEach(function(node) {
				o.value(node, node);
			});
		} else {
			o.value('', _('No Available Exit Nodes'));
			o.readonly = true;
		}
		o.default = '';
		o.depends('advertise_exit_node', '0');
		o.rmempty = true;

		o = s.taboption('advance', form.DynamicList, 'advertise_routes', _('Expose Subnets'), _('Expose physical network routes into Tailscale, e.g. <code>10.0.0.0/24</code>.'));
		if (interfaceSubnets.length > 0) {
			interfaceSubnets.forEach(function(subnet) {
				o.value(subnet, subnet);
			});
		}
		o.default = '';
		o.rmempty = true;

		o = s.taboption('advance', form.Flag, 'disable_snat_subnet_routes', _('Site To Site'), _('Use site-to-site layer 3 networking to connect subnets on the Tailscale network.'));
		o.default = o.disabled;
		o.depends('accept_routes', '1');
		o.rmempty = false;

		o = s.taboption('advance', form.DynamicList, 'subnet_routes', _('Subnet Routes'), _('Select subnet routes advertised by other nodes in Tailscale network.'));
		if (subnetRoutes.length > 0) {
			subnetRoutes.forEach(function(route) {
				o.value(route, route);
			});
		} else {
			o.value('', _('No Available Subnet Routes'));
			o.readonly = true;
		}
		o.default = '';
		o.depends('disable_snat_subnet_routes', '1');
		o.rmempty = true;

		o = s.taboption('advance', form.MultiValue, 'access', _('Access Control'));
		o.value('ts_ac_lan', _('Tailscale access LAN'));
		o.value('ts_ac_wan', _('Tailscale access WAN'));
		o.value('lan_ac_ts', _('LAN access Tailscale'));
		o.value('wan_ac_ts', _('WAN access Tailscale'));
		o.default = "ts_ac_lan ts_ac_wan lan_ac_ts";
		o.rmempty = true;

		s.tab('extra', _('Extra Settings'));

		o = s.taboption('extra', form.DynamicList, 'flags', _('Additional Flags'),
			String.format(
				_('List of extra flags. Format: --flags=value, e.g. <code>--exit-node=10.0.0.1</code>. <br> %s for enabling settings upon the initiation of Tailscale.'),
				'<a href="https://tailscale.com/kb/1241/tailscale-up" target="_blank">' + _('Available flags') + '</a>'
			)
		);
		o.default = '';
		o.rmempty = true;

		s = m.section(form.NamedSection, 'settings', 'config');
		s.title = _('Custom Server Settings');
		s.description = String.format(_('Use %s to deploy a private server.'), '<a href="https://github.com/juanfont/headscale" target="_blank">headscale</a>');

		o = s.option(form.Value, 'login_server', _('Server Address'));
		o.default = '';
		o.rmempty = true;

		o = s.option(form.Value, 'authKey', _('Auth Key'));
		o.default = '';
		o.rmempty = true;

		return m.render();
	}
});
