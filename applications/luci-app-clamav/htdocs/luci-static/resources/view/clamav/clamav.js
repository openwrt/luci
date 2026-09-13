'use strict';
'require form';
'require fs';
// 'require rpc';
'require uci';
'require view';

return view.extend({
	load: function() {

	},

	render: function() {
		let m, s, o;

		m = new form.Map('clamav', _('ClamAV'), _('Configuration'));

		// Section
		s = m.section(form.TypedSection, 'clamav', _('Settings'));
		s.anonymous = true;
		s.addremove = false;

		// Advanced Tab
		s.tab('tab_advanced', _('Settings'));
		// s.tab('tab_logs', _('Log'));

		// clamd_config_file
		o = s.taboption('tab_advanced', form.Value, 'clamd_config_file', _('clamd config file'));
		o.datatype = 'string';
		o.value('/etc/clamav/clamd.conf');
		o.placeholder = '/etc/clamav/clamd.conf';

		/*
		// LogFile
		o = s.taboption('tab_advanced', form.Value, 'LogFile', _('Logfile'));
		o.value('/tmp/clamav.log');
		o.placeholder = '/tmp/clamav.log';

		// LogFileMaxSize
		o = s.taboption('tab_advanced', form.Value, 'LogFileMaxSize', _('Max size of log file'));
		o.value('512K', _('512K'));
		o.value('1M', _('1M'));
		o.value('2M', _('2M'));
		o.placeholder = '1M';

		// LogRotate
		o = s.taboption('tab_advanced', form.ListValue, 'LogRotate', _('Add header'));
		o.value('false', _('No'));
		o.value('true', _('Yes'));
		*/

		// LogTime
		o = s.taboption('tab_advanced', form.ListValue, 'LogTime', _('Log time with each message'));
		o.value('no', _('No'));
		o.value('yes', _('Yes'));
		o.placeholder = 'no';

		// LogVerbose
		o = s.taboption('tab_advanced', form.ListValue, 'LogVerbose', _('Enable verbose logging'));
		o.value('no', _('No'));
		o.value('yes', _('Yes'));
		o.placeholder = 'no';

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

		// ExtendedDetectionInfo
		o = s.taboption('tab_advanced', form.ListValue, 'ExtendedDetectionInfo', _('Log additional infection info'));
		o.value('no', _('No'));
		o.value('yes', _('Yes'));
		o.placeholder = 'no';

		// OfficialDatabaseOnly
		o = s.taboption('tab_advanced', form.ListValue, 'OfficialDatabaseOnly', _('Use official database only'));
		o.value('no', _('No'));
		o.value('yes', _('Yes'));
		o.placeholder = 'no';

		// MaxDirectoryRecursion
		o = s.taboption('tab_advanced', form.Value, 'MaxDirectoryRecursion', _('Max directory scan depth'));
		o.value('15');
		o.value('20');
		o.placeholder = '15';

		// FollowDirectorySymlinks
		o = s.taboption('tab_advanced', form.ListValue, 'FollowDirectorySymlinks', _('Follow directory symlinks'));
		o.value('no', _('No'));
		o.value('yes', _('Yes'));
		o.placeholder = 'no';

		// FollowFileSymlinks
		o = s.taboption('tab_advanced', form.ListValue, 'FollowFileSymlinks', _('Follow file symlinks'));
		o.value('no', _('No'));
		o.value('yes', _('Yes'));
		o.placeholder = 'no';

		// DetectPUA
		o = s.taboption('tab_advanced', form.ListValue, 'DetectPUA', _('Detect possibly unwanted apps'));
		o.value('no', _('No'));
		o.value('yes', _('Yes'));
		o.placeholder = 'no';

		// ScanPE
		o = s.taboption('tab_advanced', form.ListValue, 'ScanPE', _('Scan portable executables'));
		o.value('no', _('No'));
		o.value('yes', _('Yes'));
		o.placeholder = 'yes';

		// ScanELF
		o = s.taboption('tab_advanced', form.ListValue, 'ScanELF', _('Scan ELF files'));
		o.value('no', _('No'));
		o.value('yes', _('Yes'));
		o.placeholder = 'yes';

		// DetectBrokenExecutables
		o = s.taboption('tab_advanced', form.ListValue, 'DetectBrokenExecutables', _('Detect broken executables'));
		o.value('no', _('No'));
		o.value('yes', _('Yes'));
		o.placeholder = 'no';

		// AlertBrokenExecutables
		o = s.taboption('tab_advanced', form.ListValue, 'AlertBrokenExecutables', _('Alert on broken executables'));
		o.value('no', _('No'));
		o.value('yes', _('Yes'));
		o.placeholder = 'no';

		// ScanOLE2
		o = s.taboption('tab_advanced', form.ListValue, 'ScanOLE2', _('Scan MS Office and .msi files'));
		o.value('no', _('No'));
		o.value('yes', _('Yes'));
		o.placeholder = 'yes';

		// ScanPDF
		o = s.taboption('tab_advanced', form.ListValue, 'ScanPDF', _('Scan pdf files'));
		o.value('no', _('No'));
		o.value('yes', _('Yes'));
		o.placeholder = 'yes';

		// ScanSWF
		o = s.taboption('tab_advanced', form.ListValue, 'ScanSWF', _('Scan swf files'));
		o.value('no', _('No'));
		o.value('yes', _('Yes'));
		o.placeholder = 'yes';

		// ScanMail
		o = s.taboption('tab_advanced', form.ListValue, 'ScanMail', _('Scan emails'));
		o.value('no', _('No'));
		o.value('yes', _('Yes'));
		o.placeholder = 'yes';

		// ScanPartialMessages
		o = s.taboption('tab_advanced', form.ListValue, 'ScanPartialMessages', _('Scan RFC1341 messages split over many emails'));
		o.value('no', _('No'));
		o.value('yes', _('Yes'));
		o.placeholder = 'no';

		// ScanArchive
		o = s.taboption('tab_advanced', form.ListValue, 'ScanArchive', _('Scan archives'));
		o.value('no', _('No'));
		o.value('yes', _('Yes'));
		o.placeholder = 'yes';

		// ArchiveBlockEncrypted
		o = s.taboption('tab_advanced', form.ListValue, 'ArchiveBlockEncrypted', _('Block encrypted archives'));
		o.value('no', _('No'));
		o.value('yes', _('Yes'));
		o.placeholder = 'no';

		// AlertEncrypted
		o = s.taboption('tab_advanced', form.ListValue, 'AlertEncrypted', _('Alert on encrypted archives'));
		o.value('no', _('No'));
		o.value('yes', _('Yes'));
		o.placeholder = 'yes';

		// StreamMinPort
		o = s.taboption('tab_advanced', form.Value, 'StreamMinPort', _('Port range, lowest port'));
		o.datatype = 'portrange';
		o.value('1024');
		o.placeholder = '1024';

		// StreamMaxPort
		o = s.taboption('tab_advanced', form.Value, 'StreamMaxPort', _('Port range, highest port'));
		o.datatype = 'portrange';
		o.value('2048');
		o.placeholder = '2048';

		// ReadTimeout
		o = s.taboption('tab_advanced', form.ListValue, 'ReadTimeout', _('Read timeout'));
		o.value('30');
		o.placeholder = '30';

		// CommandReadTimeout
		o = s.taboption('tab_advanced', form.ListValue, 'CommandReadTimeout', _('Command read timeout'));
		o.value('5');
		o.placeholder = '5';

		// MaxThreads
		o = s.taboption('tab_advanced', form.Value, 'MaxThreads', _('Max number of threads'));
		o.datatype = 'and(uinteger,min(1))';
		o.value('10');
		o.value('20');
		o.placeholder = '10';

		// SelfCheck
		o = s.taboption('tab_advanced', form.Value, 'SelfCheck', _('Database check every N sec'));
		o.datatype = 'and(uinteger,min(1))';
		o.value('600');
		o.placeholder = '600';

		// MaxFileSize
		o = s.taboption('tab_advanced', form.Value, 'MaxFileSize', _('Max size of scanned file'));
		o.datatype = 'string';
		o.value('512K', _('512K'));
		o.value('1M', _('1M'));
		o.value('2M', _('2M'));
		o.value('50M', _('50M'));
		o.value('150M', _('150M'));
		o.placeholder = '150M';

		// TCPAddr
		o = s.taboption('tab_advanced', form.Value, 'TCPAddr', _('TCP listen address'));
		o.datatype = 'string';
		o.value('localhost');
		o.value('127.0.0.1');
		o.placeholder = '127.0.0.1';

		// TCPSocket
		o = s.taboption('tab_advanced', form.Value, 'TCPSocket', _('TCP listen port'));
		o.datatype = 'string';
		o.value('3310');
		o.placeholder = '3310';

		// User
		o = s.taboption('tab_advanced', form.Value, 'User', _('User'));
		o.datatype = 'string';
		o.value('nobody');
		o.placeholder = 'nobody';

		// ExitOnOOM
		o = s.taboption('tab_advanced', form.ListValue, 'ExitOnOOM', _('Exit when Out Of Memory'));
		o.datatype = 'string';
		o.value('no', _('No'));
		o.value('yes', _('Yes'));
		o.placeholder = 'yes';

		// DisableCertCheck
		o = s.taboption('tab_advanced', form.ListValue, 'DisableCertCheck', _('Disable certificate checks'));
		o.datatype = 'string';
		o.value('no', _('No'));
		o.value('yes', _('Yes'));
		o.placeholder = 'no';

		// DatabaseDirectory
		o = s.taboption('tab_advanced', form.Value, 'DatabaseDirectory', _('Database directory'));
		o.datatype = 'string';
		o.value('/usr/share/clamav');
		o.placeholder = '/usr/share/clamav';

		// TemporaryDirectory
		o = s.taboption('tab_advanced', form.Value, 'TemporaryDirectory', _('Temporary directory'));
		o.datatype = 'string';
		o.value('/tmp');
		o.placeholder = '/tmp';

		// LocalSocket
		o = s.taboption('tab_advanced', form.Value, 'LocalSocket', _('Local socket'));
		o.datatype = 'string';
		o.value('/var/run/clamav/clamd.sock');
		o.placeholder = '/var/run/clamav/clamd.sock';

		/*
		// Logs Tab
		var logfile = s.taboption('tab_logs', form.TextValue, 'clamav_logfile', '');
		logfile.wrap = 'off';
		logfile.rows = 50;
		logfile.monospace = true;
		logfile.editable = false;


		logfile.cfgvalue = function() {
			const logfilename = uci.get('clamav', 'clamav', 'LogFile')
			return fs.read(logfilename)
				.then(function(data) {
					return data || '';
				});
		};

		logfile.write = function() {
		};
		*/

		return m.render();
	},

	// handleSaveApply: function(ev) {
	// 	this.super('handleSaveApply', [ev]);
	// 	return Promise.all([
	// 		rpc.declare({
	// 			object: 'luci',
	// 			method: 'setInitAction',
	// 			params: [ 'name', 'action' ],
	// 			expect: { result: false }
	// 		})('clamav', 'reload'),
	// 	]);
	// }

});
