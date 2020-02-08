'use strict';
'require form';

return L.Class.extend({
	title: _('RRDTool Plugin Configuration'),
	description: _('The rrdtool plugin stores the collected data in rrd database files, the foundation of the diagrams.<br /><br /><strong>Warning: Setting the wrong values will result in a very high memory consumption in the temporary directory. This can render the device unusable!</strong>'),

	addFormOptions: function(s) {
		var o;

		o = s.option(form.Flag, 'enable', _('Enable this plugin'));
		o.default = '0';

		o = s.option(form.Value, 'DataDir', _('Storage directory'),
			_('Note: as pages are rendered by user \'nobody\', the *.rrd files, the storage directory and all its parent directories need to be world readable.'));
		o.default = '/tmp';
		o.optional = true;
		o.rmempty = true;
		o.depends('enable', '1');

		o = s.option(form.Value, 'StepSize', _('RRD step interval'),
			_('Seconds'));
		o.default = '30';
		o.optional = true;
		o.rmempty = true;
		o.depends('enable', '1');

		o = s.option(form.Value, 'HeartBeat', _('RRD heart beat interval'),
			_('Seconds'));
		o.default = '60';
		o.optional = true;
		o.rmempty = true;
		o.depends('enable', '1');

		o = s.option(form.Flag, 'RRASingle', _('Only create average RRAs'),
			_('reduces rrd size'));
		o.default = 'true';
		o.depends('enable', '1');

		o = s.option(form.Flag, 'RRAMax', _('Show max values instead of averages'),
			_('Max values for a period can be used instead of averages when not using \'only average RRAs\''));
		o.default = 'false';
		o.rmempty = true;
		o.depends('RRASingle', '0');

		o = s.option(form.DynamicList, 'RRATimespans', _('Stored timespans'));
		o.default = '10min 1day 1week 1month 1year';
		o.optional = true;
		o.rmempty = true;
		o.depends('enable', '1');
		o.validate = function(section_id, value) {
			if (value == '')
				return true;

			if (value.match(/^[0-9]+(?:y|m|w|d|h|min|years?|months?|weeks?|days?|hours?)?$/))
				return true;

			return _('Expecting valid time range');
		};

		o = s.option(form.Value, 'RRARows', _('Rows per RRA'));
		o.default = '100';
		o.optional = true;
		o.rmempty = true;
		o.depends('enable', '1');

		o = s.option(form.Value, 'XFF', _('RRD XFiles Factor'));
		o.default = '0.1';
		o.optional = true;
		o.rmempty = true;
		o.depends('enable', '1');

		o = s.option(form.Value, 'CacheTimeout', _('Cache collected data for'),
			_('Seconds'));
		o.default = '100';
		o.optional = true;
		o.rmempty = true;
		o.depends('enable', '1');

		o = s.option(form.Value, 'CacheFlush', _('Flush cache after'),
			_('Seconds'));
		o.default = '100';
		o.optional = true;
		o.rmempty = true;
		o.depends('enable', '1');
	},

	configSummary: function(section) {
		if (section.DataDir)
			return _('Writing *.rrd files to %s').format(section.DataDir);
	}
});
