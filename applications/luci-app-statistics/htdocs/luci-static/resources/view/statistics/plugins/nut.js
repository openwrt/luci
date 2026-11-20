'use strict';
'require baseclass';
'require form';

return baseclass.extend({
	title: _('UPS Plugin Configuration'),
	description: _('The NUT plugin reads information about Uninterruptible Power Supplies.'),

	addFormOptions(s) {
		s.option(form.Flag, 'enable', _('Enable this plugin'));

		s.option(form.Value, 'UPS', _('UPS'), _('UPS name in NUT ups@host format'));
	},

	configSummary(section) {
		const ups = L.toArray(section.UPS);

		if (ups.length)
			return N_(ups.length, 'Monitoring one UPS', 'Monitoring %d UPSes').format(ups.length);
	}
});
