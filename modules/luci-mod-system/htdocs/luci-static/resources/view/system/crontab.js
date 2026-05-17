'use strict';
'require view';
'require fs';
'require ui';

var isReadonlyView = !L.hasViewPermission() || null;

return view.extend({
	load: function() {
		return L.resolveDefault(fs.read('/etc/crontabs/root'), '');
	},

	handleSave: function(ev) {
		var value = (document.querySelector('textarea').value || '').trim().replace(/\r\n/g, '\n') + '\n';

		return fs.write('/etc/crontabs/root', value).then(function(rc) {
			document.querySelector('textarea').value = value;
			ui.addNotification(null, E('p', _('Contents have been saved.')), 'info');

			return fs.exec('/etc/init.d/cron', [ 'reload' ]);
		}).catch(function(e) {
			ui.addNotification(null, E('p', _('Unable to save contents: %s').format(e.message)));
		});
	},

	render: function(crontab) {
		return E([
			E('h2', _('Scheduled Tasks')),
			E('p', { 'class': 'cbi-section-descr' }, _('This is the system crontab in which scheduled tasks can be defined.')),
			E('p', {}, E('textarea', { 'style': 'width:100%', 'rows': 25, 'disabled': isReadonlyView }, [ crontab != null ? crontab : '' ]))
		]);
	},

	handleSaveApply: null,
	handleReset: null
});
