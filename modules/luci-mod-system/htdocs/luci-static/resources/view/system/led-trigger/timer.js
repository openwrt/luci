'use strict';
'require form';

return L.Class.extend({
	trigger: _('timer (kernel)'),
	kernel: true,
	addFormOptions(s){
		var o;

		o = s.option(form.Value, 'delayon', _('On-State Delay'));
		o.modalonly = true;
		o.depends('trigger', 'timer');

		o = s.option(form.Value, 'delayoff', _('Off-State Delay'));
		o.modalonly = true;
		o.depends('trigger', 'timer');
	}
});
