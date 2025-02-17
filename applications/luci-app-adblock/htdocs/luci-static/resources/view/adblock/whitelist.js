'use strict';
'require view';
'require fs';
'require ui';

return view.extend({
	load: function() {
		return L.resolveDefault(fs.read_direct('/etc/adblock/adblock.whitelist'), '');
	},
	handleSave: function(ev) {
		var value = ((document.querySelector('textarea').value || '').trim().toLowerCase().replace(/\r\n/g, '\n')) + '\n';
		return fs.write('/etc/adblock/adblock.whitelist', value)
			.then(function(rc) {
				document.querySelector('textarea').value = value;
				ui.addNotification(null, E('p', _('The changes to the whitelist have been saved. Reload your adblock lists for the changes to take effect.')), 'info');
			}).catch(function(e) {
				ui.addNotification(null, E('p', _('Unable to save changes: %s').format(e.message)));
			});
	},
	render: function(whitelist) {
		return E([
			E('p', {},
				_('This is the local adblock whitelist to always allow certain (sub) domains.<br /> \
				Please note: add only one domain per line. Comments introduced with \'#\' are allowed - ip addresses, wildcards and regex are not.')),
			E('p', {},
				E('textarea', {
					'style': 'width: 100% !important; padding: 5px; font-family: monospace',
					'spellcheck': 'false',
					'wrap': 'off',
					'rows': 25
				}, [ whitelist != null ? whitelist : '' ])
			)
		]);
	},
	handleSaveApply: null,
	handleReset: null
});
