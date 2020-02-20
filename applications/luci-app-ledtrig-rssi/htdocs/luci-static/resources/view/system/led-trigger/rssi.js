'use strict';
'require form';
'require tools.widgets as widgets';

return L.Class.extend({
	trigger: _('rssi (service)'),
	kernel: false,
	addFormOptions(s){
		var o;

		o = s.option(widgets.DeviceSelect, '_rssi_iface', _('Device'));
		o.rmempty = true;
		o.ucioption = 'iface';
		o.modalonly = true;
		o.noaliases = true;
		o.depends('trigger', 'rssi');

		o = s.option(form.Value, 'minq', _('Minimal quality'));
		o.rmempty = true;
		o.modalonly = true;
		o.depends('trigger', 'rssi');

		o = s.option(form.Value, 'maxq', _('Maximal quality'));
		o.rmempty = true;
		o.modalonly = true;
		o.depends('trigger', 'rssi');

		o = s.option(form.Value, 'offset', _('Value offset'));
		o.rmempty = true;
		o.modalonly = true;
		o.depends('trigger', 'rssi');

		o = s.option(form.Value, 'factor', _('Multiplication factor'));
		o.rmempty = true;
		o.modalonly = true;
		o.depends('trigger', 'rssi');
	}
});
