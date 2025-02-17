'use strict';
'require form';
'require network';
'require tools.widgets as widgets';

return network.registerProtocol('unet', {
	getI18n: function() {
		return _('Unet');
	},

	getIfname: function() {
		return this._ubus('l3_device') || this.sid;
	},

	getPackageName: function() {
		return 'unetd';
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
		var o;

		o = s.taboption('general', form.DummyValue, 'device', _('Name of the tunnel device'));
		o.optional = false;

		o = s.taboption('general', form.DummyValue, 'key', _('Local wireguard key'));
		o.optional = false;

		o = s.taboption('general', form.DummyValue, 'auth_key', _('Key used to sign network config'));
		o.optional = false;

	}
});
