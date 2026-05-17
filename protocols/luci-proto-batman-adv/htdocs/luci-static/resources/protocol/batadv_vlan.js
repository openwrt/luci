'use strict';
'require uci';
'require form';
'require network';
'require tools.widgets as widgets';

network.registerPatternVirtual(/^bat\d_\d+$/);

return network.registerProtocol('batadv_vlan', {
	getI18n: function() {
		return _('Batman VLAN Interface');
	},

	getIfname: function() {
		return this._ubus('l3_device') || this.sid;
	},

	getOpkgPackage: function() {
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

		var batadvInterfaceNames = [];
		var uciInterfaces = uci.sections('network', 'interface');
		for (var i = 0; i < uciInterfaces.length; i++)
			if (uciInterfaces[i].proto == 'batadv')
				batadvInterfaceNames.push(uciInterfaces[i]['.name']);

		o = s.taboption('general', widgets.DeviceSelect, '_batadv_vlan_device', _('Device'),
				_('If not listed, please open the drop-down list and type in the name of the Batman VLAN device in the \'custom\' field.'));
		o.ucioption = 'device';
		o.optional = false;
		o.placeholder = _('Select Batman VLAN device…');
		o.filter = function(section_id, value) {
			for (var i = 0; i < batadvInterfaceNames.length; i++)
				if (value.startsWith(batadvInterfaceNames[i] + '.'))
					return true;
			return false;
		}
		o.validate = function(section_id, value) {
			for (var i = 0; i < batadvInterfaceNames.length; i++)
				if (value.startsWith(batadvInterfaceNames[i] + '.'))
					return true;
			return _("Please open the drop-down list and select or type in the name of the Batman VLAN device.");
		}

		o = s.taboption('general', form.Flag, 'ap_isolation', _('AP Isolation'),
				_('Enable AP Isolation to isolate wireless clients connected to this Batman VLAN on this AP from wireless clients connected to this Batman VLAN on different APs.  To isolate all wireless clients connected to this Batman VLAN on all APs from each other, be sure to enable this option on all APs, and be sure to enable additional wireless client isolation options (\'isolate\' and \'bridge_isolate\') for all associated wireless interfaces on all APs.'));
		o.default = o.disabled;
		o.optional = false;
	}
});

