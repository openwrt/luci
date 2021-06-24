'use strict';
'require baseclass';
'require form';

return baseclass.extend({
	title: _('CPU Frequency Plugin Configuration'),
	description: _('This plugin collects statistics about the processor frequency scaling.'),

	addFormOptions: function(s) {
		var o;

		o = s.option(form.Flag, 'enable', _('Enable this plugin'));
		o.default = '0';

		o = s.option(form.Flag, 'ExtraItems', _('Extra items'),
			_('More details about frequency usage and transitions'));
		o.depends('enable', '1');
	},

	configSummary: function(section) {
		return (section.ExtraItems == '1')
			? _('Detailled CPU frequency monitoring enabled')
			: _('Simple CPU frequency monitoring enabled');
	}
});
