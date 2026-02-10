'use strict';
'require baseclass';
'require form';

return baseclass.extend({
	trigger: _('Ping target (userspace)'),
	description: _('The LED indicates reachability of a host by blinking on success and off on failure.'),
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
