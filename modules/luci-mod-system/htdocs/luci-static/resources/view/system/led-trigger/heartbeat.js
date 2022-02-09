'use strict';
'require baseclass';

return baseclass.extend({
	trigger: _('Heartbeat interval (kernel: heartbeat)'),
	description: _('The LED flashes to simulate actual heart beat.') +
		_('The frequency is in direct proportion to 1-minute average CPU load.'),
	kernel: true,
	addFormOptions: function(s) {}
});
