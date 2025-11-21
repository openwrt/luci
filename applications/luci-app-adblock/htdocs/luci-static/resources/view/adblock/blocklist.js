'use strict';
'require view';
'require fs';
'require ui';

const localFile = '/etc/adblock/adblock.blocklist';
let notMsg = false, errMsg = false;

const resetScroll = () => {
	document.body.scrollTop = document.documentElement.scrollTop = 0;
};

return view.extend({
	load: function () {
		return L.resolveDefault(fs.stat(localFile), "")
			.then(function (stat) {
			if (!stat) {
				return fs.write(localFile, "");
			}
			return Promise.all([
				L.resolveDefault(fs.stat(localFile), ""),
				L.resolveDefault(fs.read_direct(localFile), "")
			]);
		});
	},
	render: function (blocklist) {
		if (blocklist[0] && blocklist[0].size >= 100000) {
			resetScroll();
			ui.addNotification(null, E('p', _('The blocklist is too big, unable to save modifications.')), 'error');
		}
		return E('div', { 'class': 'cbi-section cbi-section-descr' }, [
			E('p', _('This is the local adblock blocklist to always-block certain domains.<br /> \
				<em><b>Please note:</b></em> add only one domain per line. Comments introduced with \'#\' are allowed - ip addresses, wildcards and regex are not.')),
			E('textarea', {
				'style': 'min-height: 500px; max-height: 90vh; width: 100%; padding: 5px; font-family: monospace; resize: vertical;',
				'spellcheck': 'false',
				'wrap': 'off',
				'rows': 25
			}, [blocklist[1] != null ? blocklist[1] : ''])
		]);
	},
	handleSave: function (ev) {
		let value = ((document.querySelector('textarea').value || '').trim().toLowerCase().replace(/[^a-z0-9\.\-# \r\n]/g, '').replace(/\r\n?/g, '\n'));
		return fs.write(localFile, value + "\n")
		.then(function () {
			document.querySelector('textarea').value = value;
			resetScroll();
			if (!notMsg) {
				ui.addNotification(null, E('p', _('Blocklist modifications have been saved, reload adblock that changes take effect.')), 'info');
				notMsg = true;
			}
		}).catch(function (e) {
			resetScroll();
			if (!errMsg) {
				ui.addNotification(null, E('p', _('Unable to save modifications: %s').format(e.message)), 'error');
				errMsg = true;
			}
		});
	},
	handleSaveApply: null,
	handleReset: null
});
