// SPDX-License-Identifier: MIT
'use strict';
'require baseclass';
'require ui';
'require device-manager.model as model';

function statusLabel(status) {
	return status === 'online' ? _('Online') : status === 'offline' ? _('Offline') : _('Unknown');
}

function closeButton() {
	return E('button', { 'type': 'button', 'class': 'dm-dialog-close',
		'aria-label': _('Close'), 'title': _('Close'), 'click': ui.hideModal
	}, [ '×' ]);
}

function deviceHero(dev) {
	const typeInfo = model.getTypeInfo(dev.type);
	return E('div', { 'class': 'dm-dialog-hero' }, [
		E('span', { 'class': 'dm-dialog-icon' }, [ E('img', {
			'src': L.resource('device-manager/device-icons/' + typeInfo.icon), 'alt': ''
		}) ]),
		E('div', { 'class': 'dm-dialog-heading' }, [
			E('strong', {}, [ dev.customName || dev.hostname || _('Unknown device') ]),
			E('span', { 'class': 'dm-dialog-muted' }, [ model.getTypeLabel(dev.type) ])
		]),
		E('span', { 'class': 'dm-dialog-status dm-dialog-status-' + dev.status }, [ statusLabel(dev.status) ])
	]);
}

function infoGrid(fields) {
	return E('div', { 'class': 'dm-info-grid' }, fields.map(field => E('div', {
		'class': 'dm-info-item' + (field[2] ? ' dm-info-wide' : '')
	}, [
		E('span', { 'class': 'dm-info-label' }, [ field[0] ]),
		E('div', { 'class': 'dm-info-value' }, [ field[1] || '—' ])
	])));
}

return baseclass.extend({
	showEditModal: function(dev) {
		if (this.readonly) return;
		const self = this;
		const isEdit = (dev !== null);

		const curMac = isEdit ? dev.mac : '';
		const curHostname = isEdit ? (dev.hostname || _('Not detected')) : '';
		const curIp = isEdit ? (dev.ipv4 || dev.ipv6 || _('Unavailable')) : '';
		const curName = isEdit ? (dev.customName || '') : '';
		const curRemark = isEdit ? (dev.remark || '') : '';
		const curGroup = isEdit ? (dev.group || 'ungrouped') : 'ungrouped';

		const modalTitle = isEdit
			? _('Edit device')
			: _('Add device');

		let macInput = null;
		let macRow = null;

		if (!isEdit) {
			macInput = E('input', {
				'type': 'text',
				'class': 'cbi-input-text',
				'placeholder': _('e.g. AA:BB:CC:11:22:33'),
				'maxlength': 17,
				'style': 'width:100%;'
			});
			macRow = E('div', { 'class': 'cbi-value dm-form-wide' }, [
				E('label', { 'class': 'cbi-value-title' }, [
					_('MAC address'),
					E('span', { 'style': 'color:red;' }, [ ' *' ])
				]),
				E('div', { 'class': 'cbi-value-field' }, [
					macInput,
					E('div', { 'class': 'cbi-value-description' }, [ _('Hardware address; colon or hyphen separators are accepted') ])
				])
			]);
		}

		// Group dropdown options
		const groupSelect = E('select', { 'class': 'cbi-input-select', 'style': 'width:100%;' }, [
			E('option', { 'value': 'ungrouped' }, [ _('Ungrouped') ])
		]);
		for (let i = 0; i < this.groups.length; i++) {
			const g = this.groups[i];
			const opt = E('option', { 'value': g.id }, [ g.name ]);
			if (curGroup === g.id) opt.selected = true;
			groupSelect.appendChild(opt);
		}

		const curType = isEdit ? (dev.customType || 'auto') : 'auto';
		const typeSelect = E('select', { 'class': 'cbi-input-select', 'style': 'width:100%;' }, [
			E('option', { 'value': 'auto' }, [ _('Auto (detect by MAC)') ])
		]);
		for (const [ typeKey, typeObj ] of Object.entries(model.DEVICE_TYPES)) {
			const opt = E('option', { 'value': typeKey }, [ typeObj.label() ]);
			if (curType === typeKey) opt.selected = true;
			typeSelect.appendChild(opt);
		}

		const nameInput = E('input', {
			'type': 'text',
			'class': 'cbi-input-text',
			'value': curName,
			'placeholder': _('e.g. Living room TV, work computer'),
			'maxlength': 64,
			'style': 'width:100%;'
		});

		const remarkTextarea = E('textarea', {
			'class': 'cbi-input-textarea',
			'rows': 3,
			'placeholder': _('e.g. Living room TV'),
			'maxlength': 256,
			'style': 'width:100%;'
		}, [ curRemark ]);

		const errorDiv = E('div', {
			'class': 'alert-message danger',
			'style': 'display:none; margin-bottom:15px;'
		});

		const formFields = isEdit ? [] : [ macRow ];

		formFields.push(
			E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title' }, [ _('Device type') ]),
				E('div', { 'class': 'cbi-value-field' }, [
					typeSelect,
					E('div', { 'class': 'cbi-value-description' }, [
						_('Automatically detected from names and MAC address, or customize manually')
					])
				])
			]),
			E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title' }, [ _('Device group') ]),
				E('div', { 'class': 'cbi-value-field' }, [
					groupSelect,
					E('div', { 'class': 'cbi-value-description' }, [ _('Organize this device by purpose or location') ])
				])
			]),
			E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title' }, [ _('Custom name') ]),
				E('div', { 'class': 'cbi-value-field' }, [
					nameInput,
					E('div', { 'class': 'cbi-value-description' }, [ _('Leave empty to display the default hostname') ])
				])
			]),
			E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title' }, [ _('Device remarks') ]),
				E('div', { 'class': 'cbi-value-field' }, [
					remarkTextarea,
					E('div', { 'class': 'cbi-value-description' }, [ _('Record the location, purpose or owner of this device') ])
				])
			])
		);

		const btnCancel = E('button', { 'type': 'button',
			'class': 'btn cbi-button',
			'click': ui.hideModal
		}, [ _('Cancel') ]);

		const btnSave = E('button', { 'type': 'button',
			'class': 'btn cbi-button cbi-button-action important dm-primary-button',
			'click': function(ev) {
				const button = ev.currentTarget;
				const targetMac = isEdit ? curMac : (macInput ? macInput.value : '');
				const normMac = model.normalizeMac(targetMac);

				if (!normMac) {
					errorDiv.textContent = _('Enter a valid MAC address (e.g. AA:BB:CC:11:22:33)');
					errorDiv.style.display = 'block';
					if (macInput) macInput.focus();
					return;
				}

				errorDiv.style.display = 'none';
				const newName = model.sanitizeInput(nameInput.value);
				const newRemark = model.sanitizeInput(remarkTextarea.value);
				const newGroup = groupSelect.value || 'ungrouped';
				const newType = typeSelect.value || 'auto';

				button.classList.add('spinning');
				button.disabled = true;

				return self.handleSaveDevice(normMac, newName, newRemark, newGroup, dev, newType)
					.then(function() {
						ui.hideModal();
						ui.addNotification(null, E('p', [ _('Device "%s" saved.').format(newName || normMac) ]), 'info');
						return self.refresh();
					})
					.catch(function(err) {
						errorDiv.textContent = _('Save failed: %s').format(err.message || err);
						errorDiv.style.display = 'block';
					})
					.finally(function() {
						button.classList.remove('spinning');
						button.disabled = false;
					});
			}
		}, [ _('Save') ]);

		const buttonRow = [];

		if (isEdit && dev.isSaved) {
			const btnDelete = E('button', { 'type': 'button',
				'class': 'btn cbi-button cbi-button-remove dm-clear-record',
				'click': function() {
					ui.hideModal();
					self.confirmDelete(dev);
				}
			}, [ _('Clear record') ]);
			buttonRow.push(btnDelete);
		}
		buttonRow.push(E('div', { 'class': 'right dm-dialog-buttons' }, [ btnCancel, btnSave ]));

		const content = [ closeButton(), errorDiv ];
		if (isEdit) content.push(deviceHero(dev), infoGrid([
			[ _('MAC address'), curMac ], [ _('System hostname'), curHostname ],
			[ _('Current IP address'), curIp ], [ _('Current status'), statusLabel(dev.status) ]
		]));
		content.push(E('div', { 'class': 'dm-edit-fields' }, formFields),
			E('div', { 'class': 'dm-dialog-footer' }, buttonRow));
		ui.showModal(modalTitle, [ E('div', { 'class': 'dm-dialog' }, content) ], 'dm-device-modal');
	},

	confirmDelete: function(dev) {
		if (this.readonly) return;
		const self = this;
		const name = dev.customName || dev.hostname || dev.mac;

		ui.showModal(_('Clear record'), [ E('div', { 'class': 'dm-dialog' }, [
			closeButton(),
			deviceHero(dev),
			E('p', { 'class': 'dm-clear-description' }, [ _('Clear the saved record for "%s" (%s)?').format(name, dev.mac) ]),
			E('p', { 'class': 'dm-dialog-muted' }, [ _('Clears the custom name, remarks, group and device type. The device remains discoverable on the network.') ]),
			E('div', { 'class': 'right dm-dialog-footer dm-dialog-buttons' }, [
				E('button', { 'type': 'button', 'class': 'btn cbi-button', 'click': ui.hideModal }, [ _('Cancel') ]),
				' ',
				E('button', { 'type': 'button',
					'class': 'btn cbi-button cbi-button-remove',
					'click': function(ev) {
						const button = ev.currentTarget;
						button.classList.add('spinning');
						button.disabled = true;

						return self.handleDeleteDevice(dev)
							.then(function() {
								ui.hideModal();
								ui.addNotification(null, E('p', [ _('Saved record for "%s" cleared.').format(name) ]), 'info');
								return self.refresh();
							})
							.catch(function(err) {
								ui.hideModal();
								ui.addNotification(null, E('p', [ _('Clear failed: %s').format(err.message || err) ]), 'danger');
							}).finally(function() {
							button.classList.remove('spinning');
							button.disabled = false;
						});
					}
				}, [ _('Confirm clear') ])
			])
		]) ], 'dm-device-modal');
	},

	showDetailModal: function(dev) {
		const self = this;
		const addresses = key => (dev[key + 'Addresses'] || []).length
			? dev[key + 'Addresses'].join('\n') : dev[key];
		const pingStatus = E('strong', { 'class': 'dm-ping-status', 'role': 'status', 'aria-live': 'polite' }, [ _('Probing…') ]);
		const pingDetail = E('p', { 'class': 'dm-dialog-muted' });
		const pingOutput = E('pre', { 'class': 'dm-ping-output' });
		const pingLog = E('details', { 'class': 'dm-ping-log', 'style': 'display:none;' }, [
			E('summary', {}, [ _('Ping output') ]), pingOutput
		]);
		let pending = null;
		const runPing = () => {
			if (pending) return pending;
			pingButton.disabled = true;
			pingButton.classList.add('spinning');
			pingStatus.classList.remove('dm-ping-success');
			pingStatus.classList.remove('dm-ping-warning');
			pingStatus.textContent = _('Probing…');
			pingDetail.textContent = _('Sending one Ping from the router to this device.');
			pingLog.style.display = 'none';
			pending = Promise.resolve().then(() => self.handlePingDevice(dev)).then(reply => {
				pingStatus.textContent = reply.reachable ? _('Online · Ping replied') : _('No Ping reply');
				pingStatus.classList.add(reply.reachable ? 'dm-ping-success' : 'dm-ping-warning');
				pingDetail.textContent = _('Probe address: %s').format(reply.ip + (reply.interface ? ' (' + reply.interface + ')' : '')) +
					(reply.reachable ? '' : '\n' + _('No ICMP reply was received. The device may block Ping; this does not confirm it is offline.'));
				pingOutput.textContent = reply.output;
				pingLog.style.display = reply.output ? '' : 'none';
			}).catch(error => {
				pingStatus.textContent = _('Probe unavailable');
				pingStatus.classList.add('dm-ping-warning');
				pingDetail.textContent = error.message || String(error);
				pingOutput.textContent = error.output || '';
				pingLog.style.display = error.output ? '' : 'none';
			}).finally(() => {
				pending = null;
				pingButton.disabled = false;
				pingButton.classList.remove('spinning');
			});
			return pending;
		};
		const pingButton = E('button', { 'type': 'button', 'class': 'cbi-button cbi-button-action', 'click': runPing }, [ _('Ping again') ]);
		const sourceLabels = {
			'DHCP': _('DHCP'), 'Host hints': _('Host hints'), 'Wi-Fi': _('Wi-Fi'),
			'ARP': _('ARP'), 'Neighbor table': _('Neighbor table')
		};
		const neighbors = (dev.neighbors || []).map(neighbor => [ neighbor.ip, neighbor.dev, neighbor.state ].filter(Boolean).join(' · ')).join('\n');
		ui.showModal(_('Device details'), [ E('div', { 'class': 'dm-dialog' }, [
			closeButton(),
			deviceHero(dev),
			E('section', { 'class': 'dm-ping-card' }, [
				E('div', { 'class': 'dm-ping-heading' }, [ pingStatus, pingButton ]), pingDetail, pingLog
			]),
			infoGrid([
				[ _('MAC address'), dev.mac ], [ _('System hostname'), dev.hostname ],
				[ _('Custom name'), dev.customName ], [ _('Device group'), self.getGroupName(dev.group) ],
				[ _('IPv4 addresses'), addresses('ipv4') ], [ _('IPv6 addresses'), addresses('ipv6') ],
				[ _('Network interfaces'), (dev.interfaces || []).join(', ') ],
				[ _('Type detection'), dev.customType && dev.customType !== 'auto' ? _('Manual') : _('Automatic') ],
				[ _('Saved record'), dev.isSaved ? _('Yes') : _('No') ],
				[ _('Discovered on network'), dev.isDiscovered ? _('Yes') : _('No') ],
				[ _('Discovery sources'), (dev.discoverySources || []).map(source => sourceLabels[source] || source).join(', '), true ],
				[ _('Status evidence'), dev.statusDetail, true ],
				[ _('Neighbor records'), neighbors, true ], [ _('Device remarks'), dev.remark, true ]
			]),
			E('div', { 'class': 'right dm-dialog-footer dm-dialog-buttons' }, [
				E('button', { 'type': 'button', 'class': 'cbi-button', 'click': ui.hideModal }, [ _('Close') ])
			])
		]) ], 'dm-device-modal');
		return runPing();
	}
});
