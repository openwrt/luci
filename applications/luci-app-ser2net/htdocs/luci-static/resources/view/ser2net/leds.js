'use strict';
'require view';
'require form';

return view.extend({
	render: function() {
		var m, s, o;

		m = new form.Map('ser2net', 'ser2net');

		s = m.section(form.TypedSection, "led", _("LED redirect"));
		s.anonymous = false;
		s.addremove = true;

		o = s.option(form.Value, "driver", _("Driver"), _("The driver required for the device."));
		o.rmempty = false;
		o.default = "sysfs";

		o = s.option(form.Value, "device", _("Device"), _("The device itself."));
		o.rmempty = false;
		o.default = "duckbill:red:rs485";

		o = s.option(form.Value, "driver", _("Duration"), _("Blink duration."));
		o.rmempty = false;
		o.default = 20;

		o = s.option(form.Value, "state", _("State"));
		o.rmempty = false;
		o.default = 1;

		return m.render();
	}
});
