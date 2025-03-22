'use strict';
'require view';
'require form';
'require uci';
'require network';
'require tools.widgets as widgets';

return view.extend({
	load: function() {
		return Promise.all([
			network.getDevices(),
			uci.load('keepalived'),
		]);
	},

	renderGeneralTab: function(s) {
		var o, ipaddress;

		o = s.taboption('general',form.Value, 'name', _('Name'));
		o.rmempty = false;
		o.optional = false;

		o = s.taboption('general', form.ListValue, 'state', _('State'),
			_('Initial State.') + ' ' +
			_('As soon as the other machine(s) come up, an election will be held.') + ' ' +
			_('The machine with the highest "priority" will become MASTER.'));
		o.value('MASTER', _('Master'));
		o.value('BACKUP', _('Backup'));
		o.optional = false;
		o.rmempty = false;

		o = s.taboption('general', widgets.DeviceSelect, 'interface', _('Interface'),
			_('Interface for inside_network, bound by VRRP'));
		o.noaliases = true;
		o.noinactive = true;
		o.optional = false;
		o.rmempty = false;

		o = s.taboption('general', form.Value, 'virtual_router_id', _('Virtual Router Id'),
			_('Differentiate multiple instances of vrrpd, running on the same NIC'));
		o.datatype = 'range(1-255)';
		o.optional = false;
		o.rmempty = false;

		o = s.taboption('general', form.Value, 'priority', _('Priority'),
			_('A server with a higher priority becomes a MASTER'));
		o.datatype = 'uinteger';
		o.optional = false;
		o.rmempty = false;

		o = s.taboption('general', form.ListValue, 'advert_int', _('Interval'),
			_('VRRP Advert interval in seconds'));
		o.datatype = 'float';
		o.default = '1';
		o.rmempty = false;
		o.optional = false;
		o.value('1');
		o.value('3');
		o.value('5');
		o.value('10');
		o.value('30');
		o.value('60');

		o = s.taboption('general', form.Flag, 'nopreempt', _('Disable Preempt'),
			_('Allows the lower priority machine to maintain the master role, even when a higher priority machine comes back online.') + ' ' +
			_('For this to work, the initial state of this entry must be BACKUP.'));
		o.optional = true;
		o.default = false;

		ipaddress = uci.sections('keepalived', 'ipaddress');
		o = s.taboption('general', form.DynamicList, 'virtual_ipaddress', _('Virtual IP Address'),
			_('Addresses add|del on change to MASTER, to BACKUP.') + ' ' +
			_('With the same entries on other machines, the opposite transition will be occurring.'));
		if (ipaddress != '') {
			for (var i = 0; i < ipaddress.length; i++) {
				o.value(ipaddress[i]['name']);
			}
		}
		o.rmempty = false;
		o.optional = false;
	},

	renderPeerTab: function(s, netDevs) {
		var o;

		o = s.taboption('peer', form.ListValue, 'unicast_src_ip', _('Unicast Source IP'),
			_('Default IP for binding vrrpd is the primary IP on interface'));
		o.datatype = 'ipaddr';
		o.optional = true;
		o.modalonly = true;
		for (var i = 0; i < netDevs.length; i++) {
			var addrs = netDevs[i].getIPAddrs();
			for (var j = 0; j < addrs.length; j++) {
				o.value(addrs[j].split('/')[0]);
			}
		}

		var peers = uci.sections('keepalived', 'peer');
		o = s.taboption('peer', form.DynamicList, 'unicast_peer', _('Peer'),
			_('Do not send VRRP adverts over VRRP multicast group.') + ' ' +
			_('Instead it sends adverts to the following list of ip addresses using unicast design fashion'));
		if (peers != '') {
			for (var i = 0; i < peers.length; i++) {
				o.value(peers[i]['name']);
			}
		}

		o = s.taboption('peer', form.Value, 'mcast_src_ip', _('Multicast Source IP'),
			_('If you want to hide location of vrrpd, use this IP for multicast vrrp packets'));
		o.datatype = 'ipaddr';
		o.optional = true;
		o.modalonly = true;
		o.depends({ 'unicast_peer' : '' });

		o = s.taboption('peer', form.ListValue, 'auth_type', _('HA Authentication Type'));
		o.value('PASS', _('Simple Password'));
		o.value('AH', _('IPSec'));

		o = s.taboption('peer', form.Value, 'auth_pass', _('Password'),
			_('Password for accessing vrrpd, should be the same on all machines'));
		o.datatype = 'maxlength(8)';
		o.password = true;
		o.modalonly = true;
		o.depends({ 'auth_type' : 'PASS' });
	},

	renderGARPTab: function(s) {
		var o;

		o = s.taboption('garp', form.ListValue, 'garp_master_delay', _('GARP Delay'),
			_('Gratuitous Master Delay in seconds'));
		o.datatype = 'uinteger';
		o.modalonly = true;
		o.value('1');
		o.value('3');
		o.value('5');
		o.value('10');
		o.value('30');
		o.value('60');

		o = s.taboption('garp', form.ListValue, 'garp_master_repeat', _('GARP Repeat'),
			_('Gratuitous Master Repeat in seconds'));
		o.datatype = 'uinteger';
		o.modalonly = true;
		o.value('1');
		o.value('3');
		o.value('5');
		o.value('10');
		o.value('30');
		o.value('60');

		o = s.taboption('garp', form.ListValue, 'garp_master_refresh', _('GARP Refresh'),
			_('Gratuitous Master Refresh in seconds'));
		o.datatype = 'uinteger';
		o.modalonly = true;
		o.value('1');
		o.value('3');
		o.value('5');
		o.value('10');
		o.value('30');
		o.value('60');

		o = s.taboption('garp', form.ListValue, 'garp_master_refresh_repeat', _('GARP Refresh Repeat'),
			_('Gratuitous Master Refresh Repeat in seconds'));
		o.datatype = 'uinteger';
		o.modalonly = true;
		o.value('1');
		o.value('3');
		o.value('5');
		o.value('10');
		o.value('30');
		o.value('60');
	},

	renderAdvancedTab: function(s) {
		var o;

		o = s.taboption('advanced', form.Value, 'use_vmac', _('Use VMAC'),
			_('Use VRRP Virtual MAC'));
		o.optional = true;
		o.placeholder = '[<VMAC_INTERFACE_NAME>] [MAC_ADDRESS]';
		o.modalonly = true;

		o = s.taboption('advanced', form.Flag, 'vmac_xmit_base', _('Use VMAC Base'),
			_('Send/Recv VRRP messages from base interface instead of VMAC interface'));
		o.default = false;
		o.optional = true;
		o.modalonly = true;

		o = s.taboption('advanced', form.Flag, 'native_ipv6', _('Use IPV6'),
			_('Force instance to use IPv6'));
		o.default = false;
		o.optional = true;
		o.modalonly = true;

		o = s.taboption('advanced', form.Flag, 'dont_track_primary', _('Disable Primary Tracking'),
			_('Ignore VRRP interface faults'));
		o.default = false;
		o.optional = true;
		o.modalonly = true;

		o = s.taboption('advanced', form.ListValue, 'version', _('Version'),
			_('VRRP version to run on interface'));
		o.value('', _('None'));
		o.value('2', _('2'));
		o.value('3', _('3'));
		o.default = '';
		o.modalonly = true;

		o = s.taboption('advanced', form.Flag, 'accept', _('Accept'),
			_('Accept packets to non address-owner'));
		o.default = false;
		o.optional = true;

		o = s.taboption('advanced', form.Value, 'preempt_delay', _('Preempt Delay'),
			_('Time in seconds to delay preempting compared'));
		o.datatype = 'float';
		o.placeholder = '300';
		o.modalonly = true;

		o = s.taboption('advanced', form.ListValue, 'debug', _('Debug'),
			_('Debug Level'));
		o.default = '0';
		o.value('0');
		o.value('1');
		o.value('2');
		o.value('3');
		o.value('4');
		o.modalonly = true;

		o = s.taboption('advanced', form.Flag, 'smtp_alert', _('Email Alert'),
			_('Send SMTP alerts'));
		o.default = false;
		o.modalonly = true;
	},

	renderTrackingTab: function(s) {
		var o;
		var ipaddress, routes, interfaces, scripts;

		ipaddress = uci.sections('keepalived', 'ipaddress');
		routes = uci.sections('keepalived', 'route');
		interfaces = uci.sections('keepalived', 'track_interface');
		scripts = uci.sections('keepalived', 'track_script');

		o = s.taboption('tracking', form.DynamicList, 'virtual_ipaddress_excluded', _('Exclude Virtual IP Address'),
			_('VRRP IP excluded from VRRP.') + ' ' +
			_('For cases with large numbers (eg 200) of IPs on the same interface.') + ' ' +
			_('To decrease the number of packets sent in adverts, you can exclude most IPs from adverts.'));
		o.modalonly = true;
		if (ipaddress != '') {
			for (var i = 0; i < ipaddress.length; i++) {
				o.value(ipaddress[i]['name']);
			}
		}

		o = s.taboption('tracking', form.DynamicList, 'virtual_routes', _('Virtual Routes'),
			_('Routes add|del when changing to MASTER, to BACKUP'));
		o.modalonly = true;
		if (routes != '') {
			for (var i = 0; i < routes.length; i++) {
				o.value(routes[i]['name']);
			}
		}

		o = s.taboption('tracking', form.DynamicList, 'track_interface', _('Track Interfaces'),
			_('Go to FAULT state if any of these go down'));
		o.modalonly = true;
		if (interfaces != '') {
			for (var i = 0; i < interfaces.length; i++) {
				o.value(interfaces[i]['name']);
			}
		}

		o = s.taboption('tracking', form.DynamicList, 'track_script', _('Track Script'),
			_('Go to FAULT state if any of these go down, if unweighted'));
		o.modalonly = true;
		if (scripts != '') {
			for (var i = 0; i < scripts.length; i++) {
				o.value(scripts[i]['name']);
			}
		}
	},

	render: function(data) {
		var netDevs = data[0];
		let m, s, o;

		m = new form.Map('keepalived');

		s = m.section(form.GridSection, 'vrrp_instance', _('VRRP Instance'),
			_('Define an individual instance of the VRRP protocol running on an interface'));
		s.anonymous = true;
		s.addremove = true;
		s.nodescriptions = true;

		o = s.tab('general', _('General'));
		o = s.tab('peer', _('Peer'));
		o = s.tab('tracking', _('Tracking'));
		o = s.tab('garp', _('GARP'));
		o = s.tab('advanced', _('Advanced'));

		this.renderGeneralTab(s);
		this.renderPeerTab(s, netDevs);
		this.renderTrackingTab(s);
		this.renderGARPTab(s);
		this.renderAdvancedTab(s);

		return m.render();
	}
});
