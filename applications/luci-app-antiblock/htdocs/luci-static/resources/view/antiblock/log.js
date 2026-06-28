'use strict';
'require view';
'require fs';
'require poll';
'require ui';
'require uci';

let main_config;

return view.extend({
	retrieveLog: async function () {
		return fs.read_direct('/tmp/antiblock/log.txt').then(function (logdata) {
			const loglines = logdata.trim().split(/\n/).map(function (line) {
				return line.replace(/^<\d+>/, '');
			});
			return { value: loglines.join('\n'), rows: loglines.length + 1 };
		}).catch(function (err) {
			ui.addNotification(null, E('p', {}, _('Unable to load log data:') + ' ' + err.message));
			return '';
		});
	},

	pollLog: async function () {
		const element = document.getElementById('syslog');
		if (element) {
			const log = await this.retrieveLog();
			element.value = log.value;
			element.rows = log.rows;
		}
	},

	load: async function () {
		await uci.load('antiblock');

		main_config = uci.sections('antiblock', 'main');
		if (!main_config[0]?.log || main_config[0]?.log === '0') {
			return;
		}

		poll.add(this.pollLog.bind(this), 10);

		return await this.retrieveLog();
	},

	render: function (loglines) {
		const main_div = E([]);
		main_div.appendChild(E('h2', _('Log')));
		const routes_div = E('div', { class: 'cbi-section' });
		routes_div.appendChild(E('div', { class: 'cbi-section-descr' }, _('Log is not enabled.')));
		main_div.appendChild(routes_div);

		if (!main_config[0]?.log || main_config[0]?.log === '0') {
			return main_div;
		}

		const scrollDownButton = E('button', {
			'id': 'scrollDownButton',
			'class': 'cbi-button cbi-button-neutral',
		}, _('Scroll to tail', 'scroll to bottom (the tail) of the log file'));
		scrollDownButton.addEventListener('click', function () {
			scrollUpButton.scrollIntoView();
		});

		const scrollUpButton = E('button', {
			'id': 'scrollUpButton',
			'class': 'cbi-button cbi-button-neutral',
		}, _('Scroll to head', 'scroll to top (the head) of the log file'));
		scrollUpButton.addEventListener('click', function () {
			scrollDownButton.scrollIntoView();
		});

		return E([], [
			E('h2', {}, [_('Log')]),
			E('div', { 'id': 'content_syslog' }, [
				E('div', { 'style': 'padding-bottom: 20px' }, [scrollDownButton]),
				E('textarea', {
					'id': 'syslog',
					'style': 'font-size:12px',
					'readonly': 'readonly',
					'wrap': 'off',
					'rows': loglines.rows
				}, [loglines.value]),
				E('div', { 'style': 'padding-top: 20px' }, [scrollUpButton])
			])
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
