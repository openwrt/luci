'use strict';
'require view';
'require poll';
'require fs';

return view.extend({
	load: function() {
		return Promise.all([
			L.resolveDefault(fs.stat('/sbin/logread'), null),
			L.resolveDefault(fs.stat('/usr/sbin/logread'), null)
		]);
	},
	render: function(stat) {
		var logger = stat[0] ? stat[0].path : stat[1] ? stat[1].path : null;
		poll.add(function() {
			return L.resolveDefault(fs.exec_direct(logger, ['-e', 'adblock-'])).then(function(res) {
				var log = document.getElementById("logfile");
				if (res) {
					log.value = res.trim();
				} else {
					log.value = _('No adblock related logs yet!');
				}
				log.scrollTop = log.scrollHeight;
			});
		});
		return E('div', { class: 'cbi-map' },
			E('div', { class: 'cbi-section' }, [
			E('div', { class: 'cbi-section-descr' }, _('The syslog output, pre-filtered for adblock related messages only.')),
			E('textarea', {
				'id': 'logfile',
				'style': 'width: 100% !important; padding: 5px; font-family: monospace',
				'readonly': 'readonly',
				'wrap': 'off',
				'rows': 25
			})
		]));
	},
	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
