'use strict';
'require network';

return network.registerProtocol('autoip', {
	getI18n: function() {
		return _('Avahi IPv4LL');
	},

	getPackageName: function() {
		return 'avahi-autoipd';
	},

	renderFormOptions: function(s) {

	}
});
