'use strict';
'require baseclass';
'require form';

return baseclass.extend({
	trigger: _('Switch support (kernel: switch0)'),
	kernel: true,
	addFormOptions(s){
		var o;

		o = s.option(form.Value, 'switch0_port_mask', _('Switch Port Mask'));
		o.ucioption = "port_mask";
		o.modalonly = true;
		o.depends('trigger', 'switch0');

		o = s.option(form.Value, 'switch0_speed_mask', _('Switch Speed Mask'));
		o.ucioption = "speed_mask";
		o.modalonly = true;
		o.depends('trigger', 'switch0');

		o = s.option(form.MultiValue, 'switch0_mode', _('Trigger Mode'));
		o.ucioption = "mode";
		o.rmempty = true;
		o.modalonly = true;
		o.depends('trigger', 'switch0');
		o.value('link', _('Link On'));
		o.value('tx', _('Transmit'));
		o.value('rx', _('Receive'));
	}
});
