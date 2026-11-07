// SPDX-License-Identifier: MIT
'use strict';
/* global preferences */
'require baseclass';
'require device-manager.model as model';
'require dom';
'require device-manager.preferences as preferences';

return baseclass.extend({
	renderTabs: function() {
		if (!this.tabMenuNode) return;
		dom.content(this.tabMenuNode, null);

		const self = this;

		const matching = this.devices.filter(device => model.matchesDevice(device, this.groups, this.activeGroup, this.filterText));
		const total = matching.length;
		const online = matching.filter(device => device.status === 'online').length;
		const offline = matching.filter(device => device.status === 'offline').length;
		const unknown = total - online - offline;

		const tabs = [
			{ key: 'online',  label: _('Online devices'), count: online },
			{ key: 'all',     label: _('All devices'), count: total },
			{ key: 'offline', label: _('Offline devices'), count: offline },
			{ key: 'unknown', label: _('Unknown'), count: unknown }
		];

		tabs.forEach(function(t) {
			const isActive = (self.activeTab === t.key);
			const tabItem = E('button', {
				'type': 'button',
				'role': 'tab',
				'data-tab': t.key,
				'aria-selected': String(isActive),
				'class': 'dm-status-tab' + (isActive ? ' active' : ''),
				'click': function() {
					self.activeTab = t.key;
					preferences.save(self.activeTab, self.activeGroup, self.maskInfo);
					self.updateView();
					const current = Array.from(self.tabMenuNode.children).find(node => node.getAttribute('data-tab') === t.key);
					if (current) current.focus();
				}
			}, [
				t.label,
				E('span', { 'class': 'dm-tab-count' }, [ t.count ])
			]);
			self.tabMenuNode.appendChild(tabItem);
		});
	},

	renderGroupSelect: function() {
		if (!this.groupSelectNode) return;
		dom.content(this.groupSelectNode, null);

		const self = this;
		const options = [
			E('option', { 'value': 'all' }, [ _('All groups') ])
		];

		// Count devices per group
		const groupCounts = new Map();
		let ungroupedCount = 0;

		for (let i = 0; i < this.devices.length; i++) {
			const g = this.devices[i].group;
			if (!g || g === 'ungrouped') {
				ungroupedCount++;
			} else {
				groupCounts.set(g, (groupCounts.get(g) || 0) + 1);
			}
		}

		for (let i = 0; i < this.groups.length; i++) {
			const g = this.groups[i];
			const count = groupCounts.get(g.id) || 0;
			const opt = E('option', { 'value': g.id }, [ '%s (%d)'.format(g.name, count) ]);
			if (self.activeGroup === g.id) opt.selected = true;
			options.push(opt);
		}

		const ungroupedOpt = E('option', { 'value': 'ungrouped' }, [ '%s (%d)'.format(_('Ungrouped'), ungroupedCount) ]);
		if (self.activeGroup === 'ungrouped') ungroupedOpt.selected = true;
		options.push(ungroupedOpt);

		dom.content(this.groupSelectNode, options);
	},

	handleSort: function(key) {
		if (this.sortKey === key) {
			this.sortDir = (this.sortDir === 'asc') ? 'desc' : 'asc';
		} else {
			this.sortKey = key;
			this.sortDir = 'asc';
		}
		this.updateSortHeaders();
		this.renderTable();
	},

	updateSortHeaders: function() {
		if (!this.tableHeadNode) return;
		const ths = this.tableHeadNode.querySelectorAll('th');
		for (let i = 0; i < ths.length; i++) {
			const th = ths[i];
			const col = th.getAttribute('data-sort');
			if (!col) continue;
			const isCurrent = (col === this.sortKey);
			th.classList.remove('sorted-asc');
			th.classList.remove('sorted-desc');
			if (isCurrent) {
				th.classList.add(this.sortDir === 'asc' ? 'sorted-asc' : 'sorted-desc');
				if (typeof th.setAttribute === 'function') {
					th.setAttribute('aria-sort', this.sortDir === 'asc' ? 'ascending' : 'descending');
				} else if (th.attrs) {
					th.attrs['aria-sort'] = this.sortDir === 'asc' ? 'ascending' : 'descending';
				}
			} else {
				if (typeof th.setAttribute === 'function') {
					th.setAttribute('aria-sort', 'none');
				} else if (th.attrs) {
					th.attrs['aria-sort'] = 'none';
				}
			}
		}
	},

	renderTable: function() {
		if (!this.tableBodyNode) return;
		dom.content(this.tableBodyNode, null);

		const filtered = this.devices.filter(device =>
			(this.activeTab === 'all' || device.status === this.activeTab) &&
			model.matchesDevice(device, this.groups, this.activeGroup, this.filterText));

		if (filtered.length === 0) {
			let emptyMsg = _('No devices found. Refresh the list to try again.');
			if (this.filterText)
				emptyMsg = _('No devices match "%s"').format(this.filterText);
			else if (this.activeTab === 'online')
				emptyMsg = _('No online devices');
			else if (this.activeTab === 'offline')
				emptyMsg = _('No offline devices');
			else if (this.activeTab === 'unknown')
				emptyMsg = _('No devices with unknown status');
			else if (this.activeGroup !== 'all')
				emptyMsg = _('No devices in this group');

			this.tableBodyNode.appendChild(E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td', 'colspan': 8, 'style': 'text-align:center; padding:36px 16px; color:#888;' }, [ emptyMsg ])
			]));
			return;
		}

		const sorted = model.sortDevices(filtered, this.sortKey, this.sortDir, id => this.getGroupName(id));

		for (let i = 0; i < sorted.length; i++) {
			this.tableBodyNode.appendChild(this.renderDeviceRow(sorted[i], i + 1));
		}
	},

	renderDeviceRow: function(dev, rowNumber) {
		const self = this;

		// 0. Device type icon column
		const typeInfo = model.getTypeInfo(dev.type);
		const typeLabel = model.getTypeLabel(dev.type);
		const iconNode = E('span', {
			'class': 'dm-device-icon-wrap',
			'title': typeLabel
		}, [
			E('img', {
				'class': 'dm-device-icon',
				'src': L.resource('device-manager/device-icons/' + typeInfo.icon),
				'alt': typeLabel
			})
		]);

		// 1. Device name column
		const displayName = dev.customName || dev.hostname || _('Unknown device');

		// Status dot with tooltip explanation (no text displayed)
		let dotClass = 'dm-status-dot-unknown';
		let statusLabel = _('Unknown');

		if (dev.status === 'online') {
			dotClass = 'dm-status-dot-online';
			statusLabel = _('Online');
		} else if (dev.status === 'offline') {
			dotClass = 'dm-status-dot-offline';
			statusLabel = _('Offline');
		}

		const statusTooltip = dev.statusDetail ? (statusLabel + ': ' + dev.statusDetail) : statusLabel;

		const nameChildren = [
			E('div', { 'class': 'dm-device-title-row' }, [
				E('span', {
					'class': 'dm-status-dot ' + dotClass,
					'title': statusTooltip
				}),
				E('span', { 'class': 'dm-device-title' }, [ displayName ])
			])
		];

		if (dev.customName && dev.hostname && dev.customName !== dev.hostname) {
			nameChildren.push(E('div', { 'class': 'dm-device-subtitle' }, [ dev.hostname ]));
		}

		// 2. IP address column
		const ipChildren = [];
		if (dev.ipv4) {
			ipChildren.push(E('div', {}, [ dev.ipv4 ]));
		} else {
			ipChildren.push(E('div', { 'style': 'color:#999;' }, [ '—' ]));
		}
		if (dev.ipv6) {
			const displayIpv6 = (this.maskInfo && dev.ipv6) ? dev.ipv6.replace(/[0-9a-fA-F]/g, '*') : dev.ipv6;
			ipChildren.push(E('div', {
				'class': 'dm-device-subtitle',
				'title': displayIpv6,
				'style': 'max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;'
			}, [ displayIpv6 ]));
		}

		// 3. MAC address column
		const displayMac = (this.maskInfo && dev.mac) ? dev.mac.replace(/[0-9a-fA-F]/g, '*') : dev.mac;
		const macNode = E('span', { 'class': 'dm-mac-code' }, [ displayMac ]);

		// 4. Group column
		const groupName = this.getGroupName(dev.group);
		const groupNode = (dev.group && dev.group !== 'ungrouped')
			? E('span', { 'class': 'dm-group-badge' }, [ groupName ])
			: null;

		// 5. Remark column
		const remarkNode = dev.remark
			? E('span', {}, [ dev.remark ])
			: null;

		// 6. Action column
		const actionLink = (label, className, action) => E('a', {
			'href': '#',
			'role': 'button',
			'class': 'dm-action-link ' + className,
			'click': function(ev) {
				ev.preventDefault();
				return action();
			},
			'keydown': function(ev) {
				if (ev.key === ' ') {
					ev.preventDefault();
					return action();
				}
			}
		}, [ label ]);
		const actions = [ actionLink(_('View'), 'dm-action-detail', () => self.showDetailModal(dev)) ];
		if (!self.readonly) actions.push(actionLink(_('Edit'), 'dm-action-edit', () => self.showEditModal(dev)));

		return E('tr', { 'class': 'tr' }, [
			E('td', { 'class': 'td dm-index-column' }, [ rowNumber == null ? '' : String(rowNumber) ]),
			E('td', { 'class': 'td dm-type-cell', 'style': 'text-align:center; vertical-align:middle;' }, [ iconNode ]),
			E('td', { 'class': 'td' }, nameChildren),
			E('td', { 'class': 'td' }, ipChildren),
			E('td', { 'class': 'td' }, macNode),
			E('td', { 'class': 'td' }, groupNode),
			E('td', { 'class': 'td' }, remarkNode),
			E('td', { 'class': 'td dm-actions dm-actions-column' }, [
				E('div', { 'class': 'dm-action-links' }, actions)
			])
		]);
	}
});
