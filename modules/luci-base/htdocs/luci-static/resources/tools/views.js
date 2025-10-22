'use strict';
'require poll';
'require rpc';
'require uci';
'require ui';
'require view';

/* Note that any view implementing this log reader requires the log read
acl permission */

const callLogRead = rpc.declare({
	object: 'log',
	method: 'read',
	params: [ 'lines', 'stream', 'oneshot' ],
	expect: { log: [] }
});

var CBILogreadBox = function(logtag, name) {
	return L.view.extend({

		logFacilityFilter: 'any',
		invertLogFacilitySearch: false,
		logSeverityFilter: 'any',
		invertLogSeveritySearch: false,
		logTextFilter: '',
		invertLogTextSearch: false,
		logTagFilter: logtag ? logtag : '',
		logName: name ? name : _('System Log'),
		fetchMaxRows: 1000,

		facilities: [
			['any', 'any', _('Any')],
			['0',  'kern',   _('Kernel')],
			['1',  'user',   _('User')],
			['2',  'mail',   _('Mail')],
			['3',  'daemon', _('Daemon')],
			['4',  'auth',   _('Auth')],
			['5',  'syslog', _('Syslog')],
			['6',  'lpr',    _('LPR')],
			['7',  'news',   _('News')],
			['8',  'uucp',   _('UUCP')],
			['9',  'cron',   _('Cron')],
			['10', 'authpriv', _('Auth Priv')],
			['11', 'ftp', _('FTP')],
			['12', 'ntp', _('NTP')],
			['13', 'security', _('Log audit')],
			['14', 'console', _('Log alert')],
			['15', 'cron', _('Scheduling daemon')],
			['16', 'local0', _('Local 0')],
			['17', 'local1', _('Local 1')],
			['18', 'local2', _('Local 2')],
			['19', 'local3', _('Local 3')],
			['20', 'local4', _('Local 4')],
			['21', 'local5', _('Local 5')],
			['22', 'local6', _('Local 6')],
			['23', 'local7', _('Local 7')]
		],

		severity: [
			['any','any', _('Any')],
			['0',  'emerg',   _('Emergency')],
			['1',  'alert',   _('Alert')],
			['2',  'crit',   _('Critical')],
			['3',  'err', _('Error')],
			['4',  'warn',   _('Warning')],
			['5',  'notice', _('Notice')],
			['6',  'info',    _('Info')],
			['7',  'debug',   _('Debug')]
		],


		async retrieveLog() {
			try {
				const tz = uci.get('system', '@system[0]', 'zonename')?.replaceAll(' ', '_');
				const ts = uci.get('system', '@system[0]', 'clock_timestyle') || 0;
				const hc = uci.get('system', '@system[0]', 'clock_hourcycle') || 0;
				const logEntries = await callLogRead(this.fetchMaxRows, false, true);
				const dateObj = new Intl.DateTimeFormat(undefined, {
						dateStyle: 'medium',
						timeStyle: (ts == 0) ? 'long' : 'full',
						hourCycle: (hc == 0) ? undefined : hc,
						timeZone: tz
				});

				let loglines = logEntries.map(entry => {
					const time = new Date(entry?.time);
					const datestr = dateObj.format(time);
					/* remember to add one since the 'any' entry occupies 1st position i.e. [0] */
					const facility = this.facilities[Math.floor(entry?.priority / 8) + 1][1] ?? 'unknown';
					const severity = this.severity[(entry?.priority % 8) + 1][1] ?? 'unknown';
					return `[${datestr}] ${facility}.${severity}: ${entry?.msg}`;
				});

				loglines = loglines.filter(line => {
					const sevMatch = this.logSeverityFilter === 'any' || line.includes(`.${this.logSeverityFilter}`);
					const facMatch = this.logFacilityFilter === 'any' || line.includes(`${this.logFacilityFilter}.`);
					return (this.invertLogSeveritySearch != sevMatch)
						   && (this.invertLogFacilitySearch != facMatch);
				});

				loglines = loglines.filter(line => {
					return line.toLowerCase().includes(this.logTagFilter?.toLowerCase());
				});

				loglines = loglines.filter(line => {
					const match = line.includes(this.logTextFilter);
					return this.invertLogTextSearch ? !match : match;
				});

				return {
					value: loglines?.join('\n'),
					rows: loglines?.length + 1
				};
			}
			catch (err) {
				ui.addNotification(null, E('p', {}, _('Unable to load log data: ' + err.message)));
				return {
					value: '',
					rows: 0
				};
			}
		},

		async pollLog() {
			const element = document.getElementById('syslog');
			if (element) {
				const log = await this.retrieveLog();
				element.value = log?.value;
				element.rows = log?.rows;
			}
		},

		async load() {
			poll.add(this.pollLog.bind(this));
			return Promise.all([
				uci.load('system'),
			]).then(() => this.retrieveLog());
		},

		render(loglines) {
			const scrollDownButton = E('button', {
					'id': 'scrollDownButton',
					'class': 'cbi-button cbi-button-neutral'
				}, _('Scroll to tail', 'scroll to bottom (the tail) of the log file')
			);
			scrollDownButton.addEventListener('click', () => {
				scrollUpButton.scrollIntoView();
				scrollDownButton.blur();
			});

			const scrollUpButton = E('button', {
					'id' : 'scrollUpButton',
					'class': 'cbi-button cbi-button-neutral'
				}, _('Scroll to head', 'scroll to top (the head) of the log file')
			);
			scrollUpButton.addEventListener('click', () => {
				scrollDownButton.scrollIntoView();
				scrollUpButton.blur();		
			});

			const self = this;

			// Create facility invert checkbox
			const facilityInvert = E('input', {
				'id': 'invertLogFacilitySearch',
				'type': 'checkbox',
				'class': 'cbi-input-checkbox',
			});

			// Create facility select-dropdown from facilities map
			const facilitySelect = E('select', {
				'id': 'logFacilitySelect',
				'class': 'cbi-input-select',
				'style': 'margin-bottom:10px',
			},
			this.facilities.map(([_, val, label]) =>
				(val == 'any') ? E('option', { value: val, selected: '' }, label) : E('option', { value: val }, label)
			));

			// Create severity invert checkbox
			const severityInvert = E('input', {
				'id': 'invertLogSeveritySearch',
				'type': 'checkbox',
				'class': 'cbi-input-checkbox',
			});

			// Create severity select-dropdown from facilities map
			const severitySelect = E('select', {
				'id': 'logSeveritySelect',
				'class': 'cbi-input-select',
			},
			this.severity.map(([_, val, label]) =>
				(val == 'any') ? E('option', { value: val, selected: '' }, label) : E('option', { value: val }, label)
			));

			// Create raw text search invert checkbox
			const filterTextInvert = E('input', {
				'id': 'invertLogTextSearch',
				'type': 'checkbox',
				'class': 'cbi-input-checkbox',
			});

			// Create raw text search text input
			const filterTextInput = E('input', {
				'id': 'logTextFilter',
				'class': 'cbi-input-text',
			});

			// Create max rows input
			const filterMaxRows = E('input', {
				'id': 'logMaxRows',
				'type': 'number',
				'class': 'cbi-input',
			});

			function handleLogFilterChange() {
				self.logFacilityFilter = facilitySelect.value;
				self.invertLogFacilitySearch = facilityInvert.checked;
				self.logSeverityFilter = severitySelect.value;
				self.invertLogSeveritySearch = severityInvert.checked;
				self.logTextFilter = filterTextInput.value;
				self.invertLogTextSearch = filterTextInvert.checked;
				self.fetchMaxRows = Number.parseInt(filterMaxRows.value);
				self.pollLog();
			}

			facilitySelect.addEventListener('change', handleLogFilterChange);
			facilityInvert.addEventListener('change', handleLogFilterChange);
			severitySelect.addEventListener('change', handleLogFilterChange);
			severityInvert.addEventListener('change', handleLogFilterChange);
			filterTextInput.addEventListener('input', handleLogFilterChange);
			filterTextInvert.addEventListener('change', handleLogFilterChange);
			filterMaxRows.addEventListener('change', handleLogFilterChange);

			return E([], [
				E('h2', {}, [ this.logName ]),
				E('div', { 'id': 'content_syslog' }, [
					E('div', { class: 'cbi-section-descr' }, this.logTagFilter ? _('The syslog output, pre-filtered for messages related to: ' + this.logTagFilter) : '') ,
					E('div', { 'style': 'margin-bottom:10px' }, [
						E('label', { 'for': 'invertLogFacilitySearch', 'style': 'margin-right:5px' }, _('Not')),
						facilityInvert,
						E('label', { 'for': 'logFacilitySelect', 'style': 'margin: 0 5px' }, _('facility:')),
						facilitySelect,
						E('label', { 'for': 'invertLogSeveritySearch', 'style': 'margin: 0 5px' }, _('Not')),
						severityInvert,
						E('label', { 'for': 'logSeveritySelect', 'style': 'margin: 0 5px' }, _('severity:')),
						severitySelect,
					]),
					E('div', { 'style': 'margin-bottom:10px' }, [
						E('label', { 'for': 'invertLogTextSearch', 'style': 'margin-right:5px' }, _('Not')),
						filterTextInvert,
						E('label', { 'for': 'logTextFilter', 'style': 'margin: 0 5px' }, _('including:')),
						filterTextInput,
						E('label', { 'for': 'logMaxRows', 'style': 'margin: 0 5px' }, _('Max rows:')),
						filterMaxRows,
					]),
					E('div', {'style': 'padding-bottom: 20px'}, [scrollDownButton]),
					E('textarea', {
						'id': 'syslog',
						'style': 'font-size:12px',
						'readonly': 'readonly',
						'wrap': 'off',
						'rows': loglines?.rows,
					}, [ loglines?.value ]),
					E('div', {'style': 'padding-bottom: 20px'}, [scrollUpButton])
				])
			]);
		},

		handleSaveApply: null,
		handleSave: null,
		handleReset: null
	});
};

return L.Class.extend({
	LogreadBox: CBILogreadBox,
});
