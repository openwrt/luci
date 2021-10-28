'use strict';
'require baseclass';
'require form';

return baseclass.extend({
	trigger: _('Always on (kernel: default-on)'),
	description: _('The LED is always in default state on.'),
	kernel: true,
	addFormOptions(s){
		var o;
	}
});
