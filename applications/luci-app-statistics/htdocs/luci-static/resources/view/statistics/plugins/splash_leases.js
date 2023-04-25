'use strict';
'require baseclass';
'require form';

return baseclass.extend({
	title: _('Splash Leases Plugin Configuration'),
	description: _('The splash leases plugin uses libuci to collect statistics about splash leases.'),

	configSummary: function(section) {
		return _('Monitoring splash leases');
	}
});
