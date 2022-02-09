'use strict';
'require view';
'require fs';
'require ui';

return view.extend({
	load: function() {
		return L.resolveDefault(fs.read_direct('/etc/banip/banip.maclist'), '');
	},
	handleSave: function(ev) {
		var value = ((document.querySelector('textarea').value || '').trim().toUpperCase().replace(/\r\n/g, '\n')) + '\n';
		return fs.write('/etc/banip/banip.maclist', value)
			.then(function(rc) {
				document.querySelector('textarea').value = value;
				ui.addNotification(null, E('p', _('Maclist changes have been saved. Refresh your banIP lists that changes take effect.')), 'info');
			}).catch(function(e) {
				ui.addNotification(null, E('p', _('Unable to save changes: %s').format(e.message)));
			});
	},
	render: function(blacklist) {
		return E([
			E('p', {},
				_('This is the local banIP maclist to always-allow certain MAC addresses.<br /> \
				<em><b>Please note:</b></em> add only one MAC address per line. Comments introduced with \'#\' are allowed - domains, wildcards and regex are not.')),
			E('p', {},
				E('textarea', {
					'style': 'width: 100% !important; padding: 5px; font-family: monospace',
					'spellcheck': 'false',
					'wrap': 'off',
					'rows': 25
				}, [ blacklist != null ? blacklist : '' ])
			)
		]);
	},
	handleSaveApply: null,
	handleReset: null
});
