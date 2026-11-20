'use strict';
'require baseclass';
'require form';

return baseclass.extend({
	trigger: _('Custom flash interval (kernel: timer)'),
	description: _('The LED blinks with the configured on/off frequency'),
	kernel: true,
	addFormOptions: function(s) {
		var o;

		o = s.option(form.Value, 'delayon', _('On-State Delay'),
			_('How long (in milliseconds) the LED should be on')
		);
		o.modalonly = true;
		o.depends('trigger', 'timer');

		o = s.option(form.Value, 'delayoff', _('Off-State Delay'),
			_('How long (in milliseconds) the LED should be off')
		);
		o.modalonly = true;
		o.depends('trigger', 'timer');
	}
});
