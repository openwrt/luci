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

	callFileRead: rpc.declare({
		object: 'file',
		method: 'read',
		params: [ 'path' ],
		expect: { data: '' }
	}),

	callFileWrite: rpc.declare({
		object: 'file',
		method: 'write',
		params: [ 'path', 'data' ]
	}),

	load: function() {
		return Promise.all([
			this.callFileRead('/etc/rc.local'),
			this.callInitList()
		]);
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

	handleSave: function(ev) {
		var value = document.querySelector('textarea').value || '';

		return this.callFileWrite('/etc/rc.local', value.replace(/\r\n/g, '\n')).then(function() {
			L.ui.addNotification(null, E('p', _('Contents have been saved.')), 'info');
		}, function() {
			L.ui.addNotification(null, E('p', _('Unable to save contents.')));
		});
	},

	renderEnableDisable: function(init) {
		return E('button', {
			class: 'btn cbi-button-%s'.format(init.enabled ? 'positive' : 'negative'),
			click: L.ui.createHandlerFn(this, 'handleEnableDisable', init.name, init.enabled)
		}, init.enabled ? _('Enabled') : _('Disabled'));
	},

	render: function(data) {
		var rcLocal = data[0],
		    initList = data[1],
		    rows = [], list = [];

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

		var view = E('div', {}, E('div', {}, [
			E('div', { 'data-tab': 'init', 'data-tab-title': _('Initscripts') }, [
				E('p', {}, _('You can enable or disable installed init scripts here. Changes will applied after a device reboot.<br /><strong>Warning: If you disable essential init scripts like "network", your device might become inaccessible!</strong>')),
				table
			]),
			E('div', { 'data-tab': 'rc', 'data-tab-title': _('Local Startup') }, [
				E('p', {}, _('This is the content of /etc/rc.local. Insert your own commands here (in front of \'exit 0\') to execute them at the end of the boot process.')),
				E('p', {}, E('textarea', { 'style': 'width:100%', 'rows': 20 }, rcLocal != null ? rcLocal : '')),
				E('div', { 'class': 'right' }, [
					E('button', {
						'class': 'btn cbi-button-positive important',
						'click': L.ui.createHandlerFn(this, 'handleSave')
					}, _('Save'))
				])
			])
		]));

		L.ui.tabs.initTabGroup(view.firstElementChild.childNodes);

		return view;
	}
});
