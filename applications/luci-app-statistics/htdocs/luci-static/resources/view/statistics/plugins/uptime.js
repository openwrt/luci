'use strict';
'require baseclass';
'require form';

return baseclass.extend({
	title: _('Uptime Plugin Configuration'),
	description: _('The uptime plugin collects statistics about the uptime of the system.'),

	configSummary: function(section) {
		return _('Uptime monitoring enabled');
	}
});
