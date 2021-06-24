'use strict';
'require baseclass';
'require form';

return baseclass.extend({
	title: _('CPU Context Switches Plugin Configuration'),
	description: _('This plugin collects statistics about the processor context switches.'),

	configSummary: function(section) {
		return _('Context switch monitoring enabled');
	}
});
