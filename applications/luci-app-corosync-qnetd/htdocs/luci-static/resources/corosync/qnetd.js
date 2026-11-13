'use strict';
'require baseclass';
'require rpc';
'require ui';

const rpcStatus = rpc.declare({ object: 'luci.qnetd', method: 'status', expect: {} });
const rpcLogs = rpc.declare({ object: 'luci.qnetd', method: 'logs', expect: {} });
const rpcCaPem = rpc.declare({ object: 'luci.qnetd', method: 'ca-pem', expect: {} });
const rpcSetup = rpc.declare({ object: 'luci.qnetd', method: 'setup', params: [ 'address' ], expect: {} });
const rpcService = rpc.declare({ object: 'luci.qnetd', method: 'service', params: [ 'action', 'fingerprint', 'clients' ], expect: {} });
const rpcRotate = rpc.declare({ object: 'luci.qnetd', method: 'rotate', params: [ 'fingerprint', 'clients', 'allow_connected' ], expect: {} });
const rpcRollback = rpc.declare({ object: 'luci.qnetd', method: 'rollback', params: [ 'fingerprint', 'clients', 'allow_connected' ], expect: {} });
const rpcPurge = rpc.declare({ object: 'luci.qnetd', method: 'purge-rollback', params: [ 'fingerprint', 'clients' ], expect: {} });

function fail(result) {
	if (!result || result.success !== true)
		throw new Error(result?.error || _('The operation failed'));
	return result;
}

function fingerprint(status) {
	return status?.health?.fingerprint || '';
}

function clients(status) {
	const count = status?.health?.connected_clients;
	return Number.isSafeInteger(count) && count >= 0 ? count : null;
}

function badge(ok, yes, no) {
	return E('span', { 'class': ok ? 'label success' : 'label warning' }, ok ? yes : no);
}

function copyButton(text, label) {
	return E('button', {
		'class': 'btn cbi-button cbi-button-neutral',
		'click': ui.createHandlerFn(this, () => {
			if (navigator.clipboard?.writeText)
				return navigator.clipboard.writeText(text);
			const input = E('textarea', { 'style': 'position:fixed;left:-9999px' }, text);
			document.body.appendChild(input);
			input.select();
			document.execCommand('copy');
			input.remove();
		})
	}, label || _('Copy'));
}

function commandBox(text) {
	return E('div', { 'style': 'position:relative' }, [
		E('pre', { 'style': 'white-space:pre-wrap;overflow:auto' }, text),
		copyButton(text, _('Copy commands'))
	]);
}

function run(operation) {
	ui.showModal(_('Please wait…'), [ E('p', { 'class': 'spinning' }, _('Applying the requested operation…')) ]);
	return operation.then(result => {
		fail(result);
		ui.hideModal();
		ui.addNotification(null, E('p', _('Operation completed successfully.')), 'info');
		return result;
	}).catch(error => {
		ui.hideModal();
		ui.addNotification(null, E('p', error.message || String(error)), 'error');
		throw error;
	});
}

return baseclass.extend({
	status: rpcStatus,
	logs: rpcLogs,
	caPem: rpcCaPem,
	setup: address => rpcSetup(address),
	service: (action, status) => rpcService(action, fingerprint(status), clients(status)),
	rotate: (status, allow) => rpcRotate(fingerprint(status), clients(status), !!allow),
	rollback: (status, allow) => rpcRollback(fingerprint(status), clients(status), !!allow),
	purge: status => rpcPurge(fingerprint(status), clients(status)),
	fingerprint,
	clients,
	badge,
	copyButton,
	commandBox,
	run
});
