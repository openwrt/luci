'use strict';
'require view';
'require form';

return view.extend({
	render: function() {
		let m, s, o;

		m = new form.Map('apinger', _('Apinger - Loss Alarms'),
			_('This alarm will be fired when packet loss goes over "Loss High"') + '<br />' +
			_('This alarm will be canceled, when the loss drops below "Loss Low"'));

		s = m.section(form.GridSection, 'alarm_loss');
		s.anonymous = false;
		s.addremove = true;
		s.addbtntitle = _('Add Loss Alarm');

		o = s.option(form.Value, 'percent_low', _('Loss Low (%)'));
		o.datatype = 'range(1-100)';
		o.default = '10';
		o.placeholder = '10';

		o = s.option(form.Value, 'percent_high', _('Loss High (%)'));
		o.datatype = 'range(1-100)';
		o.default = '20';
		o.placeholder = '20';

		return m.render();
	},
});
