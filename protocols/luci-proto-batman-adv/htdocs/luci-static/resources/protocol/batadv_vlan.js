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

	getOpkgPackage: function() {
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
		var uciInterfaces = uci.sections('network', 'interface');
		for (var i = 0; i < uciInterfaces.length; i++)
		{
			if (uciInterfaces[i].proto == 'batadv')
			{
				var x=uciInterfaces[i]['.name'];
				o.value(x);
			}
		}
	}
});
