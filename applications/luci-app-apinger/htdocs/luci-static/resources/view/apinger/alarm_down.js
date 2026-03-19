'use strict';
'require view';
'require form';

return view.extend({
	render: function() {
		let m, s, o;

		m = new form.Map('apinger', _('Apinger - Down Alarm'),
			_('This alarm will be fired when target does not respond for "Time"'));

		s = m.section(form.GridSection, 'alarm_down');
		s.anonymous = false;
		s.addremove = true;
		s.addbtntitle = _('Add Down Alarm');

		o = s.option(form.Value, 'time', _('Time (s)'));
		o.datatype = 'range(1-30)';
		o.default = '1';
		o.placeholder = '1';

		return m.render();
	},
});
