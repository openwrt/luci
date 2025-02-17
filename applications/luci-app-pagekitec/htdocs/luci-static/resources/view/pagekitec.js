'use strict';
'require view';
'require form';

var desc = _(""
	+ "<p/>Note: you need a working PageKite account, or at least, your own running front end for this form to work. "
	+ "Visit <a href='https://pagekite.net/home/'>your account</a> to set up a name for your "
	+ "router and get a secret key for the connection."
	+ "<p/><em>Note: this web configurator only supports "
	+ "some very very basic uses of pagekite.</em>"
);

return view.extend({
	render: function() {
		let m, s, o;

		m = new form.Map('pagekitec', _('PageKite'), desc);

		s = m.section(form.TypedSection, 'pagekitec', _("Configuration"));
		s.anonymous = true;

		o = s.option(form.Value, "kitename", _("Kite Name"));
		o = s.option(form.Value, "kitesecret", _("Kite Secret"));
		o.password = true;

		o = s.option(form.Flag, "static", _("Static setup"),
			_("Static setup, disable FE failover and DDNS updates, set this if you are running your "
			+ "own frontend without a pagekite.me account"));
		o = s.option(form.Flag, "simple_http", _("Basic HTTP"), _("Enable a tunnel to the local HTTP server (in most cases, this admin interface)"));
		o = s.option(form.Flag, "simple_ssh", _("Basic SSH"), _("Enable a tunnel to the local SSH server"));
		o = s.option(form.Value, "simple_ws", _("Basic WebSockets"), _("Enable a WebSockets tunnel on a given local port"));
		o.placeholder = 8083;
		o.datatype = "port";
		o.optional = true;

		return m.render();
	}
});
