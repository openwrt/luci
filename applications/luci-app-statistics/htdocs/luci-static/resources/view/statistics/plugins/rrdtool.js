'use strict';
'require baseclass';
'require form';

return baseclass.extend({
	title: _('RRDTool Plugin Configuration'),
	description: _('The rrdtool plugin stores the collected data in rrd database files, the foundation of the diagrams.<br /><br /><strong>Warning: Setting the wrong values will result in a very high memory consumption in the temporary directory. This can render the device unusable!</strong>'),

	addFormOptions: function(s) {
		var o;

		o = s.option(form.Flag, 'enable', _('Enable this plugin'));

		o = s.option(form.Value, 'DataDir', _('Storage directory'),
			_('Note: as pages are rendered by user \'nobody\', the *.rrd files, the storage directory and all its parent directories need to be world readable.'));
		o.default = '/tmp/rrd';
		o.depends('enable', '1');

		o = s.option(form.Value, 'StepSize', _('RRD step interval'), _('Seconds'));
		o.placeholder = '30';
		o.datatype = 'uinteger';
		o.depends('enable', '1');

		o = s.option(form.Value, 'HeartBeat', _('RRD heart beat interval'), _('Seconds'));
		o.placeholder = '60';
		o.datatype = 'uinteger';
		o.depends('enable', '1');

		o = s.option(form.Flag, 'RRASingle', _('Only create average RRAs'), _('reduces rrd size'));
		o.default = '1';
		o.rmempty = false;
		o.depends('enable', '1');

		o = s.option(form.Flag, 'RRAMax', _('Show max values instead of averages'),
			_('Max values for a period can be used instead of averages when not using \'only average RRAs\''));
		o.depends('RRASingle', '0');

		o = s.option(form.DynamicList, 'RRATimespans', _('Stored timespans'),
			_('List of time spans to be stored in RRD database. E.g. "1hour 1day 14day". Allowed timespan types: min, h, hour(s), d, day(s), w, week(s), m, month(s), y, year(s)'));
		o.default = '1hour 1day 1week 1month 1year';
		o.depends('enable', '1');
		o.validate = function(section_id, value) {
			if (value == '')
				return true;

			if (value.match(/^[0-9]+(?:y|m|w|d|h|min|years?|months?|weeks?|days?|hours?)?$/))
				return true;

			return _('Expecting valid time range');
		};

		o = s.option(form.Value, 'RRARows', _('Rows per RRA'));
		o.default = '144';
		o.datatype = 'min(1)';
		o.depends('enable', '1');

		o = s.option(form.Value, 'XFF', _('RRD XFiles Factor'));
		o.placeholder = '0.1';
		o.depends('enable', '1');
		o.validate = function(section_id, value) {
			if (value == '')
				return true;

			if (value.match(/^[0-9]+(?:\.[0-9]+)?$/) && +value >= 0 && +value < 1)
				return true;

			return _('Expecting decimal value lower than one');
		};

		o = s.option(form.Value, 'CacheTimeout', _('Cache collected data for'), _('Seconds'));
		o.depends('enable', '1');
		o.datatype = 'uinteger';
		o.placeholder = '0';
		o.validate = function(section_id, value) {
			var flushinp = this.map.findElement('id', 'widget.cbid.luci_statistics.collectd_rrdtool.CacheFlush');

			if (value != '' && !isNaN(value) && +value > 0) {
				flushinp.placeholder = 10 * +value;
				flushinp.disabled = false;
			}
			else {
				flushinp.value = '';
				flushinp.placeholder = '0';
				flushinp.disabled = true;
			}

			return true;
		};

		o = s.option(form.Value, 'CacheFlush', _('Flush cache after'), _('Seconds'));
		o.depends('enable', '1');
		o.datatype = 'uinteger';
	},

	configSummary: function(section) {
		if (section.DataDir)
			return _('Writing *.rrd files to %s').format(section.DataDir);
	}
});
