'use strict';
'require baseclass';
'require form';

return baseclass.extend({
	title: _('Conntrack Plugin Configuration'),
	description: _('The conntrack plugin collects statistics about the number of tracked connections.'),

	configSummary(section) {
		return _('Conntrack monitoring enabled');
	}
});
