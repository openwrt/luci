// Copyright 2022 Jo-Philipp Wich <jo@mein.io>
// Licensed to the public under the Apache License 2.0.

import { STATUS_NO_DATA, STATUS_PERMISSION_DENIED } from 'ubus';

let last_ubus_error;

const ubus_error_map = [
	200, 'OK',
	400, 'Invalid command',
	400, 'Invalid argument',
	404, 'Method not found',
	404, 'Not found',
	204, 'No data',
	403, 'Permission denied',
	504, 'Timeout',
	500, 'Not supported',
	500, 'Unknown error',
	503, 'Connection failed',
	500, 'Out of memory',
	400, 'Parse error',
	500, 'System error',
];

function ubus_call(object, method, args) {
	ubus.error(); // clear previous error

	let res = ubus.call(object, method, args);

	last_ubus_error = ubus.error(true);

	return res ?? !last_ubus_error;
}

function ubus_state_to_http(err) {
	let code = ubus_error_map[(err << 1) + 0] ?? 200;
	let msg  = ubus_error_map[(err << 1) + 1] ?? 'OK';

	http.status(code, msg);

	if (code != 204) {
		http.prepare_content('text/plain');
		http.write(msg);
	}
}

function uci_apply(rollback) {
	if (rollback) {
		const timeout = +(config?.apply?.rollback ?? 90) || 0;
		const success = ubus_call('uci', 'apply', {
			ubus_rpc_session: ctx.authsession,
			timeout: max(timeout, 90),
			rollback: true
		});

		if (success) {
			const token = dispatcher.randomid(16);

			ubus.call('session', 'set', {
				ubus_rpc_session: '00000000000000000000000000000000',
				values: {
					rollback: {
						token,
						session: ctx.authsession,
						timeout: time() + timeout
					}
				}
			});

			return token;
		}

		return null;
	}
	else {
		let changes = ubus_call('uci', 'changes', { ubus_rpc_session: ctx.authsession })?.changes;

		for (let config in changes)
			if (!ubus_call('uci', 'commit', { ubus_rpc_session: ctx.authsession, config }))
				return false;

		return ubus_call('uci', 'apply', {
			ubus_rpc_session: ctx.authsession,
			rollback: false
		});
	}
}

function uci_confirm(token) {
	const data = ubus.call('session', 'get', {
		ubus_rpc_session: '00000000000000000000000000000000',
		keys: [ 'rollback' ]
	})?.values?.rollback;

	if (type(data?.token) != 'string' || type(data?.session) != 'string' ||
	    type(data?.timeout) != 'int' || data.timeout < time()) {
		last_ubus_error = STATUS_NO_DATA;

		return false;
	}

	if (token != data.token) {
		last_ubus_error = STATUS_PERMISSION_DENIED;

		return false;
	}

	if (!ubus_call('uci', 'confirm', { ubus_rpc_session: data.session }))
		return false;

	ubus_call('session', 'set', {
		ubus_rpc_session: '00000000000000000000000000000000',
		values: { rollback: {} }
	});

	return true;
}


return {
	action_apply_rollback: function() {
		const token = uci_apply(true);

		if (token) {
			http.prepare_content('application/json; charset=UTF-8');
			http.write_json({ token });
		}
		else {
			ubus_state_to_http(last_ubus_error);
		}
	},

	action_apply_unchecked: function() {
		uci_apply(false);
		ubus_state_to_http(last_ubus_error);
	},

	action_confirm: function() {
		uci_confirm(http.formvalue('token'));
		ubus_state_to_http(last_ubus_error);
	},

	action_revert: function() {
		for (let config in ubus_call('uci', 'changes', { ubus_rpc_session: ctx.authsession })?.changes)
			if (!ubus_call('uci', 'revert', { ubus_rpc_session: ctx.authsession, config }))
				break;

		ubus_state_to_http(last_ubus_error);
	}
};
