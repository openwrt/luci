// SPDX-License-Identifier: MIT
'use strict';
/* global deviceDialog, feedback, groupDialog, onlineCheck, preferences, service, table */
'require view';
'require ui';
'require device-manager.model as model';
'require device-manager.service as service';
'require device-manager.preferences as preferences';
'require device-manager.table as table';
'require device-manager.device-dialog as deviceDialog';
'require device-manager.group-dialog as groupDialog';
'require device-manager.feedback as feedback';
'require device-manager.online-check as onlineCheck';

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
		return Promise.all([ service.loadCached(true), preferences.load() ])
			.then(data => Object.assign({ preferences: data[1] }, data[0]));
	},

	acceptData: function(data) {
		this.groups = model.parseGroups(data.groups);
		this.devices = model.parseDevices(data, this.groups);
		this.checkingOnline = !this.showingCache && this.devices.some(device => device.status === 'unknown' && (device.ipv4 || device.ipv6));
		this.sourceErrors = data.errors || [];
		if (this.activeGroup !== 'all' && this.activeGroup !== 'ungrouped' && !this.getGroupById(this.activeGroup)) {
			this.activeGroup = 'all';
			preferences.save(this.activeTab, this.activeGroup, this.maskInfo);
		}
	},

	render: function(data) {
		const self = this;

		this.readonly = L.hasViewPermission() !== true;
		this.hasSnapshot = Boolean(data.snapshot);
		this.initialLoading = !this.hasSnapshot;
		this.loadFailed = false;
		this.listRefreshing = false;
		this.checkingOnline = false;
		this.showingCache = Boolean(data.cached);
		this.cacheRefreshFailed = false;
		if (this.sourceWarning) this.sourceWarning.destroy();
		this.sourceWarning = feedback.createWarning();
		if (data.snapshot) this.acceptData(data.snapshot);
		else { this.devices = []; this.groups = []; this.sourceErrors = []; }
		const savedView = data.preferences || {};
		this.activeTab = ['all', 'online', 'offline', 'unknown'].includes(savedView.tab) ? savedView.tab : 'online';
		this.activeGroup = this.initialLoading ? (savedView.group || 'all')
			: (savedView.group === 'all' || savedView.group === 'ungrouped' || this.getGroupById(savedView.group)) ? savedView.group : 'all';
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

			E('div', { 'id': 'dm-cache-status', 'class': 'cbi-map-descr', 'role': 'status', 'style': 'display:none;' }),
			this.sourceWarning.node,

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
						'class': 'cbi-button cbi-button-neutral dm-requires-data',
						'disabled': self.readonly || self.initialLoading || null,
						'click': function() { self.showGroupModal(); }
					}, [ _('Manage groups') ]),
					E('button', { 'type': 'button',
						'class': 'cbi-button cbi-button-action dm-btn-blue dm-requires-data',
						'disabled': self.readonly || self.initialLoading || null,
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
		this.cacheStatusNode = viewNode.querySelector('#dm-cache-status');
		this.tabMenuNode = viewNode.querySelector('#dm-tabs-container');
		this.tableBodyNode = viewNode.querySelector('#device_manager_tbody');
		this.groupSelectNode = viewNode.querySelector('#dm-group-select');
		this.maskBtnNode = viewNode.querySelector('#dm-btn-mask');
		this.dataActionButtons = viewNode.querySelectorAll('.dm-requires-data');

		this.updateView();
		clearTimeout(this.loadTimer);
		this.loadTimer = setTimeout(() => this.initialLoading || this.showingCache ? this.refresh() : this.confirmUnknownDevices(), 0);
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
	handlePingDevice: function(device) {
		return service.pingDevice(device.mac).then(reply => {
			// A reply for an older snapshot must not change the current list.
			if (reply.reachable && device.status === 'unknown' && this.devices.includes(device)) {
				device.status = 'online';
				device.statusDetail = _('Online · Ping replied');
				this.updateView();
			}
			return reply;
		});
	},
	confirmUnknownDevices: function() {
		const devices = this.devices;
		if (this.initialLoading || this.showingCache || this.confirmingDevices === devices) return this.confirming || Promise.resolve();
		this.confirmingDevices = devices;
		this.confirming = onlineCheck.run(devices, device => this.handlePingDevice(device),
			() => this.devices === devices && !this.showingCache).finally(() => {
			if (this.devices === devices) {
				this.checkingOnline = false;
				this.updateView();
			}
		});
		return this.confirming;
	},
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
		if (this.groupSelectNode) this.groupSelectNode.disabled = this.initialLoading;
		for (const button of this.dataActionButtons || []) button.disabled = this.readonly || !this.hasSnapshot;
		this.updateSortHeaders();
		if (this.maskBtnNode) {
			this.maskBtnNode.textContent = this.maskInfo ? _('Show info') : _('Hide info');
		}
		this.renderTable();
		if (this.sourceWarning) this.sourceWarning.update(this.sourceErrors);
		if (this.cacheStatusNode) {
			this.cacheStatusNode.textContent = this.showingCache && this.cacheRefreshFailed
				? _('Showing cached device data. Refresh to retry.') : '';
			this.cacheStatusNode.style.display = this.showingCache && this.cacheRefreshFailed ? '' : 'none';
		}
	},

	scan: function() {
		if (this.scanning) return this.scanning;
		this.scanning = service.scanDevices().then(() => this.refresh()).catch(error => {
			feedback.notify(_('Could not scan LAN devices: %s').format(error.message || error), 'danger');
		}).finally(() => { this.scanning = null; });
		return this.scanning;
	},

	refresh: function() {
		if (this.refreshing) return this.refreshing;
		clearTimeout(this.loadTimer);
		this.loadTimer = null;
		this.listRefreshing = true;
		if (!this.hasSnapshot) {
			this.initialLoading = true;
			this.loadFailed = false;
		}
		this.updateView();
		this.refreshing = service.load().then(data => {
			this.listRefreshing = false;
			this.initialLoading = false;
			this.loadFailed = false;
			this.hasSnapshot = true;
			this.showingCache = false;
			this.cacheRefreshFailed = false;
			this.acceptData(data);
			this.updateView();
			this.loadTimer = setTimeout(() => this.confirmUnknownDevices(), 0);
		}).catch(error => {
			this.listRefreshing = false;
			this.checkingOnline = false;
			this.initialLoading = false;
			this.loadFailed = true;
			this.cacheRefreshFailed = true;
			this.updateView();
			feedback.notify(_('Could not refresh the device list: %s').format(error.message || error), 'danger');
		}).finally(() => { this.refreshing = null; });
		return this.refreshing;
	}
});
