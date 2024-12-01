// This is free software, licensed under the Apache License, Version 2.0

'use strict';
'require poll';
'require view';
'require fs';
'require ui';
'require uci';
'require rpc';

var RefreshIfaces = "";
var RefreshTabs = ['s', 't', '5', 'h', 'd', 'm', 'y'];

const callServiceList = rpc.declare({
	object: 'service',
	method: 'list',
	params: [ 'name' ],
	expect: { '': {} }
});

var isReadonlyView = !L.hasViewPermission() || null;

function RefreshGraphs() {
	RefreshTabs.forEach(function (id) {
		RefreshIfaces.forEach(function (iface) {
			fs.exec_direct('/usr/bin/vnstati', [ '-' + id, '-i', iface, '-o', '-' ], 'blob').then(function(res) {
				document.getElementById('graph_' + id + '_' + iface).src = URL.createObjectURL(res);
			});
		});
	});
}

function IfacesResetData(ev) {
	ui.showModal(_('Delete data for ALL interfaces'), [
		E('p', _('The data will be removed from the database permanently. This cannot be undone.')),
		E('div', { 'class': 'right' }, [
			E('div', {
				'class': 'btn',
				'click': L.hideModal
			}, _('Cancel')),
			' ',
			E('div', {
				'class': 'btn cbi-button-negative',
				'click': function(ev) {
					var if_count = 0;

					RefreshIfaces.forEach(function (iface) {
						fs.exec_direct('/usr/bin/vnstat', [ '--remove', '-i', iface, '--force' ], 'blob').then(function() {
							fs.exec_direct('/usr/bin/vnstat', [ '--add', '-i', iface ], 'blob').then(function() {
								if_count++;
								if (if_count == RefreshIfaces.length) {
									RefreshGraphs();
								}
							});
						});
					});
					ui.hideModal();
				}
			}, _('Delete'))
		])
	]);
}	

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
			fs.exec_direct('/usr/bin/vnstati', [ '-'+style, '-i', iface, '-o', '-' ], 'blob').then(function(res) {
				var img = tab.querySelector('img[data-iface="%s"]'.format(iface));
				img.src = URL.createObjectURL(res);
				img.alt = _('Could not load graph, no data available: ') + iface;
				img.align = 'middle';
				img.style.visibility = 'visible';
				img.id = 'graph_' + style + '_' + iface;
				tab.firstElementChild.style.display = 'none';
			});
			tab.appendChild(E('span', {}, E('img', { 'data-iface': iface, 'style': 'visibility:hidden; margin:5px 10px' })));
		});

		return tab;
	},

	load: function() {
		return Promise.all([
			L.resolveDefault(callServiceList('vnstat'), {}),
			uci.load('vnstat'),
		]);
	},

	render: function(data) {
		var ifaces = uci.get_first('vnstat', 'vnstat', 'interface') || [];
		var isRunning = false;

		try {
			isRunning = data[0]['vnstat']['instances']['instance1']['running'];
		} catch (e) { }

		var view = E([], [
			E('h2', [_('vnStat Graphs')]),

			(isRunning == false) ? E('p', { 'class': 'alert-message warning' }, _('Warning: The service is not running, graphs will not be updated!')):E('p'),

			E('div', ifaces.length ? [
				this.renderTab(ifaces, 's', _('Summary')),
				this.renderTab(ifaces, 't', _('Top')),
				this.renderTab(ifaces, '5', _('5 Minute')),
				this.renderTab(ifaces, 'h', _('Hourly')),
				this.renderTab(ifaces, 'd', _('Daily')),
				this.renderTab(ifaces, 'm', _('Monthly')),
				this.renderTab(ifaces, 'y', _('Yearly')),
			] : [ E('em', [_('No monitored interfaces have been found. Go to the configuration to enable monitoring for one or more interfaces.')]) ]),
		]);

		if (ifaces.length) {
			ui.tabs.initTabGroup(view.lastElementChild.childNodes);

			view.appendChild(E('div', { 'class': 'right' }, [
				E('br'),
				E('button', {
					'class': 'cbi-button cbi-button-neutral',
					'click': IfacesResetData,
					'disabled': isReadonlyView
				}, [ _('Clear data for all interfaces') ])
			]));
		}

		// Preserve the interfaces for the poll/refresh function
		RefreshIfaces = ifaces;

		poll.add(RefreshGraphs, 60);

		return view;
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
