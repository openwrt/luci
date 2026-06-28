'use strict';
'require view';
'require form';

return view.extend({
	render: function() {
		let m, s, o;

		m = new form.Map('apinger', _('Apinger - Delay Alarms'), 
			 ('This alarm will be fired when target responses are delayed more than "Delay High"') + '<br />' +
			_('This alarm will be canceled, when the delay drops below "Delay Low"') + '<br />');

		s = m.section(form.GridSection, 'alarm_delay');
		s.anonymous = false;
		s.addremove = true;
		s.addbtntitle = _('Add Delay/Latency Alarm');

		o = s.option(form.Value, 'delay_low', _('Delay Low (ms)'));
		o.datatype = 'range(1-500)';
		o.default = '30';
		o.placeholder = '30';

		o = s.option(form.Value, 'delay_high', _('Delay High (ms)'));
		o.datatype = 'range(1-500)';
		o.default = '50';
		o.placeholder = '50';

		return m.render();
	},
});
