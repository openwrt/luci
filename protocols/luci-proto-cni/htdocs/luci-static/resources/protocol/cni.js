'use strict';
'require form';
'require network';

return network.registerProtocol('cni', {
	getI18n: function () {
		return _('CNI (Externally managed interface)');
	},

	getOpkgPackage: function() {
		return "cni-protocol";
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

	renderFormOptions: function(s) {
		var o;

		o = s.taboption('general', form.Value, '_device', _('Device'));
		o.ucioption = 'device';
		o.optional = false;
		o.rmempty = false;

		o = s.taboption('general', form.Value, '_delay', _('Delay'), _('Afer making changes to network using CNI protocol, network must be manually restarted.'));
		o.ucioption = 'delay';
		o.placeholder = '10';
		o.datatype = 'min(1)';
		o.optional = true;
		o.rmempty = true;
	}

});
