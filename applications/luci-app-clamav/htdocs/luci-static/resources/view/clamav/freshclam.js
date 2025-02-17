'use strict';
'require form';
'require fs';
'require uci';
'require view';

return view.extend({
	load: function() {

	},

	render: function() {
		let m, s, o;

		m = new form.Map('freshclam', _('Freshclam'), _('Configuration'));

		// Section
		s = m.section(form.TypedSection, 'freshclam', _('Settings'));
		s.anonymous = true;
		s.addremove = false;

		// Advanced Tab
		s.tab('tab_advanced', _('Settings'));

		// freshclam_config_file
		o = s.taboption('tab_advanced', form.Value, 'freshclam_config_file', _('clamd config file'));
		o.datatype = 'string';
		o.value('/etc/clamav/freshclam.conf');
		o.placeholder = '/etc/clamav/freshclam.conf';

		/*
		// UpdateLogFile
		o = s.taboption('tab_advanced', form.Value, 'UpdateLogFile', _('Logfile'));
		o.value('/tmp/clamav-milter.log');
		o.placeholder = '/tmp/clamav-milter.log';

		// LogFileMaxSize
		o = s.taboption('tab_advanced', form.Value, 'LogFileMaxSize', _('Max size of log file'));
		o.value('512K', _('512K'));
		o.value('1M', _('1M'));
		o.value('2M', _('2M'));

		// LogRotate
		o = s.taboption('tab_advanced', form.ListValue, 'LogRotate', _('Add header'));
		o.value('false', _('No'));
		o.value('true', _('Yes'));
		*/

		// LogTime
		o = s.taboption('tab_advanced', form.ListValue, 'LogTime', _('Log time with each message'));
		o.value('false', _('No'));
		o.value('true', _('Yes'));

		// LogVerbose
		o = s.taboption('tab_advanced', form.ListValue, 'LogVerbose', _('Enable verbose logging'));
		o.value('false', _('No'));
		o.value('true', _('Yes'));

		// Debug
		o = s.taboption('tab_advanced', form.ListValue, 'Debug', _('Debug logging'));
		o.value('false', _('No'));
		o.value('true', _('Yes'));
		o.placeholder = 'true';

		// LogSyslog
		o = s.taboption('tab_advanced', form.ListValue, 'LogSyslog', _('Log to syslog'));
		o.value('false', _('No'));
		o.value('true', _('Yes'));
		o.placeholder = 'true';

		// LogFacility
		o = s.taboption('tab_advanced', form.ListValue, 'LogFacility', _('Syslog facility'));
		o.value('LOG_KERN');
		o.value('LOG_USER');
		o.value('LOG_MAIL');
		o.value('LOG_DAEMON');
		o.value('LOG_AUTH');
		o.value('LOG_LPR');
		o.value('LOG_NEWS');
		o.value('LOG_UUCP');
		o.value('LOG_CRON');
		o.value('LOG_LOCAL0');
		o.value('LOG_LOCAL1');
		o.value('LOG_LOCAL2');
		o.value('LOG_LOCAL3');
		o.value('LOG_LOCAL4');
		o.value('LOG_LOCAL5');
		o.value('LOG_LOCAL6');
		o.value('LOG_LOCAL7');
		// cannot do o.depends - it removes the option if dep condition is not met, thereby causing a startup error
		// o.depends('LogSyslog', 'true');

		// Foreground
		o = s.taboption('tab_advanced', form.ListValue, 'Foreground', _('Run in foreground'));
		o.value('false', _('No'));
		o.value('true', _('Yes'));
		o.placeholder = 'false';

		// PidFile
		o = s.taboption('tab_advanced', form.Value, 'PidFile', _('PID file'));
		o.datatype = 'string';
		o.value('/var/run/clamav/freshclam.pid');
		o.placeholder = '/var/run/clamav/freshclam.pid';

		// NotifyClamd
		o = s.taboption('tab_advanced', form.Value, 'NotifyClamd', _('Notify clamd'));
		o.datatype = 'string';
		o.value('/etc/clamav/clamd.conf');
		o.placeholder = '/etc/clamav/clamd.conf';

		// DatabaseOwner
		o = s.taboption('tab_advanced', form.Value, 'DatabaseOwner', _('Database owner'));
		o.datatype = 'string';
		o.value('clamav');
		o.value('root');
		o.placeholder = 'root';

		// DatabaseDirectory
		o = s.taboption('tab_advanced', form.Value, 'DatabaseDirectory', _('Database directory'));
		o.datatype = 'string';
		o.value('/usr/share/clamav');
		o.placeholder = '/usr/share/clamav';

		// DNSDatabaseInfo
		o = s.taboption('tab_advanced', form.Value, 'DNSDatabaseInfo', _('DNS database info'));
		o.datatype = 'string';
		o.value('current.cvd.clamav.net');
		o.placeholder = 'current.cvd.clamav.net';

		// DatabaseMirror
		o = s.taboption('tab_advanced', form.Value, 'DatabaseMirror', _('Database mirror'));
		o.datatype = 'string';
		o.value('database.clamav.net');
		o.placeholder = 'database.clamav.net';

		// DatabaseCustomURL
		o = s.taboption('tab_advanced', form.Value, 'DatabaseCustomURL', _('Custom database URL'));
		o.value('http://myserver.example.com/mysigs.ndb');
		o.value('https://myserver.example.com:4567/allow_list.wdb');
		o.value('ftp://myserver.example.com/example.ldb');
		o.value('file:///mnt/nfs/local.hdb');
		o.value('file:///mnt/nfs/local.hdb');

		// PrivateMirror
		o = s.taboption('tab_advanced', form.Value, 'PrivateMirror', _('Private mirror URL'));
		o.value('mirror1.example.com');
		o.value('mirror2.example.com');

		// ScriptedUpdates
		o = s.taboption('tab_advanced', form.ListValue, 'ScriptedUpdates', _('Scripted updates'));
		o.value('false', _('No'));
		o.value('true', _('Yes'));

		// CompressLocalDatabase
		o = s.taboption('tab_advanced', form.ListValue, 'CompressLocalDatabase', _('Compress local database'));
		o.value('false', _('No'));
		o.value('true', _('Yes'));

		// ConnectTimeout
		o = s.taboption('tab_advanced', form.Value, 'ConnectTimeout', _('Connect timeout'));
		o.value('30');
		o.value('60');
		o.placeholder = '60';

		// ReceiveTimeout
		o = s.taboption('tab_advanced', form.Value, 'ReceiveTimeout', _('Receive timeout'));
		o.value('60');
		o.value('300');
		o.placeholder = '60';

		// Checks
		o = s.taboption('tab_advanced', form.Value, 'Checks', _('Database checks per day'));
		o.value('12');
		o.value('24');

		// TestDatabases
		o = s.taboption('tab_advanced', form.ListValue, 'TestDatabases', _('Test databases'));
		o.value('false', _('No'));
		o.value('true', _('Yes'));

		// Bytecode
		o = s.taboption('tab_advanced', form.MultiValue, 'Bytecode', _('Download bytecode.cvd'));
		o.value('false', _('No'));
		o.value('true', _('Yes'));

		// ExtraDatabase
		o = s.taboption('tab_advanced', form.Value, 'ExtraDatabase', _('Extra databases'));
		o.datatype = 'string';
		o.placeholder = 'dbname1';

		// ExcludeDatabase
		o = s.taboption('tab_advanced', form.Value, 'ExcludeDatabase', _('Exclude databases'));
		o.datatype = 'string';
		o.placeholder = 'dbname1';

		return m.render();
	},

});
