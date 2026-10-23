// SPDX-License-Identifier: MIT
'use strict';
/* global deviceDialog, groupDialog, preferences, service, table */
'require view';
'require ui';
'require device-manager.model as model';
'require device-manager.service as service';
'require device-manager.preferences as preferences';
'require device-manager.table as table';
'require device-manager.device-dialog as deviceDialog';
'require device-manager.group-dialog as groupDialog';

return view.extend({
	devices: [],
	groups: [],
	activeTab: 'online',
	activeGroup: 'all',
	maskInfo: false,
	filterText: '',
	readonly: true,
	sortKey: null,
	sortDir: 'asc',
	handleSave: null,
	handleSaveApply: null,
	handleReset: null,

	load: function() {
		return Promise.all([ service.load(), preferences.load() ])
			.then(data => ({ snapshot: data[0], preferences: data[1] }));
	},

	acceptData: function(data) {
		this.groups = model.parseGroups(data.groups);
		this.devices = model.parseDevices(data, this.groups);
		this.sourceErrors = data.errors || [];
		if (this.activeGroup !== 'all' && this.activeGroup !== 'ungrouped' && !this.getGroupById(this.activeGroup)) {
			this.activeGroup = 'all';
			preferences.save(this.activeTab, this.activeGroup, this.maskInfo);
		}
	},

	render: function(data) {
		const self = this;

		this.readonly = L.hasViewPermission() !== true;
		this.acceptData(data.snapshot);
		const savedView = data.preferences || {};
		this.activeTab = ['all', 'online', 'offline', 'unknown'].includes(savedView.tab) ? savedView.tab : 'online';
		this.activeGroup = (savedView.group === 'all' || savedView.group === 'ungrouped' || this.getGroupById(savedView.group)) ? savedView.group : 'all';
		this.maskInfo = Boolean(savedView.maskInfo);

		const sortHeader = (key, label, width, centered) => E('th', {
			'class': 'th dm-sortable' + (centered ? ' dm-type-th' : ''),
			'scope': 'col',
			'data-sort': key,
			'style': 'width:' + width + ';'
		}, [ E('button', {
			'type': 'button',
			'class': 'dm-header-content dm-sort-button',
			'title': _('Click to sort by %s').format(label),
			'click': function() { self.handleSort(key); }
		}, [
			E('span', { 'class': 'dm-sort-label' }, [ label ]),
			E('span', { 'class': 'dm-sort-icon', 'aria-hidden': 'true' })
		]) ]);

		const theadNode = E('thead', {}, [ E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th dm-index-column', 'scope': 'col', 'title': _('Row number') }, [
					E('span', { 'class': 'dm-header-content' }, [ _('#') ])
			]),
			sortHeader('type', _('Type'), '56px', true),
			sortHeader('name', _('Device name'), '24%'),
			sortHeader('ip', _('IP address'), '18%'),
			sortHeader('mac', _('MAC address'), '18%'),
			sortHeader('group', _('Group'), '14%'),
			E('th', { 'class': 'th', 'scope': 'col', 'style': 'width:14%;' }, [
				E('span', { 'class': 'dm-header-content' }, [ _('Remarks') ])
			]),
			E('th', { 'class': 'th dm-actions-column', 'scope': 'col' }, [
				E('span', { 'class': 'dm-header-content' }, [ _('Actions') ])
			])
		]) ]);

		const viewNode = E('div', { 'class': 'cbi-map' }, [
			E('link', { 'rel': 'stylesheet', 'href': L.resource('device-manager/styles.css') }),

			E('h2', {}, [ _('LAN Device Management') ]),
			E('div', { 'class': 'cbi-map-descr' }, [ _('Discover network devices and save custom names, remarks and groups by MAC address.') ]),

			E('div', { 'id': 'dm-source-warning', 'class': 'alert-message warning dm-source-warning', 'style': 'display:none;' }),

			// Row 1: Status Tabs
			E('div', { 'class': 'dm-status-tabs', 'id': 'dm-tabs-container', 'role': 'tablist', 'aria-label': _('Device status') }),

			// Row 2: Controls Toolbar
			E('div', { 'class': 'cbi-section dm-toolbar' }, [
				E('div', { 'class': 'dm-controls' }, [
					E('input', {
						'type': 'text',
						'id': 'dm-search-input',
						'class': 'cbi-input-text',
						'placeholder': _('Search names, IP, MAC, remarks or groups...'),
						'style': 'flex:1; min-width:200px; max-width:360px;',
						'value': self.filterText,
						'input': function(ev) {
							self.filterText = ev.target.value.trim().toLowerCase();
							self.updateView();
						}
					}),
					E('select', {
						'id': 'dm-group-select',
						'class': 'cbi-input-select',
						'style': 'min-width:140px;',
						'change': function(ev) {
							self.activeGroup = ev.target.value;
							preferences.save(self.activeTab, self.activeGroup, self.maskInfo);
							self.updateView();
						}
					})
				]),
				E('div', { 'class': 'dm-btn-group' }, [
					E('button', { 'type': 'button',
						'class': 'cbi-button cbi-button-neutral',
						'disabled': self.readonly || null,
						'click': function() { self.showGroupModal(); }
					}, [ _('Manage groups') ]),
					E('button', { 'type': 'button',
						'class': 'cbi-button cbi-button-action dm-btn-blue',
						'disabled': self.readonly || null,
						'click': function() { self.showEditModal(null); }
					}, [ _('Add device') ]),
					E('button', { 'type': 'button',
						'class': 'cbi-button cbi-button-neutral',
						'id': 'dm-btn-mask',
						'title': _('Hide/Show MAC and IPv6'),
						'click': function() {
							self.maskInfo = !self.maskInfo;
							preferences.save(self.activeTab, self.activeGroup, self.maskInfo);
							self.updateView();
						}
					}, [ (self.maskInfo ? _('Show info') : _('Hide info')) ]),
					E('button', { 'type': 'button',
						'class': 'cbi-button cbi-button-neutral',
						'id': 'dm-btn-refresh',
						'click': function(ev) {
							const button = ev.currentTarget;
							button.classList.add('spinning');
							button.disabled = true;
							return self.refresh().finally(function() {
								button.classList.remove('spinning');
								button.disabled = false;
							});
						}
					}, [ _('Refresh list') ]),
					E('button', { 'type': 'button',
						'class': 'cbi-button cbi-button-neutral',
						'id': 'dm-btn-scan',
						'disabled': self.readonly || null,
						'title': _('Probe devices on the configured LAN interfaces'),
						'click': function(ev) {
							const button = ev.currentTarget;
							button.disabled = true;
							button.classList.add('spinning');
							return self.scan().finally(() => {
								button.disabled = self.readonly;
								button.classList.remove('spinning');
							});
						}
					}, [ _('Scan LAN') ])
				])
			]),

			// Row 3: Device Table
			E('div', { 'class': 'cbi-section' }, [
				E('div', { 'class': 'dm-table-wrapper' }, [
					E('table', { 'class': 'table dm-table', 'id': 'device_manager_table' }, [
						theadNode,
						E('tbody', { 'id': 'device_manager_tbody' })
					])
				])
			])
		]);

		this.tableHeadNode = theadNode;
		this.warningNode = viewNode.querySelector('#dm-source-warning');
		this.tabMenuNode = viewNode.querySelector('#dm-tabs-container');
		this.tableBodyNode = viewNode.querySelector('#device_manager_tbody');
		this.groupSelectNode = viewNode.querySelector('#dm-group-select');
		this.maskBtnNode = viewNode.querySelector('#dm-btn-mask');

		this.updateView();
		return viewNode;
	},

	getGroupById: function(id) { return this.groups.find(group => group.id === id) || null; },
	getGroupName: function(id) { return model.groupName(this.groups, id); },
	renderTabs: function() { return table.renderTabs.call(this); },
	renderGroupSelect: function() { return table.renderGroupSelect.call(this); },
	renderTable: function() { return table.renderTable.call(this); },
	renderDeviceRow: function(device, rowNumber) { return table.renderDeviceRow.call(this, device, rowNumber); },
	handleSort: function(key) { return table.handleSort.call(this, key); },
	updateSortHeaders: function() { return table.updateSortHeaders.call(this); },
	showEditModal: function(device) { return deviceDialog.showEditModal.call(this, device); },
	showDetailModal: function(device) { return deviceDialog.showDetailModal.call(this, device); },
	handlePingDevice: function(device) { return service.pingDevice(device.mac); },
	confirmDelete: function(device) { return deviceDialog.confirmDelete.call(this, device); },
	showGroupModal: function() { return groupDialog.showGroupModal.call(this); },
	promptRenameGroup: function(group) { return groupDialog.promptRenameGroup.call(this, group); },
	confirmDeleteGroup: function(group, count) { return groupDialog.confirmDeleteGroup.call(this, group, count); },
	handleSaveDevice: function(mac, name, remark, group, dev, type) { return service.saveDevice(mac, name, remark, group, type); },
	handleDeleteDevice: function(device) { return service.deleteDevice(device); },
	handleAddGroup: function(name) { return service.addGroup(name); },
	handleRenameGroup: function(id, name) { return service.renameGroup(id, name); },
	handleDeleteGroup: function(id) { return service.deleteGroup(id); },

	updateView: function() {
		this.renderTabs();
		this.renderGroupSelect();
		this.updateSortHeaders();
		if (this.maskBtnNode) {
			this.maskBtnNode.textContent = this.maskInfo ? _('Show info') : _('Hide info');
		}
		this.renderTable();
		if (this.warningNode) {
			this.warningNode.textContent = this.sourceErrors.length
				? _('Some device data could not be read. Unconfirmed devices are shown as unknown: %s').format(this.sourceErrors.join('; ')) : '';
			this.warningNode.style.display = this.sourceErrors.length ? '' : 'none';
		}
	},

	scan: function() {
		if (this.scanning) return this.scanning;
		this.scanning = service.scanDevices().then(() => this.refresh()).catch(error => {
			ui.addNotification(null, E('p', {}, [ _('Could not scan LAN devices: %s').format(error.message || error) ]), 'danger');
		}).finally(() => { this.scanning = null; });
		return this.scanning;
	},

	refresh: function() {
		if (this.refreshing) return this.refreshing;
		this.refreshing = service.load().then(data => {
			this.acceptData(data);
			this.updateView();
		}).catch(error => {
			ui.addNotification(null, E('p', {}, [ _('Could not refresh the device list: %s').format(error.message || error) ]), 'danger');
		}).finally(() => { this.refreshing = null; });
		return this.refreshing;
	}
});
