'use strict';
'require form';
'require view';

return view.extend({
	load: function() {

	},

	render: function() {
		let m, s, o;

		m = new form.Map('nut_server', _('NUT Server'),
			_('Network UPS Tools Server Configuration'));

		// Server global settings
		s = m.section(form.NamedSection, 'upsd', 'upsd', _('UPS Server Global Settings'));
		s.addremove = true;

		o = s.option(form.Value, 'runas', _('RunAs User'), _('Drop privileges to this user'));
		o.optional = true;
		o.placeholder = 'nut'

		o = s.option(form.Value, 'statepath', _('Path to state file'));
		o.optional = true;
		o.placeholder = '/var/run/nut'

		return m.render();
	}
});
