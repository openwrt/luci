'use strict';
'require form';
'require view';

return view.extend({
	load: function() {

	},

	render: function() {
		let m, s, o;

		m = new form.Map('nut_server_root', _('NUT Server'),
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

		// User settings
		s = m.section(form.TypedSection, 'user', _('NUT Users'));
		s.addremove = true;
		s.anonymous = true;

		o = s.option(form.Value, 'username', _('Username'));
		o.optional = false;

		o = s.option(form.Value, 'password', _('Password'));
		o.password = true;
		o.optional = false;

		o = s.option(form.MultiValue, 'actions', _('Allowed actions'));
		// o.widget = 'select'
		o.value('set', _('Set variables'));
		o.value('fsd', _('Forced Shutdown'));
		o.optional = true;

		o = s.option(form.DynamicList, 'instcmd', _('Instant commands'), _('Use %s to see full list of commands your UPS supports (requires %s package)'.format('<code>upscmd -l</code>', '<code>upscmd</code>')));
		o.optional = true;

		o = s.option(form.ListValue, 'upsmon', _('Role'));
		o.value('secondary', _('Auxiliary'));
		o.value('primary', _('Primary'));
		o.value('slave', _('Auxiliary (Deprecated)'));
		o.value('master', _('Primary (Deprecated)'));
		o.optional = false;

		return m.render();
	}
});
