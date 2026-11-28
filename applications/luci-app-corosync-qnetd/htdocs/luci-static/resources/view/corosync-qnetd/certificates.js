'use strict';
'require view';
'require ui';
'require corosync.qnetd as qnetd';
/* global qnetd */

function approval(title, message, status, connectedApproval) {
	return new Promise(resolve => {
		const expected = qnetd.fingerprint(status);
		const input = E('input', { 'class': 'cbi-input-text', 'style': 'width:100%', 'autocomplete': 'off', 'placeholder': expected });
		const connected = qnetd.clients(status);
		const checkbox = E('input', { 'type': 'checkbox' });
		ui.showModal(title, [
			E('p', message),
			connected ? E('div', { 'class': 'alert-message warning' }, _('%d client(s) are connected. This operation interrupts them.').format(connected)) : '',
			E('p', [ _('Enter the current CA fingerprint to confirm:'), E('br'), E('code', expected) ]),
			input,
			connected && connectedApproval ? E('label', [ checkbox, ' ', _('I accept disruption to the currently connected clients.') ]) : '',
			E('div', { 'class': 'right' }, [
				E('button', { 'class': 'btn', 'click': () => { ui.hideModal(); resolve(false); } }, _('Cancel')),
				' ',
				E('button', { 'class': 'btn cbi-button-negative important', 'click': () => {
					if (input.value.trim() !== expected) {
						input.setCustomValidity(_('Fingerprint does not match.'));
						input.reportValidity();
						return;
					}
					if (connected && connectedApproval && !checkbox.checked) {
						checkbox.setCustomValidity(_('Explicit disruption approval is required.'));
						checkbox.reportValidity();
						return;
					}
					ui.hideModal();
					resolve(true);
				} }, _('Confirm'))
			])
		]);
		input.focus();
	});
}

function certificateTable(status) {
	const rows = [
		[ _('Certificate authority'), status.ca?.available ? _('Available') : _('Missing'), status.ca?.not_before || '-', status.ca?.not_after || '-' ],
		[ _('QNetd server'), status.server_certificate?.available ? _('Available') : _('Missing'), status.server_certificate?.not_before || '-', status.server_certificate?.not_after || '-' ]
	];
	const table = E('table', { 'class': 'table' }, [ E('tr', { 'class': 'tr table-titles' }, [ _('Certificate'), _('State'), _('Valid from'), _('Valid until') ].map(v => E('th', { 'class': 'th' }, v))) ]);
	cbi_update_table(table, rows, E('em', _('No certificate information is available.')));
	return table;
}

return view.extend({
	load: () => Promise.all([ qnetd.status(), qnetd.caPem() ]),
	render(data) {
		const status = data[0];
		const ca = data[1];
		const buttons = [];

		if (!status.health?.initialized)
			buttons.push(E('a', { 'class': 'btn cbi-button cbi-button-action', 'href': L.url('admin/services/corosync-qnetd/setup') }, _('Open first-time setup')));
		else {
			buttons.push(E('button', { 'class': 'btn cbi-button cbi-button-negative', 'click': ui.createHandlerFn(this, async () => {
				if (await approval(_('Rotate certificate authority'), _('This creates a new CA and server certificate. Existing Proxmox clients must be enrolled again.'), status, true))
					return qnetd.run(qnetd.rotate(status, qnetd.clients(status) > 0)).then(() => location.reload());
			}) }, _('Rotate CA')));
			if (status.health?.rollback_available) {
				buttons.push(' ', E('button', { 'class': 'btn cbi-button cbi-button-negative', 'click': ui.createHandlerFn(this, async () => {
					if (await approval(_('Roll back certificate authority'), _('This swaps the active CA with the retained previous CA. Clients enrolled against the current CA will disconnect.'), status, true))
						return qnetd.run(qnetd.rollback(status, qnetd.clients(status) > 0)).then(() => location.reload());
				}) }, _('Roll back CA')));
				buttons.push(' ', E('button', { 'class': 'btn cbi-button cbi-button-negative', 'click': ui.createHandlerFn(this, async () => {
					if (await approval(_('Delete rollback CA'), _('Permanently delete the retained rollback certificate database.'), status, false))
						return qnetd.run(qnetd.purge(status)).then(() => location.reload());
				}) }, _('Delete rollback CA')));
			}
		}

		if (ca.available && ca.pem)
			buttons.unshift(E('button', { 'class': 'btn cbi-button cbi-button-neutral', 'click': () => {
				const url = URL.createObjectURL(new Blob([ ca.pem ], { type: 'application/x-pem-file' }));
				const link = E('a', { 'href': url, 'download': 'qnetd-cacert.crt' });
				link.click();
				URL.revokeObjectURL(url);
			} }, _('Download public CA')), ' ');

		return E('div', { 'class': 'cbi-map' }, [
			E('h2', _('Corosync QNetd certificates')),
			E('div', { 'class': 'cbi-map-descr' }, _('Inspect and maintain the local QNetd certificate authority. Private keys are never exposed through RPC or LuCI.')),
			E('div', { 'class': 'cbi-section' }, [
				E('h3', _('Certificate state')),
				E('p', [ E('strong', _('Current CA fingerprint: ')), E('code', qnetd.fingerprint(status) || _('not initialized')) ]),
				E('p', [ E('strong', _('Validation: ')), qnetd.badge(status.health?.ca_valid && status.health?.server_valid, _('Valid'), _('Invalid or unavailable')) ]),
				E('p', [ E('strong', _('Rollback copy: ')), status.health?.rollback_available ? _('Available') : _('Not available') ]),
				certificateTable(status)
			]),
			E('div', { 'class': 'cbi-section' }, [ E('h3', _('Maintenance')), E('div', buttons) ])
		]);
	},
	handleSaveApply: null, handleSave: null, handleReset: null
});
