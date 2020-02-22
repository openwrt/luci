'use strict';
'require form';

return L.Class.extend({
	title: _('CPU Frequency Plugin Configuration'),
	description: _('This plugin collects statistics about the processor frequency scaling.'),

	configSummary: function(section) {
		return _('CPU frequency monitoring enabled');
	}
});
