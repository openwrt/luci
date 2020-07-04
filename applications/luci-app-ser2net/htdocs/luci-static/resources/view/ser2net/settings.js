'use strict';
'require view';
'require form';

return view.extend({
	render: function() {
		var m, s, o;

		m = new form.Map('ser2net', 'ser2net');

		//ser2net
		s = m.section(form.TypedSection, "ser2net", _("Global switch"));
		s.anonymous = true;

		o = s.option(form.Flag, "enabled", _("Enabled"));
		o.rmempty = false;

		//controlport
		s = m.section(form.TypedSection, "controlport", _("Control port"));
		s.anonymous = true;

		o = s.option(form.Flag, "enabled", _("Enabled"));
		o.rmempty = false;

		o = s.option(form.Value, "host", _("Binding address"), _("The network to listen from."));
		o.rmempty = false;
		o.default = "localhost";

		o = s.option(form.Value, "port", _("Control port"), _("The TCP port to listen on."));
		o.rmempty = false;
		o.default = 2000;

		//default
		s = m.section(form.TypedSection, "default", _("Default settings"));
		s.anonymous = true;

		o = s.option(form.ListValue, "speed", _("Baud rate"), _("The speed the device port should operate at."));
		o.rmempty = false;
		o.value(300);
		o.value(1200);
		o.value(2400);
		o.value(4800);
		o.value(9600);
		o.value(19200);
		o.value(38400);
		o.value(57600);
		o.value(115200);
		o.default = 9600;

		o = s.option(form.ListValue, "databits", _("Data bits"));
		o.rmempty = false;
		o.value(8);
		o.value(7);
		o.default = 8;

		o = s.option(form.ListValue, "parity", _("Parity"));
		o.rmempty = false;
		o.value("none", _("None"));
		o.value("even", _("Even"));
		o.value("odd", _("Odd"));
		o.default = "none";

		o = s.option(form.ListValue, "stopbits", _("Stop bits"));
		o.rmempty = false;
		o.value(1);
		o.value(2);
		o.default = 1;

		s.option(form.Flag, "rtscts", _("Use RTS and CTS lines"));
		s.option(form.Flag, "local", _("Ignore modem control signals"));
		s.option(form.Flag, "remctl", _("Allow the RFC 2217 protocol"));

		return m.render();
	}
});
