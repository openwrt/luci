'use strict';
'require view';
'require fs';
'require poll';
'require ui';

return view.extend({
	logFilterFrom: '0',
	logFilterTo: '',
	invertLogRangeFilter: false,

	minSeverity: '',
	invertMinSeverity: false,

	sortLogsDescending: false,

	logTextFilter: '',
	invertLogTextSearch: false,

	severity: [
		['', 'KERN_DEFAULT', _('Default')],
		// ['0',  'KERN_EMERG'], // unusable kernels tend to halt ergo no running system
		['1',  'KERN_ALERT', _('Alert')],
		['2',  'KERN_CRIT', _('Critical')],
		['3',  'KERN_ERR', _('Error')],
		['4',  'KERN_WARNING', _('Warning')],
		['5',  'KERN_NOTICE', _('Notice')],
		['6',  'KERN_INFO', _('Info')],
		['7',  'KERN_DEBUG', _('Debug')],
		// ['c',  'KERN_CONT'], // for follow-on printed lines lacking newline
		/*
		As of 24.10 there appear to be kernel log lines printed with severity 14-15
		which seems like a bug in ubox. So we must structure the filter in an
		'at least' fashion to include those.		
		*/
	],

	retrieveLog: async function() {
		return fs.exec_direct('/bin/dmesg', [ '-r' ]).then(logdata => {
			let loglines = [];
			let lastSeverity = null;

			logdata.trim().split(/\n/).forEach(line => {
				const priorityMatch = line.match(/^<(\w+)>/);
				if (!priorityMatch) return;

				const tag = priorityMatch[1];
				const isCont = tag === 'c';
				const cleanLine = line.replace(/^<\w+>/, '');
				const timeMatch = cleanLine.match(/^\[\s*(\d+(?:\.\d+)?)\]/);
				const time = timeMatch ? parseFloat(timeMatch[1]) : null;

				if (!isCont) {
					lastSeverity = parseInt(tag, 10); // update severity
				}

				loglines.push({
					severity: isCont ? lastSeverity : parseInt(tag, 10),
					isCont,
					time,
					text: cleanLine
				});
			});

			// Filter by time
			const hasStart = this.logFilterFrom;
			const hasEnd = this.logFilterTo;

			if (hasStart || hasEnd) {
				loglines = loglines.filter(({ time }) => {
					if (time == null) return false;

					let inRange = true;
					if (hasStart && hasEnd)
						inRange = time >= this.logFilterFrom && time <= this.logFilterTo;
					else if (hasStart)
						inRange = time >= this.logFilterFrom;
					else if (hasEnd)
						inRange = time <= this.logFilterTo;

					return this.invertLogRangeFilter ? !inRange : inRange;
				});
			}

			// Filter by severity
			loglines = loglines.filter(entry => {
				if (!entry.isCont) {
					if (!this.invertMinSeverity)
						return (entry.severity >= this.minSeverity);
					else
						return (entry.severity < this.minSeverity);
				}
			});

			// Filter by text
			if (this.logTextFilter) {
				loglines = loglines.filter(({ text }) => {
					const match = text.includes(this.logTextFilter);
					return this.invertLogTextSearch ? !match : match;
				});
			}

			// Sort by time
			if (this.sortLogsDescending) loglines.reverse();

			return {
				value: loglines.map(l => l.text).join('\n'),
				rows: loglines.length + 1
			};
		}).catch(function(err) {
			ui.addNotification(null, E('p', {}, _('Unable to load log data: ' + err.message)));
			return '';
		});
	},

	pollLog: async function() {
		const element = document.getElementById('syslog');
		if (element) {
			const log = await this.retrieveLog();
			element.value = log.value;
			element.rows = log.rows;
		}
	},

	load: async function() {
		poll.add(this.pollLog.bind(this));
		return await this.retrieveLog();
	},

	render: function(loglines) {
		const scrollDownButton = E('button', { 
				'id': 'scrollDownButton',
				'class': 'cbi-button cbi-button-neutral',
			}, _('Scroll to tail', 'scroll to bottom (the tail) of the log file')
		);
		scrollDownButton.addEventListener('click', () => scrollUpButton.scrollIntoView());

		const scrollUpButton = E('button', { 
				'id' : 'scrollUpButton',
				'class': 'cbi-button cbi-button-neutral',
			}, _('Scroll to head', 'scroll to top (the head) of the log file')
		);
		scrollUpButton.addEventListener('click', () => scrollDownButton.scrollIntoView());

		const self = this;


		// Create range invert checkbox
		const rangeTimeInvert = E('input', {
			'id': 'invertLogRangeTime',
			'type': 'checkbox',
			'class': 'cbi-input-checkbox',
		});

		// Create from time filter
		const fromTimeFilter = E('input', {
			'id': 'logFromTime',
			'class': 'cbi-input-text',
			'style': 'margin-bottom:10px',
			'type': 'number',
			'min': '0',
			'step': '0.1',
			'placeholder': '0.000000',
		});

		// Create to time filter
		const toTimeFilter = E('input', {
			'id': 'logToTime',
			'class': 'cbi-input-text',
			'style': 'margin-bottom:10px',
			'type': 'number',
			'min': '0',
			'step': '0.1',
			'placeholder': '0.000000',
		});


		// Create range invert checkbox
		const severityInvert = E('input', {
			'id': 'invertSeverity',
			'type': 'checkbox',
			'class': 'cbi-input-checkbox',
		});

		// Create severity select-dropdown from severity map
		const severitySelect = E('select', {
			'id': 'logSeveritySelect',
			'class': 'cbi-input-select',
		},
		this.severity.map(([val, tag, label]) =>
			E('option', { value: val }, label)
		));

		// Create range invert checkbox
		const descendingSort = E('input', {
			'id': 'invertAscendingSort',
			'type': 'checkbox',
			'class': 'cbi-input-checkbox',
		});

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

		function handleLogFilterChange() {
			// time
			self.invertLogRangeFilter = rangeTimeInvert.checked;
			self.logFilterFrom = fromTimeFilter.value;
			self.logFilterTo = toTimeFilter.value;

			// severity
			self.minSeverity = severitySelect.value;
			self.invertMinSeverity = severityInvert.checked;

			// sort
			self.sortLogsDescending = descendingSort.checked;

			// text
			self.logTextFilter = filterTextInput.value;
			self.invertLogTextSearch = filterTextInvert.checked;
			self.pollLog();
		}

		// time
		rangeTimeInvert.addEventListener('change', handleLogFilterChange);
		fromTimeFilter.addEventListener('input', handleLogFilterChange);
		toTimeFilter.addEventListener('input', handleLogFilterChange);
		// severity
		severitySelect.addEventListener('change', handleLogFilterChange);
		severityInvert.addEventListener('change', handleLogFilterChange);
		// sort
		descendingSort.addEventListener('change', handleLogFilterChange);
		// text
		filterTextInput.addEventListener('input', handleLogFilterChange);
		filterTextInvert.addEventListener('change', handleLogFilterChange);

		return E([], [
			E('h2', {}, [ _('Kernel Log') ]),
			E('div', { 'id': 'content_syslog' }, [
				E('div', { 'style': 'margin-bottom:10px' }, [
					E('label', { 'for': 'invertLogFacilitySearch', 'style': 'margin-right:5px' }, _('Not')),
					rangeTimeInvert,
					E('label', { 'for': 'logFacilitySelect', 'style': 'margin: 0 5px' }, _('between:')),
					fromTimeFilter,
					E('label', { 'for': 'logSeveritySelect', 'style': 'margin: 0 5px' }, _('and:')),
					toTimeFilter,
				]),
				E('div', { 'style': 'margin-bottom:10px' }, [
					E('label', { 'for': 'invertLogSeveritySearch', 'style': 'margin-right:5px' }, _('Not')),
					severityInvert,
					'\xa0',
					severitySelect,
					E('label', { 'for': 'logSeveritySelect', 'style': 'margin: 0 5px' }, _('and above')),
				]),
				E('div', { 'style': 'margin-bottom:10px' }, [
					E('label', { 'for': 'invertAscendingSort', 'style': 'margin-right:5px' }, _('Reverse sort')),
					descendingSort,
				]),
				E('div', { 'style': 'margin-bottom:10px' }, [
					E('label', { 'for': 'invertLogTextSearch', 'style': 'margin-right:5px' }, _('Not')),
					filterTextInvert,
					E('label', { 'for': 'logTextFilter', 'style': 'margin: 0 5px' }, _('including:')),
					filterTextInput,
				]),
				E('div', {'style': 'padding-bottom: 20px'}, [scrollDownButton]),
				E('textarea', {
					'id': 'syslog',
					'style': 'font-size:12px',
					'readonly': 'readonly',
					'wrap': 'off',
					'rows': loglines.rows
				}, [ loglines.value ]),
				E('div', {'style': 'padding-bottom: 20px'}, [scrollUpButton])
			])
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
