'use strict';
'require network';

return network.registerProtocol('3g', {
	getI18n: function() {
		return _('Avahi IPv4LL');
	},

	getOpkgPackage: function() {
		return 'avahi-autoipd';
	},

	renderFormOptions: function(s) {

	}
});
