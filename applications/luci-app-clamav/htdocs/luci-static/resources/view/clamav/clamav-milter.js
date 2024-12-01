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

		m = new form.Map('clamav-milter', _('ClamAV Milter'), _('Configuration'));

		// Section
		s = m.section(form.TypedSection, 'clamav-milter', _('Settings'));
		s.anonymous = true;
		s.addremove = false;

		// Advanced Tab
		s.tab('tab_advanced', _('Settings'));

		// clamav_milter_config_file
		o = s.taboption('tab_advanced', form.Value, 'clamav_milter_config_file', _('clamav-milter config file'));
		o.datatype = 'string';
		o.value('/etc/clamav/clamav-milter.conf');
		o.placeholder = '/etc/clamav/clamav-milter.conf';

		// Foreground
		o = s.taboption('tab_advanced', form.ListValue, 'Foreground', _('Run in foreground'));
		o.value('false', _('No'));
		o.value('true', _('Yes'));
		o.placeholder = 'false';

		// PidFile
		o = s.taboption('tab_advanced', form.Value, 'PidFile', _('PID file'));
		o.datatype = 'string';
		o.value('/var/run/clamav/clamav-milter.pid');
		o.placeholder = '/var/run/clamav/clamav-milter.pid';

		// User
		o = s.taboption('tab_advanced', form.Value, 'User', _('User'));
		o.datatype = 'string';
		o.value('nobody');
		o.placeholder = 'nobody';

		// MilterSocketGroup
		o = s.taboption('tab_advanced', form.Value, 'MilterSocketGroup', _('Milter socket group'));
		o.datatype = 'string';
		o.value('nogroup');
		o.placeholder = 'nogroup';

		// ReadTimeout
		o = s.taboption('tab_advanced', form.Value, 'ReadTimeout', _('Read timeout'));
		o.value('120');

		// OnClean
		o = s.taboption('tab_advanced', form.ListValue, 'OnClean', _('On-clean action'));
		o.value('Accept', _('Accept'));
		o.value('Reject', _('Reject'));
		o.value('Defer', _('Defer'));
		o.value('Blackhole', _('Blackhole'));
		o.value('Quarantine', _('Quarantine'));

		// OnInfected
		o = s.taboption('tab_advanced', form.ListValue, 'OnInfected', _('On-infected action'));
		o.value('Accept', _('Accept'));
		o.value('Reject', _('Reject'));
		o.value('Defer', _('Defer'));
		o.value('Blackhole', _('Blackhole'));
		o.value('Quarantine', _('Quarantine'));

		// OnFail
		o = s.taboption('tab_advanced', form.ListValue, 'OnFail', _('On-fail action'));
		o.value('Accept', _('Accept'));
		o.value('Reject', _('Reject'));
		o.value('Defer', _('Defer'));

		// AddHeader
		o = s.taboption('tab_advanced', form.ListValue, 'AddHeader', _('Add header'));
		o.value('Replace', _('Replace'));
		o.value('Yes', _('Yes'));

		/*
		// LogFile
		o = s.taboption('tab_advanced', form.Value, 'LogFile', _('Logfile'));
		o.value('/tmp/clamav-milter.log');
		o.placeholder = '/tmp/clamav-milter.log';

		// LogFileUnlock
		o = s.taboption('tab_advanced', form.ListValue, 'LogFileUnlock', _('Unlock logfile'));
		o.value('false', _('No'));
		o.value('true', _('Yes'));

		// LogFileMaxSize
		o = s.taboption('tab_advanced', form.Value, 'LogFileMaxSize', _('Max size of log file'));
		o.value('512K', _('512K'));
		o.value('1M', _('1M'));
		o.value('2M', _('2M'));
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

		// LogInfected
		o = s.taboption('tab_advanced', form.ListValue, 'LogInfected', _('Log infections'));
		o.value('Off', _('Off'));
		o.value('Basic', _('Basic'));
		o.value('Full', _('Full'));

		// LogClean
		o = s.taboption('tab_advanced', form.ListValue, 'LogClean', _('Log clean'));
		o.value('Off', _('Off'));
		o.value('Basic', _('Basic'));
		o.value('Full', _('Full'));

		// MaxFileSize
		o = s.taboption('tab_advanced', form.Value, 'MaxFileSize', _('Max size of scanned file'));
		o.datatype = 'string';
		o.value('512K', _('512K'));
		o.value('1M', _('1M'));
		o.value('2M', _('2M'));
		o.value('25M', _('25M'));
		o.value('50M', _('50M'));
		o.placeholder = '25M';

		// SupportMultipleRecipients
		o = s.taboption('tab_advanced', form.ListValue, 'SupportMultipleRecipients', _('Support multiple recipients'));
		o.value('false', _('No'));
		o.value('true', _('Yes'));

		// RejectMsg
		o = s.taboption('tab_advanced', form.TextValue, 'RejectMsg', _('Rejection log message'));
		o.wrap = 'off';
		o.rows = 3;
		o.monospace = true;
		o.editable = true;
		o.placeholder = _('Rejecting Harmful Email: %v found.')

		// TemporaryDirectory
		o = s.taboption('tab_advanced', form.Value, 'TemporaryDirectory', _('Temporary directory'));
		o.datatype = 'string';
		o.value('/tmp');
		o.placeholder = '/tmp';

		// MilterSocket
		o = s.taboption('tab_advanced', form.Value, 'MilterSocket', _('Local socket'));
		o.datatype = 'string';
		o.value('unix:/var/run/clamav/clamav-milter.sock');
		o.placeholder = 'unix:/var/run/clamav/clamav-milter.sock';

		// MilterSocketMode
		o = s.taboption('tab_advanced', form.Value, 'MilterSocketMode', _('Local socket'));
		o.datatype = 'string';
		o.value('666');
		o.placeholder = '666';

		// ClamdSocket
		o = s.taboption('tab_advanced', form.Value, 'ClamdSocket', _('clamd socket'));
		o.datatype = 'string';
		o.value('tcp:127.0.0.1:3310');
		o.placeholder = 'tcp:127.0.0.1:3310';

		// FixStaleSocket
		o = s.taboption('tab_advanced', form.ListValue, 'FixStaleSocket', _('Fix stale socket'));
		o.value('false', _('No'));
		o.value('true', _('Yes'));

		return m.render();
	},

});
