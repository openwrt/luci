'use strict';
'require rpc';

return L.view.extend({
	callInitList: rpc.declare({
		object: 'luci',
		method: 'getInitList',
		expect: { '': {} }
	}),

	callInitAction: rpc.declare({
		object: 'luci',
		method: 'setInitAction',
		params: [ 'name', 'action' ],
		expect: { result: false }
	}),

	load: function() {
		return this.callInitList();
	},

	handleAction: function(name, action, ev) {
		return this.callInitAction(name, action).then(function(success) {
			if (success != true) {
				L.ui.addNotification(null, E('p', _('Failed to execute "/etc/init.d/%s %s" action').format(name, action)));
				return Promise.reject(false);
			}

			return true;
		}).catch(function() {
			L.ui.addNotification(null, E('p', _('Connection failure while executing "/etc/init.d/%s %s" action').format(name, action)));
			return Promise.reject(false);
		});
	},

	handleEnableDisable: function(name, isEnabled, ev) {
		return this.handleAction(name, isEnabled ? 'disable' : 'enable', ev).then(L.bind(function(name, isEnabled, cell) {
			L.dom.content(cell, this.renderEnableDisable({
				name: name,
				enabled: isEnabled
			}));
		}, this, name, !isEnabled, ev.currentTarget.parentNode));
	},

	renderEnableDisable: function(init) {
		return E('button', {
			class: 'btn cbi-button-%s'.format(init.enabled ? 'positive' : 'negative'),
			click: L.ui.createHandlerFn(this, 'handleEnableDisable', init.name, init.enabled)
		}, init.enabled ? _('Enabled') : _('Disabled'));
	},

	render: function(initList) {
		var table = E('div', { 'class': 'table' }, [
			E('div', { 'class': 'tr table-titles' }, [
				E('div', { 'class': 'th' }, _('Start priority')),
				E('div', { 'class': 'th' }, _('Initscript')),
				E('div', { 'class': 'th' }, _('Enable/Disable')),
				E('div', { 'class': 'th' }, _('Start')),
				E('div', { 'class': 'th' }, _('Restart')),
				E('div', { 'class': 'th' }, _('Stop'))
			])
		]);

		var rows = [], list = [];

		for (var init in initList)
			if (initList[init].index < 100)
				list.push(Object.assign({ name: init }, initList[init]));

		list.sort(function(a, b) {
			if (a.index != b.index)
				return a.index - b.index

			return a.name > b.name;
		});

		for (var i = 0; i < list.length; i++) {
			rows.push([
				'%02d'.format(list[i].index),
				list[i].name,
				this.renderEnableDisable(list[i]),
				E('button', { 'class': 'btn cbi-button-action', 'click': L.ui.createHandlerFn(this, 'handleAction', list[i].name, 'start') }, _('Start')),
				E('button', { 'class': 'btn cbi-button-action', 'click': L.ui.createHandlerFn(this, 'handleAction', list[i].name, 'restart') }, _('Restart')),
				E('button', { 'class': 'btn cbi-button-action', 'click': L.ui.createHandlerFn(this, 'handleAction', list[i].name, 'stop') }, _('Stop'))
			]);
		}

		cbi_update_table(table, rows);

		return table;
	}
});
