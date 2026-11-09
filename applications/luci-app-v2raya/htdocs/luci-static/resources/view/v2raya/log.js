// SPDX-License-Identifier: Apache-2.0
'use strict';
'require dom';
'require fs';
'require poll';
'require ui';
'require view';

var LOG_PATH = '/var/log/v2raya/v2raya.log';
var MAX_LINES = 500;
var POLL_INTERVAL = 5;

return view.extend({
	render: function () {
		var logEl = E('pre', {
			id: 'v2raya-log',
			style: 'white-space:pre-wrap;word-break:break-all;max-height:65vh;overflow:auto;padding:8px;margin:0;background:rgba(0,0,0,0.04);border-radius:4px'
		}, _('Loading…'));

		var refresh = function () {
			return L.resolveDefault(fs.read_direct(LOG_PATH, 'text'), null).then(function (text) {
				if (text === null) {
					dom.content(logEl, _('The log file does not exist yet. Start the service and try again.'));
					return;
				}

				var lines = text.replace(/\s+$/, '').split('\n');
				if (lines.length > MAX_LINES)
					lines = lines.slice(-MAX_LINES);

				var atBottom = (logEl.scrollTop + logEl.clientHeight + 20) >= logEl.scrollHeight;
				dom.content(logEl, lines.join('\n') || _('The log is empty.'));

				if (atBottom)
					logEl.scrollTop = logEl.scrollHeight;
			}).catch(function (err) {
				dom.content(logEl, _('Unable to read the log: %s').format(err));
			});
		};

		var refreshBtn = E('button', { class: 'btn cbi-button cbi-button-action' }, _('Refresh'));
		var clearBtn = E('button', { class: 'btn cbi-button cbi-button-reset' }, _('Clear log'));

		refreshBtn.addEventListener('click', function () { refresh(); });
		clearBtn.addEventListener('click', function () {
			if (!confirm(_('Clear the v2rayA log file?')))
				return;

			L.resolveDefault(fs.write(LOG_PATH, ''), null).then(function (res) {
				if (res === null)
					ui.addNotification(null, E('p', {}, _('Unable to clear the log file.')), 'danger');
				else
					ui.addNotification(null, E('p', {}, _('Log file cleared.')), 'info');

				refresh();
			});
		});

		refresh();
		poll.add(refresh, POLL_INTERVAL);

		return E('div', { class: 'cbi-map' }, [
			E('h2', {}, _('v2rayA log')),
			E('div', { class: 'cbi-map-descr' },
				_('Showing the last %d lines of %s. Refreshes every %d seconds.')
					.format(MAX_LINES, LOG_PATH, POLL_INTERVAL)),
			E('div', { class: 'cbi-section' }, [
				logEl,
				E('div', { style: 'margin-top:8px' }, [ refreshBtn, ' ', clearBtn ])
			])
		]);
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
