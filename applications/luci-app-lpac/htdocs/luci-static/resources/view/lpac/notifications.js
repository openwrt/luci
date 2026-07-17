// SPDX-License-Identifier: Apache-2.0
/* global lpac */

'use strict';
'require view';
'require ui';
'require lpac';

const isReadonlyView = !L.hasViewPermission() || null;

function operationLabel(operation) {
	switch (operation) {
	case 'install':
		return _('Install');
	case 'enable':
		return _('Enable');
	case 'disable':
		return _('Disable');
	case 'delete':
		return _('Delete');
	default:
		return _('Unknown');
	}
}

return view.extend({
	load: function() {
		return L.resolveDefault(lpac.listNotifications(), null);
	},

	showRemoveModal: function(notification) {
		const seq = notification.seqNumber;

		ui.showModal(_('Remove notification'), [
			E('p', {}, [
				_('Remove notification sequence %s from the eUICC?').format(seq)
			]),
			E('p', { 'class': 'alert-message warning' }, [
				_('Removing an unprocessed notification permanently discards its eUICC record without contacting the provider. It does not undo the profile operation and may leave the provider state out of sync. Only continue if the notification was processed elsewhere or is no longer needed.')
			]),
			E('div', { 'class': 'right' }, [
				E('button', {
					'class': 'btn',
					'click': ui.hideModal
				}, [ _('Cancel') ]),
				' ',
				E('button', {
					'class': 'btn cbi-button-negative important',
					'click': ui.createHandlerFn(this, function() {
						ui.showModal(_('Removing notification'), [
							E('p', { 'class': 'spinning' }, [ _('Waiting for lpac…') ])
						]);

						return lpac.removeNotification(String(seq)).then(function(result) {
							if (!result || !result.success)
								throw new Error(lpac.errorMessage(result));

							ui.hideModal();
							window.location.reload();
						}).catch(function(error) {
							ui.hideModal();
							ui.addNotification(null, E('p', {}, [ error.message ]), 'error');
						});
					})
				}, [ _('Remove') ])
			])
		]);
	},

	render: function(result) {
		const notifications = lpac.dataOr(result, []);
		const hasSequenceZero = notifications.some(function(notification) {
			return notification.seqNumber === 0;
		});
		const table = E('table', { 'class': 'table' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th left' }, [ _('Sequence') ]),
				E('th', { 'class': 'th left' }, [ _('Operation') ]),
				E('th', { 'class': 'th left' }, [ _('ICCID') ]),
				E('th', { 'class': 'th left' }, [ _('Notification address') ]),
				E('th', { 'class': 'th right' }, [ _('Actions') ])
			])
		]);
		const rows = [];

		if (result && result.success) {
			notifications.forEach(function(notification) {
				rows.push([
					notification.seqNumber != null ? String(notification.seqNumber) : '-',
					operationLabel(notification.profileManagementOperation),
					notification.iccid || '-',
					notification.notificationAddress || '-',
					E('button', {
						'class': 'btn cbi-button-negative',
						'disabled': isReadonlyView || notification.seqNumber == null ||
							notification.seqNumber === 0 || null,
						'title': notification.seqNumber === 0
							? _('The packaged lpac cannot explicitly remove sequence 0 safely') : '',
						'click': ui.createHandlerFn(this, 'showRemoveModal', notification)
					}, [ _('Remove') ])
				]);
			}, this);
		}

		cbi_update_table(table, rows, E('em', {}, [
			result && result.success
				? _('No pending notifications found.')
				: _('Notification data is unavailable.')
		]));

		return E([
			E('h2', {}, [ _('eUICC notifications') ]),
			E('div', { 'class': 'cbi-map-descr' }, [
				_('Profile operations can create notifications that should normally be sent to the provider.')
			]),
			E('div', { 'class': 'alert-message warning' }, [
				_('Sending notifications is disabled because the packaged lpac does not securely verify RSP TLS certificates. Remove only discards the eUICC record; it does not contact the provider.')
			]),
			hasSequenceZero
				? E('div', { 'class': 'alert-message warning' }, [
					_('Notification sequence 0 is valid and remains visible, but explicit removal is disabled because the packaged lpac reports false success for that sequence.')
				])
				: E([]),
			(!result || !result.success)
				? E('div', { 'class': 'alert-message warning' }, [ lpac.errorMessage(result) ])
				: E([]),
			table,
			E('div', { 'class': 'cbi-page-actions' }, [
				E('button', {
					'class': 'btn cbi-button cbi-button-action',
					'click': ui.createHandlerFn(this, function() {
						window.location.reload();
					})
				}, [ _('Refresh') ])
			])
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
