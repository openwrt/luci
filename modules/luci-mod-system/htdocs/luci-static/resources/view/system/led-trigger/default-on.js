'use strict';
'require baseclass';
'require form';

return baseclass.extend({
	trigger: _('Always on (kernel: default-on)'),
	kernel: true,
	addFormOptions(s){
		var o;

		o = s.option(form.Flag, 'default', _('Default state'));
		o.rmempty = false;
		o.depends('trigger', 'default-on');
		o.textvalue = function(section_id) {
			var cval = this.cfgvalue(section_id);
			if (cval == null)
				cval = this.default;
			return (cval == this.enabled) ? _('On') : _('Off');
		};
	}
});
