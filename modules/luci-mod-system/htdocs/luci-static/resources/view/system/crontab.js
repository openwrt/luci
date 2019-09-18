'use strict';
'require rpc';

return L.view.extend({
	callFileRead: rpc.declare({
		object: 'file',
		method: 'read',
		params: [ 'path' ],
		expect: { data: '' }
	}),

	callFileWrite: rpc.declare({
		object: 'file',
		method: 'write',
		params: [ 'path', 'data' ]
	}),

	load: function() {
		return this.callFileRead('/etc/crontabs/root');
	},

	handleSave: function(ev) {
		var value = (document.querySelector('textarea').value || '').trim().replace(/\r\n/g, '\n') + '\n';

		return this.callFileWrite('/etc/crontabs/root', value).then(function(rc) {
			if (rc != 0)
				throw rpc.getStatusText(rc);

			document.querySelector('textarea').value = value;
			L.ui.addNotification(null, E('p', _('Contents have been saved.')), 'info');

		}).catch(function(e) {
			L.ui.addNotification(null, E('p', _('Unable to save contents: %s').format(e)));
		});
	},

	render: function(crontab) {
		return E([
			E('h2', _('Scheduled Tasks')),
			E('p', {},
				_('This is the system crontab in which scheduled tasks can be defined.') +
				_('<br/>Note: you need to manually restart the cron service if the crontab file was empty before editing.')),
			E('p', {}, E('textarea', { 'style': 'width:100%', 'rows': 10 }, crontab != null ? crontab : ''))
		]);
	},

	handleSaveApply: null,
	handleReset: null
});
