'use strict';
'require baseclass';
'require form';

return baseclass.extend({
	title: _('CSV Plugin Configuration'),
	description: _('The csv plugin stores collected data in csv file format for further processing by external programs.'),

	addFormOptions: function(s) {
		var o;

		o = s.option(form.Flag, 'enable', _('Enable this plugin'));

		o = s.option(form.Value, 'DataDir', _('Storage directory for the csv files'));
		o.default = '/tmp/csv';
		o.depends('enable', '1');

		o = s.option(form.Flag, 'StoreRates', _('Store data values as rates instead of absolute values'));
		o.depends('enable', '1');
	},

	configSummary: function(section) {
		if (section.DataDir)
			return _('Storing CSV data in %s').format(section.DataDir);
	}
});
