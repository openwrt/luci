'use strict';
'require form';
'require network';


network.registerPatternVirtual(/^bat\d+/);

return network.registerProtocol('batadv', {
	getI18n: function() {
		return _('Batman Device');
	},

	getIfname: function() {
		return this._ubus('l3_device') || this.sid;
	},

	getPackageName: function() {
		return 'kmod-batman-adv';
	},

	isFloating: function() {
		return true;
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
		var dev = this.getL3Device() || this.getDevice(), 
			o;
			
		s.tab('mesh', _('Mesh Routing'), _('Mesh and routing related options'));

		// @FIXME - the list of routing protocols should not be hard coded but come from batctl  
		o = s.taboption('mesh', form.ListValue, 'routing_algo', _('Routing Algorithm'),
				_('The algorithm that is used to discover mesh routes'));
		o.value('BATMAN_IV', 'BATMAN_IV');
		o.value('BATMAN_V', 'BATMAN_V');
		o.default = 'BATMAN_IV';

		o = s.taboption('mesh', form.Flag, 'aggregated_ogms', _('Aggregate Originator Messages'),
				_('reduces overhead by collecting and aggregating originator messages in a single packet rather than many small ones'));
		o.ucioption = 'aggregated_ogms';
		o.default = o.disabled;

		o = s.taboption('mesh', form.Value, 'orig_interval', _('Originator Interval'), 
				_('The value specifies the interval (milliseconds) in which batman-adv floods the network with its protocol information.'));
		o.placeholder = '1000';
		o.datatype    = 'min(1)';

		o = s.taboption('mesh', form.Flag, 'ap_isolation', _('Access Point Isolation'), 
				_('Prevents one wireless client to talk to another. This setting only affects packets without any VLAN tag (untagged packets).'));
		o.ucioption = 'ap_isolation';
		o.default = o.disabled;

		o = s.taboption('mesh', form.Flag, 'bonding', _('Bonding Mode'), 
				_('When running the mesh over multiple WiFi interfaces per node batman-adv is capable of optimizing the traffic flow to gain maximum performance.'));
		o.ucioption = 'bonding';
		o.default = o.disabled;

		o = s.taboption('mesh', form.Flag, 'bridge_loop_avoidance', _('Avoid Bridge Loops'), 
				_('In bridged LAN setups it is advisable to enable the bridge loop avoidance in order to avoid broadcast loops that can bring the entire LAN to a standstill.'));
		o.ucioption = 'bridge_loop_avoidance';
		o.default = o.disabled;

		o = s.taboption('mesh', form.Flag, 'distributed_arp_table', _('Distributed ARP Table'), 
				_('When enabled the distributed ARP table forms a mesh-wide ARP cache that helps non-mesh clients to get ARP responses much more reliably and without much delay.'));
		o.ucioption = 'distributed_arp_table';
		o.default = o.enabled;

		o = s.taboption('mesh', form.Flag, 'fragmentation', _('Fragmentation'), 
				_('Batman-adv has a built-in layer 2 fragmentation for unicast data flowing through the mesh which will allow to run batman-adv over interfaces / connections that don\'t allow to increase the MTU beyond the standard Ethernet packet size of 1500 bytes. When the fragmentation is enabled batman-adv will automatically fragment over-sized packets and defragment them on the other end. Per default fragmentation is enabled and inactive if the packet fits but it is possible to deactivate the fragmentation entirely.'));
		o.ucioption = 'fragmentation';
		o.default = o.enabled;

		o = s.taboption('mesh', form.ListValue, 'gw_mode', _('Gateway Mode'), 
				_('A batman-adv node can either run in server mode (sharing its internet connection with the mesh) or in client mode (searching for the most suitable internet connection in the mesh) or having the gateway support turned off entirely (which is the default setting).'));
		o.value('off', _('Off'));
		o.value('client', _('Client'));
		o.value('server', _('Server'));
		o.default = 'off';

		o = s.taboption('mesh', form.Value, 'hop_penalty', _('Hop Penalty'), 
				_('The hop penalty setting allows to modify batman-adv\'s preference for multihop routes vs. short routes. The value is applied to the TQ of each forwarded OGM, thereby propagating the cost of an extra hop (the packet has to be received and retransmitted which costs airtime)'));
		o.ucioption = 'hop_penalty';
		o.datatype    = 'min(1)';
		o.placeholder = '30';
		o.default = '30';
		
		o = s.taboption('mesh', form.Flag, 'multicast_mode', _('Multicast Mode'), 
				_('Enables more efficient, group aware multicast forwarding infrastructure in batman-adv.'));
		o.ucioption = 'multicast_mode';
		o.default = o.enabled;

		o = s.taboption('mesh', form.Flag, 'network_coding', _('Network Coding'), 
				_('When enabled network coding increases the WiFi throughput by combining multiple frames into a single frame, thus reducing the needed air time.'));
		o.ucioption = 'network_coding';
		o.default = o.enabled;
	}
});
