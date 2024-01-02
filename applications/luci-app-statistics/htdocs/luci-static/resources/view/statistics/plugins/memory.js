'use strict';
'require baseclass';
'require form';

return baseclass.extend({
	title: _('Memory Plugin Configuration'),
	description: _('The memory plugin collects statistics about the memory usage.'),

	addFormOptions: function(s) {
		var o;

		o = s.option(form.Flag, 'enable', _('Enable this plugin'));

		o = s.option(form.Flag, 'HideFree', _('Hide free memory'),
			_('Hiding the free memory item makes the graph to scale to actual memory usage, not to 100%.'));
		o.default = '0';
		o.rmempty = false;

		o = s.option(form.Flag, 'ValuesAbsolute', _('Absolute values'), _('When set to true, we request absolute values'));
		o.default = '1';
		o.depends('enable', '1');

		o = s.option(form.Flag, 'ValuesPercentage', _('Percent values'), _('When set to true, we request percentage values'));
		o.depends('enable', '1');
	},

	configSummary: function(section) {
		return _('Memory monitoring enabled');
	}
});
