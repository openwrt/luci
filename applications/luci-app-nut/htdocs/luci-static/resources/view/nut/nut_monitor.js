'use strict';
'require form';
'require fs';
'require view';

const upsmon_tool = '/usr/sbin/upsmon';

function ESIFlags(o) {
	o.value('EXEC', _('Execute notify command'));
	o.value('SYSLOG', _('Write to syslog'));
	o.value('IGNORE', _('Ignore'));
	o.optional = true;
	o.validate = function(section, v) {
		if (!v) return true;
		if(v.includes(' ') && v.includes('IGNORE'))
			return _('%s is mutually exclusive to other choices'.format(_('Ignore')));
		return true;
	}
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
		s.optional = true;

		o = s.option(form.Value, 'runas', _('RunAs User'), _('upsmon drops privileges to this user'));
		o.placeholder = 'nutmon'

		o = s.option(form.Value, 'minsupplies', _('Minimum required number or power supplies'));
		o.datatype = 'uinteger'
		o.placeholder = 1;
		o.optional = true;

		o = s.option(form.Value, 'shutdowncmd', _('Shutdown command'));
		o.optional = true;
		o.placeholder = '/sbin/halt'

		o = s.option(form.Value, 'notifycmd', _('Notify command'));
		o.optional = true;

		o = s.option(form.Value, 'pollfreq', _('Poll frequency'));
		o.datatype = 'uinteger'
		o.placeholder = 5;
		o.optional = true;

		o = s.option(form.Value, 'pollfreqalert', _('Poll frequency alert'));
		o.datatype = 'uinteger'
		o.optional = true;
		o.placeholder = 5;

		o = s.option(form.Value, 'hotsync', _('Hot Sync'));
		o.optional = true;
		o.placeholder = 15;

		o = s.option(form.Value, 'deadtime', _('Deadtime'));
		o.datatype = 'uinteger'
		o.optional = true;
		o.placeholder = 15;

		o = s.option(form.Value, 'onlinemsg', _('Online message'));
		o.optional = true;

		o = s.option(form.Value, 'onbattmsg', _('On battery message'));
		o.optional = true;

		o = s.option(form.Value, 'lowbattmsg', _('Low battery message'));
		o.optional = true;

		o = s.option(form.Value, 'fsdmsg', _('Forced shutdown message'));
		o.optional = true;

		o = s.option(form.Value, 'comokmsg', _('Communications restored message'));
		o.optional = true;

		o = s.option(form.Value, 'combadmsg', _('Communications lost message'));
		o.optional = true;

		o = s.option(form.Value, 'shutdownmsg', _('Shutdown message'));
		o.optional = true;

		o = s.option(form.Value, 'replbattmsg', _('Replace battery message'));
		o.optional = true;

		o = s.option(form.Value, 'nocommsg', _('No communications message'));
		o.optional = true;

		o = s.option(form.Value, 'noparentmsg', _('No parent message'));
		o.optional = true;

		o = s.option(form.MultiValue, 'defaultnotify', _('Notification defaults'));
		ESIFlags(o);

		o = s.option(form.MultiValue, 'onlinenotify', _('Notify when back online'));
		ESIFlags(o);

		o = s.option(form.MultiValue, 'onbattnotify', _('Notify when on battery'));
		ESIFlags(o);

		o = s.option(form.MultiValue, 'lowbattnotify', _('Notify when low battery'));
		ESIFlags(o);

		o = s.option(form.MultiValue, 'fsdnotify', _('Notify when force shutdown'));
		ESIFlags(o);

		o = s.option(form.MultiValue, 'comoknotify', _('Notify when communications restored'));
		ESIFlags(o);

		o = s.option(form.MultiValue, 'combadnotify', _('Notify when communications lost'));
		ESIFlags(o);

		o = s.option(form.MultiValue, 'shutdownotify', _('Notify when shutting down'));
		ESIFlags(o);

		o = s.option(form.MultiValue, 'replbattnotify', _('Notify when battery needs replacing'));
		ESIFlags(o);

		o = s.option(form.MultiValue, 'nocommnotify', _('Notify when no communications'));
		ESIFlags(o);

		o = s.option(form.MultiValue, 'noparentnotify', _('Notify when no parent process'));
		ESIFlags(o);

		if (have_ssl_support) {
			o = s.option(form.Value, 'certpath', _('CA Certificate path'), _('Path containing ca certificates to match against host certificate'));
			o.optional = true;
			o.placeholder = '/etc/ssl/certs'

			o = s.option(form.Flag, 'certverify', _('Verify all connection with SSL'), _('Require SSL and make sure server CN matches hostname'));
			o.optional = true;
			o.default = false;
		}

		s = m.section(form.TypedSection, 'master', _('UPS Primary'));
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

		s = m.section(form.TypedSection, 'slave', _('UPS Auxiliary'));
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


		return m.render();
	}
});
