'use strict';
'require view';
'require ui';
'require fs';

return view.extend({
	load: function() {
		return fs.trimmed('/proc/sys/kernel/hostname');
	},

	handleArchiveUpload: function(ev) {
		return ui.uploadFile('/tmp/nlbw-restore.tar.gz').then(function() {
			return fs.exec('/usr/libexec/nlbwmon-action', [ 'restore' ]).then(function(res) {
				if (res.code != 0)
					throw new Error(res.stderr || res.stdout);

				var json = JSON.parse(res.stdout || '{}'),
				    list = (L.isObject(json) && Array.isArray(json.restored)) ? json.restored : [];

				ui.showModal(_('Restore complete'), [
					E('p', [ _('The following database files have been restored:') ]),
					E('ul', list.map(function(file) { return E('li', [ file ]) })),
					E('div', { 'class': 'right' }, [
						E('button', { 'click': ui.hideModal }, [ _('Dismiss') ])
					])
				]);
			}).catch(function(err) {
				ui.addNotification(null, E('p', [ _('Failed to restore backup archive: %s').format(err.message) ]));
			});
		});
	},

	handleArchiveDownload: function(hostname, ev) {
		return fs.exec_direct('/usr/libexec/nlbwmon-action', [ 'backup' ], 'blob').then(function(blob) {
			var url = window.URL.createObjectURL(blob),
			    date = new Date(),
			    name = 'nlbwmon-backup-%s-%04d-%02d-%02d.tar.gz'.format(hostname, date.getFullYear(), date.getMonth() + 1, date.getDate()),
			    link = E('a', { 'style': 'display:none', 'href': url, 'download': name });

			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			window.URL.revokeObjectURL(url);
		}).catch(function(err) {
			ui.addNotification(null, E('p', [ _('Failed to download backup archive: %s').format(err.message) ]));
		});
	},

	render: function(hostname) {
		return E([], [
			E('h2', [ _('Netlink Bandwidth Monitor - Backup / Restore') ]),
			E('h5', [ _('Restore Database Backup') ]),
			E('p', [
				E('button', {
					'class': 'cbi-button',
					'click': ui.createHandlerFn(this, 'handleArchiveUpload')
				}, [ _('Restore') ])
			]),
			E('h5', [ _('Download Database Backup') ]),
			E('p', [
				E('button', {
					'class': 'cbi-button',
					'click': ui.createHandlerFn(this, 'handleArchiveDownload', hostname)
				}, [ _('Generate Backup') ])
			])
		]);
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
