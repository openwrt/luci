'use strict';
'require baseclass';
'require form';
'require statistics.pluginUtil as pluginUtil';

return baseclass.extend({
	title: _('Users Plugin Configuration'),
	description: _('The users plugin collects statistics about users logged in locally via shell. NOTE: Local shell (wtmp) tracking is NOT enabled in default builds. Additional setup is required to get non-zero counts.'),

	addFormOptions: function(s) {
		pluginUtil.addCommonOptions(s);
	},

	configSummary: function(section) {
		return _('Monitoring shell users count');
	}
});
