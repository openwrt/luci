'use strict';
'require form';
'require fs';
'require view';

const upsmon_tool = '/usr/sbin/upsmon';

function ESIFlags(o) {
	o.value('EXEC', _('Execute notify command'));
	o.value('SYSLOG', _('Write to syslog'));
	o.value('SYSLOG+EXEC', _('Write to syslog and execute notify command'))
	o.value('IGNORE', _('Ignore'));
	o.default = 'SYSLOG';
	o.optional = true;
	return o;
}


return view.extend({
	load: function() {
		return Promise.all([
			L.resolveDefault(fs.exec_direct('/usr/bin/ldd', [upsmon_tool]), []).catch(function(err) {
				throw new Error(_('Unable to run ldd: %s').format(err.message));
			}).then(function(stdout) {
				return stdout.includes('libssl.so');
			}),
		])
	},

	render: function(loaded_promises) {
		let m, s, o;
		const have_ssl_support = loaded_promises[0];

		m = new form.Map('nut_monitor', _('NUT Monitor'),
			_('Network UPS Tools Monitoring Configuration'));

		s = m.section(form.NamedSection, 'upsmon', 'upsmon', _('Global Settings'));
		s.addremove = true;
		s.optional = false;

		o = s.option(form.Value, 'minsupplies', _('Minimum required number or power supplies'));
		o.datatype = 'uinteger'
		o.placeholder = 1;
		o.optional = true;

		o = s.option(form.Value, 'pollfreq', _('Poll frequency'));
		o.datatype = 'uinteger'
		o.placeholder = 5;
		o.optional = true;

		o = s.option(form.Value, 'pollfreqalert', _('Poll frequency alert'));
		o.datatype = 'uinteger'
		o.optional = true;
		o.placeholder = 5;

		o = s.option(form.Value, 'hostsync', _('Host Sync'));
		o.optional = true;
		o.placeholder = 15;

		o = s.option(form.Value, 'deadtime', _('Deadtime'));
		o.datatype = 'uinteger'
		o.optional = true;
		o.placeholder = 15;

		if (have_ssl_support) {
			o = s.option(form.Value, 'certpath', _('CA Certificate path'), _('Path containing ca certificates to match against host certificate'));
			o.optional = true;
			o.placeholder = '/etc/ssl/certs'

			o = s.option(form.Flag, 'certverify', _('Verify all connection with SSL'), _('Require SSL and make sure server CN matches hostname'));
			o.optional = true;
			o.default = false;
		}

		s = m.section(form.TypedSection, 'notifications', _('Notifications settings'));
		s.optional = true;
		s.addremove = true;
		s.anonymous = false;

		o = s.option(form.Value, 'message', _('Custom notification message for message type'));
		o.optional = true

		o = s.option(form.ListValue, 'flag', _('Notification flags'));
		ESIFlags(o)

		return m.render();
	}
});
