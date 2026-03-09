'use strict';
'require baseclass';
'require form';

return baseclass.extend({
	trigger: _('Ping target (userspace)'),
	description: _('The LED indicates reachability of a host. Choose whether it lights on success or failure.'),
	kernel: false,
	addFormOptions: function(s) {
		var o;

		o = s.option(form.Value, 'target', _('Ping target'),
			_('Host or IP address to ping for LED state.')
		);
		o.placeholder = '8.8.8.8';
		o.rmempty = false;
		o.modalonly = true;
		o.depends('trigger', 'ping');

		o = s.option(form.ListValue, 'invert', _('LED on when'),
			_('Whether the LED lights up on successful or unsuccessful ping.')
		);
		o.value('0', _('Reachable (on when host responds)'));
		o.value('1', _('Unreachable (on when host does not respond)'));
		o.default = '0';
		o.rmempty = true;
		o.modalonly = true;
		o.depends('trigger', 'ping');

		o = s.option(form.Value, 'interval', _('Check interval (seconds)'),
			_('How often (in seconds) to check reachability.')
		);
		o.placeholder = '5';
		o.datatype = 'uinteger';
		o.rmempty = true;
		o.modalonly = true;
		o.depends('trigger', 'ping');
	}
});
