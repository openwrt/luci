// SPDX-License-Identifier: Apache-2.0
/*
 * Copyright (C) 2015 GuoGuo <gch981213@gmail.com>
 * Copyright (C) 2025 ImmortalWrt.org
 */

'use strict';
'require form';
'require network';
'require view';

'require tools.widgets as widgets';

return view.extend({
	load: function() {
		return Promise.all([
			network.getHostHints()
		]);
	},

	render: function (data) {
		let m, s, o;
		let hosts = data[0]?.hosts;
		let ipaddrs = {};

		m = new form.Map('arpbind', _('IP/MAC Binding'),
			_('ARP is used to convert a network address (e.g. an IPv4 address) to a physical address such as a MAC address.<br />Here you can add some static ARP binding rules.'));

		s = m.section(form.TableSection, 'arpbind', _('Rules'));
		s.addremove = true;
		s.anonymous = true;
		s.sortable = true;
		s.rowcolors = true;

		o = s.option(form.Flag, 'enabled', _('Disable'));
		o.enabled = '0';
		o.disabled = '1';
		o.default = o.disabled;

		o = s.option(form.Value, 'ipaddr', _('IP Address'));
		o.datatype = 'ipaddr';
		Object.keys(hosts).forEach(function(mac) {
			let addrs = L.toArray(hosts[mac].ipaddrs || hosts[mac].ipv4);

			for (let i = 0; i < addrs.length; i++)
				ipaddrs[addrs[i]] = hosts[mac].name || mac;
		});
		L.sortedKeys(ipaddrs, null, 'addr').forEach(function(ipv4) {
			o.value(ipv4, '%s (%s)'.format(ipv4, ipaddrs[ipv4]));
		});
		o.rmempty = false;

		o = s.option(form.Value, 'macaddr', _('MAC Address'));
		o.datatype = 'macaddr';
		Object.keys(hosts).forEach(function(mac) {
			let hint = hosts[mac].name || L.toArray(hosts[mac].ipaddrs || hosts[mac].ipv4)[0];
			o.value(mac, hint ? '%s (%s)'.format(mac, hint) : mac);
		});
		o.rmempty = false;

		o = s.option(widgets.DeviceSelect, 'ifname', _('Interface'));
		o.multiple = false;
		o.noaliases = true;
		o.nocreate = true;
		o.rmempty = false;

		return m.render();
	}
});
