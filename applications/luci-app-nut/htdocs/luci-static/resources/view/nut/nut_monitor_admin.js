'use strict';
'require form';
'require view';

return view.extend({
	load: function() {

	},

	render: function() {
		let m, s, o;

		m = new form.Map('nut_monitor', _('NUT Monitor'),
			_('Network UPS Tools Monitoring Configuration'));

		s = m.section(form.NamedSection, 'upsmon', 'upsmon', _('Global Settings'));
		s.addremove = true;
		s.optional = true;

		o = s.option(form.Value, 'runas', _('RunAs User'), _('upsmon drops privileges to this user'));
		o.placeholder = 'nutmon'

		o = s.option(form.Value, 'notifycmd', _('Notify command'));
		o.optional = true;

		o = s.option(form.Value, 'shutdowncmd', _('Shutdown command'));
		o.optional = true;
		o.placeholder = '/usr/sbin/nutshutdown'

		return m.render();
	}
});
