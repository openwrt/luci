'use strict';
'require view';
'require fs';
'require ui';

let notMsg, errMsg;

return view.extend({
	load: function () {
		return Promise.all([
			L.resolveDefault(fs.stat('/etc/banip/banip.blocklist'), {}),
			L.resolveDefault(fs.read_direct('/etc/banip/banip.blocklist'), '')
		]);
	},
	handleSave: function (ev) {
		let value = ((document.querySelector('textarea').value || '').trim().toLowerCase().replace(/\r\n/g, '\n')) + '\n';
		return fs.write('/etc/banip/banip.blocklist', value)
			.then(function () {
				document.querySelector('textarea').value = value;
				document.body.scrollTop = document.documentElement.scrollTop = 0;
				if (!notMsg) {
					ui.addNotification(null, E('p', _('Blocklist modifications have been saved, reload banIP that changes take effect.')), 'info');
					notMsg = true;
				}
			}).catch(function (e) {
				document.body.scrollTop = document.documentElement.scrollTop = 0;
				if (!errMsg) {
					ui.addNotification(null, E('p', _('Unable to save modifications: %s').format(e.message)), 'error');
					errMsg = true;
				}
			});
	},
	render: function (blocklist) {
		if (blocklist[0].size >= 100000) {
			document.body.scrollTop = document.documentElement.scrollTop = 0;
			ui.addNotification(null, E('p', _('The blocklist is too big, unable to save modifications.')), 'error');
		}
		return E([
			E('p', {},
				_('This is the local banIP blocklist that will prevent certain MAC-, IP-addresses or domain names.<br /> \
				<em><b>Please note:</b></em> add only exactly one MAC/IPv4/IPv6 address or domain name per line. Ranges in CIDR notation and MAC/IP-bindings are allowed.')),
			E('p', {},
				E('textarea', {
					'style': 'width: 100% !important; padding: 5px; font-family: monospace',
					'spellcheck': 'false',
					'wrap': 'off',
					'rows': 25
				}, [blocklist[1] != null ? blocklist[1] : ''])
			)
		]);
	},
	handleSaveApply: null,
	handleReset: null
});
