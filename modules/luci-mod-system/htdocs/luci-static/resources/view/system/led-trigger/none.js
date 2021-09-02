'use strict';
'require baseclass';

return baseclass.extend({
	trigger: _('Always off (kernel: none)'),
	description: _('The LED is always in default state off.'),
	kernel: true,
	addFormOptions(s){
		var o;
	}
});
