'use strict';
'require ui';
'require uci';
'require form';
'require fs';
'require network';
'require tools.widgets as widgets';


function getSelectableSlaves(section_id) {
	var rv = [];
	var NonUsableMac = /^(00:00:00:00:00:00|null)/;
	var interfaces = uci.sections('network', 'interface');

	return network.getDevices().then(function(devices) {
		for (var i = 0; i < devices.length; i++) {
			var in_use = false;
			var NotUsable = NonUsableMac.test(devices[i].getMAC());

			// Only "real" interfaces for slaves needed
			if (NotUsable == false) {
				for (var j = 0; j < interfaces.length; j++) {
					if (uci.get('network', interfaces[j]['.name'], 'proto') == 'bonding') {
						var slaves = L.toArray(uci.get('network', interfaces[j]['.name'], 'slaves'));

						for (var k = 0; k < slaves.length; k++) {
							if (devices[i].ifname == slaves[k] || devices[i].device == slaves[k]) {
								if (interfaces[j]['.name'] != section_id) {
									in_use = true;
								}
							}
						}
					}
				}
				if (in_use == false) {
					devices[i].device == null ? rv.push(devices[i].ifname) : rv.push(devices[i].device)
				}
			}
		}

	return rv.sort();
	});
}

function validateEmpty(section, value) {
	if (value) {
		return true;
	}
	else {
		return _('Expecting: non-empty value');
	}
}

function updatePrimaries(section, value) {

	var opt = this.map.lookupOption('slaves', section);
	var selected_slaves = opt[0].formvalue(section);

	var uielem = this.map.lookupOption('primary', section)[0].getUIElement(section);
	uielem.clearChoices();

	for (var i = 0; i < selected_slaves.length; i++) {
		uielem.addChoices(selected_slaves[i], selected_slaves[i]);
	}

	return true;
}

function validate_arp_policy(section, value) {

	var opt = this.map.lookupOption('link_monitoring', section);
	var selected_link_monitoring = opt[0].formvalue(section);

	var opt = this.map.lookupOption('bonding_policy', section);
	var selected_policy = opt[0].formvalue(section);

	if (selected_link_monitoring == 'arp') {
		if (selected_policy == '802.3ad' || selected_policy == 'balance-tlb' || selected_policy == 'balance-alb') {
			return _('ARP monitoring is not supported for the selected policy!');
		}
	}

	return true;
}

function validate_arp_ip_targets(section, value) {

	var opt = this.map.lookupOption('link_monitoring', section);
	var selected_link_monitoring = opt[0].formvalue(section);

	var opt = this.map.lookupOption('arp_ip_target', section);
	var selected_arp_ip_targets = opt[0].formvalue(section);

	var opt = this.map.lookupOption('bonding_policy', section);
	var selected_policy = opt[0].formvalue(section);

	if (selected_link_monitoring == 'arp' && selected_arp_ip_targets.length == 0) {
		return _('You must select at least one ARP IP target if ARP monitoring is selected!');
	}

	return true;
}

function validate_primary_interface(section, value) {

	var opt = this.map.lookupOption('bonding_policy', section);
	var selected_policy = opt[0].formvalue(section);

	var opt = this.map.lookupOption('slaves', section);
	var selected_slaves = opt[0].formvalue(section);

	var opt = this.map.lookupOption('primary', section);
	var selected_primary = opt[0].formvalue(section);

	if (selected_policy == 'active-backup' || selected_policy == 'balance-tlb' || selected_policy == 'balance-alb') {
		if (selected_slaves.filter(function(slave) { return slave == selected_primary }).length == 0)
			return _('You must select a primary interface which is included in selected slave interfaces!');
 	}

	return true;
}

return network.registerProtocol('bonding', {
	getI18n: function() {
		return _('Link Aggregation (Channel Bonding)');
	},

	getIfname: function() {
		return null;
	},

	getOpkgPackage: function() {
		return 'bonding';
	},

	isFloating: function() {
		return true;
	},

	isCreateable: function(ifname) {
		return getSelectableSlaves(ifname).then(L.bind(function(devices) {
			return devices.length == 0 ?  _('No more slaves available') : null;
		}, this));

		return _('No more slaves available');
	},

	isVirtual: function() {
		return true;
	},

	getDevices: function() {
		return null;
	},

	containsDevice: function(ifname) {
		return (network.getIfnameOf(ifname) == this.getIfname());
	},

	renderFormOptions: function(s) {
		var o;

		o = s.taboption('general', form.Value, 'ipaddr',
				_('IPv4 address'),
				_('The local IPv4 address'));
		o.datatype = 'ip4addr';
		o.rmempty = false;

		o = s.taboption('general', form.Value, 'netmask',
				_('IPv4 netmask'),
				_('The local IPv4 netmask'));
		o.datatype = 'ip4addr';
		o.validate = validateEmpty;
		o.rmempty = false;
		o.value("255.255.255.0");
		o.value("255.255.0.0");
		o.value("255.0.0.0");

		o = s.taboption('advanced', form.MultiValue, 'slaves',
				_('Slave Interfaces'),
				_('Specifies which slave interfaces should be attached to this bonding interface'));
		o.load = function(section_id) {
			return getSelectableSlaves(section_id).then(L.bind(function(devices) {
				for (var i = 0; i < devices.length; i++) {
					this.value(devices[i], devices[i]);
				}

				if (devices.length == 0) {
					this.placeholder = _('No more slaves available, can not save interface');
					this.value('', '');
					return '';
				}

				return uci.get('network', section_id, 'slaves');
			}, this));
		};
		o.validate = updatePrimaries;
		o.rmempty = false;
		
		o = s.taboption('advanced', form.ListValue, 'bonding_policy',
				_('Bonding Policy'),
				_('Specifies the mode to be used for this bonding interface'));
		o.default = 'balance-rr';
		o.value('balance-rr', _('Round-Robin policy (balance-rr, 0)'));
		o.value('active-backup', _('Active-Backup policy (active-backup, 1)'));
		o.value('balance-xor', _('XOR policy (balance-xor, 2)'));
		o.value('broadcast', _('Broadcast policy (broadcast, 3)'));
		o.value('802.3ad', _('IEEE 802.3ad Dynamic link aggregation (802.3ad, 4)'));
		o.value('balance-tlb', _('Adaptive transmit load balancing (balance-tlb, 5)'));
		o.value('balance-alb', _('Adaptive load balancing (balance-alb, 6)'));

		o = s.taboption('advanced', widgets.DeviceSelect, 'primary',
				_('Primary Slave'),
				_('Specifies which slave is the primary device. It will always be the active slave while it is available'));
		o.depends('bonding_policy', 'active-backup');
		o.depends('bonding_policy', 'balance-tlb');
		o.depends('bonding_policy', 'balance-alb');
		o.filter = function(section_id, value) {
			// Never return anything as valid, as the valid possibilities
			// will be set in the slaves validate function
			return false;
		};
		o.validate = validate_primary_interface;

		o = s.taboption('advanced', form.ListValue, 'primary_reselect',
				_('Reselection policy for primary slave'),
				_('Specifies the reselection policy for the primary slave when failure of the active slave or recovery of the primary slave occurs'));
		o.default = 'always';
		o.value('always', _('Primary becomes active slave whenever it comes back up (always, 0)'));
		o.value('better', _('Primary becomes active slave when it comes back up if speed and duplex better than current slave (better, 1)'));
		o.value('failure', _('Only if current active slave fails and the primary slave is up (failure, 2)'));
		o.depends('bonding_policy', 'active-backup');
		o.depends('bonding_policy', 'balance-tlb');
		o.depends('bonding_policy', 'balance-alb');

		o = s.taboption('advanced', form.Value, 'min_links',
				_('Minimum Number of Links'),
				_('Specifies the minimum number of links that must be active before asserting carrier'));
		o.datatype = 'uinteger';
		o.default = 0;
		o.rmempty = false;
		o.depends('bonding_policy', '802.3ad');

		o = s.taboption('advanced', form.Value, 'ad_actor_sys_prio',
				_('System Priority'),
				_('Specifies the system priority'));
		o.datatype = 'range(1,65535)';
		o.default = 65535;
		o.rmempty = false;
		o.depends('bonding_policy', '802.3ad');

		o = s.taboption('advanced', form.Value, 'ad_actor_system',
				_('MAC Address For The Actor'),
				_("Specifies the mac-address for the actor in protocol packet exchanges (LACPDUs). If empty, masters' mac address defaults to system default"));
		o.datatype = 'macaddr';
		o.default = '';
		o.depends('bonding_policy', '802.3ad');

		o = s.taboption('advanced', form.ListValue, 'ad_select',
				_('Aggregation Selection Logic'),
				_('Specifies the aggregation selection logic to use'));
		o.default = 'stable';
		o.value('stable', _('Aggregator: All slaves down or has no slaves (stable, 0)'));
		o.value('bandwidth', _('Aggregator: Slave added/removed or state changes (bandwidth, 1)'));
		o.value('count', _('Aggregator: Chosen by the largest number of ports + slave added/removed or state changes (count, 2)'));
		o.depends('bonding_policy', '802.3ad');

		o = s.taboption('advanced', form.ListValue, 'lacp_rate',
				_('LACPDU Packets'),
				_('Specifies the rate in which the link partner will be asked to transmit LACPDU packets'));
		o.default = 'slow';
		o.value('slow', _('Every 30 seconds (slow, 0)'));
		o.value('fast', _('Every second (fast, 1)'));
		o.depends('bonding_policy', '802.3ad');

		o = s.taboption('advanced', form.Value, 'packets_per_slave',
				_('Packets To Transmit Before Moving To Next Slave'),
				_("Specifies the number of packets to transmit through a slave before moving to the next one"));
		o.datatype = 'range(0,65535)';
		o.default = '1';
		o.rmempty = false;
		o.depends('bonding_policy', 'balance-rr');

		o = s.taboption('advanced', form.Value, 'lp_interval',
				_('Interval For Sending Learning Packets'),
				_("Specifies the number of seconds between instances where the bonding	driver sends learning packets to each slaves peer switch"));
		o.datatype = 'range(1,2147483647)';
		o.default = '1';
		o.rmempty = false;
		o.depends('bonding_policy', 'balance-tlb');
		o.depends('bonding_policy', 'balance-alb');

		o = s.taboption('advanced', form.ListValue, 'tlb_dynamic_lb',
				_('Enable Dynamic Shuffling Of Flows'),
				_('Specifies whether to shuffle active flows across slaves based on the load'));
		o.default = '1';
		o.value('1', _('Yes'));
		o.value('0', _('No'));
		o.depends('bonding_policy', 'balance-tlb');

		o = s.taboption('advanced', form.ListValue, 'fail_over_mac',
				_('Set same MAC Address to all slaves'),
				_('Specifies whether active-backup mode should set all slaves to the same MAC address at enslavement'));
		o.default = 'none';
		o.value('none', _('Yes (none, 0)'));
		o.value('active', _('Set to currently active slave (active, 1)'));
		o.value('follow', _('Set to first slave added to the bond (follow, 2)'));
		o.depends('bonding_policy', 'active-backup');

		o = s.taboption('advanced', form.Value, 'num_grat_arp__num_unsol_na',
				_('Number of peer notifications after failover event'),
				_("Specifies the number of peer notifications (gratuitous ARPs and unsolicited IPv6 Neighbor Advertisements) to be issued after a failover event"));
		o.datatype = 'range(0,255)';
		o.default = '1';
		o.rmempty = false;
		o.depends('bonding_policy', 'active-backup');

		o = s.taboption('advanced', form.ListValue, 'xmit_hash_policy',
				_('Transmit Hash Policy'),
				_('Selects the transmit hash policy to use for slave selection'));
		o.default = 'layer2';
		o.value('layer2', _('Use XOR of hardware MAC addresses (layer2)'));
		o.value('layer2+3', _('Use XOR of hardware MAC addresses and IP addresses (layer2+3)'));
		o.value('layer3+4', _('Use upper layer protocol information (layer3+4)'));
		o.value('encap2+3', _('Use XOR of hardware MAC addresses and IP addresses, rely on skb_flow_dissect (encap2+3)'));
		o.value('encap3+4', _('Use upper layer protocol information, rely on skb_flow_dissect (encap3+4)'));
		o.depends('bonding_policy', 'balance-xor');
		o.depends('bonding_policy', 'balance-alb');
		o.depends('bonding_policy', 'balance-tlb');
		o.depends('bonding_policy', '802.3ad');

		o = s.taboption('advanced', form.Value, 'resend_igmp',
				_('Number of IGMP membership reports'),
				_("Specifies the number of IGMP membership reports to be issued after a failover event in 200ms intervals"));
		o.datatype = 'range(0,255)';
		o.default = '1';
		o.rmempty = false;
		o.depends('bonding_policy', 'balance-tlb');
		o.depends('bonding_policy', 'balance-alb');

		o = s.taboption('advanced', form.ListValue, 'all_slaves_active',
				_('Drop Duplicate Frames'),
				_('Specifies that duplicate frames (received on inactive ports) should be dropped or delivered'));
		o.default = '0';
		o.value('0', _('Yes'));
		o.value('1', _('No'));

		o = s.taboption('advanced', form.ListValue, 'link_monitoring',
				_('Link Monitoring'),
				_('Method of link monitoring'));
		o.default = 'off';
		o.value('off', _('Off'));
		o.value('arp', _('ARP'));
		o.value('mii', _('MII'));
		o.validate = validate_arp_policy;

		o = s.taboption('advanced', form.Value, 'arp_interval',
				_('ARP Interval'),
				_("Specifies the ARP link monitoring frequency in milliseconds"));
		o.datatype = 'uinteger';
		o.default = '0';
		o.rmempty = false;
		o.depends('link_monitoring', 'arp');

		o = s.taboption('advanced', form.DynamicList, 'arp_ip_target',
				_('ARP IP Targets'),
				_('Specifies the IP addresses to use for ARP monitoring'));
		o.datatype = 'ipaddr';
		o.cast = 'string';
		o.depends('link_monitoring', 'arp');
		o.validate = validate_arp_ip_targets;

		o = s.taboption('advanced', form.ListValue, 'arp_all_targets',
				_('ARP mode to consider a slave as being up'),
				_('Specifies the quantity of ARP IP targets that must be reachable'));
		o.default = 'any';
		o.value('any', _('Consider the slave up when any ARP IP target is reachable (any, 0)'));
		o.value('all', _('Consider the slave up when all ARP IP targets are reachable (all, 1)'));
		o.depends({link_monitoring: 'arp', bonding_policy: 'active-backup'});

		o = s.taboption('advanced', form.ListValue, 'arp_validate',
				_('ARP Validation'),
				_('Specifies whether ARP probes and replies should be validated or non-ARP traffic should be filtered for link monitoring'));
		o.default = 'filter';
		o.value('none', _('No validation or filtering'));
		o.value('active', _('Validation only for active slave'));
		o.value('backup', _('Validation only for backup slaves'));
		o.value('all', _('Validation for all slaves'));
		o.value('filter', _('Filtering for all slaves, no validation'));
		o.value('filter_active', _('Filtering for all slaves, validation only for active slave'));
		o.value('filter_backup', _('Filtering for all slaves, validation only for backup slaves'));
		o.depends('link_monitoring', 'arp');

		o = s.taboption('advanced', form.Value, 'miimon',
				_('MII Interval'),
				_("Specifies the MII link monitoring frequency in milliseconds"));
		o.datatype = 'uinteger';
		o.default = '0';
		o.rmempty = false;
		o.depends('link_monitoring', 'mii');

		o = s.taboption('advanced', form.Value, 'downdelay',
				_('Down Delay'),
				_("Specifies the time in milliseconds to wait before disabling a slave after a link failure detection"));
		o.datatype = 'uinteger';
		o.default = '0';
		o.rmempty = false;
		o.depends('link_monitoring', 'mii');

		o = s.taboption('advanced', form.Value, 'updelay',
				_('Up Delay'),
				_("Specifies the time in milliseconds to wait before enabling a slave after a link recovery detection"));
		o.datatype = 'uinteger';
		o.default = '0';
		o.rmempty = false;
		o.depends('link_monitoring', 'mii');

		o = s.taboption('advanced', form.ListValue, 'use_carrier',
				_('Method to determine link status'),
				_('Specifies whether or not miimon should use MII or ETHTOOL ioctls vs. netif_carrier_ok()'));
		o.default = '1';
		o.value('0', _('MII / ETHTOOL ioctls'));
		o.value('1', _('netif_carrier_ok()'));
		o.depends('link_monitoring', 'mii');
	}
});
