// SPDX-License-Identifier: MIT
'use strict';
'require baseclass';
'require ui';
'require device-manager.model as model';

return baseclass.extend({
	showGroupModal: function() {
		if (this.readonly) return;
		const self = this;

		// Calculate count of devices per group
		const groupCounts = new Map();
		for (let i = 0; i < this.devices.length; i++) {
			const g = this.devices[i].group;
			if (g && g !== 'ungrouped') {
				groupCounts.set(g, (groupCounts.get(g) || 0) + 1);
			}
		}

		const groupRows = this.groups.map(function(g) {
			const count = groupCounts.get(g.id) || 0;

			const btnRename = E('button', { 'type': 'button',
				'class': 'btn cbi-button cbi-button-neutral',
				'style': 'margin-right:6px;',
				'click': function() { self.promptRenameGroup(g); }
			}, [ _('Rename') ]);

			const btnDelete = E('button', { 'type': 'button',
				'class': 'btn cbi-button cbi-button-remove',
				'click': function() { self.confirmDeleteGroup(g, count); }
			}, [ _('Delete') ]);

			return E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td', 'style': 'font-weight:bold;' }, [ g.name ]),
				E('td', { 'class': 'td' }, E('code', {}, [ g.id ])),
				E('td', { 'class': 'td' }, [ _('%d devices').format(count) ]),
				E('td', { 'class': 'td', 'style': 'text-align:right;' }, [ btnRename, btnDelete ])
			]);
		});

		const newGroupInput = E('input', {
			'type': 'text',
			'class': 'cbi-input-text',
			'placeholder': _('e.g. Media devices, office devices'),
			'maxlength': 32,
			'style': 'width:240px; margin-right:8px;'
		});

		const errorDiv = E('div', {
			'class': 'alert-message danger',
			'style': 'display:none; margin-bottom:12px;'
		});

		const btnAddGroup = E('button', { 'type': 'button',
			'class': 'btn cbi-button cbi-button-positive',
			'click': function(ev) {
				const button = ev.currentTarget;
				const name = model.sanitizeInput(newGroupInput.value);
				if (!name) {
					errorDiv.textContent = _('Enter a valid group name');
					errorDiv.style.display = 'block';
					newGroupInput.focus();
					return;
				}

				// Check duplicate name
				if (self.groups.some(g => g.name === name)) {
					errorDiv.textContent = _('A group with this name already exists');
					errorDiv.style.display = 'block';
					newGroupInput.focus();
					return;
				}

				button.classList.add('spinning');
				button.disabled = true;

				return self.handleAddGroup(name)
					.then(function() {
						ui.hideModal();
						ui.addNotification(null, E('p', [ _('Group "%s" created.').format(name) ]), 'info');
						return self.refresh().then(function() {
							self.showGroupModal();
						});
					})
					.catch(function(err) {
						errorDiv.textContent = _('Could not create group: %s').format(err.message || err);
						errorDiv.style.display = 'block';
					})
					.finally(function() {
						button.classList.remove('spinning');
						button.disabled = false;
					});
			}
		}, [ _('Add group') ]);

		ui.showModal(_('Device groups'), [
			E('div', { 'class': 'cbi-section' }, [
				errorDiv,
				E('table', { 'class': 'table', 'style': 'width:100%; margin-bottom:20px;' }, [
					E('tr', { 'class': 'tr table-titles' }, [
						E('th', { 'class': 'th' }, [ _('Group name') ]),
						E('th', { 'class': 'th' }, [ _('Group ID') ]),
						E('th', { 'class': 'th' }, [ _('Device count') ]),
						E('th', { 'class': 'th', 'style': 'text-align:right;' }, [ _('Actions') ])
					]),
					E('tbody', {}, groupRows)
				]),
				E('div', { 'class': 'cbi-value', 'style': 'padding-top:10px; border-top:1px solid #eee;' }, [
					E('label', { 'class': 'cbi-value-title' }, [ _('New group') ]),
					E('div', { 'class': 'cbi-value-field' }, [
						newGroupInput,
						btnAddGroup,
						E('div', { 'class': 'cbi-value-description' }, [ _('Group names support Unicode text and common symbols') ])
					])
				])
			]),
			E('div', { 'class': 'button-row', 'style': 'margin-top:20px; text-align:right;' }, [
				E('button', { 'type': 'button',
					'class': 'btn cbi-button',
					'click': ui.hideModal
				}, [ _('Close') ])
			])
		]);
	},

	promptRenameGroup: function(group) {
		if (this.readonly) return;
		const self = this;
		const nameInput = E('input', {
			'type': 'text',
			'class': 'cbi-input-text',
			'value': group.name,
			'maxlength': 32,
			'style': 'width:100%;'
		});

		const errorDiv = E('div', {
			'class': 'alert-message danger',
			'style': 'display:none; margin-bottom:12px;'
		});

		ui.showModal(_('Rename group'), [
			E('div', { 'class': 'cbi-section' }, [
				errorDiv,
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title' }, [ _('Current group name') ]),
					E('div', { 'class': 'cbi-value-field', 'style': 'padding-top:6px;' }, [ group.name ])
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title' }, [ _('New group name') ]),
					E('div', { 'class': 'cbi-value-field' }, [
						nameInput,
						E('div', { 'class': 'cbi-value-description' }, [ _('Renaming preserves the group ID and all device assignments') ])
					])
				])
			]),
			E('div', { 'class': 'button-row', 'style': 'margin-top:20px; text-align:right;' }, [
				E('button', { 'type': 'button', 'class': 'btn cbi-button', 'click': function() { self.showGroupModal(); } }, [ _('Cancel') ]),
				' ',
				E('button', { 'type': 'button',
					'class': 'btn cbi-button cbi-button-positive',
					'click': function(ev) {
						const button = ev.currentTarget;
						const newName = model.sanitizeInput(nameInput.value);
						if (!newName) {
							errorDiv.textContent = _('Enter a valid group name');
							errorDiv.style.display = 'block';
							nameInput.focus();
							return;
						}

						if (newName === group.name) {
							self.showGroupModal();
							return;
						}

						button.classList.add('spinning');
						button.disabled = true;

						return self.handleRenameGroup(group.id, newName)
							.then(function() {
								ui.addNotification(null, E('p', [ _('Group renamed to "%s".').format(newName) ]), 'info');
								return self.refresh().then(function() {
									self.showGroupModal();
								});
							})
							.catch(function(err) {
								errorDiv.textContent = _('Rename failed: %s').format(err.message || err);
								errorDiv.style.display = 'block';
							})
							.finally(function() {
								button.classList.remove('spinning');
								button.disabled = false;
							});
					}
				}, [ _('Save changes') ])
			])
		]);
	},

	confirmDeleteGroup: function(group, deviceCount) {
		if (this.readonly) return;
		const self = this;

		ui.showModal(_('Delete group'), [
			E('p', {}, [ _('Delete group "%s"?').format(group.name) ]),
			E('p', { 'class': 'cbi-value-description' }, [ _('The %d devices in this group will become ungrouped. Their names, MAC addresses and remarks will be preserved.').format(deviceCount) ]),
			E('div', { 'class': 'button-row', 'style': 'margin-top:20px; text-align:right;' }, [
				E('button', { 'type': 'button', 'class': 'btn cbi-button', 'click': function() { self.showGroupModal(); } }, [ _('Cancel') ]),
				' ',
				E('button', { 'type': 'button',
					'class': 'btn cbi-button cbi-button-remove',
					'click': function(ev) {
						const button = ev.currentTarget;
						button.classList.add('spinning');
						button.disabled = true;

						return self.handleDeleteGroup(group.id)
							.then(function() {
								ui.addNotification(null, E('p', [ _('Group "%s" deleted. Its devices are now ungrouped.').format(group.name) ]), 'info');
								return self.refresh().then(function() {
									self.showGroupModal();
								});
							})
							.catch(function(err) {
								ui.hideModal();
								ui.addNotification(null, E('p', [ _('Could not delete group: %s').format(err.message || err) ]), 'danger');
							}).finally(function() {
							button.classList.remove('spinning');
							button.disabled = false;
						});
					}
				}, [ _('Confirm delete') ])
			])
		]);
	}
});
