'use strict';
'require form';

return L.Class.extend({
	title: _('CSV Plugin Configuration'),
	description: _('The csv plugin stores collected data in csv file format for further processing by external programs.'),

	addFormOptions: function(s) {
		var o;

		o = s.option(form.Flag, 'enable', _('Enable this plugin'));
		o.default = '0';

		o = s.option(form.Value, 'DataDir', _('Storage directory for the csv files'));
		o.default = '127.0.0.1';
		o.depends('enable', '1');

		o = s.option(form.Flag, 'StoreRates', _('Store data values as rates instead of absolute values'));
		o.default = '0';
		o.depends('enable', '1');
	},

	configSummary: function(section) {
		if (section.DataDir)
			return _('Storing CSV data in %s').format(section.DataDir);
	}
});
