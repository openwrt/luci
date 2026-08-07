'use strict';
'require form';
'require view';

function MonitorUserOptions(s) {
	let o

	s.optional = true;
	s.addremove = true;
	s.anonymous = true;

	o = s.option(form.Value, 'upsname', _('Name of UPS'), _('As configured by NUT'));
	o.optional = false;

	o = s.option(form.Value, 'hostname', _('Hostname or address of UPS'));
	o.optional = false;
	o.datatype = 'or(host,ipaddr)';

	o = s.option(form.Value, 'port', _('Port'));
	o.optional = true;
	o.placeholder = 3493;
	o.datatype = 'port';

	o = s.option(form.Value, 'powervalue', _('Power value'));
	o.optional = false;
	o.datatype = 'uinteger';
	o.default = 1;

	o = s.option(form.Value, 'username', _('Username'));
	o.optional = false;

	o = s.option(form.Value, 'password', _('Password'));
	o.optional = false;
	o.password = true;

	return s;
}

return view.extend({
	load: function() {

	},

	render: function() {
		let m, s, o;

		m = new form.Map('nut_monitor_root', _('NUT Monitor'),
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

		s = m.section(form.TypedSection, 'monitor', _('UPS Monitor User Settings'));
		MonitorUserOptions(s);

		o = s.option(form.ListValue, 'type', _('User type (Primary/Auxiliary)'));
		o.optional = false;
		o.value('primary', 'Primary');
		o.value('secondary', 'Auxiliary');
		o.default = 'secondary'

		s = m.section(form.TypedSection, 'master', _('UPS Primary (Deprecated)'));
		MonitorUserOptions(s);

		s = m.section(form.TypedSection, 'slave', _('UPS Auxiliary (Deprecated)'));
		MonitorUserOptions(s);

		return m.render();
	}
});
