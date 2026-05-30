'use strict';
'require form';
'require baseclass';

return baseclass.extend({
	trigger: _('Always off (kernel: none)'),
	description: _('The LED is always in default state off.'),
	kernel: true,
	addFormOptions: function(s) {
		var o;

		o = s.option(form.Flag, 'default', _('Default state'));
		o.rmempty = false;
		o.depends('trigger', 'none');
		o.textvalue = function(section_id) {
			var cval = this.cfgvalue(section_id);
			if (cval == null)
				cval = this.default;
			return (cval == this.enabled) ? _('On') : _('Off');
		};
	}
});
