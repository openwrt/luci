'use strict';
'require view';
'require form';

return view.extend({
	render: function() {
		var m, s, o;

		m = new form.Map('dhcp', _('ISC DHCP General Settings'));

		s = m.section(form.NamedSection, 'isc_dhcpd', 'isc_dhcpd');
		s.anonymous = false;
		s.addremove = false;

		o = s.option(form.Flag, 'authoritative', _('Authoritative'));
		o.rmempty = false;
		o.default = true;

		o = s.option(form.Value, 'default_lease_time', _('Default Lease Time'));
		o.optional = true;
		o.datatype = 'uinteger';
		o.default = 3600;

		o = s.option(form.Value, 'max_lease_time', _('Max Lease Time'));
		o.optional = true;
		o.datatype = 'uinteger';
		o.default = 86400;

		o = s.option(form.Flag, 'always_broadcast', _('Always Broadcast'));
		o.default = false;

		o = s.option(form.Flag, 'boot_unknown_clients', _('Boot Unknown Clients'));
		o.default = false;

		o = s.option(form.Value, 'log_facility', _('Log Facility'));
		o.value('daemon', _('Daemon'));
		o.default = 'daemon';
		o.optional = true;

		o = s.option(form.Value, 'domain', _('Domain'));
		o.optional = true;

		o = s.option(form.Flag, 'dynamicdns', _('Dynamic DNS'));
		o.default = false;

		return m.render();
	}
});
