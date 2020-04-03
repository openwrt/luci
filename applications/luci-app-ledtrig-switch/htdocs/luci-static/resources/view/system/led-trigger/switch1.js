'use strict';
'require baseclass';
'require form';

return baseclass.extend({
	trigger: _('switch1 (kernel)'),
	kernel: true,
	addFormOptions(s){
		var o;

		o = s.option(form.Value, 'port_mask', _('Switch Port Mask'));
		o.modalonly = true;
		o.depends('trigger', 'switch1');

		o = s.option(form.Value, 'speed_mask', _('Switch Speed Mask'));
		o.modalonly = true;
		o.depends('trigger', 'switch1');
	}
});
