'use strict';
'require view';
'require fs';
'require ui';

return view.extend({
	load: function() {
		return fs.exec_direct('/sbin/logread', [ '-e', '^' ]).catch(function(err) {
			ui.addNotification(null, E('p', {}, _('Unable to load log data: ' + err.message)));
			return '';
		});
	},

	render: function(logdata) {
		var loglines = logdata.trim().split(/\n/);

		return E([], [
			E('h2', {}, [ _('System Log') ]),
			E('div', { 'id': 'content_syslog' }, [
				E('textarea', {
					'id': 'syslog',
					'style': 'font-size:12px',
					'readonly': 'readonly',
					'wrap': 'off',
					'rows': loglines.length + 1
				}, [ loglines.join('\n') ])
			])
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
