'use strict';
'require view';
'require fs';
'require ui';

var isReadonlyView = !L.hasViewPermission() || null;

return view.extend({
	load: function() {
		return L.resolveDefault(fs.read('/etc/keepalived.user'), '');
	},

	handleSave: function(ev) {
		var value = (document.querySelector('textarea').value || '').trim().replace(/\r\n/g, '\n') + '\n';

		return fs.write('/etc/keepalived.user', value).then(function(rc) {
			document.querySelector('textarea').value = value;
			ui.addNotification(null, E('p', _('Contents have been saved.')), 'info');
		}).catch(function(e) {
			ui.addNotification(null, E('p', _('Unable to save contents: %s').format(e.message)));
		});
	},

	render: function(keepalived) {
		return E([
			E('h2', _('Keepalived.user')),
			E('p', { 'class': 'cbi-section-descr' }, _('This is the /etc/keepalived.user file in which custom commands can be defined.')),
			E('p', {}, E('textarea', { 'style': 'width:100%', 'rows': 25, 'disabled': isReadonlyView }, [ keepalived != null ? keepalived : '' ]))
		]);
	},

	handleSaveApply: null,
	handleReset: null
});


