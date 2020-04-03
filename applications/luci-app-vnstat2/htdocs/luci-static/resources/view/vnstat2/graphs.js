// This is free software, licensed under the Apache License, Version 2.0

'use strict';
'require view';
'require fs';
'require ui';

return view.extend({
	renderTab: function(ifaces, style, title) {
		var tab = E('div', {
			'class': 'cbi-section',
			'data-tab': style,
			'data-tab-title': title
		}, [
			E('p', {}, E('em', { 'class': 'spinning' }, [ _('Loading graphs…') ]))
		]);

		ifaces.forEach(function(iface) {
			tab.appendChild(E('p', {}, E('img', { 'data-iface': iface, 'style': 'display:none' })));
			fs.exec_direct('/usr/bin/vnstati', [ '-'+style, '-i', iface, '-o', '-' ], 'blob').then(function(res) {
				var img = tab.querySelector('img[data-iface="%s"]'.format(iface));
				img.src = URL.createObjectURL(res);
				img.style.display = '';
				tab.firstElementChild.style.display = 'none';
			});
		});

		return tab;
	},

	load: function() {
		return fs.exec_direct('/usr/bin/vnstat', [ '--json', 'f', '1' ], 'text').then(function(res) {
			var json = null;

			try {
				json = JSON.parse(res)
			}
			catch(e) {
				throw new Error(res.replace(/^Error: /, ''));
			}

			return (L.isObject(json) ? L.toArray(json.interfaces) : []).map(function(iface) {
				return iface.name;
			}).sort();
		}).catch(function(err) {
			ui.addNotification(null, E('p', { 'style': 'white-space:pre' }, [err]));
			return [];
		});
	},

	render: function(ifaces) {
		var view = E([], [
			E('h2', [_('vnStat Graphs')]),
			E('div', ifaces.length ? [
				this.renderTab(ifaces, 's', _('Summary')),
				this.renderTab(ifaces, 't', _('Top')),
				this.renderTab(ifaces, '5', _('5 Minute')),
				this.renderTab(ifaces, 'h', _('Hourly')),
				this.renderTab(ifaces, 'd', _('Daily')),
				this.renderTab(ifaces, 'm', _('Monthly')),
				this.renderTab(ifaces, 'y', _('Yearly'))
			] : [ E('em', [_('No monitored interfaces have been found. Go to the configuration to enable monitoring for one or more interfaces.')]) ])
		]);

		if (ifaces.length)
			ui.tabs.initTabGroup(view.lastElementChild.childNodes);

		return view;
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
