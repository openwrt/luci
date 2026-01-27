'use strict';
'require baseclass';
'require form';
'require statistics.pluginUtil as pluginUtil';

return baseclass.extend({
	title: _('CPU Frequency Plugin Configuration'),
	description: _('This plugin collects statistics about the processor frequency scaling.'),

	addFormOptions: function(s) {
		var o;

		pluginUtil.addCommonOptions(s);

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
