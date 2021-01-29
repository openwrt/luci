'use strict';
'require baseclass';
'require form';
'require tools.widgets as widgets';

return baseclass.extend({
	title: _('IP-Statistics Plugin Configuration'),
	description: _('The ipstatistics plugin collects IPv4 and IPv6 statistics to compare them.'),

	addFormOptions: function(s) {
		var o;

		o = s.option(form.Flag, 'enable', _('Enable this plugin'));
		o.default = '0';
	}
});
