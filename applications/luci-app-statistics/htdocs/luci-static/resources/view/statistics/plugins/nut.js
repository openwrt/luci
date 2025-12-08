'use strict';
'require baseclass';
'require form';
'require statistics.pluginUtil as pluginUtil';

return baseclass.extend({
	title: _('UPS Plugin Configuration'),
	description: _('The NUT plugin reads information about Uninterruptible Power Supplies.'),

	addFormOptions: function(s) {
		var o;

		pluginUtil.addCommonOptions(s);

		o = s.option(form.Value, 'UPS', _('UPS'), _('UPS name in NUT ups@host format'));
	},

	configSummary: function(section) {
		var ups = L.toArray(section.UPS);

		if (ups.length)
			return N_(ups.length, 'Monitoring one UPS', 'Monitoring %d UPSes').format(ups.length);
	}
});
