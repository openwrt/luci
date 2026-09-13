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
		o.value('link_10', _('Link 10M On'));
		o.value('link_100', _('Link 100M On'));
		o.value('link_1000', _('Link 1G On'));
		o.value('link_2500', _('Link 2.5G On'));
		o.value('link_5000', _('Link 5G On'));
		o.value('link_10000', _('Link 10G On'));
		o.value('half_duplex', _('Half Duplex'));
		o.value('full_duplex', _('Full Duplex'));
		o.value('tx', _('Transmit'));
		o.value('rx', _('Receive'));
	}
});
