'use strict';
'require form';

return L.Class.extend({
	title: _('Load Plugin Configuration'),
	description: _('The load plugin collects statistics about the general system load.'),

	configSummary: function(section) {
		return _('Load monitoring enabled');
	}
});
