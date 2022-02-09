'use strict';
'require baseclass';
'require form';
'require tools.widgets as widgets';

return baseclass.extend({
	title: _('IP-Statistics Plugin Configuration'),
	description: _('The ipstatistics plugin collects IPv4 and IPv6 statistics to compare them.'),

	configSummary: function(section) {
		return _('IPv4/IPv6 Statistics monitoring enabled');
	}
});
