'use strict';
// logs.js — live tail of sing-box syslog entries. Level filter (All/Info/
// Warn/Error/Debug), substring search, manual refresh and auto-refresh
// toggle (poll every 3 s).
//
// sing-box writes to stderr; procd in the init script relays that to
// syslog (logd's ring buffer). tail-log.sh calls `logread | grep sing-box`
// server-side — logd handles rotation itself, no SIGHUP / no risk of
// crash-looping sing-box by signalling a "reload" while TUN is held.

'require view';
'require fs';
'require ui';
'require dom';
'require poll';

var MAX_LINES = 200;
var currentLevel = 'all';
var searchQuery = '';
var autoRefresh = true;

function getLogs() {
	return fs.exec('/usr/share/singbox/tail-log.sh', [
		String(MAX_LINES),
		currentLevel,
		searchQuery
	]).then(function(res) {
		return res.stdout || res.output || '';
	}).catch(function(err) {
		console.warn('[singbox] tail-log failed:', err);
		return '';
	});
}

return view.extend({
	load: function() {
		return getLogs();
	},

	render: function(initialLogs) {
		var logContainer = E('pre', {
			id: 'singbox-log-output',
			style: 'background:#1a1a1a;color:#0f0;font-family:monospace;font-size:12px;padding:15px;max-height:500px;overflow-y:auto;border-radius:4px;white-space:pre-wrap;'
		}, initialLogs || _('No logs available'));

		function refreshLogs() {
			getLogs().then(function(text) {
				dom.content(logContainer, text || _('No logs'));
				logContainer.scrollTop = logContainer.scrollHeight;
			});
		}

		var levelSelect = E('select', {
			class: 'cbi-input-select',
			style: 'margin-right:10px;',
			change: function(ev) {
				currentLevel = ev.target.value;
				refreshLogs();
			}
		}, [
			E('option', { value: 'all', selected: true }, _('All')),
			E('option', { value: 'info' }, _('Info')),
			E('option', { value: 'warn' }, _('Warning')),
			E('option', { value: 'error' }, _('Error')),
			E('option', { value: 'debug' }, _('Debug')),
			E('option', { value: 'fatal' }, _('Fatal'))
		]);

		var searchInput = E('input', {
			type: 'text',
			class: 'cbi-input-text',
			placeholder: _('Search logs...'),
			style: 'width:200px;margin-right:10px;',
			input: function(ev) { searchQuery = ev.target.value; },
			keydown: function(ev) {
				if (ev.key === 'Enter') refreshLogs();
			}
		});

		var refreshBtn = E('button', { class: 'btn', click: refreshLogs }, _('Refresh'));

		var autoToggle = E('button', {
			id: 'auto-refresh-btn',
			class: 'btn cbi-button-positive',
			click: function(ev) {
				autoRefresh = !autoRefresh;
				ev.target.textContent = autoRefresh ? _('Auto: ON') : _('Auto: OFF');
				ev.target.className = autoRefresh ? 'btn cbi-button-positive' : 'btn';
			}
		}, _('Auto: ON'));

		poll.add(function() {
			if (!autoRefresh) return;
			return getLogs().then(function(content) {
				if (content !== logContainer.textContent) {
					dom.content(logContainer, content);
					logContainer.scrollTop = logContainer.scrollHeight;
				}
			}).catch(function() {});
		}, 3);

		return E('div', { class: 'cbi-map' }, [
			E('h2', { name: 'content' }, _('sing-box Logs')),
			E('div', { class: 'cbi-section' }, [
				E('div', { style: 'margin-bottom:15px;display:flex;align-items:center;' }, [
					E('label', { style: 'margin-right:5px;' }, _('Level:')),
					levelSelect,
					searchInput,
					refreshBtn,
					autoToggle
				]),
				logContainer
			])
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
