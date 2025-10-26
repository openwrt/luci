'use strict';
'require fs';

function Logview(logtag, name) {
	return L.view.extend({
		load: function() {
			return Promise.all([
				L.resolveDefault(fs.stat('/sbin/logread'), null),
				L.resolveDefault(fs.stat('/usr/sbin/logread'), null)
			]);
		},

		render: function(stat) {
			let logger = stat[0]?.path || stat[1]?.path || null;

			if (!logger) {
				return E('div', { class: 'error' }, _('logread not found on system.'));
			}
			L.Poll.add(function() {
				return L.resolveDefault(fs.exec_direct(logger, ['-e', logtag])).then(function(res) {
					var log = document.getElementById('logfile');
					if (log) {
						log.value = res ? res.trim() : _('No %s related logs yet!').format(name);
						log.scrollTop = log.scrollHeight;
					}
				});
			});
			return E('div', { class: 'cbi-map' }, [
				E('div', { class: 'cbi-section' }, [
					E('div', { class: 'cbi-section-descr' }, _('The syslog output, pre-filtered for messages related to: %s').format(name)),
					E('textarea', {
						id: 'logfile',
						style: 'min-height: 500px; max-height: 90vh; width: 100%; padding: 5px; font-family: monospace; resize: vertical;',
						readonly: 'readonly',
						wrap: 'off'
					})
				])
			]);
		},
		handleSaveApply: null,
		handleSave: null,
		handleReset: null
	});
}

return L.Class.extend({
	Logview: Logview
});
