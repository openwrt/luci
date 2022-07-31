/* SPDX-License-Identifier: GPL-3.0-only
 *
 * Copyright (C) 2022 ImmortalWrt.org
 */

'use strict';
'require fs';
'require ui';
'require view';

return view.extend({
	load: function() {
		 return fs.exec('/sbin/ifconfig').then(function(res) {
			if (res.code !== 0 || !res.stdout || res.stdout.trim() === '') {
				ui.addNotification(null, E('p', {}, _('Unable to get interface info: %s.').format(res.message)));
				return '';
			}

			var interfaces = res.stdout.match(/zt[a-z0-9]+/g);
			if (!interfaces || interfaces.length === 0)
				return 'No interface online.';

			var promises = [];
			for (var i in interfaces)
				promises.push(L.resolveDefault(fs.exec('/sbin/ifconfig', [interfaces[i]])));

			return Promise.all(promises).then(function (res) {
				var info = '';
				for (var i in res) {
					if (res[i].code !== 0 || !res[i].stdout || res[i].stdout.trim() === '')
						ui.addNotification(null, E('p', {}, _('Unable to get interface %s info: %s.').format(interfaces[i], res[i].message)));
					else
						info += res[i].stdout;
				}

				return info;
			});
		});
	},

	render: function(info) {
		var infolines = info.trim().split(/\n/);

		return E([], [
			E('div', { 'id': 'content_interfaces' }, [
				E('textarea', {
					'id': 'syslog',
					'class': 'cbi-input-textarea',
					'style': 'font-size:13px',
					'readonly': 'readonly',
					'wrap': 'off',
					'rows': infolines.length + 1
				}, [ infolines.join('\n') ])
			])
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
