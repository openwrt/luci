'use strict';
'require form';
'require rpc';
'require baseclass';

var callLeds = rpc.declare({
	object: 'luci',
	method: 'getLEDs',
	expect: { '': {} }
});

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

		o = s.option(form.Value, 'brightness', _('Brightness'),
			_('Leave empty to use the maximum brightness supported by the LED.'));
		o.rmempty = true;
		o.modalonly = true;
		o.datatype = 'uinteger';
		o.depends({ trigger: 'none', default: '1' });
		o.load = function(section_id) {
			return callLeds().then(L.bind(function(leds) {
				this.leds = leds;
				return form.Value.prototype.load.apply(this, [section_id]);
			}, this));
		};
		o.maxBrightness = function(section_id) {
			var led = this.leds && this.leds[this.section.formvalue(section_id, 'sysfs')];
			return led ? led.max_brightness : 0;
		};
		o.checkDepends = function(section_id) {
			var max = this.maxBrightness(section_id),
			    widget = this.getUIElement(section_id);

			/* only offer brightness for LEDs supporting more than on/off */
			if (!(max > 1))
				return false;

			/* an empty value means maximum brightness, so hint it */
			if (widget)
				widget.setPlaceholder(String(max));

			return form.Value.prototype.checkDepends.apply(this, [section_id]);
		};
		o.validate = function(section_id, value) {
			var max = this.maxBrightness(section_id);

			if (value != null && value != '' && (+value < 1 || +value > max))
				return _('Value must be between %d and %d').format(1, max);

			return true;
		};
	}
});
