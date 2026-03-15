'use strict';
'require view';
'require fs';
'require ui';

const localFile = '/etc/banip/banip.blocklist';
const maxSize = 100000;
let notMsg = false;

const resetScroll = () => {
	document.body.scrollTop = document.documentElement.scrollTop = 0;
};

return view.extend({
	load: function () {
		return L.resolveDefault(fs.stat(localFile), null)
			.then(function (stat) {
				if (!stat) {
					return fs.write(localFile, "").then(() => [{ size: 0 }, ""]);
				}
				return Promise.all([
					Promise.resolve(stat),
					L.resolveDefault(fs.read_direct(localFile), "")
				]);
			});
	},

	render: function (blocklist) {
		const size = blocklist[0] ? blocklist[0].size : 0;
		const content = blocklist[1] != null ? blocklist[1] : '';
		const tooBig = size >= maxSize;

		if (tooBig) {
			resetScroll();
			ui.addNotification(null, E('p', _('The blocklist is too big, unable to save modifications.')), 'error');
		}
		return E('div', { 'class': 'cbi-section cbi-section-descr' }, [
			E('p', _('This is the local banIP blocklist that will prevent certain MAC-, IP-addresses or domain names.<br /> \
				<em><b>Please note:</b></em> add only exactly one MAC/IPv4/IPv6 address or domain name per line. Ranges in CIDR notation and MAC/IP-bindings are allowed.')),
			E('textarea', {
				'style': 'width: 100% !important; padding: 5px; font-family: monospace; margin-top: .4em',
				'spellcheck': 'false',
				'wrap': 'off',
				'rows': 25,
				'readonly': tooBig ? 'readonly' : null,
				'input': function () { notMsg = false; }
			}, [content])
		]);
	},

	handleSave: function (_ev) {
		const value = ((document.querySelector('textarea').value || '').trim().toLowerCase().replace(/\r\n?/g, '\n'));
		return fs.write(localFile, value + "\n")
			.then(function () {
				document.querySelector('textarea').value = value + "\n";
				resetScroll();
				if (!notMsg) {
					notMsg = true;
					ui.addNotification(null, E('p', _('Blocklist modifications have been saved, reload banIP that changes take effect.')), 'info');
				}
			}).catch(function (e) {
				resetScroll();
				ui.addNotification(null, E('p', _('Unable to save modifications: %s').format(e.message)), 'error');
			});
	},

	handleSaveApply: null,
	handleReset: null
});