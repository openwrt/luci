'use strict';
'require baseclass';
'require form';
'require tools.widgets as widgets';

return baseclass.extend({
	trigger: _("Network device activity (kernel: netdev)"),
	description: _('The LED flashes with link status and activity on the configured interface.'),
	kernel: true,
	addFormOptions: function(s) {
		var o;

		o = s.option(widgets.DeviceSelect, '_net_dev', _('Device'));
		o.rmempty = true;
		o.ucioption = 'dev';
		o.modalonly = true;
		o.noaliases = true;
		o.depends('trigger', 'netdev');

		o = s.option(form.MultiValue, 'mode', _('Trigger Mode'));
		o.rmempty = true;
		o.modalonly = true;
		o.depends('trigger', 'netdev');
		o.value('link', _('Link On'));
		o.value('tx', _('Transmit'));
		o.value('rx', _('Receive'));
	}
});
