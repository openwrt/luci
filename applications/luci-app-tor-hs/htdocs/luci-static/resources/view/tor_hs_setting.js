'use strict';
'require view';
'require ui';
'require form';

return view.extend({
	formdata: { torhs: {} },

	render: function(data) {
		var m, s, o;

		m  = new form.Map('tor-hs', _('Hidden service configuration'));
		m.readonly=false;

		o = m.section(form.TableSection, "hidden-service");
		o.option(form.Value, "Name", _("Name"));
		o.option(form.Value, "Description", _("Description"));
		o.option(form.Flag, "Enabled", _("Enabled"));
		o.option(form.Value, "IPv4", _("IPv4"));
		o.option(form.DynamicList, "PublicLocalPort", _("Public Local Port"));
		o.option(form.Value, "HookScript", _("HookScript"));
		o.anonymous = true;
		o.addremove = true;
		return m.render();
	}
});
