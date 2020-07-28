'use strict';
'require baseclass';
'require form';

return baseclass.extend({
	trigger: _('Custom flash interval (kernel: timer)'),
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
