'use strict';
'require fs';
'require poll';
'require ui';
'require view';

return view.extend({
	async retrieveLog() {
		const stat = await Promise.all([
			L.resolveDefault(fs.stat('/sbin/logread'), null),
			L.resolveDefault(fs.stat('/usr/sbin/logread'), null)
		]);
		const logger = stat[0] ? stat[0].path : stat[1] ? stat[1].path : null;

		const logdata = await fs.exec_direct(logger, ['-e', 'tailscale']);
		const statusMappings = {
			'daemon.err': { status: 'StdErr', startIndex: 9 },
			'daemon.notice': { status: 'Info', startIndex: 10 }
		};
		const loglines = logdata.trim().split(/\n/).map(function(log) {
			const logParts = log.split(' ').filter(Boolean);
			if (logParts.length >= 6) {
				const formattedTime = `${logParts[1]} ${logParts[2]} - ${logParts[3]}`;
				const status = logParts[5];
				const mapping = statusMappings[status] || { status: status, startIndex: 9 };
				const newStatus = mapping.status;
				const startIndex = mapping.startIndex;
				const message = logParts.slice(startIndex).join(' ');
				return `${formattedTime} [ ${newStatus} ] - ${message}`;
			} else {
				return 'Log is empty.';
			}
		}).filter(Boolean);
		return { value: loglines.join('\n'), rows: loglines.length + 1 };
	},

	async pollLog() {
		const element = document.getElementById('syslog');
		if (element) {
			try {
				const log = await this.retrieveLog();
				element.value = log.value;
				element.rows = log.rows;
			} catch (err) {
				ui.addNotification(null, E('p', {}, _('Unable to load log data: ' + err.message)));
			}
		}
	},

	load() {
		poll.add(this.pollLog.bind(this));
		return this.retrieveLog();
	},

	render(loglines) {
		const scrollDownButton = E('button', { 
				id: 'scrollDownButton',
				class: 'cbi-button cbi-button-neutral'
			}, _('Scroll to tail', 'scroll to bottom (the tail) of the log file')
		);
		scrollDownButton.addEventListener('click', function() {
			scrollUpButton.scrollIntoView();
		});

		const scrollUpButton = E('button', { 
				id : 'scrollUpButton',
				class: 'cbi-button cbi-button-neutral'
			}, _('Scroll to head', 'scroll to top (the head) of the log file')
		);
		scrollUpButton.addEventListener('click', function() {
			scrollDownButton.scrollIntoView();
		});

		return E([], [
			E('div', { id: 'content_syslog' }, [
				E('div', { style: 'padding-bottom: 20px' }, [scrollDownButton]),
				E('textarea', {
					id: 'syslog',
					style: 'font-size:12px',
					readonly: 'readonly',
					wrap: 'off',
					rows: loglines.rows,
				}, [ loglines.value ]),
				E('div', { style: 'padding-bottom: 20px' }, [scrollUpButton])
			])
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
