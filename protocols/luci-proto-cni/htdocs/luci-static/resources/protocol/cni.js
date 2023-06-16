'use strict';
'require network';

return network.registerProtocol('cni', {
	getI18n: function () {
		return _('CNI (Externally managed interface)');
	}
});
