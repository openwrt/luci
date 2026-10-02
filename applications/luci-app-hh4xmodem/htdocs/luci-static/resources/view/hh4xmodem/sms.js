/*
 * sms.js - SMS inbox/sent viewer + compose for HH4xModem
 * Copyright (C) 2026 HH4xModem
 * Licensed under the Apache License, Version 2.0.
 */

'use strict';
'require rpc';
'require view';
'require ui';

if (!document.querySelector('link[href*="hh4xmodem.css"]')) {
	document.querySelector('head').appendChild(E('link', {
		'rel': 'stylesheet',
		'type': 'text/css',
		'href': L.resource('view/hh4xmodem/hh4xmodem.css') + '?_=' + Date.now()
	}));
}

const callSMSData = rpc.declare({
	object: 'hh4xmodem',
	method: 'get_sms_list',
	params: { key: 'inbox', page: 1 }
});

const callSendSMS = rpc.declare({
	object: 'hh4xmodem',
	method: 'send_sms',
	params: { phone: '', content: '' },
	reject: true
});

const callSingleSMS = rpc.declare({
	object: 'hh4xmodem',
	method: 'get_single_sms',
	params: { id: null }
});

const callDeleteSMS = rpc.declare({
	object: 'hh4xmodem',
	method: 'delete_sms',
	params: { id: null },
	reject: true
});

const callDeleteSMSBulk = rpc.declare({
	object: 'hh4xmodem',
	method: 'delete_sms_bulk',
	params: { ids: [] },
	reject: true
});

function formatDate(dateStr) {
	if (!dateStr) return '--';
	return dateStr;
}

function truncate(str, len) {
	if (!str) return '';
	if (str.length <= len) return str;
	return str.substring(0, len) + '...';
}

function createCard(title, content) {
	return E('div', { 'class': 'cbi-section hh4x-card' }, [
		E('div', { 'class': 'hh4x-card-header' }, [
			E('h3', { 'class': 'hh4x-card-title' }, [title])
		]),
		E('div', { 'class': 'hh4x-card-body' }, content)
	]);
}

function createInfoRow(label, value) {
	return E('div', { 'class': 'hh4x-info-row' }, [
		E('span', { 'class': 'hh4x-info-label' }, [label]),
		E('span', { 'class': 'hh4x-info-value' }, [value != null ? String(value) : '--'])
	]);
}

function createModalOverlay() {
	let overlay = E('div', { 'class': 'hh4x-modal-overlay', 'style': 'display:none;' });
	let modal = E('div', { 'class': 'hh4x-modal' }, [
		E('div', { 'class': 'hh4x-modal-header' }, [
			E('span', { 'class': 'hh4x-modal-title' }),
			E('button', {
				'class': 'hh4x-modal-close cbi-button',
				'click': function () { overlay.style.display = 'none'; }
			}, [_('Close')])
		]),
		E('div', { 'class': 'hh4x-modal-body' })
	]);
	overlay.appendChild(modal);
	overlay.addEventListener('click', function (e) {
		if (e.target === overlay) overlay.style.display = 'none';
	});
	return overlay;
}

let currentView = null;

function reloadSMSList() {
	if (currentView) {
		currentView.load().then(function (newData) {
			let newBody = currentView.render(newData);
			let container = document.querySelector('.hh4x-page');
			if (container && container.parentNode) {
				container.parentNode.replaceChild(newBody, container);
			}
		}).catch(function (err) {
			ui.addNotification(null, E('p', [_('Error loading SMS list: ') + String(err)]), 'error');
		});
	}
}

function showSMSModal(sms) {
	let overlay = document.getElementById('hh4x-sms-modal');
	if (!overlay) {
		overlay = createModalOverlay();
		overlay.id = 'hh4x-sms-modal';
		document.body.appendChild(overlay);
	}

	let sender = Array.isArray(sms.PhoneNumber) ? sms.PhoneNumber[0] : (sms.PhoneNumber || '--');
	let content = sms.SMSContent || _('(No content)');

	overlay.querySelector('.hh4x-modal-title').textContent = sender;
	overlay.querySelector('.hh4x-modal-body').innerHTML = '';

	let body = overlay.querySelector('.hh4x-modal-body');
	body.appendChild(E('div', { 'class': 'hh4x-modal-meta' }, [
		E('div', { 'class': 'hh4x-modal-info' }, [
			E('span', { 'class': 'hh4x-modal-label' }, [_('Number: ')]),
			E('span', { 'class': 'hh4x-modal-value' }, [sender])
		]),
		E('div', { 'class': 'hh4x-modal-info' }, [
			E('span', { 'class': 'hh4x-modal-label' }, [_('Date: ')]),
			E('span', { 'class': 'hh4x-modal-value' }, [formatDate(sms.SMSTime)])
		]),
		E('div', { 'class': 'hh4x-modal-info' }, [
			E('span', { 'class': 'hh4x-modal-label' }, [_('ID: ')]),
			E('span', { 'class': 'hh4x-modal-value' }, [String(sms.SMSId)])
		])
	]));
	body.appendChild(E('div', { 'class': 'hh4x-modal-content' }, [content]));

	let deleteBtn = E('button', {
		'class': 'cbi-button cbi-button-negative hh4x-delete-btn',
		'click': function (e) {
			e.stopPropagation();
			if (!confirm(_('Delete this message?'))) return;
			deleteBtn.disabled = true;
			deleteBtn.textContent = _('Deleting...');
			callDeleteSMS({ id: sms.SMSId }).then(function (result) {
				if (result && typeof result === 'object' && result.error == null) {
					overlay.style.display = 'none';
					reloadSMSList();
				} else {
					ui.addNotification(null, E('p', [_('Delete failed: ') + (result?.error || _('Unknown error'))]), 'error');
					deleteBtn.disabled = false;
					deleteBtn.textContent = _('Delete');
				}
			}).catch(function (err) {
				ui.addNotification(null, E('p', [_('Error: ') + String(err)]), 'error');
				deleteBtn.disabled = false;
				deleteBtn.textContent = _('Delete');
			});
		}
	}, [_('Delete')]);

	body.appendChild(E('div', { 'class': 'hh4x-modal-actions' }, [
		deleteBtn
	]));

	overlay.style.display = 'flex';
}

function showComposeModal() {
	let overlay = document.getElementById('hh4x-compose-modal');
	if (!overlay) {
		overlay = createModalOverlay();
		overlay.id = 'hh4x-compose-modal';
		document.body.appendChild(overlay);
	}

	overlay.querySelector('.hh4x-modal-title').textContent = _('Compose SMS');
	overlay.querySelector('.hh4x-modal-body').innerHTML = '';

	let body = overlay.querySelector('.hh4x-modal-body');
	let phoneInput = E('input', {
		'type': 'text',
		'class': 'cbi-input-text',
		'placeholder': _('Phone number'),
		'style': 'width:100%;box-sizing:border-box;margin-bottom:8px;',
		'id': 'compose-phone'
	});
	let msgInput = E('textarea', {
		'class': 'cbi-input-text',
		'placeholder': _('Message'),
		'style': 'width:100%;box-sizing:border-box;min-height:100px;resize:vertical;margin-bottom:8px;',
		'id': 'compose-msg'
	});
	let sendBtn = E('button', {
		'class': 'cbi-button cbi-button-action',
		'id': 'compose-send-btn',
		'style': 'width:100%;',
		'click': function () {
			let phone = document.getElementById('compose-phone').value.trim();
			let msg = document.getElementById('compose-msg').value.trim();
			if (!phone) { ui.addNotification(null, E('p', [_('Enter a phone number.')]), 'info'); return; }
			if (!msg) { ui.addNotification(null, E('p', [_('Enter a message.')]), 'info'); return; }
			sendBtn.disabled = true;
			sendBtn.textContent = _('Sending...');
			callSendSMS({ phone: phone, content: msg }).then(function (result) {
				if (result && typeof result === 'object' && result.error == null) {
					overlay.style.display = 'none';
					reloadSMSList();
				} else {
					ui.addNotification(null, E('p', [_('Send failed: ') + (result?.error || _('Unknown error'))]), 'error');
					sendBtn.disabled = false;
					sendBtn.textContent = _('Send');
				}
			}).catch(function (err) {
				ui.addNotification(null, E('p', [_('Send error: ') + String(err)]), 'error');
				sendBtn.disabled = false;
				sendBtn.textContent = _('Send');
			});
		}
	}, [_('Send')]);

	body.appendChild(phoneInput);
	body.appendChild(msgInput);
	body.appendChild(sendBtn);

	overlay.style.display = 'flex';
	document.getElementById('compose-phone').focus();
}

let smsViewState = { key: 'inbox', page: 1 };

let smsTabs = [
	{ key: 'inbox', label: _('Inbox') },
	{ key: 'send', label: _('Sent') }
];

return view.extend({
	handleSave: null,
	handleSaveApply: null,
	handleReset: null,

	load: function () {
		return callSMSData({ key: smsViewState.key, page: smsViewState.page });
	},

	render: function (data) {
		currentView = this;
		let smsResult = data || {};
		let smsList = smsResult.SMSList || [];
		let totalPages = smsResult.TotalPageCount || 1;

		let currentKey = smsViewState.key;
		let currentTab = smsTabs.find(function (t) { return t.key === currentKey; }) || smsTabs[0];
		let tabTitle = currentTab ? currentTab.label : _('SMS');

		let tabBar = E('div', { 'class': 'hh4x-sms-tabs' },
			smsTabs.map(function (t) {
				return E('button', {
					'class': 'hh4x-sms-tab cbi-button' + (t.key === currentKey ? ' hh4x-sms-tab-active cbi-button-action' : ' cbi-button-neutral'),
					'click': function () {
						if (smsViewState.key !== t.key) {
							smsViewState.key = t.key;
							smsViewState.page = 1;
							reloadSMSList();
						}
					}
				}, [t.label]);
			})
		);

		let body = E('div', { 'class': 'hh4x-page' }, [
			E('div', { 'class': 'hh4x-page-header' }, [
				tabBar,
				E('h2', { 'class': 'hh4x-page-title' }, [_('SMS - ' + tabTitle)]),
				E('p', { 'class': 'hh4x-page-desc' }, [
					currentKey === 'inbox' ? _('View received SMS messages.') : _('View sent SMS messages.')
				]),
			])
		]);

		let composeBtn = E('button', {
			'class': 'cbi-button cbi-button-action',
			'style': 'margin-bottom:16px;',
			'click': function () { showComposeModal(); }
		}, [_('Compose')]);
		body.appendChild(composeBtn);

		let toolbar = E('div', { 'class': 'hh4x-sms-toolbar' }, [
			E('label', { 'class': 'hh4x-sms-toolbar-label' }, [
				E('input', {
					'type': 'checkbox',
					'id': 'select-all-check',
					'change': function (e) {
						let cbs = document.querySelectorAll('.hh4x-sms-check');
						for (let j = 0; j < cbs.length; j++) cbs[j].checked = e.target.checked;
					}
				}),
				_(' Select All')
			]),
			E('button', {
				'class': 'cbi-button cbi-button-negative',
				'id': 'delete-selected-btn',
				'click': function (e) {
					e.stopPropagation();
					let checked = [];
					let cbs = document.querySelectorAll('.hh4x-sms-check:checked');
					for (let j = 0; j < cbs.length; j++) checked.push(parseInt(cbs[j].value));
					if (checked.length === 0) { ui.addNotification(null, E('p', [_('No messages selected.')]), 'info'); return; }
					if (!confirm(_('Delete ' + checked.length + ' selected message(s)?'))) return;
					let btn = document.getElementById('delete-selected-btn');
					btn.disabled = true;
					btn.textContent = _('Deleting...');
					callDeleteSMSBulk({ ids: checked }).then(function (result) {
						if (result && typeof result === 'object' && result.error == null) {
							reloadSMSList();
						} else {
							ui.addNotification(null, E('p', [_('Delete failed: ') + (result?.error || _('Unknown error'))]), 'error');
							btn.disabled = false;
							btn.textContent = _('Delete Selected');
						}
					}).catch(function (err) {
						ui.addNotification(null, E('p', [_('Delete error: ') + String(err)]), 'error');
						btn.disabled = false;
						btn.textContent = _('Delete Selected');
					});
				}
			}, [_('Delete Selected')])
		]);

		if (smsList.length === 0) {
			body.appendChild(createCard(_('Messages'), [
				E('p', { 'style': 'text-align:center;color:var(--text-color-medium);padding:2em 0;' }, [_('No messages in ' + smsViewState.key + '.')])
			]));
		} else {
			let rows = [];

			for (let i = 0; i < smsList.length; i++) {
				let sms = smsList[i];
				let sender = Array.isArray(sms.PhoneNumber) ? sms.PhoneNumber[0] : (sms.PhoneNumber || '--');
				let content = sms.SMSContent || '';

				let checkCell = E('div', { 'class': 'hh4x-sms-check-cell' }, [
					E('input', {
						'type': 'checkbox',
						'class': 'hh4x-sms-check',
						'value': sms.SMSId,
						'click': function (e) { e.stopPropagation(); }
					})
				]);

				let row = E('div', { 'class': 'hh4x-sms-row' }, [
					checkCell,
					E('div', { 'class': 'hh4x-sms-body' }, [
						E('div', { 'class': 'hh4x-sms-header' }, [
							E('span', { 'class': 'hh4x-sms-sender' }, [sender]),
							E('span', { 'class': 'hh4x-sms-date' }, [formatDate(sms.SMSTime)])
						]),
						E('div', { 'class': 'hh4x-sms-preview' }, [truncate(content, 100)]),
						E('div', { 'class': 'hh4x-sms-id' }, [
							E('span', {}, ['ID: ' + sms.SMSId])
						])
					])
				]);

				row.addEventListener('click', (function(smsData) {
					return function (e) {
						if (e.target.type !== 'checkbox') showSMSModal(smsData);
					};
				})(sms));

				rows.push(row);
			}

			body.appendChild(createCard(_('Messages (' + smsList.length + ')'), [
				toolbar,
				E('div', { 'class': 'hh4x-sms-list' }, rows)
			]));
		}

		return body;
	}
});
