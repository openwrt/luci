'use strict';
'require uci';
'require form';
'require network';

network.registerPatternVirtual(/^bat.+$/);

return network.registerProtocol('batadv_hardif', {
	getI18n: function() {
		return _('Batman Interface');
	},
	
	getIfname: function() {
		return this._ubus('l3_device') || this.sid;
	},
	
	getPackageName: function() {
		return 'kmod-batman-adv';
	},
	
	isFloating: function() {
		return false;
	},
	
	isVirtual: function() {
		return false;
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

		o = s.taboption('general', form.ListValue, 'master', _('Batman Device'),
				_('This is the batman-adv device where you want to link the physical Device from above to. If this list is empty, then you need to create one first. If you want to route mesh traffic over a wired network device, then please select it from the above Device selector. If you want to assign the batman-adv interface to a Wi-fi mesh then do not select a Device in the Device selector but rather go to the Wireless settings and select this Interface as a network from there.'));
		var uciInterfaces = uci.sections('network', 'interface');

		for (var i = 0; i < uciInterfaces.length; i++) 
		{
			if (uciInterfaces[i].proto == 'batadv') 
			{
				var x=uciInterfaces[i]['.name']; 
				o.value(x);
			}
		}
		
		o = s.taboption('general', form.Value, 'mtu', _('Override MTU'));
		o.placeholder = dev ? (dev.getMTU() || '1536') : '1536';
		o.datatype    = 'max(9200)';
	}
});
