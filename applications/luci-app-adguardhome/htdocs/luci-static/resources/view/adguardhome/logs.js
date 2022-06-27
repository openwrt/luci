'use strict';
'require dom';
'require fs';
'require poll';
'require ui';
'require view';

return view.extend({
    load: function() {
		return Promise.all([
			L.resolveDefault(fs.stat('/sbin/logread'), null),
			L.resolveDefault(fs.stat('/usr/sbin/logread'), null)
		]).then(function(stat) {
			var logger = stat[0] ? stat[0].path : stat[1] ? stat[1].path : null;
			
			return fs.exec_direct(logger, [ '-e', 'AdGuardHome' ]).catch(function(err) {
				ui.addNotification(null, E('p', {}, _('Unable to load log data: ' + err.message)));
				return '';
			});
		});
	},

    render: function(logdata) {
		var loglines = logdata.trim().split(/\n/).reverse().slice(0, 50);

		return E([], [
			E('h2', {}, [_('System Log (AdGuard Home)')]),
			E('div', {}, [_('Showing last 50 lines')]),
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

    handleSave: null,
    handleSaveApply: null,
    handleReset: null
});
