'use strict';
'require baseclass';
'require form';

return baseclass.extend({
	title: _('Users Plugin Configuration'),
	description: _('The users plugin collects statistics about users logged in locally via shell. NOTE: Local shell (wtmp) tracking is NOT enabled in default builds. Additional setup is required to get non-zero counts.'),

	addFormOptions: function(s) {
		var o = s.option(form.Flag, 'enable', _('Enable this plugin'));
	},

	configSummary: function(section) {
		return _('Monitoring shell users count');
	}
});
