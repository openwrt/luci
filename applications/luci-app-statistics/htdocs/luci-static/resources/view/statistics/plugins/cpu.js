'use strict';
'require baseclass';
'require form';
'require statistics.pluginUtil as pluginUtil';

return baseclass.extend({
	title: _('CPU Plugin Configuration'),
	description: _('The cpu plugin collects basic statistics about the processor usage.'),

	addFormOptions: function(s) {
		var o;
		
		pluginUtil.addCommonOptions(s);

		o = s.option(form.Flag, 'ReportByCpu', _('Report by CPU'),
			_('By setting this, CPU is not aggregate of all processors on the system'));
		
		o.default = '1';
		
		o.rmempty = false;
		o.depends('enable', '1');

		o = s.option(form.Flag, 'ReportByState', _('Report by state'),
			_('When set to true, reports per-state metric e.g. (system, user, idle)'));
		o.default = '1';
		o.rmempty = false;
		o.depends('enable', '1');

		o = s.option(form.DynamicList, 'States', _('Monitor only specific states'),
			_('When none selected, all states will be monitored.'));
		o.depends({'enable': '1', 'ReportByState': '1'});
		o.rmempty = false;

		['idle', 'interrupt', 'nice', 'softirq', 'steal', 'system', 'user', 'wait']
			.forEach(state => o.value(state, _(state)));

		o.default = 'user system';

		o = s.option(form.Flag, 'ValuesPercentage', _('Report in percent'),
			_('When set to true, we request percentage values'));
		o.default = '1';
		o.rmempty = false;
		o.depends({ 'enable': '1', 'ReportByCpu': '1', 'ReportByState': '1' });
	},

	configSummary: function(section) {
		return _('CPU monitoring is enabled');
	}
});
