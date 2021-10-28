'use strict';
'require baseclass';
'require form';

return baseclass.extend({
	trigger: _('Always on (kernel: default-on)'),
	kernel: true,
	addFormOptions(s){
		var o;
	}
});
