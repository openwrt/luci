'use strict';
'require view';
'require rpc';
'require fs';
'require ui';

var isReadonlyView = !L.hasViewPermission() || null;

return view.extend({
	callRcList: rpc.declare({
		object: 'rc',
		method: 'list',
		expect: { '': {} }
	}),

	callRcInit: rpc.declare({
		object: 'rc',
		method: 'init',
		params: [ 'name', 'action' ],
	}),

	load: function() {
		return Promise.all([
			L.resolveDefault(fs.read('/etc/rc.local'), ''),
			this.callRcList()
		]);
	},

	handleAction: function(name, action, ev) {
		return this.callRcInit(name, action).then(function(ret) {
			if (ret)
				throw _('Command failed');

			return true;
		}).catch(function(e) {
			ui.addNotification(null, E('p', _('Failed to execute "/etc/init.d/%s %s" action: %s').format(name, action, e)));
		});
	},

	handleEnableDisable: function(name, isEnabled, ev) {
		return this.handleAction(name, isEnabled ? 'disable' : 'enable', ev).then(L.bind(function(name, isEnabled, btn) {
			btn.parentNode.replaceChild(this.renderEnableDisable({
				name: name,
				enabled: isEnabled
			}), btn);
		}, this, name, !isEnabled, ev.currentTarget));
	},

	handleRcLocalSave: function(ev) {
		var value = (document.querySelector('textarea').value || '').trim().replace(/\r\n/g, '\n') + '\n';

		return fs.write('/etc/rc.local', value).then(function() {
			document.querySelector('textarea').value = value;
			ui.addNotification(null, E('p', _('Contents have been saved.')), 'info');
		}).catch(function(e) {
			ui.addNotification(null, E('p', _('Unable to save contents: %s').format(e.message)));
		});
	},

	renderEnableDisable: function(init) {
		return E('button', {
			class: 'btn cbi-button-%s'.format(init.enabled ? 'positive' : 'negative'),
			click: ui.createHandlerFn(this, 'handleEnableDisable', init.name, init.enabled),
			disabled: isReadonlyView
		}, init.enabled ? _('Enabled') : _('Disabled'));
	},

	render: function(data) {
		var rcLocal = data[0],
		    initList = data[1],
		    rows = [], list = [];

		var table = E('table', { 'class': 'table' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th' }, _('Start priority')),
				E('th', { 'class': 'th' }, _('Initscript')),
				E('th', { 'class': 'th nowrap cbi-section-actions' })
			])
		]);

		for (var init in initList)
			if (initList[init].start < 100)
				list.push(Object.assign({ name: init }, initList[init]));

		list.sort(function(a, b) {
			if (a.start != b.start)
				return a.start - b.start

			return a.name > b.name;
		});

		for (var i = 0; i < list.length; i++) {
			rows.push([
				'%02d'.format(list[i].start),
				list[i].name,
				E('div', [
					this.renderEnableDisable(list[i]),
					E('button', { 'class': 'btn cbi-button-action', 'click': ui.createHandlerFn(this, 'handleAction', list[i].name, 'start'), 'disabled': isReadonlyView }, _('Start')),
					E('button', { 'class': 'btn cbi-button-action', 'click': ui.createHandlerFn(this, 'handleAction', list[i].name, 'restart'), 'disabled': isReadonlyView }, _('Restart')),
					E('button', { 'class': 'btn cbi-button-action', 'click': ui.createHandlerFn(this, 'handleAction', list[i].name, 'stop'), 'disabled': isReadonlyView }, _('Stop'))
				])
			]);
		}

		cbi_update_table(table, rows);

		var view = E('div', {}, [
			E('h2', _('Startup')),
			E('div', {}, [
				E('div', { 'data-tab': 'init', 'data-tab-title': _('Initscripts') }, [
					E('p', {}, _('You can enable or disable installed init scripts here. Changes will applied after a device reboot.<br /><strong>Warning: If you disable essential init scripts like "network", your device might become inaccessible!</strong>')),
					table
				]),
				E('div', { 'data-tab': 'rc', 'data-tab-title': _('Local Startup') }, [
					E('p', {}, _('This is the content of /etc/rc.local. Insert your own commands here (in front of \'exit 0\') to execute them at the end of the boot process.')),
					E('p', {}, E('textarea', { 'style': 'width:100%', 'rows': 20, 'disabled': isReadonlyView }, [ (rcLocal != null ? rcLocal : '') ])),
					E('div', { 'class': 'cbi-page-actions' }, [
						E('button', {
							'class': 'btn cbi-button-save',
							'click': ui.createHandlerFn(this, 'handleRcLocalSave'),
							'disabled': isReadonlyView
						}, _('Save'))
					])
				])
			])
		]);

		ui.tabs.initTabGroup(view.lastElementChild.childNodes);

		return view;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
