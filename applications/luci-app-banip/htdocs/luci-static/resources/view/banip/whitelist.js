'use strict';
'require view';
'require fs';
'require ui';

return view.extend({
	load: function() {
		return L.resolveDefault(fs.read_direct('/etc/banip/banip.whitelist'), '');
	},
	handleSave: function(ev) {
		var value = ((document.querySelector('textarea').value || '').trim().toLowerCase().replace(/\r\n/g, '\n')) + '\n';
		return fs.write('/etc/banip/banip.whitelist', value)
			.then(function(rc) {
				document.querySelector('textarea').value = value;
				ui.addNotification(null, E('p', _('Whitelist changes have been saved. Refresh your banIP lists that changes take effect.')), 'info');
			}).catch(function(e) {
				ui.addNotification(null, E('p', _('Unable to save changes: %s').format(e.message)));
			});
	},
	render: function(whitelist) {
		return E([
			E('p', {},
				_('This is the local banIP whitelist to always allow certain IP/CIDR addresses.<br /> \
				<em><b>Please note:</b></em> add only one IPv4 address, IPv6 address or domain name per line. Comments introduced with \'#\' are allowed - wildcards and regex are not.')),
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
