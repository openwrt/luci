'use strict';
'require form';
'require view';
'require uci';

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('basicstation')
		]);
	},

	render: function(data) {
		var m, s, o, options;
		
		/* Advanced Settings */
		m = new form.Map('basicstation', _('Advanced Settings'));

		/* RF Configuration */
		s = m.section(form.GridSection, 'rfconf', _('RF Configuration'));
		s.addremove = true;
		s.anonymous = false;
		s.nodescriptions = true;

		o = s.option(form.ListValue, 'type', _('Type'), 
			_('RF front end type'));
		o.value('SX1250');
		o.default = 'SX1250';

		o = s.option(form.Flag, 'txEnable', _('Tx enable'),
			_('Enable transmission capabilities'));
		o.default = 'false';

		o = s.option(form.Value, 'freq', _('Frequency'),
			_('Frequency in Hz'));
		o.datatype = 'uinteger';

		o = s.option(form.Value, 'antennaGain', _('Antenna Gain'),
			_('Antenna gain in dBi'));
		o.datatype = 'uinteger';
		
		o = s.option(form.Value, 'rssiOffset', _('RSSI Offset'),
			_('RSSI offset in dBm'));
		o.datatype = 'float';
		
		o = s.option(form.ListValue, 'useRssiTcomp', _('RSSI Tcomp'),
			_('RSSI Tcomp object to be used for this RF configuration'));
		options = uci.sections('basicstation', 'rssitcomp')
		for (var i = 0; i < options.length; i++) {
			var value = options[i]['.name'];
			o.value(value);
		}
		o.default = 'std';

		/* RSSI Tcomp */
		s = m.section(form.GridSection, 'rssitcomp', _('RSSI Tcomp'));
		s.addremove = true;
		s.anonymous = false;
		s.nodescripitons = true;

		o = s.option(form.Value, 'coeff_a', _('Coeff A'));
		o.datatype = 'float';
		
		o = s.option(form.Value, 'coeff_b', _('Coeff B'));
		o.datatype = 'float';
		
		o = s.option(form.Value, 'coeff_c', _('Coeff C'));
		o.datatype = 'float';
		
		o = s.option(form.Value, 'coeff_d', _('Coeff D'));
		o.datatype = 'float';
		
		o = s.option(form.Value, 'coeff_e', _('Coeff E'));
		o.datatype = 'float';

		/* TX Gain Lookup Table */
		s = m.section(form.GridSection, 'txlut', _('TX Gain Lookup Table'));
		s.addremove = true;
		s.anonymous = true;
		s.nodescriptions = true;

		o = s.option(form.Value, 'rfPower', _('RF Power'),
			_('RF output power target in dBm'));
		o.datatype = 'uinteger';
		
		o = s.option(form.Flag, 'paGain', _('PA Enable'),
			_('Power amplifier enabled'));
		o.default = false;
		
		o = s.option(form.Value, 'pwrIdx', _('Power Index'),
			_('Possible gain settings from 0 (min. gain) to 22 (max. gain)'));
		o.datatype = 'range(0,22)';

		o = s.option(form.DynamicList, 'usedBy', _('Used By'),
			_('RF configurations that use this tx gain object'));
		options = uci.sections('basicstation', 'rfconf');
		for (var i = 0; i < options.length; i++) {
			var value = options[i]['.name'];
			o.value(value);
		}

		return m.render();
	},
});
